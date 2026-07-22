-- Per-user authentication and password recovery. Safe to run repeatedly.
alter table if exists app_users
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_changed_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_users_email_unique_idx
  on app_users(lower(email)) where email is not null;

create table if not exists password_reset_tokens(
  reset_token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(user_id),
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip text,
  requested_user_agent text,
  created_at timestamptz not null default now(),
  constraint password_reset_expiry_after_create check(expires_at > created_at)
);

create index if not exists password_reset_tokens_user_idx
  on password_reset_tokens(user_id, created_at desc);

create table if not exists auth_audit_logs(
  auth_audit_id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(user_id),
  username_snapshot text,
  email_snapshot text,
  action text not null,
  success boolean not null,
  detail text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_logs_user_idx on auth_audit_logs(user_id, created_at desc);
create index if not exists auth_audit_logs_created_idx on auth_audit_logs(created_at desc);

create or replace function prevent_auth_audit_change()
returns trigger language plpgsql as $$ begin raise exception 'Authentication audit history is immutable'; end $$;
drop trigger if exists auth_audit_logs_immutable on auth_audit_logs;
create trigger auth_audit_logs_immutable before update or delete on auth_audit_logs
for each row execute function prevent_auth_audit_change();

create or replace function prevent_password_reset_token_change()
returns trigger language plpgsql as $$
begin
  if old.used_at is not null then raise exception 'Used password reset token is immutable'; end if;
  if new.user_id<>old.user_id or new.token_hash<>old.token_hash or new.expires_at<>old.expires_at or new.created_at<>old.created_at then
    raise exception 'Password reset token identity is immutable';
  end if;
  return new;
end $$;

drop trigger if exists password_reset_token_identity_immutable on password_reset_tokens;
create trigger password_reset_token_identity_immutable before update on password_reset_tokens
for each row execute function prevent_password_reset_token_change();

create or replace function consume_password_reset(p_token_hash text,p_password_hash text)
returns uuid language plpgsql as $$
declare v_token password_reset_tokens%rowtype;
begin
  select * into v_token from password_reset_tokens
  where token_hash=p_token_hash and used_at is null and expires_at>now() for update;
  if not found then raise exception 'Invalid or expired reset token'; end if;
  update app_users set password_hash=p_password_hash,must_change_password=false,password_changed_at=now(),failed_login_count=0,locked_until=null,updated_at=now() where user_id=v_token.user_id;
  update password_reset_tokens set used_at=now() where reset_token_id=v_token.reset_token_id;
  return v_token.user_id;
end $$;

revoke all on function consume_password_reset(text,text) from public, anon, authenticated;
grant execute on function consume_password_reset(text,text) to service_role;
