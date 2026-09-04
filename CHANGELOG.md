# Changelog

## 2026-09-03 - Group-level purchases and passenger travel

- Centralized Program controls, accommodation, Pre Add-ons, and Island Add-ons on the trip leader while retaining automatic adult/child/infant/FOC pricing.
- Added per-passenger outbound date, return date, transportation method, and destination sourced from Transportation Method Master Data.
- Added removal controls for Island Add-ons and safely consolidates historical passenger Add-ons onto the leader when editing.
- Enforced strict print-document line boundaries so Register excludes transport and equipment charges, while equipment, van, boat, and money documents only receive their intended line types.
- Positioned nationality immediately after each passenger surname and split the route into editable outbound/return dates and destinations, defaulting to the Booking dates.
- Added leader-to-passenger and Apply-to-all travel copying.
- Replaced prompt-based Island Add-ons with inline editable rows, deletion, payment selection, and per-document visibility stored with each Booking.
- Fixed Island Add-on printing so booking-level document selections take precedence over the shared `other` Master Data row and remain attached to the correct item after saving.
- Added a selectable monthly Dashboard chart with daily Booking bars, projected-revenue line, value labels, hover details, monthly totals, and a highlighted current day.
- Redesigned the CEO report as structured, paginated A4 landscape sheets for executive KPIs, daily outlook, operations, and seven-day revenue-table segments.
- Consolidated the CEO report to a maximum of two balanced A4 pages, summarizing long-range revenue by category instead of producing extra sheets.
- Restored daily columns in the CEO revenue-category matrix and placed equipment and park accommodation in two balanced boxes beneath it.
- Added revision-preserving daily operating expenses with CEO net-income reporting, current-day highlighting, and a permission-controlled Island Purchase Order with payment methods.
- Grouped CEO expense entry into boat, Thai/foreign adult/child, park tent, daily ice, and flexible other-cost sections with explicit quantity, unit price, and result columns.
- Expanded CEO daily reporting with adult, child, infant, foreign, FOC, and total passenger counts, plus Thai weekday date labels such as `ศ 4/9/26`.
- Auto-loads saved CEO expenses when opening the report or changing its date, prints itemized expense calculations, and shortens crowded date headings to prevent overlap.
- Changed Dashboard bars from Booking count to passenger count and expanded daily hover details with passenger categories, gross revenue, expenses, and net revenue.
- Kept every CEO expense category inside the primary daily matrix before expense totals and net revenue so A4 clipping cannot hide the breakdown.
- Always shows the seven standard CEO expense rows even when they are zero and identifies them by red styling without a repeated expense prefix.

## 2026-08-18 - Receipt totals and payment-account presentation

- Removed tent-refund credit from active booking totals, documents, reports, invoice generation, and the passenger editor while preserving historical database columns.
- Restored passenger food-allergy entry.
- Replaced competing document subtotals with Booking total, deposit, and net total, plus a money-receipt allocation matrix.
- Added cash/transfer classification and money-receipt visibility settings to Payment Method Master Data; Register exposes only the generic payment type.

## 2026-08-18 - A4 insurance summary correction

- Assigned every operational report to an A4 page and made the insurance submission A4 portrait.
- Reduced the insurance header to Adult, Child, and Total, deriving child status strictly from the `เด็กชาย` and `เด็กหญิง` titles.

## 2026-08-18 - Insurance submission report and document references

- Added a dedicated `printInsuranceReport` Permission Matrix key and a grouped insurance submission report with date, passenger-type totals, title totals, trip leaders, and passenger names.
- Removed receipt book/number references from printed documents and operational reports.
- Limited boat-ticket book/number display to the money receipt only.

## 2026-08-18 - Accommodation document visibility

- Added the five document-visibility checkboxes to Accommodation Master Data.
- Printed grouped accommodation arrangements only on selected documents and explicitly kept their value out of revenue totals.

## 2026-08-18 - Horizontal passenger summary

- Replaced the vertical passenger summary with a one-row matrix grouped by passenger type and Thai/foreign nationality.
- Added a computed total column and retained zero-value categories for consistent document reading.

## 2026-08-18 - Credit and transportation document rules

- Hid credit-sale details from Register while preserving them on the money receipt.
- Added the five document-visibility checkboxes to transportation methods, including van receipt control.
- Applied transportation visibility rules to Register and passenger-specific van receipt lines.

## 2026-08-18 - Per-document Add-on visibility

- Added five Master Data checkboxes that control whether each Add-on appears on Register, money receipt, equipment slip, van receipt, and boat ticket.
- Existing and new Add-ons default to hidden on Register, visible on money/equipment documents, and hidden on van/boat documents.
- Kept booking and travel information side by side in the compact A4 print layout.

## 2026-08-18 - A4 document layout and passenger-specific transport tickets

- Changed the Add Booking print action to Booking Confirmation (Register).
- Compacted all booking documents for A4 portrait printing and hid passenger-summary blocks where they are not required.
- Limited van receipts to passengers with transport purchases and grouped van and boat lines by passenger type and nationality.
- Standardized item order as program, transportation, equipment/services, then refund credit.

## 2026-08-18 - Five purpose-built booking documents

- Replaced the generic receipt variants with Register, money receipt, equipment slip, van receipt, and boat ticket profiles.
- Each document now enforces its own visibility rules for contact, trip, status, price, program, transport, equipment, notes, and allergy information.
- Added grouped passenger totals without individual passenger names, correct receipt references, audit print metadata, and signature areas.

## 2026-08-12 - Excel creator and Agent correction

- Replaced the Excel `ต้นฉบับ` value with the authenticated User who originally created the Booking.
- Added a separate Agent column; later Booking edits cannot overwrite the original creator.

## 2026-08-12 - Apply-all edited price fix

- Copy-from-leader actions now preserve the leader's currently edited Program price, quantity, and Add-ons instead of recalculating and overwriting the price from Master Data.

## 2026-08-12 - Large group booking workflow

- Added one-click copy of the leader Program/Add-on package to every passenger while preserving category pricing.
- Added CSV upload beside Booking Details with template download, quoted-field parsing, preview, validation, duplicate warnings, composition totals, and append/replace confirmation.

## 2026-08-12 - Excel booking export and receipt leader

- Added a UTF-8 Excel-compatible booking export for the selected Print Center date range using the requested operational columns.
- Exposed the original booking creation date without allowing it to be overwritten.
- Restored the trip-leader name in the receipt contact section while keeping passenger line items anonymous and grouped.

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

