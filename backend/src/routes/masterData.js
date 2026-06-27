import express from "express";import { requireAuth } from "../middleware/auth.js";import { supabaseAdmin } from "../services/supabase.js";
const router=express.Router();router.use(requireAuth);
router.get("/",async(req,res)=>{const [p,a]=await Promise.all([supabaseAdmin.from("master_programs").select("*").eq("active_flag",true).order("sort_order"),supabaseAdmin.from("master_addons").select("*").eq("active_flag",true).order("sort_order")]);if(p.error)return res.status(500).json({error:p.error.message});if(a.error)return res.status(500).json({error:a.error.message});res.json({programs:p.data||[],addOns:a.data||[]})});
export default router;
