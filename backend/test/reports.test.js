import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
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

test("Print Center reads v26 booking quantities before older compatible functions",()=>{
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  const v26=route.indexOf('rpc("list_bookings_json_v26")'),v25=route.indexOf('rpc("list_bookings_json_v25")'),v24=route.indexOf('rpc("list_bookings_json_v24")');
  assert.ok(v26>=0&&v25>v26&&v24>v25);
  assert.match(route,/\["PGRST202","42883"\]\.includes\(bookingResult\.error\?\.code\)/);
});

test("front charge report separates return dates and methods without repeating passenger totals",()=>{
  const booking={bookingCode:"CHARGE-1",travelDate:"2026-10-20",returnDate:"2026-10-22",leaderFirstName:"มาลี",leaderLastName:"ใจดี",phone:"0812345678",agentName:"เอเจนต์",bookingNote:"รับที่ท่าเรือ",status:"confirmed",accommodations:[{accommodationId:"large_tent",accommodationName:"เต็นท์ใหญ่",accommodationQty:1,accommodationBookedBy:"company"},{accommodationId:"park_house",accommodationName:"บ้านพัก",accommodationQty:1,accommodationBookedBy:"customer"}],passengers:[
    {passengerType:"adult",passengerReturnDate:"2026-10-22",returnTransportationMethod:"รถตู้",program:{name:"3 วัน 2 คืน"},island:"อ่าวไม้งาม"},
    {passengerType:"child",passengerReturnDate:"2026-10-22",returnTransportationMethod:"รถตู้",program:{name:"3 วัน 2 คืน"},island:"อ่าวไม้งาม"},
    {passengerType:"infant",passengerReturnDate:"2026-10-23",returnTransportationMethod:"รถส่วนตัว",program:{name:"ตั๋วเรือ"},island:"อ่าวช่องขาด"},
    {passengerType:"foc",passengerReturnDate:"2026-10-23",transportationMethod:"รถตู้",returnTransportationMethod:"",program:{name:"ตั๋วเรือ"},island:"อ่าวช่องขาด"}
  ]};
  const report=buildPrintCenterReport({bookings:[booking,{...booking,bookingCode:"CANCELLED",status:"cancelled"},{...booking,bookingCode:"NEXT-DAY",travelDate:"2026-10-21"}],date:"2026-10-20",type:"front_charge"});
  assert.equal(report.title,"ใบหน้าชาร์จ");assert.equal(report.rows.length,3);assert.equal(report.summary.bookings,1);
  assert.deepEqual(report.rows.map(row=>[row.returnDate,row.transportation,row.people]),[["2026-10-22","รถตู้",2],["2026-10-23","รถส่วนตัว",1],["2026-10-23","",1]]);
  assert.deepEqual(report.rows.map(row=>[row.bookingNo,row.bookingRowSpan,row.isFirstGroup,row.bookingPeople]),[[1,3,true,4],[1,3,false,4],[1,3,false,4]]);
  assert.deepEqual(report.totals,{people:4,adult:1,child:1,infant:1,foc:1});
  assert.equal(report.rows[0].program,"3D2N");assert.deepEqual(report.rows.map(row=>row.island),["อ่าวไม้งาม, อ่าวช่องขาด","อ่าวไม้งาม, อ่าวช่องขาด","อ่าวไม้งาม, อ่าวช่องขาด"]);assert.match(report.rows[0].accommodation,/เต็นท์ใหญ่/);assert.match(report.rows[0].accommodation,/บ้านพัก/);
  assert.equal(report.rows[2].transportation,"");assert.equal(report.rows[0].phone,"0812345678");
  const next=buildPrintCenterReport({bookings:[booking,{...booking,bookingCode:"CHARGE-2",passengers:booking.passengers.slice(0,1)}],date:"2026-10-20",type:"front_charge"});
  assert.deepEqual(next.rows.map(row=>row.bookingNo),[1,1,1,2]);assert.equal(next.rows.at(-1).bookingPeople,1);assert.equal(next.totals.people,5);
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
  assert.equal(report.expenseMatrix.length,4);
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

test("accommodation price migration is idempotent and remains available under booking RPC v23",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260922_039_accommodation_quantity_price.sql"),"utf8"),bookingRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8"),reportRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  for(const field of ["default_price","accommodation_qty","accommodation_unit_price","accommodation_default_price","upsert_booking_v21","list_bookings_json_v21","'accommodation'"])assert.match(sql,new RegExp(field));
  assert.match(sql,/if v_add_qty then/);assert.match(sql,/add column if not exists/);assert.doesNotMatch(sql,/delete from|truncate/i);assert.match(bookingRoute,/upsert_booking_v23/);assert.match(bookingRoute,/list_bookings_json_v23/);assert.match(reportRoute,/list_bookings_json_v23/);
});

test("daily register receipt and equipment summaries calculate operational totals",()=>{
  const daily=[{bookingCode:"R1",travelDate:"2026-07-23",returnDate:"2026-07-25",leaderFirstName:"Leader",agentName:"Agent A",status:"confirmed",depositAmount:1000,depositPaymentMethod:"Cash",creditAmount:500,creditPaymentMethod:"Bank",paymentMethod:"Bank",totalAmount:3000,passengers:[{passengerType:"adult",program:{name:"3 days 2 nights",qty:1,price:2000},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:2,price:100}]},{passengerType:"child",program:{name:"3 days 2 nights",qty:1,price:650},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:1,price:150}]}]}];
  const register=buildPrintCenterReport({bookings:daily,date:"2026-07-23",type:"register_summary"});
  assert.deepEqual(register.registerTotals,{adult:1,child:1,infant:0,foc:0});assert.equal(register.rows[0].program,"3D2N");
  const receipt=buildPrintCenterReport({bookings:daily,paymentMethods:[{method_name:"Cash",payment_type:"cash"},{method_name:"Bank",payment_type:"transfer"}],date:"2026-07-23",type:"receipt_summary"});
  assert.equal(receipt.receiptTotals.depositCash,1000);assert.equal(receipt.receiptTotals.creditTransfer,500);assert.equal(receipt.receiptTotals.balanceTransfer,1500);assert.equal(receipt.receiptTotals.grandTotal,3000);
  const equipment=buildPrintCenterReport({bookings:daily,date:"2026-07-23",type:"equipment_summary"});
  assert.equal(equipment.rows[0].pax,2);assert.equal(equipment.rows[0].equipment.fin,3);
  assert.equal(equipment.rows[0].total,350);assert.equal(equipment.equipmentTotals.total,350);
});

test("equipment reports keep physical count separate from billable nights",()=>{
  const bookings=[{bookingCode:"N1",travelDate:"2026-10-17",status:"confirmed",passengers:[{program:{programId:"boat_ticket",qty:1,price:1000},preAddOns:[{id:"fin",name:"Fin",selected:true,qty:2,nights:3,price:100,paymentMethod:"Cash"}]}]}];
  const report=buildPrintCenterReport({bookings,date:"2026-10-17",type:"equipment_summary",masterAddOns:[{addon_id:"fin",addon_name:"ฟิน"}],paymentMethods:[{method_id:"cash",method_name:"Cash",payment_type:"cash"}]});
  assert.equal(report.rows[0].equipment.fin,2);
  assert.equal(report.rows[0].cash,600);
  assert.equal(report.rows[0].total,600);
  assert.equal(report.equipmentTotals.total,600);
});

test("daily equipment sheet has a column for every master item and combines all cash or transfer accounts",()=>{
  const date="2026-10-17",booking=(code,leader,people)=>({bookingCode:code,travelDate:date,status:"confirmed",leaderFirstName:leader,passengers:people});
  const bookings=[
    booking("B2","มาลี",[{program:{programId:"boat_ticket",name:"ตั๋วเรือ"},preAddOns:[{id:"fin",name:"ฟิน",selected:true,qty:1,nights:1,price:75,paymentMethod:"โอนรุ่งฤดี"},{id:"camera",name:"กล้อง",selected:true,qty:1,price:200},{id:"legacy",name:"อุปกรณ์เก่า",selected:true,qty:1,price:30,paymentMethod:"เงินสด"}]}]),
    booking("B1","สมชาย",[{program:{name:"3 วัน 2 คืน"},preAddOns:[{id:"fin",name:"ฟิน",selected:true,qty:2,nights:3,price:100,paymentMethod:"เงินสด"},{id:"mask",name:"หน้ากาก",selected:true,qty:1,price:50,paymentMethod:"โอนนฤมล"}]},{program:{name:"3 วัน 2 คืน"},preAddOns:[]}]),
    {...booking("C1","ยกเลิก",[{preAddOns:[{id:"fin",selected:true,qty:10,price:1000}]}]),status:"cancelled"}
  ];
  const masterAddOns=[{addon_id:"fin",addon_name:"ฟิน",sort_order:2},{addon_id:"mask",addon_name:"หน้ากาก",sort_order:1},{addon_id:"camera",addon_name:"กล้อง",sort_order:3},{addon_id:"unused",addon_name:"ชูชีพ",sort_order:4}];
  const paymentMethods=[{method_id:"cash",method_name:"เงินสด",payment_type:"cash",active_flag:true},{method_id:"bank_transfer_naruemon",method_name:"โอนนฤมล",payment_type:"transfer",active_flag:true},{method_id:"bank_transfer_rungruedee",method_name:"โอนรุ่งฤดี",payment_type:"transfer",active_flag:true},{method_id:"bank_transfer_laddawan",method_name:"โอนลัดดาวรรณ์",payment_type:"transfer",default_equipment:true,active_flag:true}];
  const report=buildPrintCenterReport({bookings,date,type:"equipment_summary",masterAddOns,paymentMethods});
  assert.deepEqual(report.equipmentColumns.map(item=>item.code),["mask","fin","camera","unused","legacy"]);
  assert.equal(report.rows.length,2);assert.equal(report.rows[0].leader,"สมชาย");assert.equal(report.rows[0].pax,2);assert.equal(report.rows[0].program,"3D2N");
  assert.equal(report.rows[0].equipment.fin,2);assert.equal(report.rows[0].equipment.mask,1);assert.equal(report.rows[0].equipment.unused,0);
  assert.equal(report.rows[0].cash,600);assert.equal(report.rows[0].transfer,50);assert.equal(report.rows[0].total,650);
  assert.equal(report.rows[1].program,"ตั๋วเรือ");assert.equal(report.rows[1].cash,30);assert.equal(report.rows[1].transfer,275);
  assert.equal(report.equipmentTotals.equipment.fin,3);assert.equal(report.equipmentTotals.pax,3);
  assert.equal(report.equipmentTotals.cash,630);assert.equal(report.equipmentTotals.transfer,325);assert.equal(report.equipmentTotals.total,955);
});

test("equipment nights migration is idempotent and the API prevents silent multi-night loss",()=>{
  const migration=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261017_044_equipment_nights.sql"),"utf8");
  const bookingsRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8");
  const reportsRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  assert.match(migration,/add column if not exists nights integer not null default 1/);
  assert.match(migration,/create or replace function public\.upsert_booking_v24/);
  assert.match(migration,/create or replace function public\.list_bookings_json_v24/);
  assert.doesNotMatch(migration,/\bdelete from\b|\btruncate\b/i);
  assert.match(bookingsRoute,/if\(hasMultiNightEquipment\(booking\)\)/);
  assert.match(reportsRoute,/list_bookings_json_v24/);
});

test("receipt summary totals only items enabled for money receipts in current master data",()=>{
  const booking={bookingCode:"R2",travelDate:"2026-07-23",status:"confirmed",totalAmount:5000,depositAmount:500,creditAmount:200,depositPaymentMethod:"Bank",creditPaymentMethod:"Bank",paymentMethod:"Bank",paymentBreakdown:{deposit:{Cash:200,Bank:300}},passengers:[{
    program:{name:"Package",qty:1,price:1000},transportationMethod:"Van",transportationAmount:400,returnTransportationMethod:"Boat",returnTransportationAmount:600,
    preAddOns:[{id:"visible",selected:true,qty:2,price:100},{id:"hidden",selected:true,qty:1,price:300,documentVisibility:{show_money_receipt:true}},{id:"unselected",selected:false,qty:1,price:900}],
    islandAddOns:[{id:"dive",qty:1,price:150},{id:"island_hidden",qty:1,price:250}]
  }],accommodations:[{accommodationId:"house",accommodationBookedBy:"company",accommodationQty:1,accommodationPrice:500},{accommodationId:"tent",accommodationBookedBy:"company",accommodationQty:1,accommodationPrice:700},{accommodationId:"self",accommodationBookedBy:"customer",accommodationQty:1,accommodationPrice:800}]};
  const masters={paymentMethods:[{method_id:"cash",method_name:"Cash",payment_type:"cash"},{method_id:"bank_transfer_1",method_name:"Bank",payment_type:"transfer"}],masterAddOns:[{addon_id:"visible",show_money_receipt:true},{addon_id:"hidden",show_money_receipt:false}],masterIslandAddOns:[{island_addon_id:"dive",show_money_receipt:true},{island_addon_id:"island_hidden",show_money_receipt:false}],masterAccommodations:[{accommodation_id:"house",show_money_receipt:true},{accommodation_id:"tent",show_money_receipt:false},{accommodation_id:"self",show_money_receipt:true}],transportationMethods:[{method_name:"Van",show_money_receipt:true},{method_name:"Boat",show_money_receipt:false}]};
  const receipt=buildPrintCenterReport({bookings:[booking],date:"2026-07-23",type:"receipt_summary",...masters});
  assert.equal(receipt.rows[0].grandTotal,2250);
  assert.deepEqual([receipt.rows[0].depositCash,receipt.rows[0].depositTransfer,receipt.rows[0].creditTransfer,receipt.rows[0].balanceTransfer],[200,300,200,1550]);
  assert.equal(receipt.receiptTotals.totalCash+receipt.receiptTotals.totalTransfer,receipt.receiptTotals.grandTotal);
  const changed=buildPrintCenterReport({bookings:[booking],date:"2026-07-23",type:"receipt_summary",...masters,masterAddOns:masters.masterAddOns.map(row=>({...row,show_money_receipt:false}))});
  assert.equal(changed.rows[0].grandTotal,2050);
  const capped=buildPrintCenterReport({bookings:[{...booking,depositAmount:3000,creditAmount:2000,paymentBreakdown:{}}],date:"2026-07-23",type:"receipt_summary",...masters});
  assert.equal(capped.rows[0].depositTransfer,2250);
  assert.equal(capped.rows[0].creditTransfer,0);
  assert.equal(capped.rows[0].balanceTransfer,0);
});

test("new Booking payment split reaches daily, monthly, boat and receipt reports without moving equipment money",()=>{
  const booking={bookingCode:"SPLIT-1",travelDate:"2026-10-24",status:"confirmed",paymentMethod:"Naruemon",depositPaymentMethod:"Naruemon",depositAmount:1000,creditAmount:0,paymentBreakdown:{version:2,primary:{method:"Naruemon",amount:2000},secondary:{method:"Cash",amount:1000},remaining:{Naruemon:3000}},passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:4000},preAddOns:[{id:"fin",selected:true,qty:1,nights:1,price:200,paymentMethod:"Laddawan"}]}]};
  const masters={paymentMethods:[{method_name:"Cash",method_code:"cash",payment_type:"cash"},{method_name:"Naruemon",method_code:"bank_transfer_naruemon",payment_type:"transfer"},{method_name:"Laddawan",method_code:"bank_transfer_laddawan",payment_type:"transfer"}],masterAddOns:[{addon_id:"fin",show_money_receipt:true}],masterIslandAddOns:[],masterAccommodations:[],transportationMethods:[],masterPrograms:[{program_id:"boat_ticket",default_price:1700}]};
  const report=type=>buildPrintCenterReport({bookings:[booking],date:booking.travelDate,toDate:booking.travelDate,type,...masters});
  const daily=report("tour_expense_reference").rows[0],monthly=report("tour_monthly_reference").rows[0],boat=report("boat_tent_reference").rows[0],receipt=report("receipt_summary").rows[0],counter=report("counter").rows[0];
  assert.deepEqual([daily.boatCash,daily.boatTransfer,daily.deposit,daily.totalRevenue],[1000,2000,1000,4200]);
  assert.deepEqual([monthly.cash,monthly.transfer,monthly.deposit],[1000,2200,1000]);
  assert.deepEqual([boat.boatCash,boat.boatTransfer,boat.balance],[1000,3000,4000]);
  assert.deepEqual([receipt.depositTransfer,receipt.balanceCash,receipt.balanceTransfer,receipt.grandTotal],[1000,1000,2200,4200]);
  assert.equal(receipt.totalCash+receipt.totalTransfer,receipt.grandTotal);
  assert.match(counter.paymentMethod,/หลัก Naruemon 2000 บาท \/ สำรอง Cash 1000 บาท/);
  const partial={...booking,paymentBreakdown:{...booking.paymentBreakdown,primary:{method:"Naruemon",amount:100},secondary:{method:"Cash",amount:1000}}};
  assert.equal(buildPrintCenterReport({bookings:[partial],date:booking.travelDate,type:"tour_expense_reference",...masters}).rows[0].boatTransfer,2000);
  const legacy={...booking,paymentBreakdown:{remaining:{Naruemon:3000}}};
  assert.equal(buildPrintCenterReport({bookings:[legacy],date:booking.travelDate,type:"tour_expense_reference",...masters}).rows[0].boatCash,0);
});

test("mixed boat and package rows share deposits and secondary payment without double counting",()=>{
  const booking={travelDate:"2026-10-24",status:"confirmed",paymentMethod:"Bank",depositPaymentMethod:"Bank",depositAmount:1200,paymentBreakdown:{version:2,primary:{method:"Bank",amount:3600},secondary:{method:"Cash",amount:1200}},passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:4000}},{program:{programId:"one_day",name:"One Day Trip",qty:1,price:2000}}]};
  const paymentMethods=[{method_name:"Bank",payment_type:"transfer"},{method_name:"Cash",payment_type:"cash"}];
  const report=buildPrintCenterReport({bookings:[booking],date:booking.travelDate,type:"tour_expense_reference",paymentMethods}).rows[0];
  assert.deepEqual([report.boatCash,report.boatTransfer,report.packageCash,report.packageTransfer,report.deposit,report.totalRevenue],[800,2400,400,1200,1200,6000]);
  assert.equal(report.boatCash+report.boatTransfer+report.packageCash+report.packageTransfer+report.deposit,report.totalRevenue);
  const boat=buildPrintCenterReport({bookings:[booking],date:booking.travelDate,type:"boat_tent_reference",paymentMethods}).rows[0];
  assert.deepEqual([boat.boatCash,boat.boatTransfer],[800,3200]);
});

test("inactive historical payment methods keep their original cash type in reports",()=>{
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  assert.match(route,/master_payment_methods"\)\.select\("method_id,method_name,payment_type,default_general,default_equipment,default_island,default_transport,active_flag,sort_order"\)\.order/);
  const booking={travelDate:"2026-10-24",status:"confirmed",paymentMethod:"Counter Desk",passengers:[{program:{programId:"boat_ticket",qty:1,price:500}}]};
  const paymentMethods=[{method_id:"cash_archive",method_name:"Counter Desk",payment_type:"cash",active_flag:false}];
  const row=buildPrintCenterReport({bookings:[booking],date:booking.travelDate,type:"tour_expense_reference",paymentMethods}).rows[0];
  assert.equal(row.boatCash,500);assert.equal(row.boatTransfer,0);
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
  assert.match(sql,/created_by=coalesce\(created_by/);assert.match(sql,/list_bookings_json_v10/);assert.match(route,/createdBy:req\.user\.username/);assert.match(route,/upsert_booking_v23/);
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
  assert.equal(report.rows[0].operatingExpenses,600);assert.equal(report.rows[0].netAfterExpenses,report.rows[0].expectedRevenue-600);assert.equal(report.expenseMatrix.length,4);assert.equal(report.expenseDetails.length,2);assert.equal(report.summary.totalOperatingExpenses,600);
});

test("legacy park, tent and ice expenses display in the new four report categories without changing totals",()=>{
  const date="2026-10-15",expenseRows=[
    {expense_date:date,category_code:"boat_fee",category_name_snapshot:"ค่าธรรมเนียมเรือ",amount:100},
    {expense_date:date,category_code:"thai_adult_fee",category_name_snapshot:"คนไทย - ผู้ใหญ่",amount:400},
    {expense_date:date,category_code:"thai_child_fee",category_name_snapshot:"คนไทย - เด็ก",amount:100},
    {expense_date:date,category_code:"ice",category_name_snapshot:"ค่าน้ำแข็งประจำวัน",amount:150},
    {expense_date:date,category_code:"tent_fee",category_name_snapshot:"ค่าธรรมเนียมกางเต็นท์ (ยอดรวม)",amount:80}
  ];
  const report=buildPrintCenterReport({bookings:[],expenseRows,date,type:"management"});
  assert.deepEqual(report.expenseMatrix.map(row=>[row.category,row.values[date]]),[["ค่าธรรมเนียมเรือ",100],["ค่าธรรมเนียมอุทยาน",500],["ค่าธรรมเนียมกางเต็นท์",80],["ค่าน้ำแข็ง",150]]);
  assert.equal(report.rows[0].operatingExpenses,830);
  const current=buildPrintCenterReport({bookings:[],expenseRows:[
    {expense_date:date,category_code:"park_boat_total",category_name_snapshot:"ค่าธรรมเนียมเรือ",amount:100},
    {expense_date:date,category_code:"park_people_total",category_name_snapshot:"ค่าธรรมเนียมอุทยาน",amount:500},
    {expense_date:date,category_code:"other_tent",category_name_snapshot:"ค่าธรรมเนียมกางเต็นท์",expense_item_code:"park_tent_fee",amount:80},
    {expense_date:date,category_code:"other_ice",category_name_snapshot:"ค่าน้ำแข็ง",expense_item_code:"ice",amount:150}
  ],date,type:"management"});
  assert.deepEqual(current.expenseMatrix,report.expenseMatrix);
});

test("categorized manual expenses show their detail and aggregate without losing totals",()=>{
  const day="2026-10-23",expenseRows=[
    {expense_date:day,category_code:"other_a",category_name_snapshot:"ค่ารถ (ระบุทะเบียน)",expense_group_code:"transportation",expense_item_code:"vehicle_expense",expense_detail:"ทะเบียน กข 1234",amount:250},
    {expense_date:day,category_code:"other_b",category_name_snapshot:"ค่ารถ (ระบุทะเบียน)",expense_group_code:"transportation",expense_item_code:"vehicle_expense",expense_detail:"ทะเบียน กข 1234",amount:300},
    {expense_date:day,category_code:"other_c",category_name_snapshot:"คืนเงินค่าทัวร์ / คืนเงินมัดจำลูกค้า",expense_group_code:"customer_refunds",expense_item_code:"customer_refund",expense_detail:"ลูกค้า A",amount:100}
  ];
  const report=buildPrintCenterReport({bookings:[],expenseRows,date:day,toDate:day,type:"management"});
  assert.equal(report.summary.operatingExpenses,650);
  assert.equal(report.expenseMatrix.find(row=>row.category==="ค่ารถ (ระบุทะเบียน) — ทะเบียน กข 1234").values[day],550);
  assert.equal(report.expenseMatrix.find(row=>row.category==="คืนเงินค่าทัวร์ / คืนเงินมัดจำลูกค้า — ลูกค้า A").values[day],100);
  assert.equal(report.expenseDetails.length,3);
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
  assert.equal(tour.rows[0].boatTransfer,900);assert.equal(tour.rows[0].naruemonTransfer,900);assert.equal(tour.rows[0].tentCash,600);assert.equal(tour.rows[0].deposit,100);assert.equal(tour.rows[0].credit,200);assert.equal(tour.rows[0].totalRevenue,2000);assert.equal(tour.rows[0].rujirojDepositTransfer,100);assert.equal(tour.totals.accounts["นฤมล"],900);assert.equal(tour.totals.accounts["เรืองโรจน์"],400);assert.equal(tour.totals.accounts["ลัดดาวรรณ์"],0);assert.equal(tour.totals.accounts["รุจิโรจน์"],100);
  assert.deepEqual(tour.monthlyRows,[{month:"2026-09",cash:600,transfer:1300,deposit:100,credit:200,rungruedeeTransfer:0}]);assert.deepEqual(tour.monthlyTotals,{cash:600,transfer:1300,deposit:100,credit:200,rungruedeeTransfer:0});
  const naruemonDeposit=buildPrintCenterReport({bookings:[{bookingCode:"DEP1",travelDate:"2026-09-21",status:"confirmed",paymentMethod:"เงินสด",depositAmount:300,depositPaymentMethod:"นฤมล",passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1000}}]}],paymentMethods,date:"2026-09-21",toDate:"2026-09-21",type:"tour_expense_reference"});
  assert.equal(naruemonDeposit.rows[0].boatCash,700);assert.equal(naruemonDeposit.rows[0].naruemonTransfer,0);assert.equal(naruemonDeposit.totals.accounts["นฤมล"],300);
  const tent=buildPrintCenterReport({bookings:referenceBookings,date:"2026-09-21",toDate:"2026-09-21",type:"tent_fee_reference"});
  assert.equal(tent.rows[0].nights,2);assert.equal(tent.rows[0].people,2);assert.equal(tent.rows[0].rate,80);assert.equal(tent.rows[0].total,320);
  const van=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-21",toDate:"2026-09-21",type:"van_daily_reference"});
  assert.deepEqual(van.rows[0],{date:"2026-09-21",cash:0,transfer:500,total:500});assert.deepEqual(van.monthlyRows,[{month:"2026-09",cash:0,transfer:500,total:500}]);assert.deepEqual(van.monthlyTotals,{cash:0,transfer:500,total:500});
  const work=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-21",toDate:"2026-09-23",type:"van_work_order_reference"});
  assert.equal(work.rows.length,2);assert.equal(work.rows[0].location,"บขส. → ไม่ระบุ");assert.equal(work.rows[1].location,"สนามบิน → ไม่ระบุ");
  const monthly=buildPrintCenterReport({bookings:referenceBookings,paymentMethods,date:"2026-09-01",toDate:"2026-09-30",type:"tour_monthly_reference"});
  assert.deepEqual(monthly.rows[0],{month:"2026-09",cash:600,transfer:1300,deposit:100,credit:200,rungruedeeTransfer:0});assert.deepEqual(monthly.totals,{cash:600,transfer:1300,deposit:100,credit:200,rungruedeeTransfer:0});assert.equal("remaining" in monthly.rows[0],false);assert.equal("withdrawal" in monthly.rows[0],false);
});

test("boat-ticket totals follow program code, not a package name containing boat ticket",()=>{
  const makeBooking=(code,date,paymentMethod,programId,name,price)=>({bookingCode:code,travelDate:date,status:"confirmed",paymentMethod,passengers:[{program:{programId,name,qty:1,price}}]});
  const bookings=[makeBooking("B1","2026-10-15","เงินสด","boat_ticket","ตั๋วเรือ",4100),makeBooking("B2","2026-10-15","โอน","boat_ticket","ตั๋วเรือ",5900),makeBooking("P1","2026-10-15","เงินสด","package_day","แพ็คเกจรวมตั๋วเรือ",1700),makeBooking("P2","2026-10-15","โอน","package_day","แพ็คเกจรวมตั๋วเรือ",2000),makeBooking("OUT","2026-10-01","เงินสด","boat_ticket","ตั๋วเรือ",900)];
  const paymentMethods=[{method_id:"cash",method_name:"เงินสด",payment_type:"cash"},{method_id:"bank_transfer",method_name:"โอน",payment_type:"transfer"}];
  const report=buildPrintCenterReport({bookings,paymentMethods,date:"2026-10-15",toDate:"2026-10-15",type:"tour_expense_reference"});
  assert.deepEqual([report.rows[0].boatCash,report.rows[0].boatTransfer,report.rows[0].packageCash,report.rows[0].packageTransfer],[4100,5900,1700,2000]);
  assert.equal(report.rows[0].totalRevenue,13700);
  assert.deepEqual([report.monthlyTotals.cash,report.monthlyTotals.transfer],[5800,7900]);
  const boat=buildPrintCenterReport({bookings,paymentMethods,date:"2026-10-15",type:"boat_tent_reference"});
  const packages=buildPrintCenterReport({bookings,date:"2026-10-15",type:"package_cost_reference"});
  assert.equal(boat.rows.length,2);
  assert.equal(packages.rows.length,2);
});

test("tour report groups One Day Trip and Day Trip Overnight by code, not display name",()=>{
  const date="2026-10-20",paymentMethods=[{method_id:"cash",method_name:"เงินสด",payment_type:"cash"},{method_id:"bank_transfer",method_name:"โอน",payment_type:"transfer"}];
  const booking=(code,paymentMethod,programId,name,price,depositAmount=0)=>({bookingCode:code,travelDate:date,status:"confirmed",paymentMethod,depositAmount,passengers:[{program:{programId,name,qty:1,price}}]});
  const bookings=[booking("ODT-1","เงินสด","one_day","ชื่อโปรแกรมแก้ไขได้",2000,200),booking("ODT-2","โอน","one_day","One Day Trip",3000),booking("DPO-1","เงินสด","DO","Day trip overnight",4000),booking("DPO-2","โอน","DO","ชื่อโปรแกรมแก้ไขได้",5000),booking("OTHER","เงินสด","three_day","3 Day 2 Night",6000),booking("NAME-ONLY","เงินสด","custom","One Day Trip",700)];
  const report=buildPrintCenterReport({bookings,paymentMethods,date,toDate:date,type:"tour_expense_reference"}),row=report.rows[0];
  assert.deepEqual([row.oneDayCash,row.oneDayTransfer,row.dayTripOvernightCash,row.dayTripOvernightTransfer],[1800,3000,4000,5000]);
  assert.deepEqual([row.packageCash,row.packageTransfer,row.deposit,row.totalRevenue],[12500,8000,200,20700]);
  assert.deepEqual([report.totals.oneDayCash,report.totals.dayTripOvernightTransfer,report.totals.totalRevenue],[1800,5000,20700]);
});

test("15 October tour report separates deposits, excludes travel and keeps equipment revenue",()=>{
  const date="2026-10-15",paymentMethods=[
    {method_id:"cash",method_name:"เงินสด",payment_type:"cash"},
    {method_id:"bank_transfer_naruemon",method_name:"นฤมล",payment_type:"transfer",default_general:true},
    {method_id:"bank_transfer_rungruedee",method_name:"รุ่งฤดี",payment_type:"transfer"},
    {method_id:"bank_transfer_laddawan",method_name:"ลัดดาวรรณ์",payment_type:"transfer",default_equipment:true}
  ];
  const person=(programId,price,extra={})=>({program:{programId,qty:1,price},...extra});
  const booking=(code,paymentMethod,depositAmount,depositPaymentMethod,passengers,status="confirmed")=>({bookingCode:code,travelDate:date,status,paymentMethod,depositAmount,depositPaymentMethod,passengers});
  const bookings=[
    booking("BOAT-TRANSFER-1","นฤมล",1000,"นฤมล",[person("boat_ticket",1700)]),
    booking("BOAT-TRANSFER-2","นฤมล",1000,"นฤมล",[person("boat_ticket",6200)]),
    booking("BOAT-CASH-1","เงินสด",1000,"นฤมล",[person("boat_ticket",3400,{preAddOns:[{id:"mask",qty:1,price:100}],transportationMethod:"รถตู้",transportationAmount:1000,returnTransportationMethod:"รถตู้",returnTransportationAmount:1000})]),
    booking("BOAT-CASH-2","เงินสด",700,"รุ่งฤดี",[person("boat_ticket",2400,{preAddOns:[{id:"mat",qty:1,price:30},{id:"mask",qty:2,price:50},{id:"life_jacket",qty:2,price:50}]})]),
    booking("PACKAGE-TRANSFER","นฤมล",1000,"นฤมล",[person("three_day",5500),person("three_day",5500),person("three_day",5500),person("three_day",5500),person("three_day",3500),person("three_day",3500)]),
    booking("CANCELLED","นฤมล",0,"นฤมล",[person("boat_ticket",3400)],"cancelled")
  ];
  const report=buildPrintCenterReport({bookings,paymentMethods,date,toDate:date,type:"tour_expense_reference"}),row=report.rows[0];
  assert.deepEqual([row.boatCash,row.boatTransfer,row.packageCash,row.packageTransfer,row.tentCash,row.tentTransfer,row.accommodationCash,row.accommodationTransfer],[4100,5900,0,28000,0,0,0,0]);
  assert.deepEqual([row.deposit,row.credit,row.naruemonTransfer,row.rungruedeeTransfer,row["rujirojDepositCash"],row["rujirojDepositTransfer"],row.totalRevenue],[4700,0,5900,700,0,0,43030]);
  assert.equal(report.totals.totalRevenue,43030);
  assert.deepEqual(report.monthlyRows,[{month:"2026-10",cash:4100,transfer:34230,deposit:4700,credit:0,rungruedeeTransfer:700}]);
});

test("Rungruedee daily and monthly columns include net sales as well as deposits",()=>{
  const paymentMethods=[
    {method_id:"bank_transfer2",method_name:"รุ่งฤดี",payment_type:"transfer"},
    {method_id:"bank_transfer4",method_name:"ลัดดาวรรณ์",payment_type:"transfer",default_equipment:true}
  ];
  const booking={bookingCode:"BK1791268528401",travelDate:"2026-10-15",status:"confirmed",paymentMethod:"รุ่งฤดี",depositAmount:0,depositPaymentMethod:"นฤมล",totalAmount:2630,passengers:[
    {program:{programId:"boat_ticket",qty:1,price:1200},preAddOns:[{id:"life_jacket",qty:2,price:50,selected:true},{id:"Big mat",qty:1,price:30,selected:true},{id:"mask",qty:2,price:50,selected:true}]},
    {program:{programId:"boat_ticket",qty:1,price:1200},preAddOns:[]}
  ]};
  const report=buildPrintCenterReport({bookings:[booking],paymentMethods,date:"2026-10-15",toDate:"2026-10-15",type:"tour_expense_reference"});
  assert.equal(report.rows[0].deposit,0);
  assert.equal(report.rows[0].rungruedeeTransfer,2400);
  assert.equal(report.rows[0].accounts["รุ่งฤดี"],2400);
  assert.equal(report.rows[0].accounts["ลัดดาวรรณ์"],230);
  assert.equal(report.rows[0].totalRevenue,2630);
  assert.equal(report.totals.rungruedeeTransfer,2400);
  assert.equal(report.monthlyRows[0].rungruedeeTransfer,2400);
  assert.equal(report.monthlyTotals.rungruedeeTransfer,2400);
  const prepaid=buildPrintCenterReport({bookings:[{...booking,depositAmount:500,depositPaymentMethod:"รุ่งฤดี"}],paymentMethods,date:"2026-10-15",toDate:"2026-10-15",type:"tour_expense_reference"});
  assert.equal(prepaid.rows[0].rungruedeeTransfer,2400);
  assert.equal(prepaid.rows[0].accounts["รุ่งฤดี"],2400);
  assert.equal(prepaid.monthlyRows[0].rungruedeeTransfer,2400);
});

test("van report uses each leg's service date and Master Data code even when the method name omits van",()=>{
  const paymentMethods=[{method_id:"cash",method_name:"Cash",payment_type:"cash"},{method_id:"bank_transfer_laddawan",method_name:"Bank",payment_type:"transfer",default_transport:true}];
  const transportationMethods=[{method_id:"van_bus_station",method_name:"รับบขส."},{method_id:"van_airport",method_name:"ส่งสนามบิน"},{method_id:"private_car",method_name:"รถส่วนตัว"}];
  const booking={bookingCode:"VAN1",travelDate:"2026-09-20",returnDate:"2026-09-23",status:"confirmed",passengers:[
    {transportationMethod:"รับบขส.",transportationAmount:400,transportationPaymentMethod:"Cash",passengerTravelDate:"2026-09-21",returnTransportationMethod:"ส่งสนามบิน",returnTransportationAmount:600,returnTransportationPaymentMethod:"Bank",passengerReturnDate:"2026-09-23"},
    {transportationMethod:"รถส่วนตัว",transportationAmount:900,passengerTravelDate:"2026-09-21"}
  ]};
  const report=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-09-21",toDate:"2026-09-23",type:"van_daily_reference"});
  assert.equal(report.title,"รายงานรถตู้");
  assert.deepEqual(report.summary,{vanLegs:2,unpricedLegs:0});
  assert.deepEqual(report.rows,[{date:"2026-09-21",cash:400,transfer:0,total:400},{date:"2026-09-22",cash:0,transfer:0,total:0},{date:"2026-09-23",cash:0,transfer:600,total:600}]);
  assert.deepEqual(report.monthlyRows,[{month:"2026-09",cash:400,transfer:600,total:1000}]);
  assert.deepEqual(report.monthlyTotals,{cash:400,transfer:600,total:1000});
  const returnDay=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-09-23",toDate:"2026-09-23",type:"van_daily_reference"});
  assert.equal(returnDay.totals.total,600);
  assert.equal(returnDay.monthlyTotals.total,600);
  const work=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-09-21",toDate:"2026-09-23",type:"van_work_order_reference"});
  assert.equal(work.rows.length,2);
  const unpriced=buildPrintCenterReport({bookings:[{...booking,passengers:[{transportationMethod:"รับบขส.",transportationAmount:0,passengerTravelDate:"2026-09-23"}]}],paymentMethods,transportationMethods,date:"2026-09-23",toDate:"2026-09-23",type:"van_daily_reference"});
  assert.deepEqual(unpriced.summary,{vanLegs:1,unpricedLegs:1});
  assert.equal(unpriced.totals.total,0);
});

test("songthaew report lists BKS and Lignite routes without mixing in van pickup at BKS",()=>{
  const transportationMethods=[{method_id:"route_a",method_name:"รับลิกไนท์"},{method_id:"route_b",method_name:"ส่ง บขส."},{method_id:"van_bus_station",method_name:"รับบขส."}];
  const booking={bookingCode:"SONGTHAEW-1",status:"confirmed",travelDate:"2026-10-20",returnDate:"2026-10-22",leaderFirstName:"มาลี",passengers:[
    {transportationMethod:"route_a",transportationAmount:150,passengerTravelDate:"2026-10-20",outboundDestination:"ลิกไนท์",outboundTo:"ซาบีน่า",returnTransportationMethod:"route_b",returnTransportationAmount:200,passengerReturnDate:"2026-10-22",returnDestination:"ซาบีน่า",returnTo:"บขส."},
    {transportationMethod:"route_a",transportationAmount:150,passengerTravelDate:"2026-10-20",outboundDestination:"ลิกไนท์",outboundTo:"ซาบีน่า"},
    {transportationMethod:"รับบขส.",transportationAmount:400,passengerTravelDate:"2026-10-20",outboundDestination:"บขส.",outboundTo:"ซาบีน่า"}
  ]};
  const report=buildPrintCenterReport({bookings:[booking],transportationMethods,date:"2026-10-20",toDate:"2026-10-22",type:"songthaew_work_order_reference"});
  assert.equal(report.title,"รายงานรถสองแถว");
  assert.deepEqual(report.rows.map(row=>[row.date,row.direction,row.from,row.to,row.pax,row.amount]),[
    ["2026-10-20","ขาไป","ลิกไนท์","ซาบีน่า",2,300],
    ["2026-10-22","ขากลับ","ซาบีน่า","บขส.",1,200]
  ]);
  assert.deepEqual(report.summary,{jobs:2,pax:3,vehicles:2,amount:500});
  const van=buildPrintCenterReport({bookings:[booking],transportationMethods,date:"2026-10-20",type:"van_work_order_reference"});
  assert.equal(van.rows.length,1);
  assert.equal(van.rows[0].amount,400);
});

test("additional transport stops appear on their own service dates, payments and receipt visibility",()=>{
  const paymentMethods=[{method_id:"cash",method_name:"เงินสด",payment_type:"cash"},{method_id:"bank_transfer_laddawan",method_name:"ลัดดาวรรณ์",payment_type:"transfer"}];
  const transportationMethods=[{method_id:"van_airport",method_name:"รับส่งสนามบิน",show_money_receipt:true},{method_id:"private_car",method_name:"รถส่วนตัว",show_money_receipt:false}];
  const booking={bookingCode:"MULTI-STOP",travelDate:"2026-10-20",returnDate:"2026-10-23",status:"confirmed",paymentMethod:"เงินสด",totalAmount:2450,leaderFirstName:"สมชาย",passengers:[{passengerType:"adult",program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1500},transportationMethod:"รับส่งสนามบิน",transportationAmount:400,passengerTravelDate:"2026-10-20",outboundDestination:"สนามบิน",outboundTo:"ท่าเรือ",extraTransportStops:[{date:"2026-10-21",from:"ท่าเรือ",to:"โรงแรม",method:"รับส่งสนามบิน",amount:350,paymentMethod:"ลัดดาวรรณ์"},{date:"2026-10-22",from:"โรงแรม",to:"ร้านค้า",method:"รถส่วนตัว",amount:200,paymentMethod:"เงินสด"}]}]};
  const van=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-10-20",toDate:"2026-10-22",type:"van_daily_reference"});
  assert.deepEqual(van.rows.map(row=>row.total),[400,350,0]);assert.equal(van.summary.vanLegs,2);assert.equal(van.monthlyTotals.total,750);
  const work=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-10-20",toDate:"2026-10-22",type:"van_work_order_reference"});
  assert.deepEqual(work.rows.map(row=>row.location),["สนามบิน → ท่าเรือ","ท่าเรือ → โรงแรม"]);
  assert.deepEqual(work.rows.map(row=>[row.from,row.to,row.amount]),[["สนามบิน","ท่าเรือ",400],["ท่าเรือ","โรงแรม",350]]);
  assert.deepEqual(work.summary,{jobs:2,pax:2,vehicles:2,amount:750});
  const receipt=buildPrintCenterReport({bookings:[booking],paymentMethods,transportationMethods,date:"2026-10-20",type:"receipt_summary"});
  assert.equal(receipt.rows[0].grandTotal,2250);
});

test("van work order groups only identical routes and methods and sums passenger prices",()=>{
  const transportationMethods=[{method_id:"van_airport",method_name:"รับสนามบิน"},{method_id:"van_station",method_name:"รับบขส."}];
  const booking={bookingCode:"VAN-GROUP",travelDate:"2026-10-20",status:"confirmed",leaderFirstName:"มาลี",passengers:[
    {transportationMethod:"รับสนามบิน",transportationAmount:400,outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า"},
    {transportationMethod:"รับสนามบิน",transportationAmount:450,outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า"},
    {transportationMethod:"รับบขส.",transportationAmount:300,outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า"},
    {transportationMethod:"รับสนามบิน",transportationAmount:200,outboundDestination:"บขส.",outboundTo:"ซาบีน่า"}
  ]};
  const report=buildPrintCenterReport({bookings:[booking],transportationMethods,date:"2026-10-20",type:"van_work_order_reference"});
  assert.equal(report.rows.length,3);
  assert.deepEqual(report.rows.map(row=>[row.pax,row.amount]),[[2,850],[1,300],[1,200]]);
  assert.deepEqual(report.summary,{jobs:3,pax:4,vehicles:3,amount:1350});
});

test("multiple vehicles multiply each leg's unit price without multiplying passengers",()=>{
  const methods=[{method_id:"van",method_name:"รถตู้",show_money_receipt:true}];
  const booking={bookingCode:"VAN-QUANTITY",travelDate:"2026-10-20",returnDate:"2026-10-22",status:"confirmed",leaderFirstName:"มาลี",passengers:[
    {passengerType:"adult",transportationMethod:"รถตู้",transportationAmount:400,transportationQuantity:2,passengerTravelDate:"2026-10-20",outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า",returnTransportationMethod:"รถตู้",returnTransportationAmount:500,returnTransportationQuantity:3,passengerReturnDate:"2026-10-22",returnDestination:"ซาบีน่า",returnTo:"สนามบิน",extraTransportStops:[{date:"2026-10-21",method:"รถตู้",from:"ท่าเรือ",to:"โรงแรม",amount:250,quantity:2}]},
    {passengerType:"child",transportationMethod:"รถตู้",transportationAmount:0,transportationQuantity:1,passengerTravelDate:"2026-10-20",outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า"}
  ]};
  const daily=buildPrintCenterReport({bookings:[booking],transportationMethods:methods,date:"2026-10-20",toDate:"2026-10-22",type:"van_daily_reference"});
  assert.deepEqual(daily.rows.map(row=>row.total),[800,500,1500]);
  const work=buildPrintCenterReport({bookings:[booking],transportationMethods:methods,date:"2026-10-20",toDate:"2026-10-22",type:"van_work_order_reference"});
  assert.deepEqual(work.rows.map(row=>[row.pax,row.vehicles,row.amount]),[[2,2,800],[1,2,500],[1,3,1500]]);
  assert.deepEqual(work.summary,{jobs:3,pax:4,vehicles:7,amount:2800});
  const receipt=buildPrintCenterReport({bookings:[booking],transportationMethods:methods,date:"2026-10-20",type:"receipt_summary"});
  assert.equal(receipt.rows[0].grandTotal,2800);
});

test("vehicle quantity migration is revisioned, historical rows default to one, and old payloads cannot erase quantities",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261020_046_van_quantity_per_leg.sql"),"utf8");
  const rollback=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261020_047_preserve_vehicle_quantity_on_rollback.sql"),"utf8");
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8");
  for(const expected of ["transportation_quantity integer not null default 1","return_transportation_quantity integer not null default 1","quantity integer not null default 1","upsert_booking_v26","list_bookings_json_v26","upsert_booking_v25(p_booking)","list_bookings_json_v25()","Refresh the page before saving"] )assert.ok(sql.includes(expected));
  assert.match(route,/hasMultipleTransportVehicles/);
  assert.match(route,/upsert_booking_v26/);
  assert.match(route,/list_bookings_json_v26/);
  assert.match(rollback,/upsert_booking_v25/);
  assert.match(rollback,/p\.transportation_quantity<>1/);
  assert.match(rollback,/s\.quantity<>1/);
});

test("passenger transport stop migration keeps historical destinations unknown and uses revisioned RPCs",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261019_045_passenger_transport_stops.sql"),"utf8"),route=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8");
  for(const expected of ["add column if not exists outbound_to text","add column if not exists return_to text","create table if not exists public.passenger_transport_stops","amount numeric(14,2)","upsert_booking_v25","list_bookings_json_v25","upsert_booking_v24(p_booking)","list_bookings_json_v24()","reload schema"])assert.ok(sql.includes(expected));
  assert.match(route,/hasNewTravelDetails/);assert.match(route,/migrationRequired:true/);assert.match(route,/list_bookings_json_v25/);assert.doesNotMatch(sql,/update passengers set\s+outbound_to=['"]Sabina/i);
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
  assert.equal(travel.pages.length,1);assert.equal(travel.pages[0].rows.length,1);assert.deepEqual(travel.pages[0].totals,{pax:5,adult:2,child:1,infant:1,foc:1,lignite:1,bks:1,privateCar:1,van:2});assert.match(travel.pages[0].rows[0].note,/รถทัวร์ 1 คน/);assert.equal(travel.pages[0].rows[0].arrivalDate,"2026-09-21");
});

test("daily return travel groups Lignite and BKS by method name rather than code",()=>{
  const date="2026-10-20",transportationMethods=[{method_id:"route_a",method_name:"รับลิกไนท์"},{method_id:"route_b",method_name:"ส่ง บขส."},{method_id:"lignite",method_name:"รถทัวร์อื่น"}];
  const bookings=[{bookingCode:"TRAVEL-1",travelDate:"2026-10-18",returnDate:date,status:"confirmed",leaderFirstName:"มาลี",passengers:[{passengerReturnDate:date,returnTransportationMethod:"route_a"},{passengerReturnDate:date,returnTransportationMethod:"ส่ง บขส."},{passengerReturnDate:date,returnTransportationMethod:"lignite"}]}];
  const report=buildPrintCenterReport({bookings,transportationMethods,date,toDate:date,type:"customer_travel_daily_reference"}),row=report.pages[0].rows[0];
  assert.deepEqual([row.pax,row.adult,row.lignite,row.bks,row.van],[3,3,1,1,1]);
  assert.match(row.note,/รถทัวร์อื่น|lignite/);
});

test("payment defaults and per-leg transportation migration is idempotent and non-destructive",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260921_035_payment_defaults_transport_methods.sql"),"utf8");
  for(const field of ["default_general","default_equipment","default_island","default_transport","transportation_payment_method","return_transportation_payment_method","upsert_booking_v20","list_bookings_json_v20"])assert.match(sql,new RegExp(field));
  for(const name of ["นฤมล","เรืองโรจน์","รุ่งฤดี","ลัดดาวรรณ์","รุจิโรจน์"])assert.ok(sql.includes(name));
  assert.match(sql,/add column if not exists/);assert.match(sql,/where not exists/);assert.match(sql,/position\('bank_transfer'/);assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("package report multiplies passenger quantity by editable master cost rates",()=>{
  const packageCostRates=[
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"park_food",unit_rate:980,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"park_fee",unit_rate:100,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"park_tent",unit_rate:160,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"sabina_food",unit_rate:120,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"longtail",unit_rate:400,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"equipment",unit_rate:150,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"refreshment",unit_rate:100,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"guide",unit_rate:100,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"sabina_tent",unit_rate:225,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"insurance",unit_rate:30,active_flag:true},
    {program_id:"package_2d1n",program_key:"2/1",cost_code:"agent",unit_rate:500,active_flag:true},
    {program_id:"other_program",program_key:"2/1",cost_code:"park_food",unit_rate:99999,active_flag:true}
  ];
  const bookings=[{bookingCode:"PKG",travelDate:"2026-09-23",status:"confirmed",leaderFirstName:"ลูกค้า",accommodations:[{accommodationId:"tent_small",accommodationName:"เต็นท์เล็ก",accommodationQty:1}],passengers:[{program:{programId:"package_2d1n",name:"2 วัน 1 คืน",qty:2,price:5000}}]}];
  const report=buildPrintCenterReport({bookings,packageCostRates,date:"2026-09-23",type:"package_cost_reference"}),row=report.rows[0];
  assert.equal(row.qty,2);assert.equal(row.amount,10000);assert.equal(row.parkTotal,2480);assert.equal(row.sabinaTotal,3250);assert.equal(row.balance,4270);assert.deepEqual(report.missingRatePrograms,[]);
});

test("package report keeps adult and child prices in one booking-program row",()=>{
  const booking={bookingCode:"TIANTHIP-EXAMPLE",travelDate:"2026-10-23",status:"confirmed",leaderFirstName:"เทียนทิพย์",leaderLastName:"บุญศรีวงษ์",passengers:[
    {passengerType:"adult",program:{programId:"one_day",name:"One Day Trip",qty:1,price:2500}},
    {passengerType:"adult",program:{programId:"one_day",name:"One Day Trip",qty:1,price:2500}},
    {passengerType:"child",program:{programId:"one_day",name:"One Day Trip",qty:1,price:1500}}
  ]};
  const packageCostRates=[{program_id:"one_day",cost_code:"park_fee",unit_rate:100,active_flag:true},{program_id:"one_day",cost_code:"park_tent",unit_rate:80,active_flag:true},{program_id:"one_day",cost_code:"sabina_tent",unit_rate:225,active_flag:true}];
  const report=buildPrintCenterReport({bookings:[booking],packageCostRates,date:"2026-10-23",type:"package_cost_reference"});
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].qty,3);
  assert.equal(report.rows[0].amount,6500);
  assert.equal(report.rows[0].price,null);
  assert.deepEqual(report.rows[0].priceBreakdown,[{price:2500,qty:2},{price:1500,qty:1}]);
  assert.equal(report.rows[0].parkFee,300);
  assert.equal(report.rows[0].parkTent,0);
  assert.equal(report.rows[0].sabinaTent,0);
  assert.equal(report.rows[0].parkTotal,300);
  assert.equal(report.totals.qty,3);
  const frontend=fs.readFileSync(path.resolve(testDir,"../../frontend/js/app.js"),"utf8");
  assert.match(frontend,/prices\.length>1\?prices\.map\(item=>/);
  assert.match(frontend,/ผู้เดินทางคนนี้พักเต็นท์/);
  assert.match(frontend,/parkAccommodationType=this\.checked\?'park_tent':'none'/);
});

test("package tent costs count only identified tent guests in a mixed-stay booking",()=>{
  const rates=[{program_id:"package_2d1n",cost_code:"park_fee",unit_rate:100,active_flag:true},{program_id:"package_2d1n",cost_code:"park_tent",unit_rate:160,active_flag:true},{program_id:"package_2d1n",cost_code:"sabina_tent",unit_rate:225,active_flag:true}];
  const booking={bookingCode:"MIXED-STAY",travelDate:"2026-10-23",status:"confirmed",leaderFirstName:"คณะผสม",accommodations:[{accommodationId:"tent_small",accommodationName:"เต็นท์เล็ก",accommodationQty:1},{accommodationId:"park_house",accommodationName:"บ้านพัก",accommodationQty:1}],passengers:[
    {parkAccommodationType:"park_tent",program:{programId:"package_2d1n",name:"2 วัน 1 คืน",qty:1,price:5000}},
    {parkAccommodationType:"none",program:{programId:"package_2d1n",name:"2 วัน 1 คืน",qty:1,price:5000}}
  ]};
  const report=buildPrintCenterReport({bookings:[booking],packageCostRates:rates,date:"2026-10-23",type:"package_cost_reference"});
  assert.equal(report.rows[0].qty,2);
  assert.equal(report.rows[0].tentQty,1);
  assert.equal(report.rows[0].parkFee,200);
  assert.equal(report.rows[0].parkTent,160);
  assert.equal(report.rows[0].sabinaTent,225);
  assert.deepEqual(report.tentAllocationWarnings,[]);
  booking.passengers[0].parkAccommodationType="none";
  const unassigned=buildPrintCenterReport({bookings:[booking],packageCostRates:rates,date:"2026-10-23",type:"package_cost_reference"});
  assert.equal(unassigned.rows[0].parkTent,0);
  assert.equal(unassigned.rows[0].sabinaTent,0);
  assert.equal(unassigned.tentAllocationWarnings.length,1);
});

test("boat and tent report reads tents from company-booked accommodation and splits by payment type",()=>{
  const paymentMethods=[{method_id:"bank_transfer_naruemon",method_name:"นฤมล",payment_type:"transfer"}],bookings=[{bookingCode:"BT",travelDate:"2026-09-23",returnDate:"2026-09-24",status:"confirmed",leaderFirstName:"ลูกค้า",source:"Facebook",paymentMethod:"นฤมล",passengers:[
    {program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1500,defaultPrice:1600},accommodationId:"tent_small",accommodationName:"เต็นท์เล็ก",accommodationBookedBy:"company",accommodationQty:1,accommodationPrice:450},
    {program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1500,defaultPrice:1600},accommodationId:"tent_large",accommodationName:"เต็นท์ใหญ่",accommodationBookedBy:"company",accommodationQty:2,accommodationPrice:650}
  ]}];
  const report=buildPrintCenterReport({bookings,paymentMethods,date:"2026-09-23",type:"boat_tent_reference"}),row=report.rows[0];
  assert.equal(row.qty,2);assert.equal(row.boatCash,0);assert.equal(row.boatTransfer,3000);assert.equal(row.discount,200);assert.equal(row.smallTentQty,1);assert.equal(row.largeTentQty,2);assert.equal(row.tentTransfer,1750);assert.equal(row.totalTransfer,4750);assert.equal(row.customerSource,"Facebook");
});
test("boat and tent report shows current master price but uses the actual net boat sale",()=>{
  const passengers=Array.from({length:11},(_,index)=>({passengerType:index===10?"foc":"adult",program:{programId:"boat_ticket",qty:1,price:index===10?0:1300,defaultPrice:1500}}));
  const booking={bookingCode:"RATTANA-EXAMPLE",travelDate:"2026-10-23",status:"pending",leaderFirstName:"รัตนา",leaderLastName:"สุภอุดร",paymentMethod:"โอนนฤมล",totalAmount:29800,depositAmount:1000,creditAmount:29800,passengers};
  const report=buildPrintCenterReport({bookings:[booking],masterPrograms:[{program_id:"boat_ticket",default_price:1700}],paymentMethods:[{method_id:"bank_transfer_naruemon",method_name:"โอนนฤมล",payment_type:"transfer"}],date:"2026-10-23",type:"boat_tent_reference"});
  assert.deepEqual({qty:report.rows[0].qty,price:report.rows[0].price,boatCash:report.rows[0].boatCash,boatTransfer:report.rows[0].boatTransfer,discount:report.rows[0].discount,balance:report.rows[0].balance},{qty:11,price:1700,boatCash:0,boatTransfer:13000,discount:5700,balance:13000});
  assert.equal(report.totals.boatTransfer,13000);
  assert.match(report.sourceNotes.join(" "),/Master Data/);
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  assert.match(route,/master_programs"\)\.select\("program_id,default_price"\)\.eq\("program_id","boat_ticket"\)/);
  assert.match(route,/masterPrograms:programMasterResult\.data\|\|\[\]/);
});
test("staff-entered tent nights multiply revenue but do not multiply tent count",()=>{
  const booking={bookingCode:"TENT-NIGHTS",travelDate:"2026-10-21",returnDate:"2026-10-25",status:"confirmed",paymentMethod:"เงินสด",passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:1000}}],accommodations:[
    {accommodationId:"SB tent",accommodationName:"เต็นท์เล็ก",accommodationBookedBy:"company",accommodationQty:2,accommodationNights:3,accommodationPrice:450},
    {accommodationId:"park_house",accommodationName:"บ้านพัก",accommodationBookedBy:"company",accommodationQty:1,accommodationNights:8,accommodationPrice:600},
    {accommodationId:"SB Tent",accommodationName:"เต็นท์ใหญ่",accommodationBookedBy:"customer",accommodationQty:1,accommodationNights:4,accommodationPrice:650}
  ]};
  const boat=buildPrintCenterReport({bookings:[booking],date:"2026-10-21",type:"boat_tent_reference"});
  assert.equal(boat.rows[0].smallTentQty,2);assert.equal(boat.rows[0].tentCash,2700);
  const tour=buildPrintCenterReport({bookings:[booking],date:"2026-10-21",toDate:"2026-10-21",type:"tour_expense_reference"});
  assert.equal(tour.rows[0].totalRevenue,4300);
  const management=buildPrintCenterReport({bookings:[booking],date:"2026-10-21",type:"management",masterAccommodations:[]});
  assert.equal(management.accommodation.companyRevenue,3300);
});
test("booking API rejects invalid staff-entered tent nights before saving",()=>{
  const route=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8"),source=route.slice(route.indexOf("function accommodationInputError"),route.indexOf("function travelStopInputError"));
  const context={};vm.runInNewContext(`${source}\ncheck=accommodationInputError`,context);
  const row={accommodationId:"SB tent",accommodationName:"เต็นท์เล็ก",accommodationQty:2,accommodationPrice:450,accommodationNights:3};
  assert.equal(context.check({accommodations:[row]}),"");
  assert.match(context.check({accommodations:[{...row,accommodationNights:0}]}),/จำนวนคืน/);
  assert.match(context.check({accommodations:[{...row,accommodationNights:1.5}]}),/จำนวนคืน/);
  assert.match(context.check({accommodations:[{...row,accommodationPrice:-1}]}),/ราคา/);
  assert.match(route,/equipmentInputError\(req\.body\|\|\{\}\)\|\|accommodationInputError\(req\.body\|\|\{\}\)/);
});

test("package and island boat migration is revisioned, numeric and non-destructive",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260923_040_package_reports_and_island_boats.sql"),"utf8");
  for(const expected of ["master_package_cost_rates","unit_rate numeric(14,2)","master_island_boat_duties","island_boat_operation_batches","fuel_liters numeric(12,2)","passenger_count integer","save_island_boat_operations","v_current_island_boat_operations","manageIslandBoatOperations","ช่องขาด","ไม้งาม"])assert.ok(sql.includes(expected));
  assert.match(sql,/max\(revision\),0\)\+1/);assert.match(sql,/on delete restrict/);assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("package cost program-link migration adds an idempotent protected Program FK",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260923_041_link_package_costs_to_programs.sql"),"utf8");
  for(const expected of ["add column if not exists program_id text","master_package_cost_rates_program_id_fkey","references master_programs(program_id)","on delete restrict","master_package_cost_rates_program_required","check(program_id is not null) not valid","ux_master_package_cost_rates_program_cost"])assert.ok(sql.includes(expected));
  assert.match(sql,/where r\.program_id is null/);assert.doesNotMatch(sql,/delete from|truncate/i);
});

test("fast booking read migration is set-based and routes use v22",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20260924_042_fast_booking_read_model.sql"),"utf8");
  const bookingRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8"),reportRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  for(const expected of ["create or replace function list_bookings_json_v22","with program_rows as","pre_addons as","island_addons as","passenger_rows as","language sql stable","security definer","grant execute"] )assert.ok(sql.includes(expected));
  for(const field of ["accommodationQty","transportationPaymentMethod","returnTransportationPaymentMethod","paymentBreakdown","bookingOriginal","documentVisibility"])assert.ok(sql.includes(`'${field}'`));
  assert.doesNotMatch(sql,/\bfor\b|delete from|truncate/i);assert.match(bookingRoute,/list_bookings_json_v22/);assert.match(reportRoute,/list_bookings_json_v22/);
});

test("multiple booking accommodations are reported separately without charging customer-booked rows",()=>{
  const bookings=[{bookingCode:"MULTI-STAY",travelDate:"2026-10-10",returnDate:"2026-10-12",status:"confirmed",paymentMethod:"เงินสด",totalAmount:2400,passengers:[{firstName:"Leader",program:{programId:"boat_ticket",name:"ตั๋วเรือ",qty:1,price:0}}],accommodations:[
    {accommodationId:"tent_small",accommodationName:"เต็นท์เล็ก",accommodationBookedBy:"company",accommodationQty:2,accommodationPrice:400},
    {accommodationId:"tent_large",accommodationName:"เต็นท์ใหญ่",accommodationBookedBy:"company",accommodationQty:1,accommodationPrice:600},
    {accommodationId:"park_house",accommodationName:"บ้านสินสมุทร",accommodationBookedBy:"customer",accommodationQty:1,accommodationPrice:1000}
  ]}];
  const masterAccommodations=[{accommodation_id:"tent_small",accommodation_name:"เต็นท์เล็ก",default_price:400},{accommodation_id:"tent_large",accommodation_name:"เต็นท์ใหญ่",default_price:600},{accommodation_id:"park_house",accommodation_name:"บ้านสินสมุทร",default_price:1000}];
  const report=buildPrintCenterReport({bookings,masterAccommodations,date:"2026-10-10",type:"management"});
  assert.equal(report.accommodation.companyBooked,3);assert.equal(report.accommodation.customerSelfBooked,1);assert.equal(report.accommodation.companyRevenue,1400);assert.equal(report.accommodation.customerReferenceValue,1000);
  assert.equal(report.accommodationItems.find(row=>row.code==="tent_small").qty,2);assert.equal(report.accommodationItems.find(row=>row.code==="tent_large").amount,600);assert.equal(report.accommodationItems.find(row=>row.code==="park_house").amount,0);
});

test("multiple accommodation migration is idempotent, preserves history and routes use v23",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261010_043_multiple_booking_accommodations.sql"),"utf8"),bookingRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/bookings.js"),"utf8"),reportRoute=fs.readFileSync(path.resolve(testDir,"../src/routes/reports.js"),"utf8");
  for(const expected of ["add column if not exists accommodations jsonb","bookings_accommodations_array_check","upsert_booking_v23","list_bookings_json_v23","list_bookings_json_v22()","grant execute"])assert.ok(sql.includes(expected));
  assert.doesNotMatch(sql,/delete from|truncate/i);assert.match(bookingRoute,/upsert_booking_v23/);assert.match(bookingRoute,/list_bookings_json_v23/);assert.match(reportRoute,/list_bookings_json_v23/);
});
