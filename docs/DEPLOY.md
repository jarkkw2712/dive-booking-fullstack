# Deployment

## 1. Back up

Take a Supabase database backup and record the currently deployed Render and Vercel revisions. Do not export or copy the service-role key into this repository.

## 2. Supabase migration order

Run these files once, in order, with Supabase SQL Editor:

1. `database/migrations/20260722_001_stabilize_existing_schema.sql`
2. `database/migrations/20260722_002_financial_foundation.sql`
3. `database/migrations/20260722_003_financial_functions.sql`
4. `database/migrations/20260722_004_financial_permissions.sql`
5. `database/migrations/20260722_005_financial_reporting.sql`
6. `database/migrations/20260722_006_per_user_authentication.sql`
7. `database/migrations/20260723_007_park_accommodation.sql`
8. `database/migrations/20260723_008_program_accommodation_policy.sql`
9. `database/migrations/20260723_009_simplify_accommodation.sql`
10. `database/migrations/20260730_010_booking_draft_contact_deposit.sql`
11. `database/migrations/20260731_011_booking_dropdown_master_data.sql`
12. `database/migrations/20260731_012_flexible_booking_contact.sql`
13. `database/migrations/20260731_013_passenger_categories.sql`
14. `database/migrations/20260731_014_program_age_prices.sql`

The stabilization and table migrations are idempotent and do not delete existing records. Function/view migrations use `CREATE OR REPLACE`.
Migration 007 defaults existing passengers to no overnight stay and does not create revenue or financial entries.
Migration 008 adds program accommodation policies and tent-credit snapshots. Run both before deploying the matching backend.
Migration 009 simplifies the live workflow to editable Accommodation Master Data, two booking-owner choices, and a manual tent-credit field.
Migration 010 allows draft bookings without travel dates and adds contact email, deposit, receipt book, and manual receipt number fields. Run it before deploying the matching backend.
Migration 011 adds editable customer-source and transportation-method masters, connects payment methods to Booking, and stores the selected transportation method. Run it before deploying the matching backend.
Migration 012 changes the Booking contact field to preserve flexible LINE, Facebook, email, or other contact text without lowercasing it.
Migration 013 stores adult, child, infant, and FOC passenger categories while preserving existing passengers as adults.
Migration 014 adds separate adult, child, and infant Program Master prices. Existing program prices remain the adult price and initialize the other categories safely.
Migration 015 adds comprehensive audit context and makes audit history append-only. Run it after migration 014 and before deploying the matching backend/frontend.
Migration 016 adds booking credit/payment-method snapshots, per-passenger nationality/pickup/transport charges, and transportation Master Data prices. Run it after migration 015 before deploying version 2026.08.08-1.
Migration 017 adds separate boat-ticket book and serial references. Run it after migration 016 before deploying version 2026.08.08-2.
Migration 018 exposes the immutable booking creation timestamp for Excel exports. Run it after migration 017 before deploying version 2026.08.12-1.
Migration 019 records the authenticated Booking creator once and backfills historical creators from the earliest available audit entry. Run it after migration 018 before deploying version 2026.08.12-4.

## 3. Render

Configure these environment variables in Render:

- `PORT`
- `FRONTEND_ORIGIN`: comma-separated exact Vercel/local origins
- `FRONTEND_PUBLIC_URL`: public HTTPS Vercel URL used in password-reset links
- `PILOT_AUTH_MODE=shared_password`
- `JWT_SECRET`: newly rotated, long random value
- `DEMO_PASSWORD`: strong pilot-only password
- `SUPABASE_URL`: project root URL, without `/rest/v1`
- `SUPABASE_SERVICE_ROLE_KEY`: Render secret only
- Optional LINE variables
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` for password-reset email
- `RESEND_API_KEY`, `EMAIL_FROM`: preferred HTTPS email provider. When `RESEND_API_KEY` exists the backend uses Resend; otherwise it falls back to the SMTP variables above. `EMAIL_FROM` must be a sender/domain verified in Resend.

Redeploy the backend and verify `GET /api/health`. Never place `SUPABASE_SERVICE_ROLE_KEY` in Vercel or frontend files.

Before staff launch, open User Management and set a unique email and temporary password for every active user. Each employee is forced to replace the temporary password at first login. Keep `DEMO_PASSWORD` only during this migration window, then remove it after every active account has a password hash.

## 4. Vercel

Deploy `frontend/` after the backend and migrations are ready. Verify login, booking create/update/cancel, Booking List, Print Center, Smart Paste, permission visibility, and Financial search.

## 5. Financial smoke workflow

Use a non-production test booking: issue an invoice, receive a deposit, verify it, issue a receipt, receive a partial payment, confirm outstanding, request/approve/pay a refund, and verify the timeline. Void/reverse test documents rather than deleting them.

## 6. Audit and anti-corruption operations

Grant `viewAudit` only to the owner, CEO, or independent reviewer. Review failed actions, permission changes, user resets, Master Data price changes, and financial events routinely. Restrict Supabase and Render owner access with MFA, rotate service-role/JWT secrets, and keep independent database backups. Application-level immutability cannot protect against a compromised Supabase project owner, so separation of duties and off-platform backups remain required.

