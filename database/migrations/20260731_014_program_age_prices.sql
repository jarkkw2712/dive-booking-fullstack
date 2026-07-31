-- Separate program prices by passenger category. Existing prices remain the adult price.
alter table if exists master_programs
  add column if not exists child_price numeric(14,2),
  add column if not exists infant_price numeric(14,2);

update master_programs set
  child_price=coalesce(child_price,default_price,0),
  infant_price=coalesce(infant_price,default_price,0)
where child_price is null or infant_price is null;

alter table if exists master_programs
  alter column child_price set default 0,
  alter column child_price set not null,
  alter column infant_price set default 0,
  alter column infant_price set not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='master_programs_category_prices_check') then
    alter table master_programs add constraint master_programs_category_prices_check
      check(default_price>=0 and child_price>=0 and infant_price>=0);
  end if;
end $$;
