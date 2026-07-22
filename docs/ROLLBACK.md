# Rollback

Financial history must not be hard-deleted during rollback.

1. Disable Financial navigation by setting all non-admin financial permissions to false.
2. Roll Vercel back to the preceding frontend deployment.
3. Roll Render back to the preceding backend deployment.
4. Leave financial tables and events in Supabase intact for audit and recovery.
5. If a PostgreSQL function causes a problem, restore only that function from the prior database backup or replace it with a corrected migration. Do not drop invoice, payment, receipt, refund, allocation, or event tables.
6. Restore the full database backup only for a confirmed database-wide incident and only after preserving post-backup financial records for reconciliation.

The schema migrations intentionally have no destructive automatic down migration.
