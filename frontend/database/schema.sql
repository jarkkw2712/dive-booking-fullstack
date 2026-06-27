-- =========================================================
-- Dive Booking System - Phase 2 Database Schema
-- Target: PostgreSQL / Supabase
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1) USERS / ROLES / PERMISSIONS
-- =========================================================

create table if not exists app_roles (
  role_id text primary key,
  role_name text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists app_users (
  user_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique, -- Supabase auth.users.id, nullable during migration
  username text unique not null,
  display_name text not null,
  role_id text not null references app_roles(role_id),
  active_flag boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists role_permissions (
  role_id text not null references app_roles(role_id),
  permission_key text not null,
  allowed boolean not null default false,
  updated_at timestamptz default now(),
  primary key (role_id, permission_key)
);

-- =========================================================
-- 2) MASTER DATA
-- =========================================================

create table if not exists master_programs (
  program_id text primary key,
  program_name text not null,
  default_price numeric(12,2) not null default 0,
  active_flag boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_addons (
  addon_id text primary key,
  addon_name text not null,
  default_price numeric(12,2) not null default 0,
  active_flag boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- 3) BOOKING CORE
-- =========================================================

create table if not exists bookings (
  booking_id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,

  trip_type text not null check (trip_type in ('one_way', 'round_trip')),
  travel_date date not null,
  return_date date,

  leader_title text,
  leader_first_name text not null,
  leader_last_name text not null,
  phone text,

  source text,
  agent_name text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'checked-in', 'completed', 'cancelled')),

  payment_method text check (payment_method in ('เงินสด', 'โอนผ่านธนาคาร')),

  booking_note text,

  total_amount numeric(12,2) not null default 0,
  program_revenue numeric(12,2) not null default 0,
  pre_addon_revenue numeric(12,2) not null default 0,
  island_addon_revenue numeric(12,2) not null default 0,

  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references app_users(user_id),

  created_by uuid references app_users(user_id),
  updated_by uuid references app_users(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint return_date_required_for_round_trip
    check (
      (trip_type = 'one_way' and return_date is null)
      or
      (trip_type = 'round_trip' and return_date is not null)
    )
);

create index if not exists idx_bookings_travel_date on bookings(travel_date);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_source on bookings(source);

-- =========================================================
-- 4) PASSENGERS
-- =========================================================

create table if not exists passengers (
  passenger_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(booking_id) on delete restrict,

  passenger_no int not null,
  is_leader boolean not null default false,

  title text,
  first_name text not null,
  last_name text not null,
  age int,
  phone text,

  island text check (island in ('', 'อ่าวไม้งาม', 'อ่าวช่องขาด')),

  food_allergy text,
  medical_note text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (booking_id, passenger_no)
);

create index if not exists idx_passengers_booking_id on passengers(booking_id);
create index if not exists idx_passengers_name on passengers(first_name, last_name);

-- Guard against same passenger name duplicated in checked-in bookings on same travel_date
-- Implemented as a trigger because it needs to check booking status/date.

create or replace function validate_duplicate_checkedin_passenger()
returns trigger as $$
declare
  v_travel_date date;
  v_status text;
  v_duplicate_count int;
begin
  select travel_date, status
  into v_travel_date, v_status
  from bookings
  where booking_id = new.booking_id;

  if v_status = 'checked-in' then
    select count(*)
    into v_duplicate_count
    from passengers p
    join bookings b on b.booking_id = p.booking_id
    where b.travel_date = v_travel_date
      and b.status = 'checked-in'
      and lower(trim(coalesce(p.title,'') || ' ' || p.first_name || ' ' || p.last_name))
          = lower(trim(coalesce(new.title,'') || ' ' || new.first_name || ' ' || new.last_name))
      and p.passenger_id <> coalesce(new.passenger_id, gen_random_uuid());

    if v_duplicate_count > 0 then
      raise exception 'Duplicate passenger found on checked-in booking for same travel date: % % %',
        coalesce(new.title,''), new.first_name, new.last_name;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_duplicate_checkedin_passenger on passengers;
create trigger trg_validate_duplicate_checkedin_passenger
before insert or update on passengers
for each row execute function validate_duplicate_checkedin_passenger();

-- =========================================================
-- 5) PROGRAM PER PASSENGER
-- =========================================================

create table if not exists booking_programs (
  booking_program_id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null unique references passengers(passenger_id) on delete restrict,
  program_id text not null references master_programs(program_id),

  qty int not null default 1 check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  default_price numeric(12,2) not null default 0,

  price_reason text,
  price_reason_other text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- 6) ADD-ONS
-- =========================================================

create table if not exists booking_addons (
  addon_row_id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references passengers(passenger_id) on delete restrict,

  addon_source text not null check (addon_source in ('pre', 'island')),
  addon_id text not null references master_addons(addon_id),
  addon_name_snapshot text not null,

  qty int not null default 1 check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  default_price numeric(12,2) not null default 0,

  price_reason text,
  price_reason_other text,

  payment_method text check (payment_method in ('เงินสด', 'โอนผ่านธนาคาร')),
  received_by uuid references app_users(user_id),

  created_by uuid references app_users(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_booking_addons_passenger_id on booking_addons(passenger_id);
create index if not exists idx_booking_addons_source on booking_addons(addon_source);

-- =========================================================
-- 7) PAYMENTS / RECEIPTS
-- =========================================================

create table if not exists payments (
  payment_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(booking_id) on delete restrict,

  payment_type text not null default 'payment'
    check (payment_type in ('deposit', 'payment', 'balance', 'refund')),
  payment_method text not null check (payment_method in ('เงินสด', 'โอนผ่านธนาคาร')),
  amount numeric(12,2) not null check (amount >= 0),

  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'verified', 'rejected', 'refunded')),

  bank_ref text,
  slip_url text,
  paid_at timestamptz,

  verified_by uuid references app_users(user_id),
  verified_at timestamptz,

  created_by uuid references app_users(user_id),
  created_at timestamptz default now()
);

create table if not exists receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  receipt_no text unique not null,
  booking_id uuid not null references bookings(booking_id) on delete restrict,
  receipt_status text not null default 'issued'
    check (receipt_status in ('issued', 'void')),
  total_amount numeric(12,2) not null default 0,

  issued_by uuid references app_users(user_id),
  issued_at timestamptz default now(),

  void_reason text,
  void_by uuid references app_users(user_id),
  void_at timestamptz
);

create table if not exists receipt_items (
  receipt_item_id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(receipt_id) on delete restrict,
  item_name text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0
);

-- =========================================================
-- 8) REPORT / EXPORT HISTORY
-- =========================================================

create table if not exists daily_report_history (
  report_id uuid primary key default gen_random_uuid(),
  report_date date not null,
  report_type text not null,
  generated_by uuid references app_users(user_id),
  generated_at timestamptz default now(),
  payload_json jsonb
);

create table if not exists insurance_export_history (
  export_id uuid primary key default gen_random_uuid(),
  travel_date date not null,
  export_status text not null default 'generated',
  generated_by uuid references app_users(user_id),
  generated_at timestamptz default now(),
  payload_json jsonb
);

-- =========================================================
-- 9) AUDIT LOG
-- =========================================================

create table if not exists audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(booking_id),
  booking_code text,

  action text not null,
  detail text,

  before_json jsonb,
  after_json jsonb,

  changed_by uuid references app_users(user_id),
  changed_by_role text,
  changed_at timestamptz default now()
);

create index if not exists idx_audit_booking_code on audit_logs(booking_code);
create index if not exists idx_audit_changed_at on audit_logs(changed_at);

-- =========================================================
-- 10) UPDATED_AT TRIGGER
-- =========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bookings_updated_at on bookings;
create trigger trg_bookings_updated_at before update on bookings
for each row execute function set_updated_at();

drop trigger if exists trg_passengers_updated_at on passengers;
create trigger trg_passengers_updated_at before update on passengers
for each row execute function set_updated_at();

drop trigger if exists trg_master_programs_updated_at on master_programs;
create trigger trg_master_programs_updated_at before update on master_programs
for each row execute function set_updated_at();

drop trigger if exists trg_master_addons_updated_at on master_addons;
create trigger trg_master_addons_updated_at before update on master_addons
for each row execute function set_updated_at();

-- =========================================================
-- 11) USEFUL VIEWS
-- =========================================================

create or replace view v_booking_summary as
select
  b.booking_id,
  b.booking_code,
  b.travel_date,
  b.return_date,
  b.trip_type,
  b.status,
  concat_ws(' ', b.leader_title, b.leader_first_name, b.leader_last_name) as leader_name,
  b.phone,
  b.source,
  b.agent_name,
  count(p.passenger_id) as passenger_count,
  b.program_revenue,
  b.pre_addon_revenue,
  b.island_addon_revenue,
  b.total_amount,
  b.payment_method,
  b.created_at,
  b.updated_at
from bookings b
left join passengers p on p.booking_id = b.booking_id
group by b.booking_id;

create or replace view v_daily_management_report as
select
  travel_date,
  count(*) as booking_count,
  sum(passenger_count) as passenger_count,
  sum(program_revenue) as program_revenue,
  sum(pre_addon_revenue) as pre_addon_revenue,
  sum(island_addon_revenue) as island_addon_revenue,
  sum(total_amount) as total_revenue
from v_booking_summary
where status = 'checked-in'
group by travel_date;
