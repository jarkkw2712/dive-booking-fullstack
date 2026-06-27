# localStorage → PostgreSQL Mapping

## localStorage key: bookings

### bookings table
- bookingCode → booking_code
- tripType → trip_type
- travelDate → travel_date
- returnDate → return_date
- leaderTitle → leader_title
- leaderFirstName → leader_first_name
- leaderLastName → leader_last_name
- phone → phone
- source → source
- agentName → agent_name
- status → status
- paymentMethod → payment_method
- bookingNote → booking_note
- totalAmount → total_amount
- programRevenue → program_revenue
- preAddOnRevenue → pre_addon_revenue
- islandAddOnRevenue → island_addon_revenue
- cancelReason → cancel_reason
- cancelledAt → cancelled_at

### passengers table
For each booking.passengers[]
- passenger array index + 1 → passenger_no
- isLeader → is_leader
- title → title
- firstName → first_name
- lastName → last_name
- age → age
- phone → phone
- island → island
- foodAllergy → food_allergy
- medicalNote → medical_note

### booking_programs table
For each passenger.program
- program.programId → program_id
- program.qty → qty
- program.price → unit_price
- program.defaultPrice → default_price
- program.priceReason → price_reason
- program.priceReasonOther → price_reason_other

### booking_addons table
For each passenger.preAddOns where selected = true
- addon_source = pre

For each passenger.islandAddOns[]
- addon_source = island
- paymentMethod → payment_method
- receivedBy → received_by

## localStorage key: audit_logs
→ audit_logs table

## localStorage key: master_data
→ master_programs / master_addons

## localStorage key: role_permissions
→ role_permissions
