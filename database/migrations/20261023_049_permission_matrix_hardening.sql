-- Permission Matrix hardening. Safe to run more than once.
-- The browser talks to the Render API; only service_role may execute
-- SECURITY DEFINER application functions or read the protected views.
insert into public.role_permissions(role_id,permission_key,allowed,updated_at)
select r.role_id,p.permission_key,
  case
    when r.role_id='admin' then true
    when p.permission_key='printManagementReport' then r.role_id in ('ceo','management')
    when p.permission_key in ('viewOperatingExpenses','editOperatingExpenses')
      then r.role_id in ('ceo','management','counter')
    else false
  end,now()
from public.app_roles r
cross join (values ('printManagementReport'),('viewOperatingExpenses'),('editOperatingExpenses')) p(permission_key)
on conflict(role_id,permission_key) do nothing;

-- The CEO could already print standard booking documents through the old UI;
-- retain that effective access once printReceipt is enforced in the UI.
update public.role_permissions set allowed=true,updated_at=now()
where role_id='ceo' and permission_key='printReceipt' and allowed=false;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end $$;

do $$
declare view_name text;
begin
  foreach view_name in array array[
    'v_booking_summary','v_daily_management_report',
    'v_financial_booking_summary','v_financial_outstanding'
  ] loop
    if to_regclass(format('public.%I',view_name)) is not null then
      execute format('alter view public.%I set (security_invoker=true)',view_name);
      execute format('revoke all on public.%I from public, anon, authenticated',view_name);
      execute format('grant select on public.%I to service_role',view_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
