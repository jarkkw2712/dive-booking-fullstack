-- Safe to run repeatedly. Adds receipt presentation metadata without changing financial history.
alter table if exists master_payment_methods
  add column if not exists payment_type text not null default 'transfer',
  add column if not exists show_on_money_receipt boolean not null default true;

do $$ begin
  alter table master_payment_methods add constraint master_payment_methods_payment_type_check check(payment_type in ('cash','transfer'));
exception when duplicate_object then null; end $$;
