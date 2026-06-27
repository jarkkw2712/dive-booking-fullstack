-- =========================================================
-- Dive Booking System - Phase 2 Supabase RPC
-- Purpose:
--   Let frontend save/load booking as JSON while database stores normalized tables.
-- =========================================================

-- =========================================================
-- Helper: get current app user id
-- =========================================================

create or replace function current_app_user_id()
returns uuid as $$
declare
  v_uid uuid;
  v_user_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is not null then
    select user_id into v_user_id
    from app_users
    where auth_user_id = v_uid
    limit 1;

    if v_user_id is not null then
      return v_user_id;
    end if;
  end if;

  -- mock login / prototype fallback
  select user_id into v_user_id
  from app_users
  where username in ('admin', 'admin@yourcompany.com')
  order by username
  limit 1;

  return v_user_id;
end;
$$ language plpgsql stable security definer;

-- =========================================================
-- RPC: list_bookings_json
-- Returns frontend-compatible JSON.
-- =========================================================

create or replace function list_bookings_json()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(booking_obj order by booking_obj->>'travelDate' desc, booking_obj->>'bookingCode'), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'bookingCode', b.booking_code,
      'receiptNo', coalesce((
        select r.receipt_no
        from receipts r
        where r.booking_id = b.booking_id
        order by r.issued_at desc
        limit 1
      ), 'RC-' || b.booking_code),
      'tripType', b.trip_type,
      'travelDate', b.travel_date::text,
      'returnDate', case when b.return_date is null then '' else b.return_date::text end,
      'leaderTitle', coalesce(b.leader_title, ''),
      'leaderFirstName', b.leader_first_name,
      'leaderLastName', b.leader_last_name,
      'phone', coalesce(b.phone, ''),
      'source', coalesce(b.source, ''),
      'agentName', coalesce(b.agent_name, ''),
      'status', b.status,
      'bookingNote', coalesce(b.booking_note, ''),
      'paymentMethod', coalesce(b.payment_method, 'เงินสด'),
      'totalAmount', b.total_amount,
      'programRevenue', b.program_revenue,
      'preAddOnRevenue', b.pre_addon_revenue,
      'islandAddOnRevenue', b.island_addon_revenue,
      'cancelReason', coalesce(b.cancel_reason, ''),
      'cancelledAt', case when b.cancelled_at is null then '' else b.cancelled_at::text end,
      'passengers', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'title', coalesce(p.title, ''),
            'firstName', p.first_name,
            'lastName', p.last_name,
            'age', coalesce(p.age::text, ''),
            'phone', coalesce(p.phone, ''),
            'island', coalesce(p.island, ''),
            'medicalNote', coalesce(p.medical_note, ''),
            'foodAllergy', coalesce(p.food_allergy, ''),
            'isLeader', p.is_leader,
            'program', (
              select jsonb_build_object(
                'programId', bp.program_id,
                'name', mp.program_name,
                'qty', bp.qty,
                'price', bp.unit_price,
                'defaultPrice', bp.default_price,
                'priceReason', coalesce(bp.price_reason, 'ราคา Default'),
                'priceReasonOther', coalesce(bp.price_reason_other, '')
              )
              from booking_programs bp
              join master_programs mp on mp.program_id = bp.program_id
              where bp.passenger_id = p.passenger_id
              limit 1
            ),
            'preAddOns', (
              select coalesce(jsonb_agg(
                jsonb_build_object(
                  'id', ba.addon_id,
                  'name', ma.addon_name,
                  'selected', true,
                  'qty', ba.qty,
                  'price', ba.unit_price,
                  'defaultPrice', ba.default_price,
                  'customName', case when ba.addon_id = 'other' then ba.addon_name_snapshot else '' end,
                  'priceReason', coalesce(ba.price_reason, 'ราคา Default'),
                  'priceReasonOther', coalesce(ba.price_reason_other, '')
                )
              ), '[]'::jsonb)
              from booking_addons ba
              join master_addons ma on ma.addon_id = ba.addon_id
              where ba.passenger_id = p.passenger_id
                and ba.addon_source = 'pre'
            ),
            'islandAddOns', (
              select coalesce(jsonb_agg(
                jsonb_build_object(
                  'id', ba.addon_id,
                  'name', ba.addon_name_snapshot,
                  'qty', ba.qty,
                  'price', ba.unit_price,
                  'defaultPrice', ba.default_price,
                  'paymentMethod', coalesce(ba.payment_method, ''),
                  'receivedBy', coalesce(u.display_name, ''),
                  'addedLocation', 'island',
                  'addedAt', ba.created_at::text
                )
              ), '[]'::jsonb)
              from booking_addons ba
              left join app_users u on u.user_id = ba.received_by
              where ba.passenger_id = p.passenger_id
                and ba.addon_source = 'island'
            )
          )
          order by p.passenger_no
        ), '[]'::jsonb)
        from passengers p
        where p.booking_id = b.booking_id
      )
    ) as booking_obj
    from bookings b
  ) x;

  return result;
end;
$$;

-- =========================================================
-- RPC: upsert_booking_from_json
-- Saves frontend booking JSON into normalized tables.
-- =========================================================

create or replace function upsert_booking_from_json(p_booking jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
  v_booking_code text;
  v_passenger jsonb;
  v_passenger_id uuid;
  v_program jsonb;
  v_addon jsonb;
  v_passenger_no int := 0;
  v_user_id uuid;
begin
  v_user_id := current_app_user_id();
  v_booking_code := p_booking->>'bookingCode';

  if v_booking_code is null or v_booking_code = '' then
    v_booking_code := 'BK' || extract(epoch from now())::bigint::text;
  end if;

  insert into bookings (
    booking_code,
    trip_type,
    travel_date,
    return_date,
    leader_title,
    leader_first_name,
    leader_last_name,
    phone,
    source,
    agent_name,
    status,
    payment_method,
    booking_note,
    total_amount,
    program_revenue,
    pre_addon_revenue,
    island_addon_revenue,
    created_by,
    updated_by
  )
  values (
    v_booking_code,
    coalesce(p_booking->>'tripType', 'one_way'),
    (p_booking->>'travelDate')::date,
    nullif(p_booking->>'returnDate', '')::date,
    nullif(p_booking->>'leaderTitle', ''),
    coalesce(p_booking->>'leaderFirstName', '-'),
    coalesce(p_booking->>'leaderLastName', '-'),
    nullif(p_booking->>'phone', ''),
    nullif(p_booking->>'source', ''),
    nullif(p_booking->>'agentName', ''),
    coalesce(p_booking->>'status', 'pending'),
    coalesce(p_booking->>'paymentMethod', 'เงินสด'),
    nullif(p_booking->>'bookingNote', ''),
    coalesce((p_booking->>'totalAmount')::numeric, 0),
    coalesce((p_booking->>'programRevenue')::numeric, 0),
    coalesce((p_booking->>'preAddOnRevenue')::numeric, 0),
    coalesce((p_booking->>'islandAddOnRevenue')::numeric, 0),
    v_user_id,
    v_user_id
  )
  on conflict (booking_code)
  do update set
    trip_type = excluded.trip_type,
    travel_date = excluded.travel_date,
    return_date = excluded.return_date,
    leader_title = excluded.leader_title,
    leader_first_name = excluded.leader_first_name,
    leader_last_name = excluded.leader_last_name,
    phone = excluded.phone,
    source = excluded.source,
    agent_name = excluded.agent_name,
    status = excluded.status,
    payment_method = excluded.payment_method,
    booking_note = excluded.booking_note,
    total_amount = excluded.total_amount,
    program_revenue = excluded.program_revenue,
    pre_addon_revenue = excluded.pre_addon_revenue,
    island_addon_revenue = excluded.island_addon_revenue,
    updated_by = v_user_id,
    updated_at = now()
  returning booking_id into v_booking_id;

  -- Replace child rows for simplicity in phase 2
  delete from booking_addons
  where passenger_id in (select passenger_id from passengers where booking_id = v_booking_id);

  delete from booking_programs
  where passenger_id in (select passenger_id from passengers where booking_id = v_booking_id);

  delete from passengers where booking_id = v_booking_id;

  for v_passenger in select * from jsonb_array_elements(coalesce(p_booking->'passengers', '[]'::jsonb))
  loop
    v_passenger_no := v_passenger_no + 1;

    insert into passengers (
      booking_id,
      passenger_no,
      is_leader,
      title,
      first_name,
      last_name,
      age,
      phone,
      island,
      food_allergy,
      medical_note
    )
    values (
      v_booking_id,
      v_passenger_no,
      coalesce((v_passenger->>'isLeader')::boolean, false),
      nullif(v_passenger->>'title', ''),
      coalesce(v_passenger->>'firstName', '-'),
      coalesce(v_passenger->>'lastName', '-'),
      nullif(v_passenger->>'age', '')::int,
      nullif(v_passenger->>'phone', ''),
      nullif(v_passenger->>'island', ''),
      nullif(v_passenger->>'foodAllergy', ''),
      nullif(v_passenger->>'medicalNote', '')
    )
    returning passenger_id into v_passenger_id;

    v_program := v_passenger->'program';

    insert into booking_programs (
      passenger_id,
      program_id,
      qty,
      unit_price,
      default_price,
      price_reason,
      price_reason_other
    )
    values (
      v_passenger_id,
      coalesce(v_program->>'programId', 'boat_ticket'),
      coalesce((v_program->>'qty')::int, 1),
      coalesce((v_program->>'price')::numeric, 0),
      coalesce((v_program->>'defaultPrice')::numeric, 0),
      nullif(v_program->>'priceReason', ''),
      nullif(v_program->>'priceReasonOther', '')
    );

    -- Pre add-ons
    for v_addon in select * from jsonb_array_elements(coalesce(v_passenger->'preAddOns', '[]'::jsonb))
    loop
      if coalesce((v_addon->>'selected')::boolean, false) then
        insert into booking_addons (
          passenger_id,
          addon_source,
          addon_id,
          addon_name_snapshot,
          qty,
          unit_price,
          default_price,
          price_reason,
          price_reason_other,
          created_by
        )
        values (
          v_passenger_id,
          'pre',
          coalesce(v_addon->>'id', 'other'),
          case
            when v_addon->>'id' = 'other' and nullif(v_addon->>'customName', '') is not null
              then v_addon->>'customName'
            else coalesce(v_addon->>'name', 'อื่นๆ')
          end,
          coalesce((v_addon->>'qty')::int, 1),
          coalesce((v_addon->>'price')::numeric, 0),
          coalesce((v_addon->>'defaultPrice')::numeric, 0),
          nullif(v_addon->>'priceReason', ''),
          nullif(v_addon->>'priceReasonOther', ''),
          v_user_id
        );
      end if;
    end loop;

    -- Island add-ons
    for v_addon in select * from jsonb_array_elements(coalesce(v_passenger->'islandAddOns', '[]'::jsonb))
    loop
      insert into booking_addons (
        passenger_id,
        addon_source,
        addon_id,
        addon_name_snapshot,
        qty,
        unit_price,
        default_price,
        payment_method,
        created_by
      )
      values (
        v_passenger_id,
        'island',
        coalesce(v_addon->>'id', 'other'),
        coalesce(v_addon->>'name', 'อื่นๆ'),
        coalesce((v_addon->>'qty')::int, 1),
        coalesce((v_addon->>'price')::numeric, 0),
        coalesce((v_addon->>'defaultPrice')::numeric, 0),
        nullif(v_addon->>'paymentMethod', ''),
        v_user_id
      );
    end loop;
  end loop;

  insert into audit_logs (
    booking_id,
    booking_code,
    action,
    detail,
    after_json,
    changed_by,
    changed_at
  )
  values (
    v_booking_id,
    v_booking_code,
    'UPSERT_BOOKING',
    'Save booking from frontend JSON',
    p_booking,
    v_user_id,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'bookingCode', v_booking_code,
    'bookingId', v_booking_id
  );
end;
$$;

-- =========================================================
-- RPC: cancel_booking_by_code
-- =========================================================

create or replace function cancel_booking_by_code(
  p_booking_code text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
  v_user_id uuid;
begin
  v_user_id := current_app_user_id();

  update bookings
  set status = 'cancelled',
      cancel_reason = p_reason,
      cancelled_at = now(),
      cancelled_by = v_user_id,
      updated_by = v_user_id,
      updated_at = now()
  where booking_code = p_booking_code
  returning booking_id into v_booking_id;

  if v_booking_id is null then
    raise exception 'Booking not found: %', p_booking_code;
  end if;

  insert into audit_logs (
    booking_id,
    booking_code,
    action,
    detail,
    changed_by,
    changed_at
  )
  values (
    v_booking_id,
    p_booking_code,
    'CANCEL_BOOKING',
    p_reason,
    v_user_id,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'bookingCode', p_booking_code
  );
end;
$$;
