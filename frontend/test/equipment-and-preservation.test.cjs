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

test("child-to-adult correction keeps the same named passenger, route and five-person total",()=>{
  const fields={adultCount:"5",childCount:"1",infantCount:"0",focCount:"0"};
  const program={program_id:"boat_ticket",default_price:1700,child_price:1100};
  const person=(firstName,type,price)=>({firstName,passengerType:type,title:type==="child"?"เด็กหญิง":"นางสาว",program:{programId:"boat_ticket",price,defaultPrice:price},extraTransportStops:[]});
  const child={...person("รุ่งนภา","child",1100),outboundTo:"ซาบีน่า",extraTransportStops:[{from:"ท่าเรือ",to:"ซาบีน่า"}]};
  const context={passengers:[person("หัวหน้า","adult",1700),person("คนที่สอง","adult",1700),person("คนที่สาม","adult",1700),person("คนที่สี่","adult",1700),child],master:{programs:[program]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},val:id=>fields[id],programPriceForType:(item,type)=>type==="child"?item.child_price:item.default_price,createPassenger:(_,type)=>({firstName:"",passengerType:type,outboundTo:"ซาบีน่า",returnDestination:"ซาบีน่า",program:{programId:"boat_ticket",price:1700,defaultPrice:1700}}),updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(){throw new Error("named passenger must not be removed")}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,6);
  fields.childCount="0";
  vm.runInNewContext("syncPassengerComposition();",context);
  assert.equal(context.passengers.length,5);
  assert.equal(context.passengers[4],child);
  assert.equal(child.passengerType,"adult");
  assert.equal(child.title,"นางสาว");
  assert.equal(child.program.price,1700);
  assert.equal(child.outboundTo,"ซาบีน่า");
  assert.equal(child.extraTransportStops.length,1);
});

test("direct passenger type edit preserves a manually overridden program price",()=>{
  const person={title:"เด็กชาย",passengerType:"child",program:{programId:"boat_ticket",price:900,defaultPrice:1100},outboundTo:"ซาบีน่า"};
  const context={passengers:[{passengerType:"adult"},person],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100}]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},programPriceForType:(item,type)=>type==="child"?item.child_price:item.default_price,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};changePassengerType(1,"adult");`,context);
  assert.equal(context.passengers[1],person);
  assert.equal(person.passengerType,"adult");
  assert.equal(person.title,"นาย");
  assert.equal(person.program.price,900);
  assert.equal(person.outboundTo,"ซาบีน่า");
});

test("lowering the child count first never silently deletes a named child",()=>{
  const child={firstName:"รุ่งนภา",passengerType:"child",outboundTo:"ซาบีน่า",program:{programId:"boat_ticket",price:1100,defaultPrice:1100}};
  let prompt="",restored=false;
  const context={passengers:[{firstName:"หัวหน้า",passengerType:"adult"},child],master:{programs:[]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},val:id=>id==="adultCount"?"1":"0",updatePassengerCountInputs(){restored=true},renderPassengers(){throw new Error("should not rerender")},refreshSummary(){throw new Error("should not recalculate")},confirm(message){prompt=message;return false}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,2);
  assert.equal(context.passengers[1],child);
  assert.equal(restored,true);
  assert.match(prompt,/รุ่งนภา/);
  assert.match(prompt,/ประเภทผู้เดินทาง/);
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

test("equipment report paginates many master columns and repeats the correct totals",()=>{
  const columns=Array.from({length:9},(_,index)=>({code:`a${index}`,name:`อุปกรณ์ ${index+1}`}));
  const report={date:"2026-10-17",title:"ใบรายงานอุปกรณ์",equipmentColumns:columns,rows:[{no:1,leader:"สมชาย",pax:3,program:"3D2N",equipment:{a0:2,a8:1},cash:200,transfer:50,total:250}],equipmentTotals:{pax:3,equipment:{a0:2,a8:1},cash:200,transfer:50,total:250}};
  const context={report,escapeHtml:value=>String(value),getCompanySettings:()=>({company_name:"Sabina",address:"Phang Nga",phone:"081",tax_id:"-"}),cachedCompanyLogo:()=>"",money:value=>Number(value||0).toFixed(2)};
  vm.runInNewContext(`${section("function equipmentReportHtml(report)","function excelDate(")};html=equipmentReportHtml(report);`,context);
  assert.equal((context.html.match(/equipment-report-page/g)||[]).length,2);
  assert.match(context.html,/ชื่อลูกค้า \(หัวหน้าทริป\)/);
  assert.match(context.html,/อุปกรณ์ 9/);
  assert.match(context.html,/สมชาย/);
  assert.equal((context.html.match(/250\.00/g)||[]).length,4);
});
