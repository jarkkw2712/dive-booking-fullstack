-- Package cost assumptions, daily island-boat operations, and their permissions.
-- All operational saves are revisioned so older records remain available for audit.

create table if not exists master_package_cost_rates(
  rate_id text primary key,
  program_key text not null,
  cost_code text not null,
  cost_name text not null,
  recipient_group text not null check(recipient_group in ('park','sabina')),
  unit_rate numeric(14,2) not null default 0 check(unit_rate>=0),
  active_flag boolean not null default true,
  sort_order integer not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_key,cost_code)
);

insert into master_package_cost_rates(rate_id,program_key,cost_code,cost_name,recipient_group,unit_rate,sort_order)
values
  ('dt_park_food','DT','park_food','อาหาร','park',280,10),('dt_park_fee','DT','park_fee','อุทยาน','park',100,20),('dt_park_tent','DT','park_tent','เต็นท์','park',80,30),
  ('dt_sabina_food','DT','sabina_food','อาหาร','sabina',120,110),('dt_longtail','DT','longtail','เรือหาง','sabina',20,120),('dt_equipment','DT','equipment','อุปกรณ์','sabina',100,130),('dt_refreshment','DT','refreshment','ผลไม้/น้ำ','sabina',50,140),('dt_guide','DT','guide','ไกด์','sabina',50,150),('dt_sabina_tent','DT','sabina_tent','เต็นท์','sabina',0,160),('dt_insurance','DT','insurance','ประกัน','sabina',30,170),('dt_agent','DT','agent','เอเจ้นท์','sabina',500,180),
  ('2_1_park_food','2/1','park_food','อาหาร','park',980,210),('2_1_park_fee','2/1','park_fee','อุทยาน','park',100,220),('2_1_park_tent','2/1','park_tent','เต็นท์','park',160,230),
  ('2_1_sabina_food','2/1','sabina_food','อาหาร','sabina',120,310),('2_1_longtail','2/1','longtail','เรือหาง','sabina',400,320),('2_1_equipment','2/1','equipment','อุปกรณ์','sabina',150,330),('2_1_refreshment','2/1','refreshment','ผลไม้/น้ำ','sabina',100,340),('2_1_guide','2/1','guide','ไกด์','sabina',100,350),('2_1_sabina_tent','2/1','sabina_tent','เต็นท์','sabina',225,360),('2_1_insurance','2/1','insurance','ประกัน','sabina',30,370),('2_1_agent','2/1','agent','เอเจ้นท์','sabina',500,380),
  ('3_2_park_food','3/2','park_food','อาหาร','park',1680,410),('3_2_park_fee','3/2','park_fee','อุทยาน','park',100,420),('3_2_park_tent','3/2','park_tent','เต็นท์','park',240,430),
  ('3_2_sabina_food','3/2','sabina_food','อาหาร','sabina',120,510),('3_2_longtail','3/2','longtail','เรือหาง','sabina',800,520),('3_2_equipment','3/2','equipment','อุปกรณ์','sabina',200,530),('3_2_refreshment','3/2','refreshment','ผลไม้/น้ำ','sabina',150,540),('3_2_guide','3/2','guide','ไกด์','sabina',150,550),('3_2_sabina_tent','3/2','sabina_tent','เต็นท์','sabina',675,560),('3_2_insurance','3/2','insurance','ประกัน','sabina',30,570),('3_2_agent','3/2','agent','เอเจ้นท์','sabina',500,580),
  ('4_3_park_food','4/3','park_food','อาหาร','park',2380,610),('4_3_park_fee','4/3','park_fee','อุทยาน','park',100,620),('4_3_park_tent','4/3','park_tent','เต็นท์','park',320,630),
  ('4_3_sabina_food','4/3','sabina_food','อาหาร','sabina',120,710),('4_3_longtail','4/3','longtail','เรือหาง','sabina',1200,720),('4_3_equipment','4/3','equipment','อุปกรณ์','sabina',250,730),('4_3_refreshment','4/3','refreshment','ผลไม้/น้ำ','sabina',200,740),('4_3_guide','4/3','guide','ไกด์','sabina',200,750),('4_3_sabina_tent','4/3','sabina_tent','เต็นท์','sabina',900,760),('4_3_insurance','4/3','insurance','ประกัน','sabina',30,770),('4_3_agent','4/3','agent','เอเจ้นท์','sabina',500,780)
on conflict(rate_id) do nothing;

create table if not exists master_island_boat_duties(
  duty_id text primary key,
  duty_name text not null,
  active_flag boolean not null default true,
  sort_order integer not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into master_island_boat_duties(duty_id,duty_name,sort_order,description) values
  ('diving','ดำน้ำ',10,'หน้าที่เรือสำหรับกิจกรรมดำน้ำ'),
  ('transfer','รับส่ง',20,'หน้าที่เรือสำหรับรับส่งผู้โดยสาร'),
  ('luggage','บรรทุกกระเป๋า',30,'หน้าที่เรือสำหรับบรรทุกสัมภาระ')
on conflict(duty_id) do nothing;

insert into master_islands(island_id,island_name,active_flag,sort_order,description)
values ('chong_khad','ช่องขาด',true,10,'กลุ่มปฏิบัติงานเรือบนเกาะ'),('mai_ngam','ไม้งาม',true,20,'กลุ่มปฏิบัติงานเรือบนเกาะ')
on conflict(island_id) do update set island_name=excluded.island_name,active_flag=true;

create table if not exists island_boat_operation_batches(
  batch_id uuid primary key default gen_random_uuid(),
  operation_date date not null,
  revision integer not null check(revision>0),
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique(operation_date,revision)
);
create table if not exists island_boat_operation_items(
  item_id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references island_boat_operation_batches(batch_id) on delete restrict,
  island_id text not null,
  island_name_snapshot text not null,
  duty_id text not null,
  duty_name_snapshot text not null,
  longtail_boat_no text,
  fuel_liters numeric(12,2) not null default 0 check(fuel_liters>=0),
  driver_name text,
  passenger_count integer not null default 0 check(passenger_count>=0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_island_boat_batches_date on island_boat_operation_batches(operation_date,revision desc);
create index if not exists idx_island_boat_items_batch on island_boat_operation_items(batch_id);
alter table master_package_cost_rates enable row level security;
alter table master_island_boat_duties enable row level security;
alter table island_boat_operation_batches enable row level security;
alter table island_boat_operation_items enable row level security;

create or replace function save_island_boat_operations(p_date date,p_items jsonb,p_note text,p_actor text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_batch uuid; v_revision integer; v_item jsonb;
begin
  if p_date is null or coalesce(trim(p_actor),'')='' then raise exception 'Date and actor are required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be an array'; end if;
  perform pg_advisory_xact_lock(hashtext('island-boat-'||p_date::text));
  select coalesce(max(revision),0)+1 into v_revision from island_boat_operation_batches where operation_date=p_date;
  insert into island_boat_operation_batches(operation_date,revision,note,created_by)
  values(p_date,v_revision,nullif(trim(p_note),''),p_actor) returning batch_id into v_batch;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(trim(v_item->>'islandId'),'')<>'' and coalesce(trim(v_item->>'dutyId'),'')<>'' then
      insert into island_boat_operation_items(batch_id,island_id,island_name_snapshot,duty_id,duty_name_snapshot,longtail_boat_no,fuel_liters,driver_name,passenger_count,sort_order)
      values(v_batch,trim(v_item->>'islandId'),coalesce(nullif(trim(v_item->>'islandName'),''),trim(v_item->>'islandId')),trim(v_item->>'dutyId'),coalesce(nullif(trim(v_item->>'dutyName'),''),trim(v_item->>'dutyId')),nullif(trim(v_item->>'boatNo'),''),greatest(coalesce((v_item->>'fuelLiters')::numeric,0),0),nullif(trim(v_item->>'driverName'),''),greatest(coalesce((v_item->>'passengerCount')::integer,0),0),coalesce((v_item->>'sortOrder')::integer,0));
    end if;
  end loop;
  return v_batch;
end $$;
revoke all on function save_island_boat_operations(date,jsonb,text,text) from public,anon,authenticated;
grant execute on function save_island_boat_operations(date,jsonb,text,text) to service_role;

create or replace view v_current_island_boat_operations as
select b.operation_date,b.batch_id,b.revision,b.note,b.created_by,b.created_at,
       i.item_id,i.island_id,i.island_name_snapshot,i.duty_id,i.duty_name_snapshot,
       i.longtail_boat_no,i.fuel_liters,i.driver_name,i.passenger_count,i.sort_order
from island_boat_operation_batches b
join (select operation_date,max(revision) revision from island_boat_operation_batches group by operation_date) latest
  on latest.operation_date=b.operation_date and latest.revision=b.revision
left join island_boat_operation_items i on i.batch_id=b.batch_id;
revoke all on v_current_island_boat_operations from public,anon,authenticated;
grant select on master_package_cost_rates,master_island_boat_duties,v_current_island_boat_operations to service_role;

insert into role_permissions(role_id,permission_key,allowed,updated_at)
select role_id,'manageIslandBoatOperations',role_id in ('admin','island_staff','boat_crew','management','ceo'),now() from app_roles
on conflict(role_id,permission_key) do nothing;
