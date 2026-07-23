import test from "node:test";
import assert from "node:assert/strict";
import { buildPrintCenterReport } from "../src/services/reportService.js";

const passenger=(name,island="อ่าวไม้งาม")=>({firstName:name,lastName:"ทดสอบ",age:30,phone:"0800000000",island,foodAllergy:"",medicalNote:"",program:{name:"One Day Trip"}});
const bookings=[
  {bookingCode:"BK1",travelDate:"2026-07-23",returnDate:"2026-07-24",leaderFirstName:"สมชาย",leaderLastName:"ใจดี",phone:"081",status:"confirmed",paymentMethod:"โอน",totalAmount:3000,passengers:[passenger("หนึ่ง"),passenger("สอง")]},
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
});

test("island report includes both arrivals and departures on the selected date",()=>{
  const report=buildPrintCenterReport({bookings,date:"2026-07-24",type:"island"});
  assert.equal(report.summary.arrivals,1);
  assert.equal(report.summary.departures,2);
  assert.equal(report.rows.filter(row=>row.direction==="ลงเกาะ").length,1);
  assert.equal(report.rows.filter(row=>row.direction==="ขึ้นจากเกาะ").length,2);
  assert.equal(report.rows.some(row=>row.bookingCode==="CANCEL"),false);
});

test("counter report keeps booking revenue at booking level instead of repeating it per passenger",()=>{
  const report=buildPrintCenterReport({bookings,date:"2026-07-23",type:"counter"});
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].pax,2);
  assert.equal(report.summary.pax,2);
  assert.equal(report.summary.expectedRevenue,3000);
});
