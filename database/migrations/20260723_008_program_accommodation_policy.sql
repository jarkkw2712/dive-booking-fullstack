-- Program-driven accommodation rules and immutable tent-credit snapshots.
-- Safe to run repeatedly; no financial history is overwritten.
alter table if exists master_programs
  add column if not exists accommodation_policy text not null default 'optional',
  add column if not exists self_booked_tent_credit numeric(12,2) not null default 0;

alter table if exists passengers
  add column if not exists park_accommodation_arrangement text not null default 'undecided',
  add column if not exists accommodation_policy_snapshot text,
  add column if not exists tent_credit_amount numeric(12,2) not null default 0;

update master_programs set accommodation_policy='none' where program_id='one_day';
update master_programs set accommodation_policy='required' where program_id in('two_day','three_day');
update master_programs set accommodation_policy='optional' where program_id='boat_ticket';

alter table passengers drop constraint if exists passengers_park_accommodation_type_check;
alter table passengers add constraint passengers_park_accommodation_type_check
  check(park_accommodation_type in('none','park_house','park_tent','unknown'));

do $$
begin
  if not exists(select 1 from pg_constraint where conname='master_programs_accommodation_policy_check') then
    alter table master_programs add constraint master_programs_accommodation_policy_check
      check(accommodation_policy in('none','required','optional'));
  end if;
  if not exists(select 1 from pg_constraint where conname='master_programs_tent_credit_check') then
    alter table master_programs add constraint master_programs_tent_credit_check
      check(self_booked_tent_credit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='passengers_accommodation_arrangement_check') then
    alter table passengers add constraint passengers_accommodation_arrangement_check
      check(park_accommodation_arrangement in('not_required','included_tent','customer_self_booked','undecided'));
  end if;
  if not exists(select 1 from pg_constraint where conname='passengers_tent_credit_check') then
    alter table passengers add constraint passengers_tent_credit_check check(tent_credit_amount>=0);
  end if;
end $$;

create or replace function update_booking_accommodation_details(p_booking_code text,p_passengers jsonb)
returns void language plpgsql security definer as $$
declare
  v_pass jsonb; v_no int:=0; v_program_id text; v_policy text; v_credit numeric(12,2);
  v_arrangement text; v_type text; v_booked_by text;
begin
  for v_pass in select * from jsonb_array_elements(coalesce(p_passengers,'[]'::jsonb)) loop
    v_no:=v_no+1;
    v_program_id:=v_pass->'program'->>'programId';
    select accommodation_policy,self_booked_tent_credit into v_policy,v_credit
      from master_programs where program_id=v_program_id;
    v_policy:=coalesce(v_policy,'optional');
    v_arrangement:=coalesce(nullif(v_pass->>'parkAccommodationArrangement',''),'undecided');
    v_type:=coalesce(nullif(v_pass->>'parkAccommodationType',''),'unknown');
    v_booked_by:=nullif(v_pass->>'parkAccommodationBookedBy','');
    if v_policy='none' then
      v_arrangement:='not_required'; v_type:='none'; v_booked_by:='customer'; v_credit:=0;
    elsif v_policy='required' and v_arrangement='undecided' then
      raise exception 'Overnight program requires an accommodation choice';
    elsif v_arrangement='customer_self_booked' then
      v_credit:=coalesce(v_credit,0); v_booked_by:='customer';
    else
      v_credit:=0;
    end if;
    update passengers p set
      park_accommodation_type=v_type,
      park_accommodation_booked_by=v_booked_by,
      park_accommodation_reference=nullif(v_pass->>'parkAccommodationReference',''),
      park_accommodation_note=nullif(v_pass->>'parkAccommodationNote',''),
      park_accommodation_arrangement=v_arrangement,
      accommodation_policy_snapshot=v_policy,
      tent_credit_amount=greatest(coalesce(v_credit,0),0)
    from bookings b
    where p.booking_id=b.booking_id and b.booking_code=p_booking_code and p.passenger_no=v_no;
  end loop;
end $$;

create or replace function upsert_booking_with_accommodation(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_from_json(p_booking);
  v_code:=v_result->>'bookingCode';
  perform update_booking_accommodation_details(v_code,p_booking->'passengers');
  return v_result;
end $$;

create or replace function list_bookings_json_v2()
returns jsonb language plpgsql security definer as $$
declare
  v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_passengers jsonb; v_pass jsonb;
  v_booking_code text; v_no int; v_row record;
begin
  v_base:=list_bookings_json();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    v_booking_code:=v_booking->>'bookingCode';
    v_passengers:='[]'::jsonb;
    v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select p.park_accommodation_type,p.park_accommodation_booked_by,p.park_accommodation_reference,
        p.park_accommodation_note,p.park_accommodation_arrangement,p.accommodation_policy_snapshot,
        p.tent_credit_amount,mp.accommodation_policy,mp.self_booked_tent_credit
      into v_row
      from passengers p join bookings b on b.booking_id=p.booking_id
      left join booking_programs bp on bp.passenger_id=p.passenger_id
      left join master_programs mp on mp.program_id=bp.program_id
      where b.booking_code=v_booking_code and p.passenger_no=v_no limit 1;

      v_pass:=v_pass||jsonb_build_object(
        'parkAccommodationType',coalesce(v_row.park_accommodation_type,'unknown'),
        'parkAccommodationBookedBy',coalesce(v_row.park_accommodation_booked_by,'unknown'),
        'parkAccommodationReference',coalesce(v_row.park_accommodation_reference,''),
        'parkAccommodationNote',coalesce(v_row.park_accommodation_note,''),
        'parkAccommodationArrangement',coalesce(v_row.park_accommodation_arrangement,'undecided'),
        'tentCreditAmount',coalesce(v_row.tent_credit_amount,0)
      );
      if v_pass->'program' is not null then
        v_pass:=jsonb_set(v_pass,'{program}',(v_pass->'program')||jsonb_build_object(
          'accommodationPolicy',coalesce(v_row.accommodation_policy_snapshot,v_row.accommodation_policy,'optional'),
          'selfBookedTentCredit',coalesce(v_row.self_booked_tent_credit,0)
        ));
      end if;
      v_passengers:=v_passengers||jsonb_build_array(v_pass);
    end loop;
    v_result:=v_result||jsonb_build_array(jsonb_set(v_booking,'{passengers}',v_passengers));
  end loop;
  return v_result;
end $$;
