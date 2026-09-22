-- booking_addons stores two independent master-data families. The original
-- single FK to master_addons rejected valid master_island_addons identifiers.
-- Preserve every historical snapshot and validate new writes by addon_source.

insert into master_island_addons(
  island_addon_id,island_addon_name,default_price,active_flag,sort_order,description
)
select
  ba.addon_id,
  coalesce(max(nullif(trim(ba.addon_name_snapshot),'')),ba.addon_id),
  greatest(coalesce(max(ba.default_price),0),0),
  false,
  9000,
  'รายการ Island Add-on เดิมที่เก็บไว้เพื่อรักษาประวัติ Booking'
from booking_addons ba
where ba.addon_source='island'
  and nullif(trim(ba.addon_id),'') is not null
group by ba.addon_id
on conflict(island_addon_id) do nothing;

insert into master_island_addons(
  island_addon_id,island_addon_name,default_price,active_flag,sort_order,description
)
values('other','Island Add-on อื่นๆ',0,false,9999,'รหัสสำรองสำหรับรายการย้อนหลังหรือรายการกำหนดเอง')
on conflict(island_addon_id) do nothing;

do $$
declare v_constraint text;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid='public.booking_addons'::regclass
      and con.confrelid='public.master_addons'::regclass
      and con.contype='f'
  loop
    execute format('alter table public.booking_addons drop constraint %I',v_constraint);
  end loop;
end $$;

create or replace function validate_booking_addon_master_reference() returns trigger
language plpgsql set search_path=public as $$
begin
  if nullif(trim(new.addon_id),'') is null then
    raise exception using errcode='23503',message='booking_addons.addon_id is required';
  end if;

  if new.addon_source='pre' then
    if not exists(select 1 from master_addons where addon_id=new.addon_id) then
      raise exception using errcode='23503',
        message=format('ไม่พบอุปกรณ์รหัส %s ใน Master Data อุปกรณ์',new.addon_id);
    end if;
  elsif new.addon_source='island' then
    if not exists(select 1 from master_island_addons where island_addon_id=new.addon_id) then
      raise exception using errcode='23503',
        message=format('ไม่พบ Island Add-on รหัส %s ใน Master Data Island Add-on',new.addon_id);
    end if;
  else
    raise exception using errcode='23514',
      message=format('ไม่รองรับประเภท booking_addons.addon_source: %s',coalesce(new.addon_source,'NULL'));
  end if;

  return new;
end $$;

drop trigger if exists booking_addons_master_reference_trigger on booking_addons;
create trigger booking_addons_master_reference_trigger
before insert or update of addon_source,addon_id on booking_addons
for each row execute function validate_booking_addon_master_reference();

