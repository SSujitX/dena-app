# AGENTS Guide for `dena-app`

This file is the first-stop context for any LLM agent working in this repository.

## Project Purpose

`dena-app` is a React + Vite single-page app for tracking interval-based interest loans in Bengali.
It runs as:

- a web app in browser, and
- an Android app via Capacitor WebView wrapper.

There is no backend API. All business data is stored in browser/app `localStorage`.

## Tech Stack

- Frontend: React 19, Vite 8
- Native shell: Capacitor 8 (`@capacitor/core`, `@capacitor/android`)
- Native app lifecycle: `@capacitor/app` (Android back-button interception)
- Android background scheduler: `androidx.work:work-runtime` (WorkManager)
- Date input: `react-datepicker`
- Image handling: `react-image-crop`, `react-easy-crop`
- Image zoom/pan viewer: `react-zoom-pan-pinch`
- Linting: ESLint flat config
- CI: GitHub Actions builds signed Android release APK

## Canonical Runtime Flow

1. `index.html` loads `/src/main.jsx` (Noto Sans Bengali from Google Fonts).
2. `src/main.jsx` renders `<App />`.
3. `src/App.jsx` initializes loans via `recalculateActiveLoansToFixedSchedule().loans` (migrates `coveredDate`, fixes `nextPaymentDate`).
4. User actions (add/payment/delete/edit) call functions in `src/utils/loanManager.js`.
5. Optional proof image flow in add form:
   - pick from camera/gallery
   - optional crop (`DocumentCropModal`)
   - compression (`src/utils/imageCompression.js`)
   - store compressed image metadata in loan record
6. `loanManager.js` mutates loan array and persists to `localStorage` key `denaLoans`.
7. UI re-renders from state updates in `App.jsx`.

## Repository Map

- `src/`
  - `main.jsx`: React entry
  - `App.jsx`: global state and modal orchestration
  - `components/`: UI modules (`Dashboard`, `LoanCard`, modals, `LiveClock`)
    - `LoanDetailsModal.jsx`: full loan details + proof image + JPG download
    - `DocumentCropModal.jsx`: free crop / skip-crop flow for proof image
  - `utils/loanManager.js`: core business and persistence logic (most critical file)
  - `services/notificationService.js`: Android kisti reminders (uses `getLoanDueState`)
  - `services/apkUpdate.js`: in-app APK update helper
  - `utils/imageCompression.js`: client-side proof image resizing/compression
  - `index.css`: full app styling
- `public/`: static assets (`icons.svg`)
- `android/`: Capacitor Android project (Gradle, resources, `MainActivity`)
  - `AutoBackupWorker.java`: periodic background backup worker
  - `BackupWorkScheduler.java`: enqueues unique periodic work
- `.github/workflows/build-android.yml`: Android CI build

## Domain Model (Current Data Contract)

Loan object (stored in `denaLoans` array):

- `id`: string
- `name`: string
- `startDate`: string (`YYYY-MM-DD`)
- `principal`: number
- `interestPerInstallment`: number (per kisti munafa amount; legacy records may still have `interestPerWeek` until normalized on read)
- `proofImage`: optional object
  - `dataUrl`: compressed image payload
  - `mimeType`: stored image MIME type (currently `image/webp`)
  - `width`: compressed width
  - `height`: compressed height
  - `originalName`: original picked filename
- `status`: `"ACTIVE"` or `"DONE"`
- `nextPaymentDate`: ISO datetime string
- `payments`: array of payment entries

Settings and UI state values (stored separately):

- `denaProfitIntervalDays`: number (default `7`)
- `denaProfitPreset`: object `{ principal, interest }` (default `5000 -> 500`)
- `denaAutoBackupConfig`: object `{ enabled, intervalDays }` (default `enabled: false`, `intervalDays: 1`)
- `denaLastAutoBackupAt`: ISO datetime string
- `denaLastManualBackupAt`: ISO datetime string
- `denaFirstRunSettingsShown`: `"1"` after first-run settings auto-open is shown
- `denaDashboardFilters`: object `{ activeTab, selectedYear, selectedMonth }`
- `denaAutoBackupSnapshot`: web-only local auto-backup JSON snapshot (used instead of auto file download)
- `denaLastUpdateCheckAt`: last auto update-check timestamp
- `denaCurrentAppVersion`: cached installed app version for update UI

Payment entry:

- `date`: ISO datetime string (Dhaka calendar day when user picks date in modal)
- `amount`: number
- `type`: `"INTEREST"` or `"SETTLEMENT"`
- `coveredDate`: optional ISO datetime — which fixed kisti slot this joma closed (stored on new jomas; migrated for old records)

## Fixed Kisti Schedule (Critical — Read First)

All due dates are computed from a **fixed calendar grid** anchored to `startDate` + global `denaProfitIntervalDays` (7/8/10/15/30…).

- Slot *n* due date = `startDate + n × intervalDays` (slot 1 is first munafa due, not start day).
- **Late payment does not shift the grid.** Missing a due date leaves that slot unpaid.
- **1 munafa joma = 1 kisti slot**, always the **oldest unpaid** slot first (by payment count order, not by payment date chosen in UI).
- UI labels use **কিস্তি** (not সপ্তাহ) because interval is configurable days.

Key exports in `loanManager.js`:

- `getLoanDueState(loan)` → `{ nextPaymentDate, upcomingPaymentDate, missedCycles, missedDueDates, paidCycles }`
- `getMissedDueCycleDates(loan)` → unpaid slots whose due date is today or past (oldest first)
- `getInterestPaymentCoveredDate(loan, payment)` → prefers stored `payment.coveredDate`
- `recalculateActiveLoansToFixedSchedule()` → migrates `coveredDate`, reconciles `nextPaymentDate` cache
- `calculateDaysLeft(iso)` → day diff using **Asia/Dhaka** calendar days

`nextPaymentDate` on the loan object is a **cache** updated on payment/interval change. Cards and modals should prefer `getLoanDueState()` for display.

### Reference test case (7-day interval)

- Start **২০/৫/২০২৬**, interval **7** → dues: ২৭/৫, ৩/৬, ১০/৬, ১৭/৬…
- **1 joma on ১১/৬ (৭০০ ৳)** covers **২৭/৫** (oldest unpaid).
- Expected UI:
  - **বাকি কিস্তি (২):** ৩/৬, ১০/৬
  - **এখন জমা হবে:** ৩/৬
  - **নতুন পরবর্তী কিস্তি:** ১৭/৬
  - **সম্পন্ন কিস্তি:** ২৭/৫
  - **বাকি status:** overdue from current due (৩/৬), not from completed slot

After **3 total jomas** (covering ২৭/৫, ৩/৬, ১০/৬), **পরবর্তী কিস্তি** must be **১৭/৬** — never jump back to ২৭/৫.

## Business Rules Implemented

- New loan:
  - `status = ACTIVE`
  - `nextPaymentDate = startDate + 1 × interval` (slot 1)
  - `payments = []`
- Interest collection (`collectPayment`):
  - appends `INTEREST` with `coveredDate` = slot `(paidCount + 1)`
  - recomputes `nextPaymentDate` = slot `(paidCount + 1)` after append (i.e. next unpaid slot)
  - payment **date** field is when money was received; it does **not** pick which slot is covered
- Interval update from Settings:
  - saves `denaProfitIntervalDays` (1–365, default 7)
  - recalculates all `ACTIVE` loans' `nextPaymentDate` from fixed grid
  - does **not** rewrite stored `coveredDate` on old payments (historical record preserved)
- Full settlement:
  - appends `SETTLEMENT`, sets `status = DONE`
  - does not require all missed kisti to be collected first (by design)
- Dashboard summary:
  - active principal from `ACTIVE` loans
  - all-time interest from `INTEREST` payments
  - monthly interest filtered by **Dhaka** year/month of payment date
- App open / debug:
  - `recalculateActiveLoansToFixedSchedule()` runs on init and via Settings → ডিবাগ → **পরবর্তী কিস্তির তারিখ ঠিক করুন**

## UI and Interaction Notes

- No route system (`react-router` not used).
- Single-screen app with modal overlays.
- Bengali locale display (`bn-BD`) with **`Asia/Dhaka`** for schedule math and date labels (not device timezone).
- Font: **Noto Sans Bengali** (`index.html` + `src/index.css`); tuned minimum sizes for small labels.
- Terminology: **কিস্তি** (installment on fixed grid), **বাকি কিস্তি**, **সম্পন্ন কিস্তি**, **প্রতি কিস্তির মুনাফা** — avoid সপ্তাহ/সাপ্তাহিক in UI.
- `LiveClock` uses `Asia/Dhaka`.
- `AddLoanForm` normalizes start date to Dhaka `YYYY-MM-DD`; **edit mode** does not auto-overwrite custom munafa from preset.
- `PaymentModal` receives **live loan** from `loans.find(loanId)` (not a stale snapshot).
- `LoanCard` color-coded sections: gray start, green last joma / সম্পন্ন কিস্তি, red বাকি কিস্তি, blue পরবর্তী কিস্তি, orange/green বাকি status.
- Loan card action buttons use responsive grid; Bengali `word-break: keep-all` on buttons.
- `App.jsx` `calendarDay` tick (60s + visibility/resume) refreshes overdue counts when the day changes.
- Loan cards are tappable and open `LoanDetailsModal`.
- Proof image upload is optional and never blocks loan creation.
- Proof download from details modal is exported as JPG (client-side conversion).
- On native Android, back swipe/button now closes open overlays first (details > delete > payment > add-loan), then exits only if no overlay is open.
- Proof download in details modal now performs direct file save (no share sheet) to `Documents/Dena/`.
- Both details modal and add-loan image preview support full-screen image viewer with pinch zoom, pan, double-tap zoom, and reset controls.
- Settled (`DONE`) loan cards intentionally show only delete action (no close/settle action).
- Loan cards and summary stat cards have status-based glow styles and animated lighting sweep.
- Mobile tap/press feedback is tuned to stay clipped inside rounded corners and avoid full-card false press feedback when tapping action buttons.
- Settings is a dedicated responsive modal (opened from footer-area settings button).
- On fresh install / fresh app-data state, Settings modal auto-opens once (first-run guidance).
- Settings includes:
  - Auto Munafa settings (principal -> munafa rule + munafa interval days, saved together)
  - Auto Backup settings (instant toggle on/off, custom interval days)
  - Manual Backup
  - Restore (native Android option lists backup files from `Documents/Dena` directly)
  - App Update (GitHub latest release check + in-app APK download progress + install handoff)
  - Toggleable notification test options
- Manual Backup card shows last manual backup time for transparency.
- Restore uses in-app confirmation modal (not browser native `confirm`) for consistent responsive UI.
- Settings cards now use centered section titles above each card (homepage-style underline).
- App update checks are throttled by local timestamp (~12 hours) and can be triggered manually from Settings.
- Loan details header is mobile-optimized: title left, close button pinned top-right, edit button on a separate row.
- Footer copyright year now auto-renders as dynamic Bengali range (`২০২৬`, `২০২৬–২০২৭`, `২০২৬–২০২৮`, ...).
- Bangla wording is standardized around `মুনাফা` (replacing legacy `লাভ` copy).
- Modal close (`×`) controls are visually unified with the highlighted close-button style used in loan details.
- Heavy modal flows are lazy-loaded:
  - `AddLoanForm`
  - `LoanDetailsModal`
  - `DocumentCropModal`
  - shared zoom viewer modal

## Recent Change Log (2026-06)

- **Fixed kisti schedule:** dues from `startDate + n×interval`; late pay does not drift grid; `computeNextPaymentDateForLoan` uses `paidCycles + 1` slot directly.
- **Bangladesh timezone:** all schedule/day-diff math via `Asia/Dhaka` (`toBangladeshYmd`, `bangladeshYmdToDate`).
- **`coveredDate` on payments:** persisted per joma; migration in `recalculateActiveLoansToFixedSchedule`; UI shows **✓ সম্পন্ন কিস্তি**.
- **কিস্তি wording** across `LoanCard`, `PaymentModal`, `LoanDetailsModal`, `AddLoanForm`.
- **UI polish:** section color stripes, cleaner joma block layout, Noto Sans Bengali, mobile button fit.
- **`interestPerInstallment`:** canonical field; `getLoanInterestAmount()` reads legacy `interestPerWeek` on load and normalizes on save.
- **`getLoans()`:** try/catch + `normalizeLoan()` for corrupt JSON safety.
- **Notifications:** `buildLoanNotifications` uses `getLoanDueState()` for due date, not stale `loan.nextPaymentDate` alone.
- **DONE loans:** details modal hides **পরবর্তী কিস্তি**.
- **Dashboard filters:** full `{ activeTab, selectedYear, selectedMonth }` persisted to `denaDashboardFilters` (restore still resets month/year to current — known quirk).
- **Android version:** `versionName 3.8`, `versionCode 28` (check `android/app/build.gradle` for current).

## Recent Change Log (2026-04)

- Added Android-native back-button handling through `@capacitor/app`.
- Added direct JPG proof save path `Documents/Dena/<loan>-proof-<timestamp>.jpg` for native platform.
- Added image viewer modal interactions in:
  - `src/components/LoanDetailsModal.jsx`
  - `src/components/AddLoanForm.jsx`
- Updated loan-card action behavior:
  - `ACTIVE`: interest + settle + delete
  - `DONE`: delete only
- Added enhanced visual system:
  - active vs done edge highlights on cards
  - animated sweep/light pass on loan cards
  - highlighted summary stat cards
  - unified touch press states for rounded buttons/tabs
- Added loan edit action from details modal (`LoanDetailsModal` -> `AddLoanForm` in edit mode).
- Added responsive Settings modal with:
  - Backup (`dena_YYYY-MM-DD_backup.json`)
  - Restore
  - Configurable profit interval days
  - Notification test panel (moved from logo-tap easter egg)
- Added immediate active-loan due-date recalculation when profit interval changes.
- Refined loan details modal header controls:
  - close icon stays top-right with highlighted border/background
  - edit button has separate responsive row for small screens
- Added auto-updating Bengali footer year range (base year ২০২৬).
- Added editable Auto Munafa preset (`principal -> interest`) and connected it to Add/Edit loan auto-calculation.
- Auto Munafa save now also applies interval-day changes to active loans immediately.
- Added first-run-only Settings modal auto-open via `denaFirstRunSettingsShown`.
- Added richer Settings feedback: highlighted saved-status text for Auto Munafa values.
- Added Auto Backup configuration:
  - instant toggle save (no extra save button for on/off)
  - custom day interval
  - last auto-backup timestamp display
  - periodic due check and run while app is active
- Added Android WorkManager-based background backup flow:
  - schedules unique periodic worker from `MainActivity`
  - worker reads mirrored backup source/meta from app data
  - writes due backup files with timestamped names
  - keeps battery/RAM impact low via lightweight checks + early exits
- Auto backup/manual backup payload now includes full app state needed for practical restore:
  - loans (ACTIVE + DONE + payment history)
  - munafa settings
  - auto backup settings
  - manual backup timestamp
  - dashboard filter state
  - first-run shown flag
  - last auto-backup timestamp
- Backup and restore settings UI was split into distinct cards:
  - Auto Backup
  - Manual Backup
  - Restore
- Added native restore picker modal that reads `Documents/Dena/*.json` and restores on tap.
- Dashboard filters were lifted to App-level persisted state to allow backup/restore continuity.
- Unified close-icon styling across modals and image viewers.
- Optimized initial bundle by lazy-loading heavy modal/viewer code paths.
- Added in-app updater using GitHub latest release API:
  - current-version detection and local cache
  - update-available modal with release notes preview
  - APK download progress UI
  - install handoff via system share/open flow

## Commands

- `npm run dev`: start Vite dev server
- `npm run build`: production build to `dist`
- `npm run preview`: preview build
- `npm run lint`: ESLint
- `npm run android:release`: build + sync + signed release APK (local)

Android packaging flow (local):

1. Ensure signing files exist in `android/keystore/`
2. Run `npm run android:release`
3. Output: `android/app/build/outputs/apk/release/app-release.apk`

## CI Behavior

Workflow: `.github/workflows/build-android.yml` (`Android Signed Release Build`)

- Triggers on push to `main` and `master` (plus manual dispatch)
- Uses Node 22 + Java 21
- Builds web bundle, syncs Capacitor, validates signing files, builds `assembleRelease`
- APK filename format: `Dena-v<versionName>.apk`
- Artifact name format: `Dena-Android-v<versionName>-<versionCode>`
- New GitHub releases use the matching `## v<versionName>` section from `CHANGELOG.md` as release notes

## Known Limits and Remaining Quirks

- Tracks **one current due** + **বাকি কিস্তি** list/count; does not auto-sum total money owed across all missed slots.
- Joma **order** (count), not payment **date**, decides which kisti is covered.
- **Settlement** can mark DONE without collecting all missed munafa.
- **Legacy backup** (bare loans array without `profitIntervalDays`) may restore with wrong interval if current settings differ.
- **Restore** resets dashboard month/year to current even when backup contained other values.
- **Edit start date** on a loan with payments: stored `coveredDate` values stay, but future schedule recomputes from new anchor — use carefully.
- **No automated tests** yet for schedule math.
- App/package ID aligned to `com.dena.app`; Android test package still `com.getcapacitor.myapp`.
- Product title in UI: **হিসাব রক্ষক**; repo/package name: `dena-app`.

## Guardrails for Future Agents

- Do not introduce backend/API assumptions unless explicitly requested.
- Use only `dena...` keys for `localStorage`.
- Treat `src/utils/loanManager.js` as source of truth for business logic.
- Keep Bengali UX text and locale behavior unless user requests language changes.
- If changing loan schema, update `normalizeLoan`, create/read/update paths, backup/restore, and run migration in `recalculateActiveLoansToFixedSchedule`.
- Do not use সপ্তাহ in user-facing copy when interval ≠ 7; use **কিস্তি**.
- Default business timezone is **Asia/Dhaka** — do not ask for GPS/location permission for dates.
- After substantive edits, run `npm run lint` and `npm run build`.
- Do not commit unless the user explicitly asks.

## Suggested First Read Order for New Agents

1. `src/utils/loanManager.js` — fixed schedule, `getLoanDueState`, `coveredDate`
2. `src/App.jsx` — init migration, modals, filters, calendar day refresh
3. `src/components/LoanCard.jsx` + `PaymentModal.jsx` + `LoanDetailsModal.jsx`
4. `src/services/notificationService.js`
5. `src/components/Dashboard.jsx`
6. `src/components/AddLoanForm.jsx`
7. `src/components/NotificationDebugPanel.jsx` (schedule repair button)
8. `.github/workflows/build-android.yml`
9. `android/app/build.gradle`

## Where to Find Detailed Design Notes

Read `.agents/ARCHITECTURE.md` for deeper implementation details, extension guidance, and risk list.
