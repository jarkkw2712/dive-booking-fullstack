-- Store the server-authenticated creator once; later edits cannot overwrite it.
alter table if exists bookings add column if not exists created_by text;
update bookings b set created_by=(select nullif(trim(a.changed_by),'') from audit_logs a where a.booking_code=b.booking_code and a.changed_by is not null order by a.changed_at asc limit 1) where b.created_by is null;

create or replace function upsert_booking_v10(p_booking jsonb) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_v9(p_booking);v_code:=v_result->>'bookingCode';
  update bookings set created_by=coalesce(created_by,nullif(trim(p_booking->>'createdBy'),'')) where booking_code=v_code;
  return v_result;
end $$;

create or replace function list_bookings_json_v10() returns jsonb language plpgsql security definer as $$
declare v_base jsonb;v_result jsonb:='[]'::jsonb;v_booking jsonb;v_creator text;
begin
  v_base:=list_bookings_json_v9();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select created_by into v_creator from bookings where booking_code=v_booking->>'bookingCode';
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('createdBy',coalesce(v_creator,'')));
  end loop;return v_result;
end $$;
