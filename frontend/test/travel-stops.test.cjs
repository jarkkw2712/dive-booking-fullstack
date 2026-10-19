const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.resolve(__dirname,"../js/travelStops.js"),"utf8");
function run(expression){return vm.runInNewContext(`${source}\n${expression}`,{});}

test("historical trips keep unknown endpoints explicit, without fabricating Sabina",()=>{
  const events=run("travelRouteEvents({passengerTravelDate:'2026-10-20',passengerReturnDate:'2026-10-23'},'','')");
  assert.equal(events[0].place,"ไม่ระบุ");assert.equal(events.at(-1).place,"ไม่ระบุ");
  assert.equal(events.find(event=>event.kind==="inferred").date,"2026-10-20 → 2026-10-23");
  assert.equal(run("travelRouteEvents({passengerTravelDate:'2026-10-20'},'','').some(event=>event.kind==='inferred')"),false);
});

test("route timeline puts same-day and later stops around the island journey",()=>{
  const kinds=run("travelRouteEvents({passengerTravelDate:'2026-10-20',passengerReturnDate:'2026-10-23',island:'ไม้งาม',extraTransportStops:[{date:'2026-10-20',from:'สนามบิน',to:'ท่าเรือ'},{date:'2026-10-21',from:'เกาะ',to:'โรงแรม'},{date:'2026-10-23',from:'ท่าเรือ',to:'สนามบิน'}]},'','').map(event=>event.kind)");
  assert.deepEqual(Array.from(kinds),["start","stop","arrival","island","inferred","stop","return","stop","finish"]);
});

test("additional stop prices are summed without changing base travel prices",()=>{
  assert.equal(run("travelStopTotal({extraTransportStops:[{amount:350},{amount:200}]})"),550);
  assert.equal(run("travelStopTotal({})"),0);
});

test("live booking total and printable stop lines follow transport Master Data visibility",()=>{
  const context={window:{},document:{querySelector:()=>null},passengers:[],master:{},travelDetailFields:[],
    createPassenger:()=>({}),applyGroupBookingUiV2:()=>{},copyLeaderTravelDetails:()=>{},applyLeaderTravelDetailsToAll:()=>{},
    personTotal:()=>1500,selectedBookingItemsSummaryHtml:()=>"",documentGroupedItems:()=>[],validateBooking:()=>"",bookingSearchText:()=>"",
    transportationVisibleOnDocument:(leg,booking,profile)=>profile.title==="ใบเสร็จรถตู้"&&leg.transportationMethod==="รถตู้",
    passengerTypeLabels:{adult:"ผู้ใหญ่"},escapeHtml:value=>String(value),money:value=>String(value)};
  vm.runInNewContext(source,context);
  const booking={passengers:[{passengerType:"adult",nationalityType:"thai",extraTransportStops:[{from:"สนามบิน",to:"ท่าเรือ",method:"รถตู้",amount:400},{from:"ท่าเรือ",to:"โรงแรม",method:"รถส่วนตัว",amount:200}]}]};
  assert.equal(context.personTotal(booking.passengers[0]),2100);
  const van=context.documentGroupedItems(booking,{title:"ใบเสร็จรถตู้"});
  assert.equal(van.length,1);assert.equal(van[0].total,400);assert.match(van[0].name,/สนามบิน → ท่าเรือ/);
  assert.equal(context.documentGroupedItems(booking,{title:"ใบสำคัญรับเงิน"}).length,0);
});

test("transport editor and print hooks are wired into active booking flow",()=>{
  for(const expected of ["addPassengerTravelStop","removePassengerTravelStop","outboundTo","returnTo","copyLeaderTravelDetails=function","applyLeaderTravelDetailsToAll=function","personTotal=function","documentGroupedItems=function","selectedBookingItemsSummaryHtml=function"])assert.ok(source.includes(expected));
  const financial=fs.readFileSync(path.resolve(__dirname,"../js/financial.js"),"utf8");
  assert.match(financial,/person\.extraTransportStops/);assert.match(financial,/transport_stop_/);
});
