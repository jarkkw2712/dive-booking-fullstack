import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrintCenterReport } from "../src/services/reportService.js";

const testDir=path.dirname(fileURLToPath(import.meta.url));

test("booking API caches expensive list reads and invalidates after mutations",()=>{
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8");
  assert.match(route,/const bookingCache=/);
  assert.match(route,/Date\.now\(\)\+30_000/);
  assert.match(route,/if\(bookingCache\.promise\)return bookingCache\.promise/);
  assert.ok((route.match(/invalidateBookingCache\(\)/g)||[]).length>=4);
});

test("booking list performance migration adds the required read indexes",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260922_037_booking_list_performance_indexes.sql"),"utf8");
  for(const expected of ["passengers_booking_passenger_no_idx","booking_programs_passenger_idx","booking_addons_passenger_source_idx","bookings_travel_status_idx","bookings_return_status_idx"])assert.match(sql,new RegExp(expected));
  assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("booking add-on references validate against the correct master family",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260922_038_fix_polymorphic_booking_addon_reference.sql"),"utf8");
  assert.match(sql,/con\.confrelid='public\.master_addons'::regclass/);
  assert.match(sql,/from booking_addons ba[\s\S]+ba\.addon_source='island'/);
  assert.match(sql,/if new\.addon_source='pre'[\s\S]+from master_addons/);
  assert.match(sql,/elsif new\.addon_source='island'[\s\S]+from master_island_addons/);
  assert.match(sql,/booking_addons_master_reference_trigger/);
  assert.doesNotMatch(sql,/delete from|truncate/i);
});

const passenger=(name,island="อ่าวไม้งาม",accommodation="")=>({firstName:name,lastName:"ทดสอบ",age:30,phone:"0800000000",island,foodAllergy:"",medicalNote:"",accommodationId:accommodation,accommodationName:accommodation==="park_house"?"บ้านพักอุทยาน":accommodation==="park_tent"?"เต็นท์อุทยาน":"",accommodationBookedBy:"customer",parkAccommodationReference:accommodation?"PARK-01":"",program:{name:"One Day Trip"},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:1}]});
const bookings=[
  {bookingCode:"BK1",travelDate:"2026-07-23",returnDate:"2026-07-24",leaderFirstName:"สมชาย",leaderLastName:"ใจดี",phone:"081",status:"confirmed",paymentMethod:"โอน",totalAmount:3000,passengers:[passenger("หนึ่ง","อ่าวไม้งาม","park_house"),passenger("สอง","อ่าวไม้งาม","park_tent")]},
  {bookingCode:"BK2",travelDate:"2026-07-24",returnDate:"2026-07-25",leaderFirstName:"สมหญิง",leaderLastName:"ใจดี",phone:"082",status:"pending",totalAmount:2000,passengers:[passenger("สาม","อ่าวช่องขาด")]},
  {bookingCode:"CANCEL",travelDate:"2026-07-23",returnDate:"2026-07-24",status:"cancelled",totalAmount:9999,passengers:[passenger("ยกเลิก")]}
];

test("management report summarizes today and forecasts seven days without cancelled bookings",()=>{
  const report=buildPrintCenterReport({bookings,financialRows:[{booking_code:"BK1",net_cash_received:1000}],date:"2026-07-23",type:"management"});
  assert.equal(report.rows.length,7);
  assert.deepEqual(report.range,{from:"2026-07-23",to:"2026-07-29"});
  assert.equal(report.summary.bookings,1);
  assert.equal(report.summary.pax,2);
  assert.equal(report.summary.expectedRevenue,3000);
  assert.equal(report.summary.actualReceived,1000);
  assert.equal(report.summary.outstanding,2000);
  assert.equal(report.summary.sevenDayExpected,5000);
  assert.deepEqual(report.equipment,[{code:"fin",name:"Fin",qty:2}]);
  assert.equal(report.accommodation.parkHouse,1);
  assert.equal(report.accommodation.parkTent,1);
  assert.equal(report.rows[0].equipmentUnits,2);
});

test("management daily rows separate age, foreign nationality and FOC counts",()=>{
  const categorized=[{bookingCode:"PEOPLE",travelDate:"2026-09-04",status:"confirmed",totalAmount:0,passengers:[
    {passengerType:"adult",nationalityType:"thai"},
    {passengerType:"child",nationalityType:"foreign"},
    {passengerType:"infant",nationalityType:"thai"},
    {passengerType:"foc",nationalityType:"foreign"}
  ]}];
  const row=buildPrintCenterReport({bookings:categorized,date:"2026-09-04",type:"management"}).rows[0];
  assert.deepEqual({adult:row.adult,child:row.child,infant:row.infant,foreign:row.foreign,foc:row.foc,pax:row.pax},{adult:1,child:1,infant:1,foreign:2,foc:1,pax:4});
});

test("management report supports custom ranges and transposed income categories",()=>{
  const report=buildPrintCenterReport({bookings,date:"2026-07-23",toDate:"2026-07-24",type:"management"});
  assert.equal(report.rows.length,2);
  assert.deepEqual(report.range,{from:"2026-07-23",to:"2026-07-24"});
  assert.ok(report.incomeMatrix.some(row=>row.category==="ค่าตั๋วเรือ"));
  assert.ok(report.incomeMatrix.some(row=>row.category==="ขายเชื่อ"));
  assert.ok(report.incomeMatrix.some(row=>row.category==="รวมรายได้"));
  assert.equal(report.expenseMatrix.length,7);
  assert.ok(report.expenseMatrix.every(row=>Object.values(row.values).every(value=>value===0)));
});

test("management operations list active master data even when usage is zero",()=>{
  const report=buildPrintCenterReport({bookings:[],masterAddOns:[{addon_id:"mask",addon_name:"หน้ากาก"}],masterAccommodations:[{accommodation_id:"park_house",accommodation_name:"บ้านพักอุทยาน"}],date:"2026-09-04",type:"management"});
  assert.deepEqual(report.equipment,[{code:"mask",name:"หน้ากาก",qty:0}]);
  assert.deepEqual(report.accommodationItems,[{code:"park_house",name:"บ้านพักอุทยาน",qty:0,defaultPrice:0,amount:0}]);
});

test("accommodation quantity and price flow to reports only when the company books it",()=>{
  const accommodationBookings=[
    {bookingCode:"STAY-COMPANY",travelDate:"2026-09-04",status:"confirmed",paymentMethod:"เงินสด",totalAmount:1500,passengers:[{firstName:"A",accommodationId:"park_house",accommodationName:"บ้านพักอุทยาน",accommodationBookedBy:"company",accommodationQty:2,accommodationPrice:750}]},
    {bookingCode:"STAY-CUSTOMER",travelDate:"2026-09-04",status:"confirmed",paymentMethod:"เงินสด",totalAmount:0,passengers:[{firstName:"B",accommodationId:"park_house",accommodationName:"บ้านพักอุทยาน",accommodationBookedBy:"customer",accommodationQty:3,accommodationPrice:900}]}
  ],paymentMethods=[{method_id:"cash",method_name:"เงินสด",payment_type:"cash"}],masterAccommodations=[{accommodation_id:"park_house",accommodation_name:"บ้านพักอุทยาน",default_price:800}];
  const management=buildPrintCenterReport({bookings:accommodationBookings,paymentMethods,masterAccommodations,date:"2026-09-04",type:"management"});
  assert.equal(management.accommodation.parkHouse,5);assert.equal(management.accommodation.companyBooked,2);assert.equal(management.accommodation.customerSelfBooked,3);assert.equal(management.accommodation.companyRevenue,1500);assert.equal(management.accommodation.customerReferenceValue,2700);assert.equal(management.accommodationItems[0].amount,1500);assert.equal(management.incomeMatrix.find(row=>row.category==="ที่พัก").values["2026-09-04"],1500);
  const tour=buildPrintCenterReport({bookings:accommodationBookings,paymentMethods,date:"2026-09-04",toDate:"2026-09-04",type:"tour_expense_reference"});
  assert.equal(tour.rows[0].accommodationCash,1500);assert.equal(tour.rows[0].accommodationTransfer,0);assert.equal(tour.rows[0].totalRevenue,1500);
  const boat=buildPrintCenterReport({bookings:accommodationBookings,date:"2026-09-04",type:"boat"});
  assert.deepEqual(boat.rows.map(row=>row.accommodationTotal),[1500,0]);assert.deepEqual(boat.rows.map(row=>row.accommodationQty),[2,3]);
});

test("accommodation price migration is idempotent and routes use booking RPC v21",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260922_039_accommodation_quantity_price.sql"),"utf8"),bookingRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8"),reportRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  for(const field of ["default_price","accommodation_qty","accommodation_unit_price","accommodation_default_price","upsert_booking_v21","list_bookings_json_v21","'accommodation'"])assert.match(sql,new RegExp(field));
  assert.match(sql,/if v_add_qty then/);assert.match(sql,/add column if not exists/);assert.doesNotMatch(sql,/delete from|truncate/i);assert.match(bookingRoute,/upsert_booking_v21/);assert.match(bookingRoute,/list_bookings_json_v21/);assert.match(reportRoute,/list_bookings_json_v21/);
});

test("daily register receipt and equipment summaries calculate operational totals",()=>{
  const daily=[{bookingCode:"R1",travelDate:"2026-07-23",returnDate:"2026-07-25",leaderFirstName:"Leader",agentName:"Agent A",status:"confirmed",depositAmount:1000,depositPaymentMethod:"Cash",creditAmount:500,creditPaymentMethod:"Bank",paymentMethod:"Bank",totalAmount:3000,passengers:[{passengerType:"adult",program:{name:"3 days 2 nights"},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:2,price:100}]},{passengerType:"child",program:{name:"3 days 2 nights"},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:1,price:150}]}]}];
  const register=buildPrintCenterReport({bookings:daily,date:"2026-07-23",type:"register_summary"});
  assert.deepEqual(register.registerTotals,{adult:1,child:1,infant:0,foc:0});assert.equal(register.rows[0].program,"3D2N");
  const receipt=buildPrintCenterReport({bookings:daily,paymentMethods:[{method_name:"Cash",payment_type:"cash"},{method_name:"Bank",payment_type:"transfer"}],date:"2026-07-23",type:"receipt_summary"});
  assert.equal(receipt.receiptTotals.depositCash,1000);assert.equal(receipt.receiptTotals.creditTransfer,500);assert.equal(receipt.receiptTotals.balanceTransfer,1500);assert.equal(receipt.receiptTotals.grandTotal,3000);
  const equipment=buildPrintCenterReport({bookings:daily,date:"2026-07-23",type:"equipment_summary"});
  assert.equal(equipment.rows[0].qty,3);assert.equal(equipment.rows[0].total,350);assert.equal(equipment.equipmentTotals.amount,350);
});

test("register summary supports an inclusive custom date range",()=>{
  const bookings=[
    {bookingCode:"R1",travelDate:"2026-07-23",returnDate:"2026-07-25",leaderFirstName:"A",status:"confirmed",passengers:[{passengerType:"adult",program:{name:"3 days 2 nights"}}]},
    {bookingCode:"R2",travelDate:"2026-07-25",returnDate:"2026-07-26",leaderFirstName:"B",status:"confirmed",passengers:[{passengerType:"child",program:{name:"ตั๋วเรือ"}}]},
    {bookingCode:"R3",travelDate:"2026-07-26",leaderFirstName:"Outside",status:"confirmed",passengers:[{passengerType:"adult"}]}
  ];
  const report=buildPrintCenterReport({bookings,date:"2026-07-23",toDate:"2026-07-25",type:"register_summary_range"});
  assert.equal(report.rows.length,2);assert.equal(report.rows[1].travelDate,"2026-07-25");assert.deepEqual(report.registerTotals,{adult:1,child:1,infant:0,foc:0});assert.deepEqual(report.range,{from:"2026-07-23",to:"2026-07-25"});
});

test("credit transport and nationality migration is idempotent and numeric",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260808_016_credit_transport_nationality_reporting.sql"),"utf8");
  for(const field of ["credit_amount numeric(14,2)","deposit_payment_method","credit_payment_method","nationality_type","pickup_location","transportation_amount numeric(14,2)","default_price numeric(14,2)","upsert_booking_v8","list_bookings_json_v7"])assert.match(sql,new RegExp(field.replace(/[()]/g,"\\$&"),"i"));
  assert.match(sql,/add column if not exists/);
});
test("boat ticket references are separate from receipt references",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260808_017_boat_ticket_book_numbers.sql"),"utf8");
  for(const expected of ["boat_ticket_book_no","boat_ticket_no","upsert_booking_v9","list_bookings_json_v8"])assert.match(sql,new RegExp(expected));
  assert.match(sql,/add column if not exists/);
});
test("booking export exposes immutable creation date",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260812_018_booking_created_date_export.sql"),"utf8");
  assert.match(sql,/list_bookings_json_v9/);assert.match(sql,/created_at/);assert.match(sql,/'createdAt'/);
});
test("booking creator comes from authenticated server user and remains immutable",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260812_019_booking_creator_export.sql"),"utf8"),route=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8");
  assert.match(sql,/created_by=coalesce\(created_by/);assert.match(sql,/list_bookings_json_v10/);assert.match(route,/createdBy:req\.user\.username/);assert.match(route,/upsert_booking_v20/);
});

test("island report includes both arrivals and departures on the selected date",()=>{
  const report=buildPrintCenterReport({bookings,date:"2026-07-24",type:"island"});
  assert.equal(report.summary.arrivals,1);
  assert.equal(report.summary.departures,2);
  assert.equal(report.rows.filter(row=>row.direction==="ลงเกาะ").length,1);
  assert.equal(report.rows.filter(row=>row.direction==="ขึ้นจากเกาะ").length,2);
  assert.equal(report.rows.find(row=>row.bookingCode==="BK1").accommodation,"บ้านพักอุทยาน");
  assert.equal(report.rows.some(row=>row.bookingCode==="CANCEL"),false);
});

test("counter report keeps booking revenue at booking level instead of repeating it per passenger",()=>{
  const report=buildPrintCenterReport({bookings,date:"2026-07-23",type:"counter"});
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].pax,2);
  assert.equal(report.summary.pax,2);
  assert.equal(report.summary.expectedRevenue,3000);
});

test("park accommodation migration is idempotent and does not add accommodation revenue",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260723_007_park_accommodation.sql"),"utf8");
  assert.match(sql,/add column if not exists park_accommodation_type/);
  assert.match(sql,/create or replace function list_bookings_json/);
  assert.match(sql,/create or replace function upsert_booking_from_json/);
  assert.doesNotMatch(sql,/accommodation_revenue|park_accommodation_price/i);
});

test("program accommodation policy migration supports editable boat dates and auditable tent credits",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260723_008_program_accommodation_policy.sql"),"utf8");
  assert.match(sql,/add column if not exists accommodation_policy/);
  assert.match(sql,/add column if not exists self_booked_tent_credit numeric/);
  assert.match(sql,/program_id='one_day'/);
  assert.match(sql,/program_id='boat_ticket'/);
  assert.match(sql,/upsert_booking_with_accommodation/);
  assert.match(sql,/list_bookings_json_v2/);
  assert.doesNotMatch(sql,/delete from (payments|refunds|financial_events)/i);
});

test("simplified accommodation migration provides editable master data and manual credits",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260723_009_simplify_accommodation.sql"),"utf8");
  assert.match(sql,/create table if not exists master_accommodations/);
  assert.match(sql,/accommodation_booked_by in\('customer','company'\)/);
  assert.match(sql,/tentCreditAmount/);
  assert.match(sql,/list_bookings_json_v3/);
});

test("counter report exposes email, deposit and balance without document references",()=>{
  const booking={bookingCode:"DRAFT1",travelDate:"2026-07-23",leaderFirstName:"Draft",phone:"081",contactEmail:"guest@example.com",status:"pending",totalAmount:3000,depositAmount:500,receiptBookNo:"1",manualReceiptNo:"15",passengers:[]};
  const row=buildPrintCenterReport({bookings:[booking],date:"2026-07-23",type:"counter"}).rows[0];
  assert.equal(row.email,"guest@example.com");
  assert.equal(row.depositAmount,500);
  assert.equal(row.balanceAmount,2500);
  assert.equal("receiptBookNo" in row,false);
  assert.equal("manualReceiptNo" in row,false);
});

test("insurance submission groups names and derives adult/child totals from title",()=>{
  const booking={bookingCode:"INS1",travelDate:"2026-07-23",leaderTitle:"นาย",leaderFirstName:"A",status:"confirmed",passengers:[{title:"นาย",firstName:"A",passengerType:"adult"},{title:"เด็กชาย",firstName:"B",passengerType:"child"},{title:"เด็กหญิง",firstName:"C",passengerType:"infant"}]};
  const report=buildPrintCenterReport({bookings:[booking],date:"2026-07-23",type:"insurance"});
  assert.equal(report.title,"ใบส่งประกัน");assert.deepEqual(report.rows,[{leader:"นาย A",passenger:"นาย A"},{leader:"",passenger:"เด็กชาย B"},{leader:"",passenger:"เด็กหญิง C"}]);
  assert.deepEqual(report.insuranceSummary,{adult:1,child:2,total:3});
});

test("draft booking migration is idempotent and preserves financial history",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260730_010_booking_draft_contact_deposit.sql"),"utf8");
  assert.match(sql,/alter column travel_date drop not null/);
  assert.match(sql,/add column if not exists contact_email text/);
  assert.match(sql,/add column if not exists deposit_amount numeric\(14,2\)/);
  assert.match(sql,/add column if not exists receipt_book_no text/);
  assert.match(sql,/add column if not exists manual_receipt_no text/);
  assert.match(sql,/create or replace function upsert_booking_v4/);
  assert.match(sql,/create or replace function list_bookings_json_v4/);
  assert.doesNotMatch(sql,/delete from (payments|refunds|receipts|financial_events)/i);
});

test("payment breakdown migration is idempotent and preserves financial history",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260818_025_booking_payment_breakdown.sql"),"utf8");
  assert.match(sql,/add column if not exists payment_breakdown jsonb/);assert.match(sql,/upsert_booking_v11/);assert.match(sql,/list_bookings_json_v11/);assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("passenger travel migration preserves old bookings and exposes per-person dates and destination",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260903_027_passenger_travel_details.sql"),"utf8");
  for(const field of ["passenger_travel_date","passenger_return_date","transportation_destination","upsert_booking_v12","list_bookings_json_v13"])assert.match(sql,new RegExp(field));
  assert.match(sql,/add column if not exists/);assert.match(sql,/coalesce\(p\.passenger_travel_date,b\.travel_date\)/);assert.doesNotMatch(sql,/delete from|truncate/i);
});
test("separate destinations and Island Add-on document choices are persisted",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260903_028_passenger_destinations_island_documents.sql"),"utf8");
  for(const field of ["outbound_destination","return_destination","show_register","show_money_receipt","show_equipment_slip","show_van_receipt","show_boat_ticket","upsert_booking_v13","list_bookings_json_v14","documentVisibility"])assert.match(sql,new RegExp(field));
  assert.match(sql,/add column if not exists/);assert.doesNotMatch(sql,/delete from|truncate/i);
});
test("return transportation migration preserves existing passenger travel",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260921_031_passenger_return_transportation.sql"),"utf8");
  assert.match(sql,/add column if not exists return_transportation_method text/);
  assert.match(sql,/return_transportation_method=transportation_method/);
  assert.match(sql,/returnTransportationMethod/);
  assert.match(sql,/upsert_booking_v16/);assert.match(sql,/list_bookings_json_v16/);
  assert.doesNotMatch(sql,/delete from|truncate/i);
});
test("Island Add-on visibility is matched to the correct saved row",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260903_029_fix_island_document_visibility.sql"),"utf8");
  assert.match(sql,/upsert_booking_v14/);assert.match(sql,/addon_name_snapshot/);assert.match(sql,/addon_row_id<>all\(v_used\)/);assert.match(sql,/array_append/);assert.doesNotMatch(sql,/delete from|truncate/i);
});
test("CEO operating expenses reduce daily net without rewriting prior revisions",()=>{
  const report=buildPrintCenterReport({bookings,financialRows:[],expenseRows:[{expense_date:"2026-07-23",category_code:"boat_fee",category_name_snapshot:"ค่าธรรมเนียมเรือ",amount:100},{expense_date:"2026-07-23",category_code:"ice",category_name_snapshot:"ค่าน้ำแข็ง",amount:500}],date:"2026-07-23",toDate:"2026-07-24",type:"management"});
  assert.equal(report.rows[0].operatingExpenses,600);assert.equal(report.rows[0].netAfterExpenses,report.rows[0].expectedRevenue-600);assert.equal(report.expenseMatrix.length,7);assert.equal(report.expenseDetails.length,2);assert.equal(report.summary.totalOperatingExpenses,600);
});

test("booking dropdown migration adds editable masters and transportation snapshot",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260731_011_booking_dropdown_master_data.sql"),"utf8");
  assert.match(sql,/create table if not exists master_customer_sources/);
  assert.match(sql,/create table if not exists master_transportation_methods/);
  assert.match(sql,/รถยนต์ส่วนตัว/);
  assert.match(sql,/รถตู้/);
  assert.match(sql,/รถทัวร์/);
  assert.match(sql,/add column if not exists transportation_method text/);
  assert.match(sql,/create or replace function upsert_booking_v5/);
  assert.match(sql,/create or replace function list_bookings_json_v5/);
  assert.doesNotMatch(sql,/delete from/i);
});

test("flexible booking contact migration preserves contact text without forced lowercase",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260731_012_flexible_booking_contact.sql"),"utf8");
  assert.match(sql,/create or replace function upsert_booking_v6/);
  assert.match(sql,/contact_email=nullif\(trim\(p_booking->>'contactEmail'\),''\)/);
  assert.doesNotMatch(sql,/lower\s*\(/i);
});

test("passenger category migration preserves adult child infant and FOC per passenger",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260731_013_passenger_categories.sql"),"utf8");
  assert.match(sql,/add column if not exists passenger_type text not null default 'adult'/);
  assert.match(sql,/passenger_type in\('adult','child','infant','foc'\)/);
  assert.match(sql,/create or replace function upsert_booking_v7/);
  assert.match(sql,/create or replace function list_bookings_json_v6/);
  assert.doesNotMatch(sql,/delete from/i);
});

test("program age-price migration preserves adult price and initializes child and infant prices",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260731_014_program_age_prices.sql"),"utf8");
  assert.match(sql,/add column if not exists child_price numeric\(14,2\)/);
  assert.match(sql,/add column if not exists infant_price numeric\(14,2\)/);
  assert.match(sql,/child_price=coalesce\(child_price,default_price,0\)/);
  assert.match(sql,/infant_price=coalesce\(infant_price,default_price,0\)/);
  assert.match(sql,/check\(default_price>=0 and child_price>=0 and infant_price>=0\)/);
  assert.doesNotMatch(sql,/delete from/i);
});

test("reference reports follow travel date, stable payment codes and fixed tent fee",()=>{
  const paymentMethods=[
    {method_id:"cash",method_name:"เงินสด",payment_type:"cash"},
    {method_id:"bank_transfer_naruemon",method_name:"นฤมล",payment_type:"transfer",default_general:true},
    {method_id:"bank_transfer_rueangroj",method_name:"เรืองโรจน์",payment_type:"transfer",default_island:true},
    {method_id:"bank_transfer_rungruedee",method_name:"รุ่งฤดี",payment_type:"transfer"},
    {method_id:"bank_transfer_laddawan",method_name:"ลัดดาวรรณ์",payment_type:"transfer",default_equipment:true,default_transport:true},
    {method_id:"bank_transfer_rujiroj",method_name:"รุจิโรจน์",payment_type:"transfer"}
  ];
  const referenceBookings=[{bookingCode:"REF1",travelDate:"2026-09-21",returnDate:"2026-09-23",leaderFirstName:"หัวหน้า",leaderLastName:"ทริป",phone:"081",status:"confirmed",paymentMethod:"นฤมล",depositAmount:100,depositPaymentMethod:"รุจิโรจน์",creditAmount:200,passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1000},preAddOns:[{id:"tent",name:"เต็นท์",selected:true,qty:2,price:300,paymentMethod:"เงินสด"}],islandAddOns:[{id:"dive",name:"ดำน้ำ",qty:1,price:400,paymentMethod:"เรืองโรจน์"}],transportationMethod:"รถตู้",transportationAmount:500,transportationPaymentMethod:"ลัดดาวรรณ์",passengerTravelDate:"2026-09-21",outboundDestination:"บขส.",returnTransportationMethod:"รถตู้",returnTransportationAmount:600,returnTransportationPaymentMethod:"เงินสด",passengerReturnDate:"2026-09-23",returnDestination:"สนามบิน"}]}];
  const tour=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-21",toDate:"2026-09-21",type:"tour_expense_reference"});
  assert.equal(tour.rows[0].boatTransfer,1000);assert.equal(tour.rows[0].tentCash,600);assert.equal(tour.rows[0].deposit,100);assert.equal(tour.rows[0].credit,200);assert.equal(tour.rows[0].totalRevenue,3100);assert.equal(tour.rows[0].rujirojDepositTransfer,100);assert.equal(tour.totals.accounts["นฤมล"],1000);assert.equal(tour.totals.accounts["เรืองโรจน์"],400);assert.equal(tour.totals.accounts["ลัดดาวรรณ์"],500);assert.equal(tour.totals.accounts["รุจิโรจน์"],100);
  assert.deepEqual(tour.monthlyRows,[{month:"2026-09",cash:1200,transfer:1900,deposit:100,credit:200,rungruedeeTransfer:0}]);assert.deepEqual(tour.monthlyTotals,{cash:1200,transfer:1900,deposit:100,credit:200,rungruedeeTransfer:0});
  const naruemonDeposit=buildPrintCenterReport({bookings:[{bookingCode:"DEP1",travelDate:"2026-09-21",status:"confirmed",paymentMethod:"เงินสด",depositAmount:300,depositPaymentMethod:"นฤมล",passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1000}}]}],paymentMethods,date:"2026-09-21",toDate:"2026-09-21",type:"tour_expense_reference"});
  assert.equal(naruemonDeposit.rows[0].naruemonTransfer,300);assert.equal(naruemonDeposit.totals.accounts["นฤมล"],300);
  const tent=buildPrintCenterReport({bookings:referenceBookings,date:"2026-09-21",toDate:"2026-09-21",type:"tent_fee_reference"});
  assert.equal(tent.rows[0].nights,2);assert.equal(tent.rows[0].people,2);assert.equal(tent.rows[0].rate,80);assert.equal(tent.rows[0].total,320);
  const van=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-21",toDate:"2026-09-21",type:"van_daily_reference"});
  assert.deepEqual(van.rows[0],{date:"2026-09-21",cash:600,transfer:500,total:1100});assert.deepEqual(van.monthlyRows,[{month:"2026-09",cash:600,transfer:500,total:1100}]);assert.deepEqual(van.monthlyTotals,{cash:600,transfer:500,total:1100});
  const work=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-21",toDate:"2026-09-23",type:"van_work_order_reference"});
  assert.equal(work.rows.length,2);assert.equal(work.rows[0].location,"บขส.");assert.equal(work.rows[1].location,"สนามบิน");
  const monthly=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-01",toDate:"2026-09-30",type:"tour_monthly_reference"});
  assert.deepEqual(monthly.rows[0],{month:"2026-09",cash:1200,transfer:1900,deposit:100,credit:200,rungruedeeTransfer:0});assert.deepEqual(monthly.totals,{cash:1200,transfer:1900,deposit:100,credit:200,rungruedeeTransfer:0});assert.equal("remaining" in monthly.rows[0],false);assert.equal("withdrawal" in monthly.rows[0],false);
});

test("agent and daily return travel reports follow the approved workbook logic",()=>{
  const bookings=[
    {bookingCode:"AG-B",travelDate:"2026-09-21",returnDate:"2026-09-23",leaderFirstName:"หัวหน้า",leaderLastName:"บี",agentName:"Agent B",status:"confirmed",bookingNote:"โทรก่อนรับ",passengers:[
      {passengerType:"adult",program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1000},passengerTravelDate:"2026-09-21",passengerReturnDate:"2026-09-23",returnTransportationMethod:"ลิกไนท์"},
      {passengerType:"child",program:{programId:"package_3d2n",name:"3 วัน 2 คืน",qty:1,price:2000},passengerTravelDate:"2026-09-21",passengerReturnDate:"2026-09-23",returnTransportationMethod:"บขส."},
      {passengerType:"infant",program:{programId:"package_3d2n",name:"3 วัน 2 คืน",qty:1,price:500},passengerTravelDate:"2026-09-21",passengerReturnDate:"2026-09-23",returnTransportationMethod:"รถส่วนตัว"},
      {passengerType:"foc",program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:0},passengerTravelDate:"2026-09-21",passengerReturnDate:"2026-09-23",returnTransportationMethod:"รถตู้ VIP"},
      {passengerType:"adult",program:{programId:"package_3d2n",name:"3 วัน 2 คืน",qty:1,price:300},passengerTravelDate:"2026-09-21",passengerReturnDate:"2026-09-23",returnTransportationMethod:"รถทัวร์"}
    ]},
    {bookingCode:"AG-A",travelDate:"2026-09-22",leaderFirstName:"หัวหน้า",leaderLastName:"เอ",agentName:"Agent A",status:"confirmed",passengers:[{passengerType:"adult",program:{programId:"package",name:"แพ็คเกจ",qty:1,price:3000}}]},
    {bookingCode:"CANCEL",travelDate:"2026-09-21",agentName:"Agent B",status:"cancelled",passengers:[{passengerType:"adult",program:{programId:"boat_ticket",qty:1,price:9999},passengerReturnDate:"2026-09-23",returnTransportationMethod:"ลิกไนท์"}]}
  ];
  const agents=[{agent_name:"Agent B",sort_order:1},{agent_name:"Agent A",sort_order:2}],transportationMethods=[
    {method_id:"lignite",method_name:"ลิกไนท์"},{method_id:"BKS",method_name:"บขส."},{method_id:"private_car",method_name:"รถส่วนตัว"},{method_id:"pv01",method_name:"รถตู้ VIP"},{method_id:"coach",method_name:"รถทัวร์"}
  ];
  const agent=buildPrintCenterReport({bookings,masterAgents:agents,date:"2026-09-21",toDate:"2026-09-22",type:"agent_reference"});
  assert.deepEqual(agent.pages.map(page=>page.agent),["Agent B","Agent A"]);assert.equal(agent.pages[0].rows[0].adult,2);assert.equal(agent.pages[0].rows[0].child,1);assert.equal(agent.pages[0].rows[0].infant,1);assert.equal(agent.pages[0].rows[0].foc,1);assert.equal(agent.pages[0].totals.boatAmount,1000);assert.equal(agent.pages[0].totals.packageAmount,2800);assert.equal(agent.pages[0].totals.total,3800);assert.equal(agent.pages[0].rows[0].paymentDate,"");
  const travel=buildPrintCenterReport({bookings,transportationMethods,date:"2026-09-23",toDate:"2026-09-23",type:"customer_travel_daily_reference"});
  assert.equal(travel.pages.length,1);assert.equal(travel.pages[0].rows.length,1);assert.deepEqual(travel.pages[0].totals,{pax:5,lignite:1,bks:1,privateCar:1,van:1});assert.match(travel.pages[0].rows[0].note,/รถทัวร์ 1 คน/);assert.equal(travel.pages[0].rows[0].arrivalDate,"2026-09-21");
});

test("payment defaults and per-leg transportation migration is idempotent and non-destructive",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260921_035_payment_defaults_transport_methods.sql"),"utf8");
  for(const field of ["default_general","default_equipment","default_island","default_transport","transportation_payment_method","return_transportation_payment_method","upsert_booking_v20","list_bookings_json_v20"])assert.match(sql,new RegExp(field));
  for(const name of ["นฤมล","เรืองโรจน์","รุ่งฤดี","ลัดดาวรรณ์","รุจิโรจน์"])assert.ok(sql.includes(name));
  assert.match(sql,/add column if not exists/);assert.match(sql,/where not exists/);assert.match(sql,/position\('bank_transfer'/);assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("package report multiplies passenger quantity by editable master cost rates",()=>{
  const packageCostRates=[
    {program_key:"2/1",cost_code:"park_food",unit_rate:980,active_flag:true},
    {program_key:"2/1",cost_code:"park_fee",unit_rate:100,active_flag:true},
    {program_key:"2/1",cost_code:"park_tent",unit_rate:160,active_flag:true},
    {program_key:"2/1",cost_code:"sabina_food",unit_rate:120,active_flag:true},
    {program_key:"2/1",cost_code:"longtail",unit_rate:400,active_flag:true},
    {program_key:"2/1",cost_code:"equipment",unit_rate:150,active_flag:true},
    {program_key:"2/1",cost_code:"refreshment",unit_rate:100,active_flag:true},
    {program_key:"2/1",cost_code:"guide",unit_rate:100,active_flag:true},
    {program_key:"2/1",cost_code:"sabina_tent",unit_rate:225,active_flag:true},
    {program_key:"2/1",cost_code:"insurance",unit_rate:30,active_flag:true},
    {program_key:"2/1",cost_code:"agent",unit_rate:500,active_flag:true}
  ];
  const bookings=[{bookingCode:"PKG",travelDate:"2026-09-23",status:"confirmed",leaderFirstName:"ลูกค้า",passengers:[{program:{programId:"package_2d1n",name:"2 วัน 1 คืน",qty:2,price:5000}}]}];
  const report=buildPrintCenterReport({bookings,packageCostRates,date:"2026-09-23",type:"package_cost_reference"}),row=report.rows[0];
  assert.equal(row.qty,2);assert.equal(row.amount,10000);assert.equal(row.parkTotal,2480);assert.equal(row.sabinaTotal,3250);assert.equal(row.balance,4270);assert.deepEqual(report.missingRatePrograms,[]);
});

test("boat and tent report reads tents from company-booked accommodation and splits by payment type",()=>{
  const paymentMethods=[{method_id:"bank_transfer_naruemon",method_name:"นฤมล",payment_type:"transfer"}],bookings=[{bookingCode:"BT",travelDate:"2026-09-23",returnDate:"2026-09-24",status:"confirmed",leaderFirstName:"ลูกค้า",source:"Facebook",paymentMethod:"นฤมล",passengers:[
    {program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1500,defaultPrice:1600},accommodationId:"tent_small",accommodationName:"เต็นท์เล็ก",accommodationBookedBy:"company",accommodationQty:1,accommodationPrice:450},
    {program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1500,defaultPrice:1600},accommodationId:"tent_large",accommodationName:"เต็นท์ใหญ่",accommodationBookedBy:"company",accommodationQty:2,accommodationPrice:650}
  ]}];
  const report=buildPrintCenterReport({bookings,paymentMethods,date:"2026-09-23",type:"boat_tent_reference"}),row=report.rows[0];
  assert.equal(row.qty,2);assert.equal(row.boatCash,0);assert.equal(row.boatTransfer,3000);assert.equal(row.discount,200);assert.equal(row.smallTentQty,1);assert.equal(row.largeTentQty,2);assert.equal(row.tentTransfer,1750);assert.equal(row.totalTransfer,4750);assert.equal(row.customerSource,"Facebook");
});

test("package and island boat migration is revisioned, numeric and non-destructive",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260923_040_package_reports_and_island_boats.sql"),"utf8");
  for(const expected of ["master_package_cost_rates","unit_rate numeric(14,2)","master_island_boat_duties","island_boat_operation_batches","fuel_liters numeric(12,2)","passenger_count integer","save_island_boat_operations","v_current_island_boat_operations","manageIslandBoatOperations","ช่องขาด","ไม้งาม"])assert.ok(sql.includes(expected));
  assert.match(sql,/max\(revision\),0\)\+1/);assert.match(sql,/on delete restrict/);assert.doesNotMatch(sql,/delete from|truncate/i);
});
