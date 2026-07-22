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

The stabilization and table migrations are idempotent and do not delete existing records. Function/view migrations use `CREATE OR REPLACE`.

## 3. Render

Configure these environment variables in Render:

- `PORT`
- `FRONTEND_ORIGIN`: comma-separated exact Vercel/local origins
- `PILOT_AUTH_MODE=shared_password`
- `JWT_SECRET`: newly rotated, long random value
- `DEMO_PASSWORD`: strong pilot-only password
- `SUPABASE_URL`: project root URL, without `/rest/v1`
- `SUPABASE_SERVICE_ROLE_KEY`: Render secret only
- Optional LINE variables

Redeploy the backend and verify `GET /api/health`. Never place `SUPABASE_SERVICE_ROLE_KEY` in Vercel or frontend files.

## 4. Vercel

Deploy `frontend/` after the backend and migrations are ready. Verify login, booking create/update/cancel, Booking List, Print Center, Smart Paste, permission visibility, and Financial search.

## 5. Financial smoke workflow

Use a non-production test booking: issue an invoice, receive a deposit, verify it, issue a receipt, receive a partial payment, confirm outstanding, request/approve/pay a refund, and verify the timeline. Void/reverse test documents rather than deleting them.

