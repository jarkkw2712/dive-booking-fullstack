-- Replace the historical v1-v21 procedural JSON wrappers with one set-based read.
-- The JSON contract is unchanged; no booking or financial history is modified.

create or replace function list_bookings_json_v22() returns jsonb
language sql stable security definer set search_path=public as $$
with program_rows as (
  select distinct on (bp.passenger_id)
    bp.passenger_id,
    jsonb_build_object(
      'programId',bp.program_id,
      'name',coalesce(mp.program_name,bp.program_id,''),
      'qty',coalesce(bp.qty,1),
      'price',coalesce(bp.unit_price,0),
      'defaultPrice',coalesce(bp.default_price,0),
      'priceReason',coalesce(bp.price_reason,''),
      'priceReasonOther',coalesce(bp.price_reason_other,''),
      'accommodationPolicy',coalesce(p.accommodation_policy_snapshot,mp.accommodation_policy,'optional'),
      'selfBookedTentCredit',coalesce(mp.self_booked_tent_credit,0)
    ) as program
  from booking_programs bp
  join passengers p on p.passenger_id=bp.passenger_id
  left join master_programs mp on mp.program_id=bp.program_id
  order by bp.passenger_id,bp.booking_program_id
), pre_addons as (
  select ba.passenger_id,jsonb_agg(jsonb_build_object(
    'id',ba.addon_id,
    'name',coalesce(nullif(ba.addon_name_snapshot,''),ma.addon_name,ba.addon_id,''),
    'selected',true,
    'qty',coalesce(ba.qty,1),
    'price',coalesce(ba.unit_price,0),
    'defaultPrice',coalesce(ba.default_price,0),
    'customName',case when ba.addon_id='other' then coalesce(ba.addon_name_snapshot,'') else '' end,
    'paymentMethod',coalesce(ba.payment_method,''),
    'receivedBy',coalesce(ba.received_by,''),
    'documentVisibility',jsonb_build_object(
      'show_register',ba.show_register,
      'show_money_receipt',ba.show_money_receipt,
      'show_equipment_slip',ba.show_equipment_slip,
      'show_van_receipt',ba.show_van_receipt,
      'show_boat_ticket',ba.show_boat_ticket,
      'show_island_purchase_order',ba.show_island_purchase_order,
      'show_dive_receipt',ba.show_dive_receipt
    )
  ) order by ba.created_at,ba.addon_row_id) as items
  from booking_addons ba
  left join master_addons ma on ma.addon_id=ba.addon_id
  where ba.addon_source='pre'
  group by ba.passenger_id
), island_addons as (
  select ba.passenger_id,jsonb_agg(jsonb_build_object(
    'id',ba.addon_id,
    'name',coalesce(nullif(ba.addon_name_snapshot,''),mia.island_addon_name,ba.addon_id,''),
    'selected',true,
    'qty',coalesce(ba.qty,1),
    'price',coalesce(ba.unit_price,0),
    'defaultPrice',coalesce(ba.default_price,0),
    'paymentMethod',coalesce(ba.payment_method,''),
    'receivedBy',coalesce(ba.received_by,''),
    'source','island',
    'documentVisibility',jsonb_build_object(
      'show_register',ba.show_register,
      'show_money_receipt',ba.show_money_receipt,
      'show_equipment_slip',ba.show_equipment_slip,
      'show_van_receipt',ba.show_van_receipt,
      'show_boat_ticket',ba.show_boat_ticket,
      'show_island_purchase_order',ba.show_island_purchase_order,
      'show_dive_receipt',ba.show_dive_receipt
    )
  ) order by ba.created_at,ba.addon_row_id) as items
  from booking_addons ba
  left join master_island_addons mia on mia.island_addon_id=ba.addon_id
  where ba.addon_source='island'
  group by ba.passenger_id
), passenger_rows as (
  select p.booking_id,jsonb_agg(jsonb_build_object(
    'title',coalesce(p.title,''),
    'firstName',coalesce(p.first_name,''),
    'lastName',coalesce(p.last_name,''),
    'age',coalesce(p.age::text,''),
    'phone',coalesce(p.phone,''),
    'island',coalesce(p.island,''),
    'foodAllergy',coalesce(p.food_allergy,''),
    'medicalNote',coalesce(p.medical_note,''),
    'isLeader',coalesce(p.is_leader,false),
    'passengerType',coalesce(p.passenger_type,'adult'),
    'nationalityType',coalesce(p.nationality_type,'thai'),
    'pickupLocation',coalesce(p.pickup_location,''),
    'transportationMethod',coalesce(p.transportation_method,''),
    'transportationAmount',coalesce(p.transportation_amount,0),
    'transportationPaymentMethod',coalesce(p.transportation_payment_method,''),
    'returnTransportationMethod',coalesce(p.return_transportation_method,p.transportation_method,''),
    'returnTransportationAmount',coalesce(p.return_transportation_amount,0),
    'returnTransportationPaymentMethod',coalesce(p.return_transportation_payment_method,''),
    'passengerTravelDate',coalesce(p.passenger_travel_date::text,''),
    'passengerReturnDate',coalesce(p.passenger_return_date::text,''),
    'transportationDestination',coalesce(p.transportation_destination,''),
    'outboundDestination',coalesce(p.outbound_destination,p.transportation_destination,''),
    'returnDestination',coalesce(p.return_destination,''),
    'parkAccommodationType',coalesce(p.park_accommodation_type,'none'),
    'parkAccommodationBookedBy',coalesce(p.park_accommodation_booked_by,'customer'),
    'parkAccommodationReference',coalesce(p.park_accommodation_reference,''),
    'parkAccommodationNote',coalesce(p.park_accommodation_note,''),
    'parkAccommodationArrangement',coalesce(p.park_accommodation_arrangement,'undecided'),
    'accommodationId',coalesce(p.accommodation_id,''),
    'accommodationName',coalesce(ma.accommodation_name,''),
    'accommodationBookedBy',coalesce(p.accommodation_booked_by,'customer'),
    'accommodationQty',coalesce(p.accommodation_qty,0),
    'accommodationPrice',coalesce(p.accommodation_unit_price,0),
    'accommodationDefaultPrice',coalesce(p.accommodation_default_price,0),
    'tentCreditAmount',coalesce(p.tent_credit_amount,0),
    'program',pr.program,
    'preAddOns',coalesce(pa.items,'[]'::jsonb),
    'islandAddOns',coalesce(ia.items,'[]'::jsonb)
  ) order by p.passenger_no) as passengers
  from passengers p
  left join master_accommodations ma on ma.accommodation_id=p.accommodation_id
  left join program_rows pr on pr.passenger_id=p.passenger_id
  left join pre_addons pa on pa.passenger_id=p.passenger_id
  left join island_addons ia on ia.passenger_id=p.passenger_id
  group by p.booking_id
)
select coalesce(jsonb_agg(jsonb_build_object(
  'bookingCode',b.booking_code,
  'tripType',coalesce(b.trip_type,'one_way'),
  'travelDate',coalesce(b.travel_date::text,''),
  'returnDate',coalesce(b.return_date::text,''),
  'leaderTitle',coalesce(b.leader_title,''),
  'leaderFirstName',coalesce(b.leader_first_name,''),
  'leaderLastName',coalesce(b.leader_last_name,''),
  'phone',coalesce(b.phone,''),
  'contactEmail',coalesce(b.contact_email,''),
  'source',coalesce(b.source,''),
  'agentName',coalesce(b.agent_name,''),
  'transportationMethod',coalesce(b.transportation_method,''),
  'status',coalesce(b.status,''),
  'paymentMethod',coalesce(b.payment_method,''),
  'depositAmount',coalesce(b.deposit_amount,0),
  'depositPaymentMethod',coalesce(b.deposit_payment_method,''),
  'creditAmount',coalesce(b.credit_amount,0),
  'creditPaymentMethod',coalesce(b.credit_payment_method,''),
  'paymentBreakdown',coalesce(b.payment_breakdown,'{}'::jsonb),
  'receiptBookNo',coalesce(b.receipt_book_no,''),
  'manualReceiptNo',coalesce(b.manual_receipt_no,''),
  'boatTicketBookNo',coalesce(b.boat_ticket_book_no,''),
  'boatTicketNo',coalesce(b.boat_ticket_no,''),
  'bookingOriginal',coalesce(b.booking_original,''),
  'bookingNote',coalesce(b.booking_note,''),
  'totalAmount',coalesce(b.total_amount,0),
  'programRevenue',coalesce(b.program_revenue,0),
  'preAddOnRevenue',coalesce(b.pre_addon_revenue,0),
  'islandAddOnRevenue',coalesce(b.island_addon_revenue,0),
  'cancelReason',coalesce(b.cancel_reason,''),
  'cancelledAt',b.cancelled_at,
  'cancelledBy',coalesce(b.cancelled_by,''),
  'createdAt',b.created_at,
  'createdBy',coalesce(b.created_by,''),
  'passengers',coalesce(px.passengers,'[]'::jsonb)
) order by b.travel_date desc nulls last,b.created_at desc),'[]'::jsonb)
from bookings b
left join passenger_rows px on px.booking_id=b.booking_id;
$$;

grant execute on function list_bookings_json_v22() to service_role;

comment on function list_bookings_json_v22() is
  'Set-based Booking read model replacing the procedural v1-v21 wrapper chain.';
