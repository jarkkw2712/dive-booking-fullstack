import express from "express";import { requireAuth, requirePermission } from "../middleware/auth.js";import { supabaseAdmin } from "../services/supabase.js";
const router=express.Router();router.use(requireAuth);
router.get("/",requirePermission("manageUsers"),async(req,res)=>{const {data,error}=await supabaseAdmin.from("app_users").select("user_id,username,display_name,role_id,active_flag,created_at").order("created_at");if(error)return res.status(500).json({error:error.message});res.json(data||[])});
router.post("/",requirePermission("manageUsers"),async(req,res)=>{const {data,error}=await supabaseAdmin.from("app_users").insert(req.body).select().single();if(error)return res.status(500).json({error:error.message});res.json(data)});
router.put("/:id",requirePermission("manageUsers"),async(req,res)=>{const {data,error}=await supabaseAdmin.from("app_users").update(req.body).eq("user_id",req.params.id).select().single();if(error)return res.status(500).json({error:error.message});res.json(data)});
export default router;
