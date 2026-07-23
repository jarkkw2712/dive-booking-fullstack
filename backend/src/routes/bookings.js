import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router=express.Router();
router.use(requireAuth);
const normalizeName = value => String(value || "").normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const normalizePhone = value => String(value || "").replace(/\D/g, "").replace(/^66/, "0");

router.get("/",async(req,res)=>{const {data,error}=await supabaseAdmin.rpc("list_bookings_json_v2");if(error)return res.status(500).json({error:error.message});res.json(data||[])});
router.post("/check-duplicate",async(req,res)=>{
  const booking=req.body||{};
  const {data,error}=await supabaseAdmin.rpc("list_bookings_json_v2");
  if(error)return res.status(500).json({error:error.message});
  const candidates=(data||[]).filter(row=>row.travelDate===booking.travelDate&&row.bookingCode!==booking.bookingCode&&row.status!=="cancelled");
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
router.post("/",requirePermission("createBooking"),async(req,res)=>{const {data,error}=await supabaseAdmin.rpc("upsert_booking_with_accommodation",{p_booking:req.body});if(error)return res.status(500).json({error:error.message});res.json(data)});
router.put("/:code",requirePermission("editBooking"),async(req,res)=>{const {data,error}=await supabaseAdmin.rpc("upsert_booking_with_accommodation",{p_booking:{...req.body,bookingCode:req.params.code}});if(error)return res.status(500).json({error:error.message});res.json(data)});
router.post("/:code/cancel",requirePermission("cancelBooking"),async(req,res)=>{if(!String(req.body.reason||"").trim())return res.status(400).json({error:"Cancellation reason is required"});const {data,error}=await supabaseAdmin.rpc("cancel_booking_by_code",{p_booking_code:req.params.code,p_reason:req.body.reason});if(error)return res.status(500).json({error:error.message});res.json(data)});
router.get("/:code/timeline",async(req,res)=>{const {data,error}=await supabaseAdmin.from("audit_logs").select("*").eq("booking_code",req.params.code).order("changed_at",{ascending:true});if(error)return res.status(500).json({error:error.message});res.json(data||[])});
export default router;
