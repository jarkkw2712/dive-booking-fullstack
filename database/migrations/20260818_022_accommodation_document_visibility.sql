-- Safe to run repeatedly. Accommodation remains non-revenue; these flags only control printing.
alter table if exists master_accommodations
  add column if not exists show_register boolean not null default true,
  add column if not exists show_money_receipt boolean not null default true,
  add column if not exists show_equipment_slip boolean not null default false,
  add column if not exists show_van_receipt boolean not null default false,
  add column if not exists show_boat_ticket boolean not null default false;
