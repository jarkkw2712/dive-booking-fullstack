import express from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router=express.Router();
async function permissionsFor(role){const {data,error}=await supabaseAdmin.from("role_permissions").select("permission_key,allowed").eq("role_id",role);if(error)throw error;return Object.fromEntries((data||[]).map(row=>[row.permission_key,row.allowed]))}
router.post("/login",rateLimit({windowMs:60_000,max:10}),async(req,res)=>{
  try{
    const {username,password}=req.body||{};
    if(process.env.PILOT_AUTH_MODE!=="shared_password"||!process.env.DEMO_PASSWORD||!process.env.JWT_SECRET)return res.status(503).json({error:"Pilot authentication environment is not configured"});
    const {data:user,error}=await supabaseAdmin.from("app_users").select("user_id,username,display_name,role_id,active_flag").eq("username",username).maybeSingle();
    if(error)return res.status(500).json({error:error.message});
    if(!user||!user.active_flag)return res.status(401).json({error:"User inactive/not found"});
    if(password!==process.env.DEMO_PASSWORD)return res.status(401).json({error:"Invalid password"});
    const permissions=await permissionsFor(user.role_id);
    const payload={userId:user.user_id,username:user.username,displayName:user.display_name,role:user.role_id,permissions};
    const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:"12h"});
    res.json({token,user:payload});
  }catch(error){res.status(500).json({error:error.message||"Login failed"})}
});
router.get("/me",requireAuth,(req,res)=>res.json({user:req.user}));
export default router;
