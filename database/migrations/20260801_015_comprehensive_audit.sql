-- Comprehensive append-only audit metadata. No business or audit history is deleted.
alter table if exists audit_logs
  add column if not exists request_id uuid,
  add column if not exists actor_user_id uuid,
  add column if not exists actor_username text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists http_method text,
  add column if not exists request_path text,
  add column if not exists status_code integer,
  add column if not exists success boolean,
  add column if not exists metadata jsonb;

create index if not exists audit_logs_changed_at_idx on audit_logs(changed_at desc);
create index if not exists audit_logs_actor_idx on audit_logs(actor_username,changed_at desc);
create index if not exists audit_logs_action_idx on audit_logs(action,changed_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type,entity_id,changed_at desc);
create index if not exists audit_logs_request_idx on audit_logs(request_id);

create or replace function prevent_audit_history_change()
returns trigger language plpgsql as $$
begin
  raise exception 'Audit history is append-only and cannot be changed or deleted';
end $$;

drop trigger if exists audit_logs_immutable on audit_logs;
create trigger audit_logs_immutable before update or delete on audit_logs
for each row execute function prevent_audit_history_change();

-- Authentication and financial audit tables already have immutable triggers;
-- recreate the auth trigger defensively in case an older environment missed it.
drop trigger if exists auth_audit_logs_immutable on auth_audit_logs;
create trigger auth_audit_logs_immutable before update or delete on auth_audit_logs
for each row execute function prevent_audit_history_change();

revoke update,delete,truncate on audit_logs from anon,authenticated;
revoke update,delete,truncate on auth_audit_logs from anon,authenticated;
revoke update,delete,truncate on financial_events from anon,authenticated;
