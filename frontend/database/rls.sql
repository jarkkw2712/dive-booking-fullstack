-- =========================================================
-- Supabase RLS Draft
-- IMPORTANT:
-- This is a starting point. Enable after auth_user_id is linked to auth.users.id.
-- =========================================================

alter table app_users enable row level security;
alter table bookings enable row level security;
alter table passengers enable row level security;
alter table booking_programs enable row level security;
alter table booking_addons enable row level security;
alter table payments enable row level security;
alter table receipts enable row level security;
alter table audit_logs enable row level security;

create or replace function current_app_role()
returns text as $$
  select role_id
  from app_users
  where auth_user_id = auth.uid()
    and active_flag = true
  limit 1;
$$ language sql stable security definer;

create or replace function has_permission(permission text)
returns boolean as $$
  select coalesce(rp.allowed, false)
  from role_permissions rp
  where rp.role_id = current_app_role()
    and rp.permission_key = permission
  limit 1;
$$ language sql stable security definer;

-- Bookings read: operational roles can read bookings
create policy "bookings_select_authenticated"
on bookings for select
to authenticated
using (
  current_app_role() in ('admin', 'counter', 'island_staff', 'boat_crew', 'management')
);

create policy "bookings_insert_create_booking"
on bookings for insert
to authenticated
with check (has_permission('createBooking'));

create policy "bookings_update_edit_booking"
on bookings for update
to authenticated
using (has_permission('editBooking') or has_permission('addIslandAddOn'))
with check (has_permission('editBooking') or has_permission('addIslandAddOn'));

-- Master data admin only
create policy "master_programs_admin_all"
on master_programs for all
to authenticated
using (has_permission('editMasterData'))
with check (has_permission('editMasterData'));

create policy "master_addons_admin_all"
on master_addons for all
to authenticated
using (has_permission('editMasterData'))
with check (has_permission('editMasterData'));

-- Audit logs read permission
create policy "audit_logs_select_view_audit"
on audit_logs for select
to authenticated
using (has_permission('viewAudit'));

create policy "audit_logs_insert_authenticated"
on audit_logs for insert
to authenticated
with check (auth.uid() is not null);
