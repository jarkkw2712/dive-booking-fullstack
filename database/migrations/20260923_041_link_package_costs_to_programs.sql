-- Link package costs to canonical Program Master records.
-- program_key remains a printable short label (DT, 2/1, ...), never a join key.

alter table if exists master_package_cost_rates
  add column if not exists program_id text;

with matched as (
  select r.rate_id, (
    select p.program_id
    from master_programs p
    where
    lower(trim(p.program_id)) = lower(trim(r.program_key))
    or lower(regexp_replace(p.program_name,'[^a-zA-Z0-9ก-๙]+','','g')) = lower(regexp_replace(r.program_key,'[^a-zA-Z0-9ก-๙]+','','g'))
    or (upper(trim(r.program_key)) = 'DT' and (
      lower(p.program_id) in ('one_day','day_trip','dt')
      or lower(p.program_name) ~ '(one[[:space:]]*day|day[[:space:]]*trip|1[[:space:]]*day)'
      or p.program_name ~ '(วันเดียว|เดย์ทริป)'
    ))
    or (trim(r.program_key) = '2/1' and (
      lower(p.program_id) in ('two_day','2d1n','2_day_1_night')
      or lower(p.program_name) ~ '2[[:space:]]*(day|วัน).*(1[[:space:]]*(night|คืน))'
    ))
    or (trim(r.program_key) = '3/2' and (
      lower(p.program_id) in ('three_day','3d2n','3_day_2_night')
      or lower(p.program_name) ~ '3[[:space:]]*(day|วัน).*(2[[:space:]]*(night|คืน))'
    ))
    or (trim(r.program_key) = '4/3' and (
      lower(p.program_id) in ('four_day','4d3n','4_day_3_night')
      or lower(p.program_name) ~ '4[[:space:]]*(day|วัน).*(3[[:space:]]*(night|คืน))'
    ))
    order by
    case
      when lower(trim(p.program_id)) = lower(trim(r.program_key)) then 0
      when upper(trim(r.program_key)) = 'DT' and lower(p.program_id) = 'one_day' then 1
      when trim(r.program_key) = '2/1' and lower(p.program_id) = 'two_day' then 1
      when trim(r.program_key) = '3/2' and lower(p.program_id) = 'three_day' then 1
      when trim(r.program_key) = '4/3' and lower(p.program_id) = 'four_day' then 1
      else 2
    end,
    p.sort_order,
    p.program_id
    limit 1
  ) as program_id
  from master_package_cost_rates r
  where r.program_id is null
)
update master_package_cost_rates r
set program_id = matched.program_id
from matched
where r.rate_id = matched.rate_id
  and matched.program_id is not null
  and r.program_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'master_package_cost_rates_program_id_fkey'
      and conrelid = 'master_package_cost_rates'::regclass
  ) then
    alter table master_package_cost_rates
      add constraint master_package_cost_rates_program_id_fkey
      foreign key(program_id) references master_programs(program_id)
      on update cascade on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'master_package_cost_rates_program_required'
      and conrelid = 'master_package_cost_rates'::regclass
  ) then
    alter table master_package_cost_rates
      add constraint master_package_cost_rates_program_required
      check(program_id is not null) not valid;
  end if;
end $$;

create unique index if not exists ux_master_package_cost_rates_program_cost
  on master_package_cost_rates(program_id,cost_code)
  where program_id is not null;

create index if not exists ix_master_package_cost_rates_program_active
  on master_package_cost_rates(program_id,active_flag,sort_order);

comment on column master_package_cost_rates.program_id is
  'Canonical join to master_programs; reports must match with this field.';
comment on column master_package_cost_rates.program_key is
  'Short printable label such as DT or 2/1; never used as the report join key.';
