create extension if not exists "pgcrypto";

create table if not exists financial_document_counters(
  document_type text not null,
  document_year integer not null,
  last_number bigint not null default 0 check(last_number >= 0),
  primary key(document_type, document_year)
);

create table if not exists invoices(
  invoice_id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  booking_id uuid not null references bookings(booking_id),
  booking_code text not null,
  invoice_type text not null check(invoice_type in ('initial','adjustment','credit_note')),
  issue_date date not null default current_date,
  due_date date,
  currency char(3) not null default 'THB',
  subtotal numeric(14,2) not null default 0 check(subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check(discount_amount >= 0),
  vat_rate numeric(7,4) not null default 0 check(vat_rate >= 0),
  vat_amount numeric(14,2) not null default 0 check(vat_amount >= 0),
  grand_total numeric(14,2) not null default 0 check(grand_total >= 0),
  status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','void')),
  notes text,
  idempotency_key text unique,
  created_by text not null,
  created_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  void_reason text,
  voided_by text,
  voided_at timestamptz
);

create table if not exists invoice_items(
  invoice_item_id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(invoice_id),
  source_type text not null check(source_type in ('program','pre_addon','island_addon','manual')),
  source_id text,
  passenger_name_snapshot text,
  item_code_snapshot text,
  item_name_snapshot text not null,
  description text,
  qty numeric(12,2) not null check(qty > 0),
  unit_price numeric(14,2) not null check(unit_price >= 0),
  discount_amount numeric(14,2) not null default 0 check(discount_amount >= 0),
  line_total numeric(14,2) not null check(line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists payments(
  payment_id uuid primary key default gen_random_uuid(),
  payment_no text unique not null,
  booking_id uuid not null references bookings(booking_id),
  booking_code text not null,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check(amount > 0),
  method_id text,
  method_snapshot text not null,
  bank_name text,
  reference_no text,
  slip_url text,
  status text not null default 'pending' check(status in ('pending','verified','rejected','reversed')),
  remark text,
  received_by text not null,
  received_role text,
  verified_by text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  reversed_by text,
  reversed_at timestamptz,
  reversal_reason text,
  idempotency_key text unique
);

create table if not exists payment_allocations(
  allocation_id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(payment_id),
  invoice_id uuid not null references invoices(invoice_id),
  amount numeric(14,2) not null check(amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id, invoice_id)
);

create table if not exists receipts(
  receipt_id uuid primary key default gen_random_uuid(),
  receipt_no text unique not null,
  payment_id uuid not null references payments(payment_id),
  booking_id uuid not null references bookings(booking_id),
  booking_code text not null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check(status in ('issued','void')),
  document_snapshot jsonb not null default '{}'::jsonb,
  issued_by text not null,
  issued_role text,
  void_reason text,
  voided_by text,
  voided_at timestamptz,
  idempotency_key text unique
);

create table if not exists refunds(
  refund_id uuid primary key default gen_random_uuid(),
  refund_no text unique not null,
  booking_id uuid not null references bookings(booking_id),
  booking_code text not null,
  payment_id uuid references payments(payment_id),
  amount numeric(14,2) not null check(amount > 0),
  refund_date date not null default current_date,
  method text not null,
  reason text not null,
  status text not null default 'requested' check(status in ('requested','approved','paid','rejected')),
  approved_by text,
  paid_by text,
  created_by text not null,
  created_role text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  idempotency_key text unique
);

create table if not exists financial_events(
  financial_event_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(booking_id),
  booking_code text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  amount numeric(14,2),
  method text,
  reference_no text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  before_json jsonb,
  after_json jsonb,
  created_by text not null,
  created_role text,
  created_at timestamptz not null default now()
);

create index if not exists invoices_booking_idx on invoices(booking_id, created_at);
create unique index if not exists invoices_one_active_initial_idx on invoices(booking_id) where invoice_type='initial' and status<>'void';
create index if not exists payments_booking_idx on payments(booking_id, created_at);
create index if not exists receipts_booking_idx on receipts(booking_id, issued_at);
create unique index if not exists receipts_one_active_per_payment_idx on receipts(payment_id) where status='issued';
create index if not exists refunds_booking_idx on refunds(booking_id, created_at);
create index if not exists financial_events_booking_idx on financial_events(booking_id, created_at);

-- History tables are append-only from the application. No cascading deletes are used.
create or replace function prevent_immutable_financial_history_change()
returns trigger language plpgsql as $$ begin raise exception '% is immutable; use void/reversal/refund workflow', tg_table_name; end $$;
drop trigger if exists invoice_items_immutable on invoice_items;
create trigger invoice_items_immutable before update or delete on invoice_items for each row execute function prevent_immutable_financial_history_change();
drop trigger if exists financial_events_immutable on financial_events;
create trigger financial_events_immutable before update or delete on financial_events for each row execute function prevent_immutable_financial_history_change();
