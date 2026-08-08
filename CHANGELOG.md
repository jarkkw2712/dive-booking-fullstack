# Changelog

## 2026-08-08 - Separate boat-ticket references

- Added `เล่มที่ (ตั๋วเรือ)` and `เลขที่ (ตั๋วเรือ)` without replacing the existing receipt book/number.
- Boat-ticket references are searchable and appear in booking details, receipts, and counter reports.

## 2026-08-08 - Credit, passenger logistics and management range reporting

- Added deposit and credit-sale amounts with a required payment method for each.
- Added Thai/foreign nationality, pickup location, transportation method, and transportation charge per passenger.
- Transportation prices are editable in Master Data and copied as an editable booking snapshot.
- Receipts group passengers by age/nationality and group equipment and transportation lines without showing passenger names.
- Print Center supports daily, weekly, monthly, and custom ranges with a date-column management income matrix.

## 2026-08-01 - Comprehensive anti-corruption audit trail

- Added an immutable, searchable Audit Log covering data mutations, authentication, users, permissions, Master Data, company settings, and financial events.
- Records actor, role, timestamp, request ID, IP, endpoint, result, and sanitized before/after values without passwords, tokens, or secrets.
- Added database protections against update, delete, and truncate of audit history.

## 2026-08-01 - Frontend deployment visibility

- Added asset cache-busting and a visible application version so staff can verify that the latest Program price UI is deployed.

## 2026-07-31 - Program prices by passenger category

- Program Master Data now stores separate adult, child, and infant prices; FOC remains zero.
- New passenger placeholders receive the matching category price automatically.
- Changing a passenger category, changing a program, or copying the leader package reapplies the correct category default.
- Existing Booking program prices remain immutable snapshots when Master Data prices change later.

## 2026-07-31 - Passenger composition

- Replaced the manual passenger-count action with automatic Adult, Child, Infant, and FOC composition fields.
- Total passengers is a read-only sum of every category.
- Passenger placeholders are created automatically and may be saved without names for later completion.
- Passenger cards, receipts, and operational reports show the passenger category; FOC program price defaults to zero.

## 2026-07-31 - Flexible booking contact

- Renamed the Booking email field to `ติดต่อได้จาก`.
- Accepts LINE ID, Facebook name, email, or any other contact text without email-format validation or forced lowercasing.

## 2026-07-31 - Master-driven booking dropdowns and navigation

- Added editable Customer Source and Transportation Method Master Data.
- Booking customer source, transportation method, and payment method dropdowns now load active Master Data.
- Added private car, van, and coach transportation defaults.
- New Booking now clears all prior form, passenger, document, and edit state.
- Booking List provides a direct return-to-editor action without starting a new booking.

## 2026-07-30 - Draft booking and deposit details

- Added contact email, deposit, receipt book, and manual receipt number to bookings, lists, receipts, and counter reports.
- Booking can be saved with only the group leader name and phone; travel dates and passenger details may be completed later.
- Added an idempotent migration that makes the booking travel date optional without deleting booking or financial history.
- Kept Print Center focused on date-required daily reports and moved flexible document search to Booking List.
- Booking List search supports outbound/return date, booking and receipt references, customer/passenger name, phone, email, source, and agent.
- Renamed the customer document from Voucher to Booking Confirmation.

## 2026-07-23 - Simplified accommodation entry

- Added editable Accommodation Master Data.
- Reduced passenger accommodation entry to accommodation, booking owner, and manual tent credit.
- Moved accommodation entry directly after Program Tour.
- Kept existing accommodation history and financial refund auditability.

## 2026-07-23 - Program accommodation rules

- One Day Trip now defaults to no overnight stay.
- Overnight programs require an accommodation decision.
- Boat Ticket allows approximate outbound/return dates and an undecided stay that can be edited later.
- Program Master Data controls the self-booked tent credit per passenger.
- Customer-arranged accommodation reduces booking and invoice totals through a snapshotted discount; overpayments use the existing auditable refund workflow.
- Operations and management reports include park stays, tent credits, and equipment issue totals.

## Unreleased — Stabilization and Financial Foundation

- Repaired Thai text encoding in the active HTML and the legacy master-data module.
- Fixed Smart Paste newline/number parsing and added deterministic malformed-input handling.
- Added phone/name duplicate detection, create-to-edit protection, report status correction, permission-aware navigation, and missing legacy DataService adapters.
- Consolidated duplicate legacy master-data functions.
- Added idempotent schema stabilization migrations.
- Added invoices, immutable invoice item snapshots, payments, allocations, receipts, refunds, financial events, server-side numbering, and outstanding reporting.
- Added backend financial permissions, validation, rate limiting, audit events, Financial frontend workspace, and smoke tests.
- Removed example secrets and insecure production authentication fallbacks.
- Added per-user salted password hashes, forced temporary-password changes, lockout, authentication audit, and expiring one-time password-reset emails over SMTP.
- Added Resend HTTPS email delivery as the primary password-reset provider while preserving SMTP as the automatic no-key fallback.

