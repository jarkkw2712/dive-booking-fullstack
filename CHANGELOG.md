# Changelog

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

