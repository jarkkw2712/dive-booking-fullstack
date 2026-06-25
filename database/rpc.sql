
create or replace function list_bookings_json()
returns jsonb language plpgsql security definer as $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(obj order by obj->>'travelDate' desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'bookingCode', b.booking_code,
      'tripType', b.trip_type,
      'travelDate', b.travel_date::text,
      'returnDate', coalesce(b.return_date::text,''),
      'leaderTitle', coalesce(b.leader_title,''),
      'leaderFirstName', b.leader_first_name,
      'leaderLastName', b.leader_last_name,
      'phone', coalesce(b.phone,''),
      'source', coalesce(b.source,''),
      'agentName', coalesce(b.agent_name,''),
      'status', b.status,
      'paymentMethod', coalesce(b.payment_method,'เงินสด'),
      'bookingNote', coalesce(b.booking_note,''),
      'totalAmount', b.total_amount,
      'programRevenue', b.program_revenue,
      'preAddOnRevenue', b.pre_addon_revenue,
      'islandAddOnRevenue', b.island_addon_revenue,
      'passengers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'title',coalesce(p.title,''),'firstName',p.first_name,'lastName',p.last_name,'age',coalesce(p.age::text,''),'phone',coalesce(p.phone,''),'island',coalesce(p.island,''),'foodAllergy',coalesce(p.food_allergy,''),'medicalNote',coalesce(p.medical_note,''),'isLeader',p.is_leader,
          'program',(select jsonb_build_object('programId',bp.program_id,'name',mp.program_name,'qty',bp.qty,'price',bp.unit_price,'defaultPrice',bp.default_price,'priceReason',coalesce(bp.price_reason,'ราคา Default'),'priceReasonOther',coalesce(bp.price_reason_other,'')) from booking_programs bp join master_programs mp on mp.program_id=bp.program_id where bp.passenger_id=p.passenger_id limit 1),
          'preAddOns',(select coalesce(jsonb_agg(jsonb_build_object('id',ba.addon_id,'name',ma.addon_name,'selected',true,'qty',ba.qty,'price',ba.unit_price,'defaultPrice',ba.default_price,'customName',case when ba.addon_id='other' then ba.addon_name_snapshot else '' end)), '[]'::jsonb) from booking_addons ba join master_addons ma on ma.addon_id=ba.addon_id where ba.passenger_id=p.passenger_id and ba.addon_source='pre'),
          'islandAddOns',(select coalesce(jsonb_agg(jsonb_build_object('id',ba.addon_id,'name',ba.addon_name_snapshot,'qty',ba.qty,'price',ba.unit_price,'defaultPrice',ba.default_price,'paymentMethod',coalesce(ba.payment_method,''),'receivedBy',coalesce(ba.received_by,''))), '[]'::jsonb) from booking_addons ba where ba.passenger_id=p.passenger_id and ba.addon_source='island')
        ) order by p.passenger_no), '[]'::jsonb) from passengers p where p.booking_id=b.booking_id
      )
    ) obj
    from bookings b
  ) x;
  return result;
end $$;

create or replace function upsert_booking_from_json(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_booking_id uuid; v_code text; v_pass jsonb; v_pid uuid; v_prog jsonb; v_add jsonb; v_no int:=0;
begin
  v_code := coalesce(p_booking->>'bookingCode','BK'||extract(epoch from now())::bigint::text);
  insert into bookings(booking_code,trip_type,travel_date,return_date,leader_title,leader_first_name,leader_last_name,phone,source,agent_name,status,payment_method,booking_note,total_amount,program_revenue,pre_addon_revenue,island_addon_revenue)
  values(v_code,coalesce(p_booking->>'tripType','one_way'),(p_booking->>'travelDate')::date,nullif(p_booking->>'returnDate','')::date,nullif(p_booking->>'leaderTitle',''),coalesce(p_booking->>'leaderFirstName','-'),coalesce(p_booking->>'leaderLastName','-'),nullif(p_booking->>'phone',''),nullif(p_booking->>'source',''),nullif(p_booking->>'agentName',''),coalesce(p_booking->>'status','pending'),coalesce(p_booking->>'paymentMethod','เงินสด'),nullif(p_booking->>'bookingNote',''),coalesce((p_booking->>'totalAmount')::numeric,0),coalesce((p_booking->>'programRevenue')::numeric,0),coalesce((p_booking->>'preAddOnRevenue')::numeric,0),coalesce((p_booking->>'islandAddOnRevenue')::numeric,0))
  on conflict(booking_code) do update set trip_type=excluded.trip_type,travel_date=excluded.travel_date,return_date=excluded.return_date,leader_title=excluded.leader_title,leader_first_name=excluded.leader_first_name,leader_last_name=excluded.leader_last_name,phone=excluded.phone,source=excluded.source,agent_name=excluded.agent_name,status=excluded.status,payment_method=excluded.payment_method,booking_note=excluded.booking_note,total_amount=excluded.total_amount,program_revenue=excluded.program_revenue,pre_addon_revenue=excluded.pre_addon_revenue,island_addon_revenue=excluded.island_addon_revenue,updated_at=now()
  returning booking_id into v_booking_id;

  delete from booking_addons where passenger_id in (select passenger_id from passengers where booking_id=v_booking_id);
  delete from booking_programs where passenger_id in (select passenger_id from passengers where booking_id=v_booking_id);
  delete from passengers where booking_id=v_booking_id;

  for v_pass in select * from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no := v_no+1;
    insert into passengers(booking_id,passenger_no,is_leader,title,first_name,last_name,age,phone,island,food_allergy,medical_note)
    values(v_booking_id,v_no,coalesce((v_pass->>'isLeader')::boolean,false),nullif(v_pass->>'title',''),coalesce(v_pass->>'firstName','-'),coalesce(v_pass->>'lastName','-'),nullif(v_pass->>'age','')::int,nullif(v_pass->>'phone',''),nullif(v_pass->>'island',''),nullif(v_pass->>'foodAllergy',''),nullif(v_pass->>'medicalNote',''))
    returning passenger_id into v_pid;

    v_prog := v_pass->'program';
    insert into booking_programs(passenger_id,program_id,qty,unit_price,default_price,price_reason,price_reason_other)
    values(v_pid,coalesce(v_prog->>'programId','boat_ticket'),coalesce((v_prog->>'qty')::int,1),coalesce((v_prog->>'price')::numeric,0),coalesce((v_prog->>'defaultPrice')::numeric,0),nullif(v_prog->>'priceReason',''),nullif(v_prog->>'priceReasonOther',''));

    for v_add in select * from jsonb_array_elements(coalesce(v_pass->'preAddOns','[]'::jsonb)) loop
      if coalesce((v_add->>'selected')::boolean,false) then
        insert into booking_addons(passenger_id,addon_source,addon_id,addon_name_snapshot,qty,unit_price,default_price)
        values(v_pid,'pre',coalesce(v_add->>'id','other'),coalesce(nullif(v_add->>'customName',''),v_add->>'name','อื่นๆ'),coalesce((v_add->>'qty')::int,1),coalesce((v_add->>'price')::numeric,0),coalesce((v_add->>'defaultPrice')::numeric,0));
      end if;
    end loop;

    for v_add in select * from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      insert into booking_addons(passenger_id,addon_source,addon_id,addon_name_snapshot,qty,unit_price,default_price,payment_method,received_by)
      values(v_pid,'island',coalesce(v_add->>'id','other'),coalesce(v_add->>'name','อื่นๆ'),coalesce((v_add->>'qty')::int,1),coalesce((v_add->>'price')::numeric,0),coalesce((v_add->>'defaultPrice')::numeric,0),nullif(v_add->>'paymentMethod',''),nullif(v_add->>'receivedBy',''));
    end loop;
  end loop;

  insert into audit_logs(booking_code,action,detail,after_json) values(v_code,'UPSERT_BOOKING','Saved from backend API',p_booking);
  return jsonb_build_object('success',true,'bookingCode',v_code);
end $$;

create or replace function cancel_booking_by_code(p_booking_code text, p_reason text)
returns jsonb language plpgsql security definer as $$
begin
  update bookings set status='cancelled', cancel_reason=p_reason, cancelled_at=now(), updated_at=now() where booking_code=p_booking_code;
  insert into audit_logs(booking_code,action,detail) values(p_booking_code,'CANCEL_BOOKING',p_reason);
  return jsonb_build_object('success',true,'bookingCode',p_booking_code);
end $$;
