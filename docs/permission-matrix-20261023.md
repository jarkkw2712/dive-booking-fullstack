# Permission Matrix and Smart Paste rollout (2026-10-23)

## Behavior

- Smart Paste row 1 is the trip leader. Later rows fill or create guests. Re-pasting four unique names produces four passengers, not five. The existing leader's price, travel and add-on details remain intact while their name is replaced.
- The Matrix shows active permissions grouped by workflow. `manageOperatingExpenses` and `systemAdmin` are legacy keys and are no longer editable there.
- Counter can view and edit daily operating expenses. `viewOperatingExpenses` controls reading; `editOperatingExpenses` controls saving. Each save remains a new revision with an audit event.
- The CEO report uses `printManagementReport`, separate from ordinary `printDailyReport`. Admin always has all permissions.
- Booking documents, boat tickets, dive receipts and island purchase orders use their respective print permissions in the UI. The server enforces report and data permissions. Browser-generated booking documents are not a substitute for server-side document authorization if stricter print controls are later needed.
- Render API reloads role permissions from the database on every authenticated request. Changing a user's role invalidates their old session; other permission edits take effect on the API immediately. Staff should reload the page to update menus.
- Users without `viewMoney` receive redacted money fields in booking/master-data/financial read APIs. Users without `viewBankReference` receive redacted bank and payment-reference fields.

## Deployment order

1. Apply `database/migrations/20261023_049_permission_matrix_hardening.sql` to the production Supabase project under migration name `20261023_049_permission_matrix_hardening`. It adds three permission keys, keeps existing permission choices, and restricts direct access to privileged functions/views to `service_role`. No booking or financial history is deleted.
2. Deploy the matching Render backend and Vercel frontend from the same commit.
3. Reload the app; confirm Counter sees **ค่าใช้จ่าย**, can save a test revision, and cannot open the CEO report unless explicitly granted. Confirm CEO/management can open the CEO report. Test Smart Paste with four names in a draft and verify the preview has exactly four people before saving.
4. Run the local automated suite: `npm.cmd test --prefix backend` and `npm.cmd run check --prefix backend`.

## Rollback

- Roll back application code together. Do **not** re-grant `anon`/`authenticated` access to `SECURITY DEFINER` booking functions or protected views; that would reopen direct data access.
- The new permission rows are harmless with older code. If necessary, temporarily re-enable the old UI's `manageOperatingExpenses` role values while rolling back; do not delete the new rows or any expense revisions.
- If a user's menu is stale after changing Matrix values, reload the page or sign in again. API permissions are already current.
