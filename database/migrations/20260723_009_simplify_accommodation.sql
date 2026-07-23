-- Simplified accommodation workflow:
-- selectable master data, two booking-owner choices, and manual tent credit.
create table if not exists master_accommodations(
  accommodation_id text primary key,
  accommodation_name text not null,
  description text,
  active_flag boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into master_accommodations(accommodation_id,accommodation_name,sort_order)
values('park_house','บ้านพักอุทยาน',10),('park_tent','เต็นท์อุทยาน',20),('other','ที่พักอื่น',90)
on conflict(accommodation_id) do nothing;

alter table if exists passengers
  add column if not exists accommodation_id text references master_accommodations(accommodation_id) on delete set null,
  add column if not exists accommodation_booked_by text;

update passengers set accommodation_id=park_accommodation_type
where park_accommodation_type in('park_house','park_tent') and accommodation_id is null;

alter table passengers drop constraint if exists passengers_accommodation_booked_by_check;
alter table passengers add constraint passengers_accommodation_booked_by_check
  check(accommodation_booked_by is null or accommodation_booked_by in('customer','company'));

create or replace function update_booking_accommodation_details(p_booking_code text,p_passengers jsonb)
returns void language plpgsql security definer as $$
declare
  v_pass jsonb; v_no int:=0; v_accommodation_id text; v_booked_by text; v_credit numeric(12,2);
begin
  for v_pass in select * from jsonb_array_elements(coalesce(p_passengers,'[]'::jsonb)) loop
    v_no:=v_no+1;
    v_accommodation_id:=nullif(v_pass->>'accommodationId','');
    v_booked_by:=coalesce(nullif(v_pass->>'accommodationBookedBy',''),'customer');
    v_credit:=greatest(coalesce((v_pass->>'tentCreditAmount')::numeric,0),0);
    if v_accommodation_id is not null and not exists(
      select 1 from master_accommodations where accommodation_id=v_accommodation_id
    ) then raise exception 'Invalid accommodation';
    end if;
    if v_booked_by not in('customer','company') then raise exception 'Invalid accommodation booking owner';
    end if;
    update passengers p set
      accommodation_id=v_accommodation_id,
      accommodation_booked_by=v_booked_by,
      tent_credit_amount=v_credit,
      park_accommodation_reference=nullif(v_pass->>'parkAccommodationReference',''),
      park_accommodation_note=nullif(v_pass->>'parkAccommodationNote','')
    from bookings b
    where p.booking_id=b.booking_id and b.booking_code=p_booking_code and p.passenger_no=v_no;
  end loop;
end $$;

create or replace function list_bookings_json_v3()
returns jsonb language plpgsql security definer as $$
declare
  v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_passengers jsonb; v_pass jsonb;
  v_booking_code text; v_no int; v_row record;
begin
  v_base:=list_bookings_json_v2();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    v_booking_code:=v_booking->>'bookingCode'; v_passengers:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select p.accommodation_id,p.accommodation_booked_by,p.tent_credit_amount,ma.accommodation_name
      into v_row
      from passengers p join bookings b on b.booking_id=p.booking_id
      left join master_accommodations ma on ma.accommodation_id=p.accommodation_id
      where b.booking_code=v_booking_code and p.passenger_no=v_no limit 1;
      v_pass:=v_pass||jsonb_build_object(
        'accommodationId',coalesce(v_row.accommodation_id,''),
        'accommodationName',coalesce(v_row.accommodation_name,''),
        'accommodationBookedBy',coalesce(v_row.accommodation_booked_by,'customer'),
        'tentCreditAmount',coalesce(v_row.tent_credit_amount,0)
      );
      v_passengers:=v_passengers||jsonb_build_array(v_pass);
    end loop;
    v_result:=v_result||jsonb_build_array(jsonb_set(v_booking,'{passengers}',v_passengers));
  end loop;
  return v_result;
end $$;
