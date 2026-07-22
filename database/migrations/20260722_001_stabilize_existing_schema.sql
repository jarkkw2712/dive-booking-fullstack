-- Safe to run more than once. This migration never deletes business data.
alter table if exists role_permissions
  add column if not exists updated_at timestamptz default now();

alter table if exists master_programs
  add column if not exists description text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists master_addons
  add column if not exists description text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists booking_programs
  add column if not exists price_reason_other text;

alter table if exists bookings
  add column if not exists cancelled_by text;

alter table if exists audit_logs
  add column if not exists before_json jsonb,
  add column if not exists actor_role text,
  add column if not exists entity_type text,
  add column if not exists entity_id text;

