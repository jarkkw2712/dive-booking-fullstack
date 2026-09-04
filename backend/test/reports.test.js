import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrintCenterReport } from "../src/services/reportService.js";

const testDir=path.dirname(fileURLToPath(import.meta.url));

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
  assert.match(sql,/created_by=coalesce\(created_by/);assert.match(sql,/list_bookings_json_v10/);assert.match(route,/createdBy:req\.user\.username/);assert.match(route,/upsert_booking_v15/);
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
test("Island Add-on visibility is matched to the correct saved row",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260903_029_fix_island_document_visibility.sql"),"utf8");
  assert.match(sql,/upsert_booking_v14/);assert.match(sql,/addon_name_snapshot/);assert.match(sql,/addon_row_id<>all\(v_used\)/);assert.match(sql,/array_append/);assert.doesNotMatch(sql,/delete from|truncate/i);
});
test("CEO operating expenses reduce daily net without rewriting prior revisions",()=>{
  const report=buildPrintCenterReport({bookings,financialRows:[],expenseRows:[{expense_date:"2026-07-23",category_name_snapshot:"ค่าธรรมเนียมเรือ",amount:100},{expense_date:"2026-07-23",category_name_snapshot:"ค่าน้ำแข็ง",amount:500}],date:"2026-07-23",toDate:"2026-07-24",type:"management"});
  assert.equal(report.rows[0].operatingExpenses,600);assert.equal(report.rows[0].netAfterExpenses,report.rows[0].expectedRevenue-600);assert.equal(report.expenseMatrix.length,2);assert.equal(report.expenseDetails.length,2);assert.equal(report.summary.totalOperatingExpenses,600);
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
