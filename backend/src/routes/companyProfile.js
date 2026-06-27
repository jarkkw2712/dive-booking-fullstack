import express from "express";import { requireAuth, requirePermission } from "../middleware/auth.js";import { supabaseAdmin } from "../services/supabase.js";
const router=express.Router();router.use(requireAuth);
router.get("/",async(req,res)=>{const {data,error}=await supabaseAdmin.from("company_profile").select("*").eq("profile_id","default").maybeSingle();if(error)return res.status(500).json({error:error.message});res.json(data||{profile_id:"default",company_name:"Dive Tour Company"})});
router.put("/",requirePermission("editMasterData"),async(req,res)=>{const payload={profile_id:"default",...req.body,updated_at:new Date().toISOString()};const {data,error}=await supabaseAdmin.from("company_profile").upsert(payload,{onConflict:"profile_id"}).select().single();if(error)return res.status(500).json({error:error.message});res.json({success:true,profile:data})});
export default router;
