const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../js/deploymentGuard.js"),"utf8");

function setup({valid=true,updateFails=false}={}){
  const storage=new Map(),calls=[],fields={travelDate:{value:"2026-11-03"},returnDate:{value:"2026-11-05"}},notice={textContent:"",classList:{remove:()=>{}}};
  const context={window:{addEventListener:()=>{}},document:{getElementById:id=>id==="appVersion"?{textContent:"Version 2026.10.29-01"}:id==="deploymentNotice"?notice:fields[id]||null},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    currentUser:{username:"staff"},passengers:[{firstName:"หัวหน้า",program:{price:1500}}],bookingAccommodations:[],paymentBreakdown:{},bookingGroupPaymentSelection:{equipment:"",island:""},bookingPaymentLegacyMode:false,bookingPaymentLegacySnapshot:null,editingCode:"BK1",pendingNewBookingCode:null,pendingMutations:0,
    structuredClone,console:{error:()=>{},warn:()=>{}},setTimeout:callback=>{callback();return 1},setInterval:()=>{},Date,
    API:{updateBooking:async()=>{calls.push("save");if(updateFails)throw new Error("offline")},bookings:async()=>[{bookingCode:"BK1"}]},buildBooking:()=>({bookingCode:"BK1"}),validateBooking:()=>valid?"":"incomplete",logout:()=>calls.push("logout"),
    startNewBooking:()=>{},loadBookingToForm:()=>{},saveBooking:async()=>true,updateBooking:async()=>true,initData:async()=>{},updatePassengerCountInputs:()=>{},renderPassengers:()=>{},refreshSummary:()=>{},renderPaymentBreakdownEditor:()=>{},showPage:()=>{}};
  vm.createContext(context);vm.runInContext(source,context);vm.runInContext("deploymentBookingBaseline=deploymentBookingSignature()",context);
  return{context,storage,calls,notice};
}

test("new deployment saves a changed Booking on the server before logout",async()=>{
  const {context,storage,calls,notice}=setup();context.passengers[0].program.price=1700;
  await vm.runInContext('deploymentHandleVersion("2026.10.29-02")',context);
  assert.deepEqual(calls,["save","logout"]);assert.equal(storage.has("sabinaDeploymentBookingDraft"),false);assert.match(notice.textContent,/จากเวอร์ชัน 2026\.10\.29-01 เป็น 2026\.10\.29-02/);
});

test("incomplete Booking is kept as a tab draft before deployment logout",async()=>{
  const {context,storage,calls,notice}=setup({valid:false});context.passengers[0].program.price=1700;
  await vm.runInContext('deploymentHandleVersion("2026.10.29-02")',context);
  assert.deepEqual(calls,["logout"]);assert.equal(JSON.parse(storage.get("sabinaDeploymentBookingDraft")).passengers[0].program.price,1700);assert.match(notice.textContent,/เก็บร่างไว้ในแท็บนี้/);
});

test("server save failure retains Booking draft for the same user",async()=>{
  const {context,storage,calls}=setup({updateFails:true});context.passengers[0].program.price=1700;
  await vm.runInContext('deploymentHandleVersion("2026.10.29-02")',context);
  assert.deepEqual(calls,["save","logout"]);assert.equal(JSON.parse(storage.get("sabinaDeploymentBookingDraft")).username,"staff");
  context.passengers=[];await vm.runInContext("deploymentRestoreDraft()",context);
  assert.equal(context.passengers[0].program.price,1700);assert.equal(storage.has("sabinaDeploymentBookingDraft"),false);
});
