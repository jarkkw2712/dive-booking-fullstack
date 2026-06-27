
create extension if not exists "pgcrypto";

create table if not exists app_roles (
  role_id text primary key,
  role_name text not null
);

create table if not exists app_users (
  user_id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  role_id text not null references app_roles(role_id),
  active_flag boolean default true,
  created_at timestamptz default now()
);

create table if not exists role_permissions (
  role_id text references app_roles(role_id),
  permission_key text not null,
  allowed boolean default false,
  primary key(role_id, permission_key)
);

create table if not exists master_programs (
  program_id text primary key,
  program_name text not null,
  default_price numeric(12,2) default 0,
  active_flag boolean default true,
  sort_order int default 0
);

create table if not exists master_addons (
  addon_id text primary key,
  addon_name text not null,
  default_price numeric(12,2) default 0,
  active_flag boolean default true,
  sort_order int default 0
);

create table if not exists bookings (
  booking_id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  trip_type text not null,
  travel_date date not null,
  return_date date,
  leader_title text,
  leader_first_name text not null,
  leader_last_name text not null,
  phone text,
  source text,
  agent_name text,
  status text default 'pending',
  payment_method text,
  booking_note text,
  total_amount numeric(12,2) default 0,
  program_revenue numeric(12,2) default 0,
  pre_addon_revenue numeric(12,2) default 0,
  island_addon_revenue numeric(12,2) default 0,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists passengers (
  passenger_id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(booking_id) on delete cascade,
  passenger_no int not null,
  is_leader boolean default false,
  title text,
  first_name text not null,
  last_name text not null,
  age int,
  phone text,
  island text,
  food_allergy text,
  medical_note text
);

create table if not exists booking_programs (
  booking_program_id uuid primary key default gen_random_uuid(),
  passenger_id uuid references passengers(passenger_id) on delete cascade,
  program_id text references master_programs(program_id),
  qty int default 1,
  unit_price numeric(12,2) default 0,
  default_price numeric(12,2) default 0,
  price_reason text,
  price_reason_other text
);

create table if not exists booking_addons (
  addon_row_id uuid primary key default gen_random_uuid(),
  passenger_id uuid references passengers(passenger_id) on delete cascade,
  addon_source text not null,
  addon_id text references master_addons(addon_id),
  addon_name_snapshot text not null,
  qty int default 1,
  unit_price numeric(12,2) default 0,
  default_price numeric(12,2) default 0,
  price_reason text,
  price_reason_other text,
  payment_method text,
  received_by text,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  booking_code text,
  action text not null,
  detail text,
  after_json jsonb,
  changed_by text,
  changed_at timestamptz default now()
);

create or replace view v_booking_summary as
select
  b.booking_code,
  b.travel_date,
  b.status,
  concat_ws(' ', b.leader_title, b.leader_first_name, b.leader_last_name) as leader_name,
  count(p.passenger_id) as passenger_count,
  b.program_revenue,
  b.pre_addon_revenue,
  b.island_addon_revenue,
  b.total_amount
from bookings b
left join passengers p on p.booking_id=b.booking_id
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
where status='checked-in'
group by travel_date;


-- Sprint 1.3 Company Profile / System Setting
create table if not exists company_profile (
  profile_id text primary key default 'default',
  company_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  website text,
  line_oa text,
  facebook text,
  logo_url text,
  signature_url text,
  stamp_url text,
  bank_name text,
  bank_account text,
  bank_account_name text,
  promptpay text,
  promptpay_qr_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- Sprint 1.4 Master Data Pro
create table if not exists master_agents (
  agent_id text primary key,
  agent_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_boats (
  boat_id text primary key,
  boat_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_islands (
  island_id text primary key,
  island_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_price_reasons (
  reason_id text primary key,
  reason_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_payment_methods (
  method_id text primary key,
  method_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists master_statuses (
  status_id text primary key,
  status_name text not null,
  description text,
  active_flag boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
