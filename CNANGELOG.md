# Changelog

## v3.8 (2026-06)

### হিসাব / Schedule
- **Fixed কিস্তি grid** — due dates from `startDate + n×interval`; late joma does not shift future dues
- Each munafa joma closes the **oldest unpaid কিস্তি**; `coveredDate` stored on payments (old data auto-migrated)
- All date math uses **Bangladesh time (Asia/Dhaka)** — consistent dues, missed count, and overdue days
- `পরবর্তী কিস্তি` no longer jumps back after multiple payments

### UI / Copy
- Wording updated to **কিস্তি** (বাকি কিস্তি, সম্পন্ন কিস্তি, প্রতি কিস্তির মুনাফা)
- **Noto Sans Bengali** font; clearer loan card sections (start / joma / বাকি / পরবর্তী)
- Settled loans hide **পরবর্তী কিস্তি** in details
- Settings & debug panel titles aligned and spaced better

### Fixes
- Notifications use live due state (`getLoanDueState`)
- Payment modal always shows current loan data
- Edit loan no longer overwrites custom munafa amount
- Legacy `interestPerWeek` → `interestPerInstallment` on load/save
- Corrupt `localStorage` no longer crashes app on open

### Android
- `versionCode` 28 · `versionName` 3.8
