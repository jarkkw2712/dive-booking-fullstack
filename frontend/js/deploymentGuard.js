// Keep an open Booking safe when a newer frontend is deployed.
const DEPLOYMENT_DRAFT_KEY="sabinaDeploymentBookingDraft";
const DEPLOYMENT_FORM_IDS=["tripType","travelDate","returnDate","bookingOriginal","leaderTitle","leaderFirstName","leaderLastName","phone","contactEmail","source","agentName","status","receiptBookNo","manualReceiptNo","boatTicketBookNo","boatTicketNo","bookingNote","paymentMethod","primaryPaymentAmount","secondaryPaymentMethod","secondaryPaymentAmount","depositAmount","depositPaymentMethod","creditAmount","creditPaymentMethod"];
const DEPLOYMENT_VERSION=(document.getElementById("appVersion")?.textContent||"").match(/\d{4}\.\d{2}\.\d{2}-\d{2}/)?.[0]||"";
let deploymentBookingBaseline=null,deploymentGuardBusy=false;

function deploymentFormFields(){return Object.fromEntries(DEPLOYMENT_FORM_IDS.map(id=>[id,document.getElementById(id)?.value??""]))}
function deploymentBookingState(){return{fields:deploymentFormFields(),passengers,bookingAccommodations,paymentBreakdown,bookingGroupPaymentSelection}}
function deploymentBookingSignature(){return JSON.stringify(deploymentBookingState())}
function deploymentNotice(message){const node=document.getElementById("deploymentNotice");if(!node)return;node.textContent=message;node.classList.remove("hidden")}
function deploymentSaveDraft(){const draft={...structuredClone(deploymentBookingState()),username:currentUser?.username||"",editingCode,pendingNewBookingCode,bookingPaymentLegacyMode,bookingPaymentLegacySnapshot,createdAt:Date.now()};sessionStorage.setItem(DEPLOYMENT_DRAFT_KEY,JSON.stringify(draft));return draft}

async function deploymentRestoreDraft(){
  let draft;try{draft=JSON.parse(sessionStorage.getItem(DEPLOYMENT_DRAFT_KEY)||"null")}catch{return}
  if(!draft||!currentUser||draft.username!==currentUser.username)return;
  if(draft.editingCode){const rows=await API.bookings(),saved=rows.find(row=>row.bookingCode===draft.editingCode);if(!saved){deploymentNotice(`มีร่าง Booking ${draft.editingCode} แต่ไม่พบรายการเดิม กรุณาติดต่อ Admin`);return}loadBookingToForm(saved)}
  else startNewBooking();
  for(const [id,value] of Object.entries(draft.fields||{})){const node=document.getElementById(id);if(!node)continue;if(node.tagName==="SELECT"&&value&&![...node.options].some(option=>option.value===value))node.add(new Option(`${value} (รายการเดิม)`,value));node.value=value}
  passengers=structuredClone(draft.passengers||[]);bookingAccommodations=structuredClone(draft.bookingAccommodations||[]);paymentBreakdown=structuredClone(draft.paymentBreakdown||{});bookingGroupPaymentSelection=structuredClone(draft.bookingGroupPaymentSelection||{equipment:"",island:""});
  bookingPaymentLegacyMode=Boolean(draft.bookingPaymentLegacyMode);bookingPaymentLegacySnapshot=structuredClone(draft.bookingPaymentLegacySnapshot||null);pendingNewBookingCode=draft.pendingNewBookingCode||null;
  updatePassengerCountInputs();renderPassengers();refreshSummary();renderPaymentBreakdownEditor();showPage("bookingPage");
  sessionStorage.removeItem(DEPLOYMENT_DRAFT_KEY);
  deploymentNotice("กู้คืนร่าง Booking หลังอัปเดตระบบแล้ว กรุณาตรวจข้อมูลและกดบันทึกอีกครั้ง");
}

async function deploymentHandleVersion(nextVersion){
  if(deploymentGuardBusy||!currentUser||!nextVersion||nextVersion===DEPLOYMENT_VERSION)return;
  deploymentGuardBusy=true;
  const prefix=`กำลังปรับปรุงระบบจากเวอร์ชัน ${DEPLOYMENT_VERSION} เป็น ${nextVersion}`;
  deploymentNotice(`${prefix} · กำลังตรวจและบันทึก Booking ก่อนออกจากระบบ...`);
  const waitStarted=Date.now();
  while(pendingMutations>0&&Date.now()-waitStarted<120000)await new Promise(resolve=>setTimeout(resolve,750));
  if(pendingMutations>0){deploymentNotice(`${prefix} · กำลังรอการบันทึกเดิมให้เสร็จ ระบบยังไม่ออกจากระบบ`);deploymentGuardBusy=false;return}
  const dirty=deploymentBookingBaseline!==null&&deploymentBookingSignature()!==deploymentBookingBaseline;
  let draftSaved=false,serverSaved=false;
  if(dirty){
    try{deploymentSaveDraft();draftSaved=true}catch(error){console.error("Deployment draft save failed",error)}
    try{
      const booking=buildBooking();
      if(!validateBooking(booking)){
        if(editingCode){await API.updateBooking(editingCode,booking);serverSaved=true}
        else if(booking.leaderFirstName||booking.leaderLastName){pendingNewBookingCode=booking.bookingCode;const duplicates=await API.duplicate(booking);if(!duplicates.duplicates?.length){await API.saveBooking(booking);serverSaved=true}}
      }
    }catch(error){console.warn("Deployment Booking save failed; retaining draft",error)}
    if(serverSaved){sessionStorage.removeItem(DEPLOYMENT_DRAFT_KEY);deploymentNotice(`${prefix} · บันทึก Booking สำเร็จ กำลังออกจากระบบ...`)}
    else if(draftSaved)deploymentNotice(`${prefix} · ยังบันทึกขึ้นระบบไม่ได้ เก็บร่างไว้ในแท็บนี้เพื่อกู้คืนหลัง Login กำลังออกจากระบบ...`);
    else{deploymentNotice(`${prefix} · บันทึก Booking และเก็บร่างไม่ได้ กรุณาบันทึกด้วยตนเองก่อนออกจากระบบ`);return}
  }else deploymentNotice(`${prefix} · กำลังออกจากระบบ กรุณา Login ใหม่...`);
  await new Promise(resolve=>setTimeout(resolve,1800));
  logout();
}

async function deploymentCheckVersion(){
  if(!currentUser||deploymentGuardBusy||deploymentBookingBaseline===null)return;
  try{const response=await fetch(`${location.pathname}?version_check=${Date.now()}`,{cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(12000)});if(!response.ok)return;const html=await response.text(),next=html.match(/id="appVersion"[^>]*>\s*Version\s+(\d{4}\.\d{2}\.\d{2}-\d{2})/i)?.[1];if(next)await deploymentHandleVersion(next)}catch(error){console.warn("Deployment version check skipped",error)}
}

const deploymentStartNewBooking=startNewBooking;startNewBooking=function(...args){const result=deploymentStartNewBooking(...args);deploymentBookingBaseline=deploymentBookingSignature();return result};
const deploymentLoadBookingToForm=loadBookingToForm;loadBookingToForm=function(...args){const result=deploymentLoadBookingToForm(...args);deploymentBookingBaseline=deploymentBookingSignature();return result};
const deploymentSaveBooking=saveBooking;saveBooking=async function(...args){const saved=await deploymentSaveBooking(...args);if(saved)deploymentBookingBaseline=deploymentBookingSignature();return saved};
const deploymentUpdateBooking=updateBooking;updateBooking=async function(...args){const saved=await deploymentUpdateBooking(...args);if(saved)deploymentBookingBaseline=deploymentBookingSignature();return saved};
const deploymentInitData=initData;initData=async function(...args){const result=await deploymentInitData(...args);try{await deploymentRestoreDraft()}catch(error){console.error("Deployment draft restore failed",error);deploymentNotice("มีร่าง Booking ที่ยังไม่สามารถกู้คืนได้ กรุณาลอง Login อีกครั้ง")}return result};
setInterval(deploymentCheckVersion,30000);
window.addEventListener("focus",deploymentCheckVersion);
