# Architecture and Implementation Notes

This document explains how `dena-app` works internally so engineers and coding agents can make safe changes.

## 1) High-Level Architecture

The app is a client-only React SPA with a local persistence layer.

- UI layer: React components under `src/components`
- Orchestration layer: `src/App.jsx`
- Domain/persistence layer: `src/utils/loanManager.js`
- Platform wrapper: Capacitor Android project under `android/`

No server, API, or database is currently part of the architecture.

## 2) Startup and Data Hydration

- Browser loads `index.html`, then `src/main.jsx`.
- `main.jsx` mounts `<App />` in React StrictMode.
- `App.jsx` initializes `loans` from `recalculateActiveLoansToFixedSchedule().loans`:
  - reads `getLoans()` (with try/catch — corrupt JSON returns `[]`)
  - normalizes each loan (`interestPerInstallment`, drops legacy `interestPerWeek` on save)
  - backfills missing `payment.coveredDate` on interest payments
  - reconciles `nextPaymentDate` on ACTIVE loans to fixed-grid formula
- `dashboardFilters` loaded from `denaDashboardFilters` (tab + month + year).
- `calendarDay` state refreshes every 60s and on app resume so overdue/missed counts update after midnight without a payment action.

## 3) State Ownership and Component Boundaries

`App.jsx` owns global app state:

- `loans`: all loan records
- `isSettingsOpen`: settings modal visibility
- `isSettingsTestOpen`: settings test panel visibility
- `profitIntervalDraft`: editable profit interval value in settings
- `updateInfo` / `isUpdateModalOpen`: in-app updater state from GitHub releases
- `isNativeRestorePickerOpen`: native restore file-picker modal (`Documents/Dena`)
- `isAddingLoan`: controls add modal visibility
- `activePaymentModal`: `{ show, loanId, isSettle }` — modal resolves live loan via `loans.find(id)`
- `activeDeleteModal`: `{ show, loan }`
- `activeLoanDetailsId`: selected loan for full details modal

`Dashboard.jsx` owns display-only controls:

- active tab (`ACTIVE` or `DONE`)
- selected month and year for summary
- persisted in App state + `denaDashboardFilters` (full object on filter change)
- defaults to current month/year only when no saved filters exist

Pattern used:

- `App` passes callbacks into child components.
- Child components request actions; only `App` writes to state.
- All writes eventually flow through `loanManager.js`.

## 4) Domain Logic in `loanManager.js`

### Storage keys

- `denaLoans` — loan array
- `denaProfitIntervalDays` — global kisti interval in days (default `7`, range `1..365`)
- `denaProfitPreset`, `denaAutoBackupConfig`, `denaDashboardFilters`, etc. (see `AGENTS.md`)

### Timezone helpers

All schedule boundaries use **`Asia/Dhaka`**:

- `toBangladeshYmd(value)` → `YYYY-MM-DD`
- `bangladeshYmdToDate(ymd)` → UTC+6 midnight anchor
- `toStartOfDay(value)` → Dhaka start-of-day `Date`
- `calculateDaysLeft(iso)` → signed day diff vs today in Dhaka

Do **not** use device-local `new Date().getDate()` for due/missed logic.

### Fixed kisti grid

```text
slotIndex n  →  due = startDate + n × intervalDays   (n >= 1)
paidCycles   =  count of payments where type !== SETTLEMENT
next unpaid  =  slot (paidCycles + 1)
missed slots =  slots (paidCycles+1 .. today] on the grid
```

Rules:

- Late payment does **not** slide the grid.
- Each `INTEREST` payment covers exactly **one** slot: oldest unpaid at time of joma.
- `payment.date` = when money was received; `payment.coveredDate` = which slot was closed.

### `getLoanDueState(loan)` (primary UI API)

Returns:

| Field | Meaning |
|-------|---------|
| `nextPaymentDate` | Oldest unpaid slot (same as first missed, or next future slot if none missed) |
| `upcomingPaymentDate` | Next future slot on grid (used when missed list non-empty) |
| `missedDueDates` | All unpaid slots with due ≤ today |
| `missedCycles` | `missedDueDates.length` |
| `paidCycles` | interest payment count |

UI should call this instead of reading `loan.nextPaymentDate` alone.

### Loan create

- Input: `{ name, startDate, principal, interestPerInstallment, proofImage? }`
- `nextPaymentDate` = slot 1
- `status: ACTIVE`, `payments: []`

### Payment — `collectPayment(loanId, amount, isFullSettlement, paymentDate?)`

- Appends payment; for interest, sets `coveredDate` to slot `paidCycles + 1` **before** count increments
- Updates `nextPaymentDate` via `computeNextPaymentDateForLoan`
- Settlement → `status: DONE` (missed munafa may remain uncollected)

### Migration — `recalculateActiveLoansToFixedSchedule()`

Runs on app init and from debug panel. For each loan:

1. `withCoveredDates` — backfill `coveredDate` if missing
2. ACTIVE loans — fix `nextPaymentDate` if out of sync with grid

### Other helpers

- `getLoanInterestAmount(loan)` — `interestPerInstallment` with legacy `interestPerWeek` fallback
- `normalizeLoan` on read/save — canonical schema
- `getSummaryStats` — monthly bucket uses Dhaka month of payment date
- `getInterestPaymentCoveredDate` — prefers stored `coveredDate`

## 5) UI Modules and Responsibilities

- `Dashboard.jsx`
  - Computes/filter/sort for displayed loans
  - Renders summary cards and month/year selectors
  - Tabbed list: active vs done
- `LoanCard.jsx`
  - Uses `getLoanDueState`, `getLastInterestPayment`, `getInterestPaymentCoveredDate`
  - Sections: নেওয়া হয়েছে (gray), শেষ মুনাফা জমা + সম্পন্ন কিস্তি (green), বাকি কিস্তি (red), পরবর্তী কিস্তি (blue), বাকি status (orange/green)
  - Status “দিন জমা হয়নি” counts from **last সম্পন্ন কিস্তি** date, not current due
  - Actions: `ACTIVE` → munafa + settle + delete; `DONE` → delete only
- `LoanDetailsModal.jsx`
  - Shows full loan details and payment history via `getLoanDueState` / `getInterestPaymentCoveredDate`
  - Hides **পরবর্তী কিস্তি** when `status === DONE`
  - Shows optional proof image
  - Supports proof download as JPG
  - Native save target is `Documents/Dena/` (no share sheet flow)
  - Includes full-screen image viewer with pinch zoom/pan/reset
  - Includes edit action button that opens add form in edit mode
  - Header uses responsive two-row layout: title left, close button fixed top-right, edit button below
- `AddLoanForm.jsx`
  - Captures new loan fields; field **প্রতি কিস্তিতে মুনাফা**
  - Auto-suggests munafa from `calculateInterestFromPreset` on **create** only (edit mode preserves custom amount)
  - Converts chosen date into Dhaka `YYYY-MM-DD` before save
  - Supports optional proof image from camera/gallery
  - Opens `DocumentCropModal` before final save
  - Includes full-screen zoomable preview for uploaded/cropped proof image
- `PaymentModal.jsx`
  - Munafa joma vs full settlement; shows বাকি কিস্তি list, এখন জমা হবে, পরবর্তী কিস্তি
  - Payment date picker defaults to today (Dhaka); backdating allowed
- `DeleteModal.jsx`
  - Dangerous action confirmation
- `DocumentCropModal.jsx`
  - Free-form corner-resize crop UI
  - Allows "use without crop" option
- `LiveClock.jsx`
  - 1-second ticking Bengali date/time for `Asia/Dhaka`
- `NotificationDebugPanel.jsx`
  - Rendered inside Settings modal test section (not logo-tap trigger)
  - **পরবর্তী কিস্তির তারিখ ঠিক করুন** runs `recalculateActiveLoansToFixedSchedule()`
- `App.jsx` (updater + restore extensions)
  - checks latest GitHub release (`/releases/latest`)
  - compares with installed app version and opens update modal when newer
  - downloads APK with in-app progress UI
  - hands off install via system share/open dialog
  - provides native restore list from `Documents/Dena/*.json`

## 6) Timezone and Date Behavior

**Single rule:** business calendar = **`Asia/Dhaka`**.

| Data | Format |
|------|--------|
| `loan.startDate` | `YYYY-MM-DD` string |
| `payment.date`, `payment.coveredDate`, `nextPaymentDate` | ISO (anchored to Dhaka midnight via `+06:00` helpers) |
| UI date labels | `toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka' })` |
| LiveClock, payment modal YMD | Dhaka |
| Missed/overdue/day-left math | Dhaka via `loanManager` helpers |

We do **not** use GPS or device timezone for kisti logic. Default is Bangladesh.

Test around **Dhaka midnight** when changing date code.

## 7) Styling System

- Main style file: `src/index.css`
- Contains:
  - design tokens
  - layout utilities
  - modal styles
  - responsive behavior
  - `react-datepicker` overrides
  - crop modal / proof image styles
  - small-device button safeguards (including `<=360px` compact button sizing)

Footer behavior:

- Footer year text is computed in `App.jsx` from base year `2026` to current year.
- Display uses Bengali digits and range format (for example `২০২৬` or `২০২৬–২০২৮`).

## 8) Android Wrapper and Build Chain

Important files:

- `capacitor.config.json` (`webDir: dist`, `appId: com.dena.app`)
- `android/app/build.gradle` (`applicationId: com.dena.app`)
- `android/app/src/main/java/com/dena/app/MainActivity.java`
- `android/app/src/main/AndroidManifest.xml`

Build logic:

- Build web assets into `dist`
- Sync Capacitor assets/plugins into Android project
- Compile APK via Gradle

Android interaction behavior:

- `@capacitor/app` back-button listener is registered in `App.jsx`.
- Back priority closes overlays in this order:
  1. loan details modal
  2. delete modal
  3. native restore file-picker modal
  4. update modal
  5. payment modal
  6. add-loan modal
  7. settings modal
  8. restore confirmation modal
- Only when no modal is open, app falls back to navigation/back exit flow.

CI automation:

- `.github/workflows/build-android.yml` builds signed release APK and uploads artifact `Dena-Android-v<versionName>-<versionCode>`.

## 9) External Dependencies and Integrations

- Google Fonts from `fonts.googleapis.com` and `fonts.gstatic.com`
- Capacitor native runtime
- Capacitor App plugin (`@capacitor/app`) for native back button events
- `react-image-crop` for document-proof cropping UX
- `react-easy-crop` (installed dependency for image handling stack)
- `react-zoom-pan-pinch` for touch-first full-screen image viewing
- No remote API integrations in current code
- GitHub Releases API integration for in-app update checks:
  - `https://api.github.com/repos/onelifeproject/dena-app/releases/latest`
- Optional Google Services plugin in Gradle if `google-services.json` exists

## 10) Testing and Quality Status

- JavaScript/React tests are not configured.
- Root `package.json` has no `test` script.
- Only default Android template tests exist.
- ESLint is active and should be run on edits.

## 11) Current Risks / Technical Debt

- No automated tests for fixed-grid schedule (manual reference case in `AGENTS.md`)
- Legacy bare-array backup restore may apply wrong `profitIntervalDays`
- Restore flow overwrites restored dashboard month/year with current date
- Settlement without clearing missed munafa
- Editing `startDate` after payments: `coveredDate` frozen but future slots recompute
- Android test package `com.getcapacitor.myapp` vs app id `com.dena.app`
- Random ID generation without collision guard
- `getLoans()` recovers from corrupt JSON (returns `[]`) but does not repair partial corruption

### Git note (2026-06)

If `refs/heads/master` becomes all zeros after a crash, repair by pointing master to `origin/master` and `git reset --mixed`. Dangling commits may exist on `recovery-local-work`.

## 12) Safe Change Checklist

When modifying behavior:

1. Update logic in `loanManager.js` first; extend `recalculateActiveLoansToFixedSchedule` if schema changes.
2. Verify `getLoanDueState` + reference test case in `AGENTS.md` (start ২০/৫, interval 7, joma scenarios).
3. Confirm `LoanCard`, `PaymentModal`, `LoanDetailsModal`, notifications stay consistent.
4. Use Dhaka timezone helpers — never mix device-local midnight for dues.
5. Run `npm run lint` and `npm run build`.
6. If native-impacting, `npx cap sync android`.

When changing loan schema:

1. Add backward-compatible reads for old records.
2. Keep old records functional (or provide migration logic).
3. Validate summary calculations still match expectations.

## 13) Recommended Next Improvements

- Add unit tests for fixed-grid schedule (`getLoanDueState`, multiple jomas, missed cycles).
- Fix restore to honor backed-up `profitIntervalDays` and dashboard month/year.
- Warn on settlement when missed kisti remain.
- Align package/app IDs and branding (`Dena` vs Bengali product label).
- Replace template `README.md` with real project docs.
- Add missing favicon asset or remove references.

## 14) Recent Logic and UX Updates (2026-06)

- Fixed kisti schedule engine and `getLoanDueState` API
- `coveredDate` persistence on munafa payments + migration
- Bangladesh timezone throughout `loanManager` and date display
- কিস্তি-based Bengali copy; Noto Sans Bengali font
- Loan card color sections and compact mobile buttons
- `interestPerInstallment` schema with legacy normalization
- Notifications tied to `getLoanDueState`
- Payment modal uses live `loanId` lookup
- Debug: **পরবর্তী কিস্তির তারিখ ঠিক করুন** in `NotificationDebugPanel`

## 15) Recent UX/Styling Updates (2026-04)

- Added status-specific glow and animated sweep effects for loan cards.
- Added highlighted summary stat cards (principal/profit emphasis).
- Refined mobile tap behavior so rounded buttons and tabs keep press effects clipped inside shape.
- Reduced mobile false-hover artifacts on touch devices (coarse pointer media queries).
- Added responsive Settings modal and custom restore confirm modal.
- Added centered section titles above Settings cards (homepage-style underline).
- Added native restore picker modal for `Documents/Dena` backup files.
- Added in-app updater modal with release-note preview, APK download progress, and install handoff.
- Added visible inline update-check status text inside Settings (mobile-friendly feedback).
- Added responsive safeguards for small-device buttons (including settings/test panels).
- Updated loan details modal header responsiveness and close icon highlight styling.
- Added dynamic Bengali footer copyright year range.
