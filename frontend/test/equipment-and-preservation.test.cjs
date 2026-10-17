const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const app=fs.readFileSync(path.resolve(__dirname,"../js/app.js"),"utf8");
const section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("existing leader price and travel survive later smart-pasted guest names",()=>{
  const fields=Object.fromEntries(["passengerText","leaderTitle","leaderFirstName","leaderLastName"].map(id=>[id,{value:""}]));
  const leader={title:"นาย",firstName:"สมชาย",lastName:"ใจดี",passengerType:"adult",isLeader:true,program:{programId:"boat_ticket",price:1500,defaultPrice:1700},transportationMethod:"รถตู้",transportationAmount:400,returnTransportationMethod:"รถส่วนตัว",returnDestination:"ท่าเรือ",preAddOns:[{id:"fin",selected:true,qty:2,nights:3,price:100}]};
  const context={passengers:[leader],document:{getElementById:id=>fields[id]},parseSmartPasteText:()=>({ok:true,passengers:[{title:"นางสาว",firstName:"มาลี",lastName:"ดีใจ"}]}),createPassenger:()=>({passengerType:"adult",program:{programId:"boat_ticket",price:1700},preAddOns:[]}),structuredClone,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},alert(){throw new Error("unexpected alert")}};
  vm.runInNewContext(`${section("function parsePassengerText()","function renderPassengers()")};parsePassengerText();`,context);
  assert.equal(context.passengers.length,2);
  assert.equal(context.passengers[0].program.price,1500);
  assert.equal(context.passengers[0].transportationMethod,"รถตู้");
  assert.equal(context.passengers[0].returnTransportationMethod,"รถส่วนตัว");
  assert.equal(context.passengers[0].preAddOns[0].nights,3);
  assert.equal(context.passengers[1].firstName,"มาลี");
  assert.equal(fields.leaderFirstName.value,"สมชาย");
});

test("changing passenger count preserves the original leader object and custom price",()=>{
  const leader={firstName:"สมชาย",passengerType:"adult",program:{programId:"boat_ticket",price:1500,defaultPrice:1700},transportationMethod:"รถตู้"};
  const context={passengers:[leader],master:{programs:[]},val:id=>id==="adultCount"?"2":"0",createPassenger:()=>({passengerType:"adult",program:{price:1700}}),updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(){return true}};
  vm.runInNewContext(`${section("function syncPassengerComposition()","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,2);
  assert.equal(context.passengers[0],leader);
  assert.equal(leader.program.price,1500);
  assert.equal(leader.transportationMethod,"รถตู้");
});

test("equipment quantity is physical pieces times nights while old bookings remain one night",()=>{
  const context={};
  vm.runInNewContext(`${section("function equipmentNights(item)","function createPassenger(")};result=[equipmentBillableQty({qty:2,nights:3}),equipmentBillableQty({qty:2})];`,context);
  assert.deepEqual(Array.from(context.result),[6,2]);
});

test("printed equipment lines use billable units and keep the rental breakdown",()=>{
  const context={passengerTypeLabels:{adult:"ผู้ใหญ่"},equipmentNights:item=>item.nights??1,equipmentBillableQty:item=>(item.qty??1)*(item.nights??1),addonVisibleOnDocument:()=>true,transportationVisibleOnDocument:()=>false};
  vm.runInNewContext(`${section("function documentGroupedItems(booking,profile)","function documentInfoLine")};result=documentGroupedItems({passengers:[{preAddOns:[{name:"Fin",selected:true,qty:2,nights:3,price:100}]}]},{program:false});`,context);
  assert.equal(context.result[0].qty,6);
  assert.equal(context.result[0].total,600);
  assert.match(context.result[0].name,/2 ชิ้น × 3 คืน/);
});

test("CSV parser records only fields explicitly supplied by staff",()=>{
  const {parsePassengerCsv}=require("../js/csvImport.js");
  const row=parsePassengerCsv("ชื่อ,นามสกุล,วิธีเดินทาง,โปรแกรม\nมาลี,ดีใจ,,").rows[0];
  assert.deepEqual(row.providedFields,["firstName","lastName"]);
});
