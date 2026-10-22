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

test("smart paste of the same leader completes the surname without creating a second guest",()=>{
  const fields=Object.fromEntries(["passengerText","leaderTitle","leaderFirstName","leaderLastName"].map(id=>[id,{value:""}]));
  const leader={title:"นาย",firstName:"สมชาย",lastName:"",passengerType:"adult",program:{price:1500},transportationMethod:"รถตู้"};
  const context={passengers:[leader],document:{getElementById:id=>fields[id]},parseSmartPasteText:()=>({ok:true,passengers:[{title:"นาย",firstName:"สมชาย",lastName:"ใจดี"}]}),createPassenger(){throw new Error("same leader must not create another passenger")},structuredClone,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},alert(){throw new Error("unexpected alert")}};
  vm.runInNewContext(`${section("function parsePassengerText()","function renderPassengers()")};parsePassengerText();`,context);
  assert.equal(context.passengers.length,1);
  assert.equal(context.passengers[0].lastName,"ใจดี");
  assert.equal(context.passengers[0].program.price,1500);
  assert.equal(context.passengers[0].transportationMethod,"รถตู้");
  assert.equal(fields.leaderLastName.value,"ใจดี");
});

test("smart paste recognizes whitespace-only differences in an existing leader name",()=>{
  const fields=Object.fromEntries(["passengerText","leaderTitle","leaderFirstName","leaderLastName"].map(id=>[id,{value:""}]));
  const context={passengers:[{title:"นาย",firstName:"สมชาย ",lastName:" ใจดี",passengerType:"adult",program:{price:1500}}],document:{getElementById:id=>fields[id]},parseSmartPasteText:()=>({ok:true,passengers:[{title:"นาย",firstName:"สมชาย",lastName:"ใจดี"}]}),createPassenger(){throw new Error("same leader must not create another passenger")},structuredClone,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},alert(){throw new Error("unexpected alert")}};
  vm.runInNewContext(`${section("function parsePassengerText()","function renderPassengers()")};parsePassengerText();`,context);
  assert.equal(context.passengers.length,1);
});

test("smart paste fills blank guests and matches named guests without overwriting their details",()=>{
  const fields=Object.fromEntries(["passengerText","leaderTitle","leaderFirstName","leaderLastName"].map(id=>[id,{value:""}]));
  const leader={title:"นาย",firstName:"หัวหน้า",lastName:"ทริป",passengerType:"adult",program:{price:1500}};
  const named={title:"เด็กหญิง",firstName:"มาลี",lastName:"ดีใจ",passengerType:"child",program:{price:900},outboundTo:"ท่าเรือ",extraTransportStops:[{to:"โรงแรม"}]};
  const blank={title:"",firstName:"",lastName:"",passengerType:"adult",program:{price:1700},transportationMethod:"รถตู้"};
  const context={passengers:[leader,named,blank],document:{getElementById:id=>fields[id]},parseSmartPasteText:()=>({ok:true,passengers:[{title:"นาย",firstName:"สมชาย",lastName:"มาใหม่"},{title:"เด็กหญิง",firstName:"มาลี",lastName:"ดีใจ"}]}),createPassenger(){throw new Error("unused blank should be filled")},structuredClone,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},alert(){throw new Error("unexpected alert")}};
  vm.runInNewContext(`${section("function parsePassengerText()","function renderPassengers()")};parsePassengerText();`,context);
  assert.deepEqual(Array.from(context.passengers,person=>person.firstName),["หัวหน้า","มาลี","สมชาย"]);
  assert.equal(context.passengers[1].program.price,900);
  assert.equal(context.passengers[1].outboundTo,"ท่าเรือ");
  assert.equal(context.passengers[1].extraTransportStops[0].to,"โรงแรม");
  assert.equal(context.passengers[2].transportationMethod,"รถตู้");
});

test("changing passenger count preserves the original leader object and custom price",()=>{
  const leader={firstName:"สมชาย",passengerType:"adult",program:{programId:"boat_ticket",price:1500,defaultPrice:1700},transportationMethod:"รถตู้"};
  const context={passengers:[leader],master:{programs:[]},val:id=>id==="adultCount"?"2":"0",createPassenger:()=>({passengerType:"adult",program:{price:1700}}),document:{getElementById:()=>({value:""})},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(){return true}};
  vm.runInNewContext(`${section("function syncPassengerComposition()","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,2);
  assert.equal(context.passengers[0],leader);
  assert.equal(leader.program.price,1500);
  assert.equal(leader.transportationMethod,"รถตู้");
});

test("a named child can become an adult without losing custom price or travel details",()=>{
  const child={title:"เด็กหญิง",firstName:"รุ่งนภา",passengerType:"child",program:{programId:"boat_ticket",price:900,defaultPrice:1100},outboundDestination:"สนามบิน",extraTransportStops:[{from:"ท่าเรือ",to:"ซาบีน่า"}]};
  const context={passengers:[{title:"นาย",passengerType:"adult"},child],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100}]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},programPriceForType:(program,type)=>type==="child"?program.child_price:program.default_price,updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};changePassengerType(1,"adult");`,context);
  assert.equal(context.passengers[1],child);
  assert.equal(child.passengerType,"adult");assert.equal(child.title,"นางสาว");
  assert.equal(child.program.price,900);assert.equal(child.program.defaultPrice,1700);
  assert.equal(child.outboundDestination,"สนามบิน");assert.equal(child.extraTransportStops.length,1);
});

test("leader passenger type can change without being overwritten by the main booking title",()=>{
  const leader={title:"นาย",firstName:"หัวหน้า",passengerType:"adult",program:{programId:"boat_ticket",price:1700,defaultPrice:1700}},leaderTitle={value:"นาย"};
  const context={passengers:[leader],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100}]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},programPriceForType:(program,type)=>type==="child"?program.child_price:program.default_price,document:{getElementById:()=>leaderTitle},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};changePassengerType(0,"child");`,context);
  assert.equal(leader.passengerType,"child");assert.equal(leader.title,"เด็กชาย");assert.equal(leaderTitle.value,"เด็กชาย");assert.equal(leader.program.price,1100);
});

test("infant and FOC edits use their own program defaults",()=>{
  const person={title:"นางสาว",passengerType:"adult",program:{programId:"boat_ticket",price:1700,defaultPrice:1700}};
  const context={passengers:[person],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100,infant_price:300}]},passengerTypeLabels:{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"},programPriceForType:(program,type)=>type==="foc"?0:type==="infant"?program.infant_price:program.default_price,document:{getElementById:()=>({value:""})},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};changePassengerType(0,"infant");`,context);
  assert.equal(person.title,"เด็กหญิง");assert.equal(person.program.price,300);
  vm.runInNewContext('changePassengerType(0,"foc");',context);
  assert.equal(person.passengerType,"foc");assert.equal(person.program.price,0);
});

test("changing count composition keeps passenger order and retains existing details",()=>{
  const child={title:"เด็กชาย",firstName:"ภูมิ",passengerType:"child",program:{programId:"boat_ticket",price:1100,defaultPrice:1100},transportationMethod:"รถตู้"};
  const fields={adultCount:"2",childCount:"0",infantCount:"0",focCount:"0"},leaderTitle={value:"นาย"};
  const context={passengers:[{title:"นาย",firstName:"หัวหน้า",passengerType:"adult"},child],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100}]},val:id=>fields[id],document:{getElementById:()=>leaderTitle},programPriceForType:(program,type)=>type==="child"?program.child_price:program.default_price,createPassenger(){throw new Error("must reuse named passenger")},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(){throw new Error("same total must not remove anyone")}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers[1],child);assert.equal(child.passengerType,"adult");assert.equal(child.title,"นาย");assert.equal(child.program.price,1700);assert.equal(child.transportationMethod,"รถตู้");
});

test("raising adult count then lowering child count keeps the named guest",()=>{
  const child={title:"เด็กหญิง",firstName:"รุ่งนภา",passengerType:"child",program:{programId:"boat_ticket",price:950,defaultPrice:1100},returnDestination:"ซาบีน่า"};
  const fields={adultCount:"2",childCount:"1",infantCount:"0",focCount:"0"},leaderTitle={value:"นาย"};
  const context={passengers:[{title:"นาย",passengerType:"adult"},child],master:{programs:[{program_id:"boat_ticket",default_price:1700,child_price:1100}]},val:id=>fields[id],document:{getElementById:()=>leaderTitle},programPriceForType:(program,type)=>type==="child"?program.child_price:program.default_price,createPassenger:(_,type)=>({passengerType:type,firstName:"",program:{programId:"boat_ticket",price:1700,defaultPrice:1700}}),updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(){return true}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,3);assert.equal(context.passengers[1],child);
  fields.childCount="0";vm.runInNewContext("syncPassengerComposition();",context);
  assert.equal(context.passengers.length,2);assert.equal(context.passengers[1],child);
  assert.equal(child.passengerType,"adult");assert.equal(child.program.price,950);assert.equal(child.returnDestination,"ซาบีน่า");
});

test("decreasing passenger count removes only from the end after showing their names",()=>{
  const passengers=["หัวหน้า","คนที่สอง","คนที่สาม","คนที่สี่"].map((firstName,index)=>({firstName,title:"นาย",passengerType:"adult",program:{price:1700,defaultPrice:1700},isLeader:index===0}));
  let prompt="";const fields={adultCount:"2",childCount:"0",infantCount:"0",focCount:"0"};
  const context={passengers,master:{programs:[]},val:id=>fields[id],document:{getElementById:()=>({value:"นาย"})},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(message){prompt=message;return true}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.deepEqual(context.passengers.map(person=>person.firstName),["หัวหน้า","คนที่สอง"]);
  assert.match(prompt,/คนที่สาม/);assert.match(prompt,/คนที่สี่/);
  assert.equal(context.passengers[0],passengers[0]);assert.equal(context.passengers[1],passengers[1]);
});

test("cancelling a count decrease leaves every passenger untouched",()=>{
  const child={firstName:"รุ่งนภา",passengerType:"child"};let prompt="",restored=false;
  const context={passengers:[{firstName:"หัวหน้า",passengerType:"adult"},child],master:{programs:[]},val:id=>id==="adultCount"?"1":"0",updatePassengerCountInputs(){restored=true},renderPassengers(){throw new Error("should not rerender")},refreshSummary(){throw new Error("should not recalculate")},confirm(message){prompt=message;return false}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,2);assert.equal(context.passengers[1],child);assert.equal(restored,true);assert.match(prompt,/รุ่งนภา/);
});

test("saved booking may remove the last passenger after naming them in the confirmation",()=>{
  const rows=[{firstName:"หัวหน้า",passengerType:"adult",program:{price:1500},outboundTo:"ท่าเรือ"},{firstName:"ลูกทัวร์",passengerType:"adult",outboundTo:"ซาบีน่า"}];
  let prompt="";
  const context={editingCode:"BK123",passengers:rows,master:{programs:[]},val:id=>id==="adultCount"?"1":"0",document:{getElementById:()=>({value:""})},updatePassengerCountInputs(){},renderPassengers(){},refreshSummary(){},confirm(message){prompt=message;return true}};
  vm.runInNewContext(`${section("function applyPassengerTypeChange(","function parsePassengerText()")};syncPassengerComposition();`,context);
  assert.equal(context.passengers.length,1);assert.equal(context.passengers[0],rows[0]);
  assert.equal(context.passengers[0].program.price,1500);assert.equal(context.passengers[0].outboundTo,"ท่าเรือ");
  assert.match(prompt,/ลูกทัวร์/);
});

test("saved booking reduction uses a revisioned RPC and retains the expected count",()=>{
  const route=fs.readFileSync(path.resolve(__dirname,"../../backend/src/routes/bookings.js"),"utf8");
  const sql=fs.readFileSync(path.resolve(__dirname,"../../database/migrations/20261022_048_safe_passenger_reduction.sql"),"utf8");
  assert.match(app,/booking\.expectedPassengerCount=loadedPassengerCount/);
  assert.match(app,/booking\.allowPassengerReduction=booking\.passengers\.length<loadedPassengerCount/);
  assert.match(route,/if\(booking\.allowPassengerReduction\)[\s\S]*?upsert_booking_v27/);
  assert.match(sql,/v_result:=public\.upsert_booking_v24\(p_booking\)/);
  assert.match(sql,/Passenger count changed\. Reload the Booking/);
  assert.match(sql,/PASSENGER_COUNT_REDUCED/);
  assert.match(sql,/transportation_quantity=coalesce/);
  assert.match(sql,/insert into public\.passenger_transport_stops/);
  assert.match(sql,/revoke all on function public\.upsert_booking_v27\(jsonb\) from public, anon, authenticated/);
});

test("new booking reuses its code after an uncertain failed save and prevents a duplicate retry",async()=>{
  const notices=[],codes=[],button={disabled:false,innerText:"บันทึก Booking",classList:{add(){}}},editButton={classList:{remove(){}}};
  let clock=1000,attempt=0;
  const context={pendingNewBookingCode:null,editingCode:null,selectedBooking:null,bookings:[],Date:{now:()=>++clock},document:{getElementById:id=>id==="saveNewBtn"?button:editButton},buildBooking(){return{bookingCode:context.pendingNewBookingCode}},validateBooking:()=>"",API:{duplicate:async()=>({duplicates:[]}),saveBooking:async booking=>{codes.push(booking.bookingCode);if(++attempt===1)throw Error("timeout")},bookings:async()=>[]},toggleEditBookingPrintActions(){},loadBookingList:async()=>{},alert:message=>notices.push(message),console:{error(){},warn(){}}};
  vm.runInNewContext(`${section("async function saveBooking()","async function updateBooking()")};globalThis.runSave=saveBooking;`,context);
  assert.equal(await context.runSave(),false);
  assert.match(notices[0],/timeout/);
  assert.equal(await context.runSave(),true);
  assert.deepEqual(codes,["BK1001","BK1001"]);
  assert.equal(context.editingCode,"BK1001");
  assert.equal(context.pendingNewBookingCode,null);
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
