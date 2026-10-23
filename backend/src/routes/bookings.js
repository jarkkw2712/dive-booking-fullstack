import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { bankReferencesForUser, bookingForUser } from "../services/permissionViews.js";

const router=express.Router();
router.use(requireAuth);
const normalizeName = value => String(value || "").normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const normalizePhone = value => String(value || "").replace(/\D/g, "").replace(/^66/, "0");
const missingBookingRpc=error=>["PGRST202","42883"].includes(error?.code);
async function bookingRpc(names,args){let result;for(const name of names){result=await supabaseAdmin.rpc(name,args);if(!missingBookingRpc(result.error))return result}return result}
const hasMultiNightEquipment=booking=>(booking.passengers||[]).some(person=>(person.preAddOns||[]).some(item=>item.selected!==false&&Number(item.nights??1)!==1));
const hasNewTravelDetails=booking=>(booking.passengers||[]).some(person=>String(person.outboundTo||"").trim()||String(person.returnTo||"").trim()||(person.extraTransportStops||[]).length);
const hasMultipleTransportVehicles=booking=>(booking.passengers||[]).some(person=>Number(person.transportationQuantity??1)!==1||Number(person.returnTransportationQuantity??1)!==1||(person.extraTransportStops||[]).some(stop=>Number(stop.quantity??1)!==1));
function equipmentInputError(booking){for(const person of booking.passengers||[]){const signatures=new Map();for(const item of person.preAddOns||[]){if(item.selected===false)continue;const nights=Number(item.nights??1),qty=Number(item.qty??1);if(!Number.isInteger(nights)||nights<1||nights>365)return"Equipment nights must be an integer from 1 to 365";if(!Number.isInteger(qty)||qty<1)return"Equipment quantity must be a positive integer";const key=[item.id,qty,Number(item.price||0)].join("|");if(signatures.has(key)&&signatures.get(key)!==nights)return"อุปกรณ์รายการเดียวกันที่จำนวนและราคาเท่ากัน แต่จำนวนคืนต่างกัน ไม่สามารถบันทึกแยกแถวได้";signatures.set(key,nights)}}return""}
function accommodationInputError(booking){
  if(booking.accommodations===undefined)return"";
  if(!Array.isArray(booking.accommodations))return"รายการที่พักต้องเป็นรายการแบบ Array";
  for(const row of booking.accommodations){
    if(!row||typeof row!=="object"||Array.isArray(row))return"รูปแบบรายการที่พักไม่ถูกต้อง";
    const qty=Number(row.accommodationQty),price=Number(row.accommodationPrice);
    if(!Number.isInteger(qty)||qty<1)return"จำนวนที่พักต้องเป็นจำนวนเต็มมากกว่า 0";
    if(!Number.isFinite(price)||price<0||price>100000000||Math.abs(price*100-Math.round(price*100))>0.000001)return"ราคาที่พักต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง";
    if(/tent|เต็นท์|เตนท์/i.test(`${row.accommodationId||""} ${row.accommodationName||""}`)){
      const nights=Number(row.accommodationNights??1);
      if(!Number.isInteger(nights)||nights<1||nights>365)return"จำนวนคืนของเต็นท์ต้องเป็นจำนวนเต็ม 1–365 คืน";
    }
  }
  return"";
}
function travelStopInputError(booking){const validQuantity=value=>Number.isInteger(Number(value??1))&&Number(value??1)>=1&&Number(value??1)<=30;for(const person of booking.passengers||[]){if(!validQuantity(person.transportationQuantity)||!validQuantity(person.returnTransportationQuantity))return"จำนวนรถต้องเป็นจำนวนเต็ม 1–30 คัน";const stops=person.extraTransportStops??[];if(!Array.isArray(stops)||stops.length>30)return"จุดรับส่งเพิ่มเติมต้องเป็นรายการไม่เกิน 30 จุดต่อคน";for(const stop of stops){if(!stop||typeof stop!=="object"||Array.isArray(stop))return"รูปแบบจุดรับส่งเพิ่มเติมไม่ถูกต้อง";if(!validQuantity(stop.quantity))return"จำนวนรถของจุดแวะต้องเป็นจำนวนเต็ม 1–30 คัน";const amount=Number(stop.amount??0);if(!Number.isFinite(amount)||amount<0||amount>100000000||Math.abs(amount*100-Math.round(amount*100))>0.000001)return"ราคาจุดรับส่งเพิ่มเติมต้องเป็นตัวเลขไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง";if(stop.date&&!/^\d{4}-\d{2}-\d{2}$/.test(String(stop.date)))return"วันที่จุดรับส่งเพิ่มเติมไม่ถูกต้อง";if((stop.method||amount)&&!stop.date)return"กรุณาระบุวันที่ของจุดรับส่งเพิ่มเติม";if(amount&&!stop.method)return"กรุณาเลือกวิธีการเดินทางของจุดรับส่งที่มีราคา";for(const field of ["from","to","method","paymentMethod"])if(String(stop[field]??"").length>250)return"รายละเอียดจุดรับส่งเพิ่มเติมยาวเกินไป"}}return""}
async function saveBookingRpc(booking){
  if(booking.allowPassengerReduction){
    const categorySafe=Array.isArray(booking.retainedPassengerNos);
    const reduced=await supabaseAdmin.rpc(categorySafe?"upsert_booking_v28":"upsert_booking_v27",{p_booking:booking});
    if(missingBookingRpc(reduced.error))return{error:{message:categorySafe?"กรุณารัน migration 20261023044513_category_safe_passenger_reduction.sql ก่อนลดจำนวนผู้เดินทางตามประเภทใน Booking ที่บันทึกแล้ว":"กรุณารัน migration 20261022_048_safe_passenger_reduction.sql ก่อนลดจำนวนผู้เดินทางใน Booking ที่บันทึกแล้ว"},migrationRequired:true};
    return reduced;
  }
  const args={p_booking:booking},withQuantity=await supabaseAdmin.rpc("upsert_booking_v26",args);
  if(!missingBookingRpc(withQuantity.error))return withQuantity;
  if(hasMultipleTransportVehicles(booking))return{error:{message:"กรุณารัน migration 20261020_046_van_quantity_per_leg.sql ก่อนบันทึกจำนวนรถหลายคัน"},migrationRequired:true};
  const latest=await supabaseAdmin.rpc("upsert_booking_v25",args);
  if(!missingBookingRpc(latest.error))return latest;
  if(hasNewTravelDetails(booking))return{error:{message:"กรุณารัน migration 20261019_045_passenger_transport_stops.sql ก่อนบันทึกเส้นทางหรือจุดรับส่งใหม่"},migrationRequired:true};
  const previous=await supabaseAdmin.rpc("upsert_booking_v24",args);
  if(!missingBookingRpc(previous.error))return previous;
  if(hasMultiNightEquipment(booking))return{error:{message:"กรุณารัน migration 20261017_044_equipment_nights.sql ก่อนบันทึกอุปกรณ์หลายคืน"},migrationRequired:true};
  return bookingRpc(["upsert_booking_v23","upsert_booking_v21"],args);
}
const bookingCache={data:null,expiresAt:0,promise:null,version:0};
function invalidateBookingCache(){bookingCache.data=null;bookingCache.expiresAt=0;bookingCache.promise=null;bookingCache.version+=1}
async function listBookingsCached(){
  if(bookingCache.data&&Date.now()<bookingCache.expiresAt)return bookingCache.data;
  if(bookingCache.promise)return bookingCache.promise;
  const version=bookingCache.version;
  const request=(async()=>{const {data,error}=await bookingRpc(["list_bookings_json_v26","list_bookings_json_v25","list_bookings_json_v24","list_bookings_json_v23","list_bookings_json_v22"]);if(error)throw error;const rows=data||[];if(version===bookingCache.version){bookingCache.data=rows;bookingCache.expiresAt=Date.now()+30_000}return rows})();
  bookingCache.promise=request;
  try{return await request}finally{if(bookingCache.promise===request)bookingCache.promise=null}
}

router.get("/",async(req,res)=>{try{res.json(bankReferencesForUser(bookingForUser(await listBookingsCached(),req.user),req.user))}catch(error){res.status(500).json({error:error.message})}});
router.post("/check-duplicate",async(req,res)=>{
  const booking=req.body||{};
  const {data,error}=await bookingRpc(["list_bookings_json_v26","list_bookings_json_v25","list_bookings_json_v24","list_bookings_json_v23","list_bookings_json_v22"]);
  if(error)return res.status(500).json({error:error.message});
  const candidates=(data||[]).filter(row=>(!booking.travelDate||row.travelDate===booking.travelDate)&&row.bookingCode!==booking.bookingCode&&row.status!=="cancelled");
  const names=new Set((booking.passengers||[]).map(person=>normalizeName(`${person.title||""}${person.firstName||""}${person.lastName||""}`)).filter(Boolean));
  const phones=new Set([booking.phone,...(booking.passengers||[]).map(person=>person.phone)].map(normalizePhone).filter(phone=>phone.length>=9));
  const found=new Map();
  for(const candidate of candidates)for(const person of candidate.passengers||[]){
    const name=normalizeName(`${person.title||""}${person.firstName||""}${person.lastName||""}`);
    const phone=normalizePhone(person.phone||candidate.phone);
    if(names.has(name)||phones.has(phone))found.set(`${candidate.bookingCode}:${name}:${phone}`,{bookingCode:candidate.bookingCode,name:[person.title,person.firstName,person.lastName].filter(Boolean).join(" "),phone:person.phone||candidate.phone||""});
  }
  res.json({duplicates:[...found.values()]});
});
router.post("/",requirePermission("createBooking"),async(req,res)=>{const inputError=equipmentInputError(req.body||{})||accommodationInputError(req.body||{})||travelStopInputError(req.body||{});if(inputError)return res.status(400).json({error:inputError});const {data,error,migrationRequired}=await saveBookingRpc({...req.body,createdBy:req.user.username});if(error)return res.status(migrationRequired?503:500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.put("/:code",requirePermission("editBooking"),async(req,res)=>{const inputError=equipmentInputError(req.body||{})||accommodationInputError(req.body||{})||travelStopInputError(req.body||{});if(inputError)return res.status(400).json({error:inputError});const {data,error,migrationRequired}=await saveBookingRpc({...req.body,bookingCode:req.params.code,createdBy:req.user.username});if(error)return res.status(migrationRequired?503:500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.post("/:code/cancel",requirePermission("cancelBooking"),async(req,res)=>{if(!String(req.body.reason||"").trim())return res.status(400).json({error:"Cancellation reason is required"});const {data,error}=await supabaseAdmin.rpc("cancel_booking_by_code",{p_booking_code:req.params.code,p_reason:req.body.reason});if(error)return res.status(500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.get("/:code/timeline",requirePermission("viewAudit"),async(req,res)=>{const {data,error}=await supabaseAdmin.from("audit_logs").select("*").eq("booking_code",req.params.code).order("changed_at",{ascending:true});if(error)return res.status(500).json({error:error.message});res.json(data||[])});
export default router;
