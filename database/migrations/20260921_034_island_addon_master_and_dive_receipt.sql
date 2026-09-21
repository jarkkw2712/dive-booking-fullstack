-- Replace free-text Island Add-ons with editable master data while preserving
-- immutable booking snapshots and all historical rows.
create table if not exists master_island_addons(
  island_addon_id text primary key,
  island_addon_name text not null,
  default_price numeric(14,2) not null default 0 check(default_price>=0),
  active_flag boolean not null default true,
  sort_order integer not null default 0,
  description text not null default '',
  show_register boolean not null default false,
  show_money_receipt boolean not null default true,
  show_equipment_slip boolean not null default false,
  show_van_receipt boolean not null default false,
  show_boat_ticket boolean not null default false,
  show_island_purchase_order boolean not null default true,
  show_dive_receipt boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into master_island_addons(island_addon_id,island_addon_name,default_price,sort_order,description)
values('dive','ดำน้ำ',0,10,'กิจกรรมหรือบริการดำน้ำที่ซื้อเพิ่มบนเกาะ')
on conflict(island_addon_id) do nothing;

do $$
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='booking_addons' and column_name='show_dive_receipt'
  ) then
    alter table booking_addons add column show_dive_receipt boolean not null default false;
    -- Historical Island Add-ons remain printable in the new receipt. This runs
    -- only when the column is first created, so later user choices are preserved.
    update booking_addons set show_dive_receipt=true where addon_source='island';
  end if;
end $$;

insert into role_permissions(role_id,permission_key,allowed,updated_at)
select role_id,'printDiveReceipt',role_id in ('admin','counter','island_staff','management','finance','ceo'),now() from app_roles
on conflict(role_id,permission_key) do nothing;

create or replace function upsert_booking_v19(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_add jsonb; v_pid uuid; v_row uuid; v_no integer:=0; v_used uuid[]:='{}'::uuid[];
begin
  v_result:=upsert_booking_v18(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1; v_used:='{}'::uuid[];
    select passenger_id into v_pid from passengers where booking_id=v_booking_id and passenger_no=v_no;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      select addon_row_id into v_row from booking_addons where passenger_id=v_pid and addon_source='island' and addon_row_id<>all(v_used)
        and addon_name_snapshot=coalesce(v_add->>'name','Other') and qty=coalesce((v_add->>'qty')::integer,1)
        and unit_price=coalesce((v_add->>'price')::numeric,0) order by addon_row_id limit 1;
      if v_row is null then select addon_row_id into v_row from booking_addons where passenger_id=v_pid and addon_source='island' and addon_row_id<>all(v_used) order by addon_row_id limit 1; end if;
      if v_row is not null then
        v_used:=array_append(v_used,v_row);
        update booking_addons set show_dive_receipt=coalesce((v_add->'documentVisibility'->>'show_dive_receipt')::boolean,true) where addon_row_id=v_row;
      end if;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v19() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_base jsonb; v_result jsonb:='[]'; v_booking jsonb; v_people jsonb; v_pass jsonb; v_bid uuid; v_pid uuid; v_island jsonb; v_no integer;
begin
  v_base:=list_bookings_json_v18();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_bid from bookings where booking_code=v_booking->>'bookingCode'; v_people:='[]'; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1; select passenger_id into v_pid from passengers where booking_id=v_bid and passenger_no=v_no;
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',ba.addon_id,'name',ba.addon_name_snapshot,'qty',ba.qty,'price',ba.unit_price,'defaultPrice',ba.default_price,
        'paymentMethod',coalesce(ba.payment_method,''),'receivedBy',coalesce(ba.received_by,''),'source','island',
        'documentVisibility',jsonb_build_object('show_register',ba.show_register,'show_money_receipt',ba.show_money_receipt,
          'show_equipment_slip',ba.show_equipment_slip,'show_van_receipt',ba.show_van_receipt,'show_boat_ticket',ba.show_boat_ticket,
          'show_island_purchase_order',ba.show_island_purchase_order,'show_dive_receipt',ba.show_dive_receipt)
      ) order by ba.created_at,ba.addon_row_id),'[]') into v_island
      from booking_addons ba where ba.passenger_id=v_pid and ba.addon_source='island';
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object('islandAddOns',v_island));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
