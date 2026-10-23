-- Add classification metadata without changing historical descriptions or monetary values.
alter table public.daily_expense_items add column if not exists expense_group_code text;
alter table public.daily_expense_items add column if not exists expense_item_code text;
alter table public.daily_expense_items add column if not exists expense_detail text;

update public.daily_expense_items
set expense_group_code = case
      when category_code in ('boat_fee','thai_adult_fee','thai_child_fee','foreign_adult_fee','foreign_child_fee','tent_fee') then 'tour_operations'
      when category_code = 'ice' then 'food_supplies'
      when category_name_snapshot in ('ค่าเล่น DT','ค่าเล่นเดย์ทริป','ค่าคอมมิชชั่นจ๊ะหยัน') then 'staff_labor'
      when category_name_snapshot = 'บังตั๊กเบิกล่วงหน้า' then 'payroll_advance'
      when category_name_snapshot = 'คืนค่าดำน้ำคุณณัฐนนท์' then 'customer_refunds'
      when category_name_snapshot in ('สัปรด','ค่าสัปรด','ไก่ทอด PS','ข้าวเหนียว PS','ค่าข้าวไปเอาแผ่นลาก','ค่าอาหารช่างซูซูกิ','ค่าอาหารเช้าเดย์ทริป') then 'food_supplies'
      when category_name_snapshot in ('แผ่นลากดำน้ำ','ค่าดูดส้วม','ค่าทำบันไดเรือ','ค่าทำห้องน้ำท่าเรือ') then 'maintenance_repair'
      else 'other' end,
    expense_item_code = case
      when category_code in ('thai_adult_fee','thai_child_fee','foreign_adult_fee','foreign_child_fee') then 'national_park_fee'
      when category_code = 'boat_fee' then 'boat_park_fee'
      when category_code = 'tent_fee' then 'park_tent_fee'
      when category_code = 'ice' then 'ice'
      when category_name_snapshot in ('ค่าเล่น DT','ค่าเล่นเดย์ทริป') then 'day_trip_staff_fee'
      when category_name_snapshot = 'บังตั๊กเบิกล่วงหน้า' then 'salary_advance'
      when category_name_snapshot = 'คืนค่าดำน้ำคุณณัฐนนท์' then 'customer_refund'
      else 'other' end,
    expense_detail = case
      when category_code in ('boat_fee','thai_adult_fee','thai_child_fee','foreign_adult_fee','foreign_child_fee','tent_fee','ice') then expense_detail
      else coalesce(nullif(expense_detail,''),category_name_snapshot) end
where expense_group_code is null or expense_item_code is null;

create or replace function public.save_daily_operating_expenses(p_date date,p_items jsonb,p_note text,p_actor text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_batch uuid; v_revision integer; v_item jsonb;
begin
  if p_date is null or coalesce(trim(p_actor),'')='' then raise exception 'Date and actor are required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be an array'; end if;
  perform pg_advisory_xact_lock(hashtext(p_date::text));
  select coalesce(max(revision),0)+1 into v_revision from public.daily_expense_batches where expense_date=p_date;
  insert into public.daily_expense_batches(expense_date,revision,note,created_by) values(p_date,v_revision,nullif(trim(p_note),''),p_actor) returning batch_id into v_batch;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(trim(v_item->>'name'),'')<>'' then
      insert into public.daily_expense_items(batch_id,category_code,category_name_snapshot,qty,unit_price,expense_group_code,expense_item_code,expense_detail)
      values(v_batch,coalesce(nullif(trim(v_item->>'code'),''),'other'),trim(v_item->>'name'),
             greatest(coalesce((v_item->>'qty')::numeric,0),0),greatest(coalesce((v_item->>'unitPrice')::numeric,0),0),
             coalesce(nullif(trim(v_item->>'groupCode'),''),'other'),coalesce(nullif(trim(v_item->>'itemCode'),''),'other'),nullif(trim(v_item->>'detail'),''));
    end if;
  end loop;
  return v_batch;
end $$;
revoke all on function public.save_daily_operating_expenses(date,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_daily_operating_expenses(date,jsonb,text,text) to service_role;

create or replace view public.v_current_daily_operating_expenses as
select b.expense_date,b.batch_id,b.revision,b.note,b.created_by,b.created_at,
       i.item_id,i.category_code,i.category_name_snapshot,i.qty,i.unit_price,i.amount,
       i.expense_group_code,i.expense_item_code,i.expense_detail
from public.daily_expense_batches b
join (select expense_date,max(revision) revision from public.daily_expense_batches group by expense_date) latest
  on latest.expense_date=b.expense_date and latest.revision=b.revision
left join public.daily_expense_items i on i.batch_id=b.batch_id;
revoke all on public.v_current_daily_operating_expenses from public,anon,authenticated;
grant select on public.v_current_daily_operating_expenses to service_role;
