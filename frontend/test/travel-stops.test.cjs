const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.resolve(__dirname,"../js/travelStops.js"),"utf8");
function run(expression){return vm.runInNewContext(`${source}\n${expression}`,{});}

test("historical trips keep unknown endpoints explicit, without fabricating Sabina",()=>{
  const events=run("travelRouteEvents({passengerTravelDate:'2026-10-20',passengerReturnDate:'2026-10-23'},'','')");
  assert.equal(events[0].from,"");assert.equal(events[0].to,"");
  assert.equal(events.at(-1).from,"");assert.equal(events.at(-1).to,"");
  assert.equal(events.length,2);
});

test("route preview shows complete legs in entered stop order with separate prices",()=>{
  const kinds=run("travelRouteEvents({passengerTravelDate:'2026-10-20',passengerReturnDate:'2026-10-23',island:'ไม้งาม',extraTransportStops:[{date:'2026-10-20',from:'สนามบิน',to:'ท่าเรือ'},{date:'2026-10-21',from:'เกาะ',to:'โรงแรม'},{date:'2026-10-23',from:'ท่าเรือ',to:'สนามบิน'}]},'','').map(event=>event.kind)");
  assert.deepEqual(Array.from(kinds),["outbound","stop","stop","stop","return"]);
  const context={val:()=>"",escapeHtml:value=>String(value),money:value=>Number(value).toFixed(2)};
  vm.runInNewContext(source,context);
  const html=context.travelRouteTimelineHtml({passengerTravelDate:"2026-10-20",passengerReturnDate:"2026-10-23",outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า",transportationAmount:400,returnDestination:"ซาบีน่า",returnTo:"โรงแรม",returnTransportationAmount:600});
  assert.match(html,/สนามบิน<\/span><span class="travel-route-arrow"[^>]*>→<\/span><span>ซาบีน่า/);
  assert.match(html,/400\.00 บาท/);assert.match(html,/600\.00 บาท/);
  assert.match(html,/ช่วงเที่ยวบนเกาะ/);
});

test("new passengers default only the outbound destination and return origin to Sabina",()=>{
  const context={window:{},document:{querySelector:()=>null},passengers:[],master:{},travelDetailFields:[],
    createPassenger:()=>({outboundDestination:"",returnDestination:"",outboundTo:"",returnTo:""}),
    applyGroupBookingUiV2:()=>{},copyLeaderTravelDetails:()=>{},applyLeaderTravelDetailsToAll:()=>{},
    personTotal:()=>0,selectedBookingItemsSummaryHtml:()=>"",documentGroupedItems:()=>[],validateBooking:()=>"",bookingSearchText:()=>""};
  vm.runInNewContext(source,context);
  const person=context.createPassenger();
  assert.equal(person.outboundTo,"ซาบีน่า");assert.equal(person.returnDestination,"ซาบีน่า");
  assert.equal(person.outboundDestination,"");assert.equal(person.returnTo,"");
});

test("outbound, added stops, and return use the same from-arrow-to editor with prices",()=>{
  const context={val:()=>"",escapeHtml:value=>String(value),money:value=>Number(value).toFixed(2),
    master:{transportationMethods:[{method_name:"รถตู้",default_price:400}]},bookingPaymentOptions:()=>'<option value="">ไม่ระบุ</option>'};
  vm.runInNewContext(source,context);
  const person={outboundDestination:"สนามบิน",outboundTo:"ซาบีน่า",transportationMethod:"รถตู้",transportationAmount:400,
    returnDestination:"ซาบีน่า",returnTo:"โรงแรม",returnTransportationAmount:600,
    extraTransportStops:[{date:"2026-10-21",from:"ซาบีน่า",to:"ท่าเรือ",method:"รถตู้",amount:250}]};
  const html=context.travelMainLegEditor(person,0,"outbound")+context.travelStopsEditor(person,0)+context.travelMainLegEditor(person,0,"return");
  assert.equal((html.match(/class="travel-route-inputs"/g)||[]).length,3);
  assert.equal((html.match(/class="travel-route-arrow"/g)||[]).length,3);
  for(const price of ["400.00 บาท","250.00 บาท","600.00 บาท"])assert.match(html,new RegExp(price.replace(".","\\.")));
  assert.match(html,/setPassengerLogistics\(0,'outboundTo'/);
  assert.match(html,/setPassengerLogistics\(0,'returnDestination'/);
  assert.match(html,/updatePassengerTravelStop\(0,0,'from'/);
  assert.match(html,/setPassengerLogistics\(0,'transportationQuantity'/);
  assert.match(html,/setPassengerLogistics\(0,'returnTransportationQuantity'/);
  assert.match(html,/updatePassengerTravelStop\(0,0,'quantity'/);
});

test("new stop starts from the previous destination and method fills its master price",()=>{
  const context={passengers:[{outboundTo:"ซาบีน่า",extraTransportStops:[]}],refreshSummary(){},
    master:{transportationMethods:[{method_name:"รถตู้",default_price:450}]},
    bookingDefaultPaymentMethod:()=>"เงินสด",bookingIsVanMethod:()=>true};
  vm.runInNewContext(source,context);
  context.addPassengerTravelStop(0);
  assert.equal(context.passengers[0].extraTransportStops[0].from,"ซาบีน่า");
  context.updatePassengerTravelStop(0,0,"method","รถตู้");
  assert.equal(context.passengers[0].extraTransportStops[0].amount,450);
  assert.equal(context.passengers[0].extraTransportStops[0].quantity,1);
  context.updatePassengerTravelStop(0,0,"quantity",2);
  assert.equal(context.passengers[0].extraTransportStops[0].quantity,2);
  assert.equal(context.passengers[0].extraTransportStops[0].paymentMethod,"เงินสด");
  context.updatePassengerTravelStop(0,0,"to","โรงแรม");
  context.addPassengerTravelStop(0);
  assert.equal(context.passengers[0].extraTransportStops[1].from,"โรงแรม");
});

test("additional stop prices are summed without changing base travel prices",()=>{
  assert.equal(run("travelStopTotal({extraTransportStops:[{amount:350},{amount:200}]})"),550);
  assert.equal(run("travelStopTotal({extraTransportStops:[{amount:350,quantity:2},{amount:200,quantity:3}]})"),1300);
  assert.equal(run("travelStopTotal({})"),0);
});

test("each route leg displays quantity times unit price while historical legs remain one vehicle",()=>{
  const events=run("travelRouteEvents({transportationAmount:400,transportationQuantity:2,returnTransportationAmount:600,returnTransportationQuantity:3,extraTransportStops:[{amount:250,quantity:2}]},'2026-10-20','2026-10-22')");
  assert.deepEqual(Array.from(events).map(row=>row.amount),[800,500,1800]);
  assert.equal(run("travelLegTotal(400,undefined)"),400);
  assert.equal(run("travelLegTotal(400,2)"),800);
});

test("apply travel to guests copies van routes without charging the same vehicles per passenger",()=>{
  const context={travelDetailFields:["transportationMethod","transportationAmount","transportationQuantity","returnTransportationMethod","returnTransportationAmount","returnTransportationQuantity"],val:()=>"",bookingIsVanMethod:value=>value==="รถตู้"};
  vm.runInNewContext(source,context);
  const leader={transportationMethod:"รถตู้",transportationAmount:400,transportationQuantity:2,returnTransportationMethod:"รถตู้",returnTransportationAmount:500,returnTransportationQuantity:2,outboundTo:"ซาบีน่า",extraTransportStops:[{method:"รถตู้",amount:250,quantity:2,from:"ท่าเรือ",to:"โรงแรม"}]};
  const guest={};context.copyLeaderTravelValues(guest,leader);
  assert.equal(guest.transportationMethod,"รถตู้");assert.equal(guest.outboundTo,"ซาบีน่า");
  assert.equal(guest.transportationAmount,0);assert.equal(guest.transportationQuantity,1);
  assert.equal(guest.returnTransportationAmount,0);assert.equal(guest.extraTransportStops[0].amount,0);
  assert.equal(leader.transportationAmount,400);assert.equal(leader.extraTransportStops[0].amount,250);
});

test("live booking total and printable stop lines follow transport Master Data visibility",()=>{
  const context={window:{},document:{querySelector:()=>null},passengers:[],master:{},travelDetailFields:[],
    createPassenger:()=>({}),applyGroupBookingUiV2:()=>{},copyLeaderTravelDetails:()=>{},applyLeaderTravelDetailsToAll:()=>{},
    personTotal:()=>1500,selectedBookingItemsSummaryHtml:()=>"",documentGroupedItems:()=>[],validateBooking:()=>"",bookingSearchText:()=>"",
    transportationVisibleOnDocument:(leg,booking,profile)=>profile.title==="ใบเสร็จรถตู้"&&leg.transportationMethod==="รถตู้",
    passengerTypeLabels:{adult:"ผู้ใหญ่"},escapeHtml:value=>String(value),money:value=>String(value)};
  vm.runInNewContext(source,context);
  const booking={passengers:[{passengerType:"adult",nationalityType:"thai",extraTransportStops:[{from:"สนามบิน",to:"ท่าเรือ",method:"รถตู้",amount:400,quantity:2},{from:"ท่าเรือ",to:"โรงแรม",method:"รถส่วนตัว",amount:200}]}]};
  assert.equal(context.personTotal(booking.passengers[0]),2500);
  const van=context.documentGroupedItems(booking,{title:"ใบเสร็จรถตู้"});
  assert.equal(van.length,1);assert.equal(van[0].qty,2);assert.equal(van[0].total,800);assert.match(van[0].name,/สนามบิน → ท่าเรือ/);
  assert.equal(context.documentGroupedItems(booking,{title:"ใบสำคัญรับเงิน"}).length,0);
});

test("transport editor and print hooks are wired into active booking flow",()=>{
  for(const expected of ["addPassengerTravelStop","removePassengerTravelStop","outboundTo","returnTo","copyLeaderTravelDetails=function","applyLeaderTravelDetailsToAll=function","personTotal=function","documentGroupedItems=function","selectedBookingItemsSummaryHtml=function"])assert.ok(source.includes(expected));
  const financial=fs.readFileSync(path.resolve(__dirname,"../js/financial.js"),"utf8");
  assert.match(financial,/person\.extraTransportStops/);assert.match(financial,/transport_stop_/);
});
