# Changelog

## Unreleased — Stabilization and Financial Foundation

- Repaired Thai text encoding in the active HTML and the legacy master-data module.
- Fixed Smart Paste newline/number parsing and added deterministic malformed-input handling.
- Added phone/name duplicate detection, create-to-edit protection, report status correction, permission-aware navigation, and missing legacy DataService adapters.
- Consolidated duplicate legacy master-data functions.
- Added idempotent schema stabilization migrations.
- Added invoices, immutable invoice item snapshots, payments, allocations, receipts, refunds, financial events, server-side numbering, and outstanding reporting.
- Added backend financial permissions, validation, rate limiting, audit events, Financial frontend workspace, and smoke tests.
- Removed example secrets and insecure production authentication fallbacks.

