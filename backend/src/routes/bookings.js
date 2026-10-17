import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router=express.Router();
router.use(requireAuth);
const normalizeName = value => String(value || "").normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const normalizePhone = value => String(value || "").replace(/\D/g, "").replace(/^66/, "0");
const missingBookingRpc=error=>["PGRST202","42883"].includes(error?.code);
async function bookingRpc(names,args){let result;for(const name of names){result=await supabaseAdmin.rpc(name,args);if(!missingBookingRpc(result.error))return result}return result}
const hasMultiNightEquipment=booking=>(booking.passengers||[]).some(person=>(person.preAddOns||[]).some(item=>item.selected!==false&&Number(item.nights??1)!==1));
function equipmentInputError(booking){for(const person of booking.passengers||[]){const signatures=new Map();for(const item of person.preAddOns||[]){if(item.selected===false)continue;const nights=Number(item.nights??1),qty=Number(item.qty??1);if(!Number.isInteger(nights)||nights<1||nights>365)return"Equipment nights must be an integer from 1 to 365";if(!Number.isInteger(qty)||qty<1)return"Equipment quantity must be a positive integer";const key=[item.id,qty,Number(item.price||0)].join("|");if(signatures.has(key)&&signatures.get(key)!==nights)return"อุปกรณ์รายการเดียวกันที่จำนวนและราคาเท่ากัน แต่จำนวนคืนต่างกัน ไม่สามารถบันทึกแยกแถวได้";signatures.set(key,nights)}}return""}
async function saveBookingRpc(booking){
  const args={p_booking:booking},latest=await supabaseAdmin.rpc("upsert_booking_v24",args);
  if(!missingBookingRpc(latest.error))return latest;
  if(hasMultiNightEquipment(booking))return{error:{message:"กรุณารัน migration 20261017_044_equipment_nights.sql ก่อนบันทึกอุปกรณ์หลายคืน"},migrationRequired:true};
  return bookingRpc(["upsert_booking_v23","upsert_booking_v21"],args);
}
const bookingCache={data:null,expiresAt:0,promise:null,version:0};
function invalidateBookingCache(){bookingCache.data=null;bookingCache.expiresAt=0;bookingCache.promise=null;bookingCache.version+=1}
async function listBookingsCached(){
  if(bookingCache.data&&Date.now()<bookingCache.expiresAt)return bookingCache.data;
  if(bookingCache.promise)return bookingCache.promise;
  const version=bookingCache.version;
  const request=(async()=>{const {data,error}=await bookingRpc(["list_bookings_json_v24","list_bookings_json_v23","list_bookings_json_v22"]);if(error)throw error;const rows=data||[];if(version===bookingCache.version){bookingCache.data=rows;bookingCache.expiresAt=Date.now()+30_000}return rows})();
  bookingCache.promise=request;
  try{return await request}finally{if(bookingCache.promise===request)bookingCache.promise=null}
}

router.get("/",async(req,res)=>{try{res.json(await listBookingsCached())}catch(error){res.status(500).json({error:error.message})}});
router.post("/check-duplicate",async(req,res)=>{
  const booking=req.body||{};
  const {data,error}=await bookingRpc(["list_bookings_json_v24","list_bookings_json_v23","list_bookings_json_v22"]);
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
router.post("/",requirePermission("createBooking"),async(req,res)=>{const inputError=equipmentInputError(req.body||{});if(inputError)return res.status(400).json({error:inputError});const {data,error,migrationRequired}=await saveBookingRpc({...req.body,createdBy:req.user.username});if(error)return res.status(migrationRequired?503:500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.put("/:code",requirePermission("editBooking"),async(req,res)=>{const inputError=equipmentInputError(req.body||{});if(inputError)return res.status(400).json({error:inputError});const {data,error,migrationRequired}=await saveBookingRpc({...req.body,bookingCode:req.params.code,createdBy:req.user.username});if(error)return res.status(migrationRequired?503:500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.post("/:code/cancel",requirePermission("cancelBooking"),async(req,res)=>{if(!String(req.body.reason||"").trim())return res.status(400).json({error:"Cancellation reason is required"});const {data,error}=await supabaseAdmin.rpc("cancel_booking_by_code",{p_booking_code:req.params.code,p_reason:req.body.reason});if(error)return res.status(500).json({error:error.message});invalidateBookingCache();res.json(data)});
router.get("/:code/timeline",async(req,res)=>{const {data,error}=await supabaseAdmin.from("audit_logs").select("*").eq("booking_code",req.params.code).order("changed_at",{ascending:true});if(error)return res.status(500).json({error:error.message});res.json(data||[])});
export default router;
