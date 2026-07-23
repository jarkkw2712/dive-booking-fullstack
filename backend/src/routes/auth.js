import express from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { hashPassword,verifyPassword,consumeComparableDelay,createPasswordResetToken,hashResetToken } from "../services/passwordService.js";
import { sendPasswordResetEmail } from "../services/emailService.js";

const router=express.Router();
const publicUserFields="user_id,username,email,display_name,role_id,active_flag,password_hash,must_change_password,failed_login_count,locked_until";
async function permissionsFor(role){const {data,error}=await supabaseAdmin.from("role_permissions").select("permission_key,allowed").eq("role_id",role);if(error)throw error;return Object.fromEntries((data||[]).map(row=>[row.permission_key,row.allowed]))}
async function audit(req,{user,username,email,action,success,detail}){try{await supabaseAdmin.from("auth_audit_logs").insert({user_id:user?.user_id||null,username_snapshot:username||user?.username||null,email_snapshot:email||user?.email||null,action,success,detail,ip_address:req.ip,user_agent:String(req.headers["user-agent"]||"").slice(0,500)})}catch(error){console.error("Auth audit failed",error.message)}}
const loginLimiter=rateLimit({windowMs:15*60_000,max:30});
const recoveryLimiter=rateLimit({windowMs:15*60_000,max:5});

router.post("/login",loginLimiter,async(req,res)=>{
  try{
    const {username,password}=req.body||{};
    const pilotAuthMode=process.env.PILOT_AUTH_MODE||"shared_password";
    if(!process.env.JWT_SECRET)return res.status(503).json({error:"Authentication environment is not configured"});
    const {data:user,error}=await supabaseAdmin.from("app_users").select(publicUserFields).eq("username",String(username||"").trim()).maybeSingle();
    if(error)throw error;
    if(!user){await consumeComparableDelay(password);await audit(req,{username,action:"LOGIN",success:false,detail:"Unknown username"});return res.status(401).json({error:"Invalid username or password"})}
    if(!user.active_flag){await audit(req,{user,action:"LOGIN",success:false,detail:"Inactive account"});return res.status(401).json({error:"Invalid username or password"})}
    if(user.locked_until&&new Date(user.locked_until)>new Date()){await audit(req,{user,action:"LOGIN",success:false,detail:"Account temporarily locked"});return res.status(423).json({error:"Account temporarily locked. Try again later."})}
    const usingPilotPassword=!user.password_hash&&pilotAuthMode==="shared_password"&&process.env.DEMO_PASSWORD&&password===process.env.DEMO_PASSWORD;
    const valid=usingPilotPassword||await verifyPassword(password,user.password_hash);
    if(!valid){const failures=Number(user.failed_login_count||0)+1,lockedUntil=failures>=5?new Date(Date.now()+15*60_000).toISOString():null;await supabaseAdmin.from("app_users").update({failed_login_count:failures>=5?0:failures,locked_until:lockedUntil,updated_at:new Date().toISOString()}).eq("user_id",user.user_id);await audit(req,{user,action:"LOGIN",success:false,detail:lockedUntil?"Locked after failed attempts":"Invalid password"});return res.status(401).json({error:"Invalid username or password"})}
    await supabaseAdmin.from("app_users").update({failed_login_count:0,locked_until:null,last_login_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",user.user_id);
    const permissions=await permissionsFor(user.role_id),mustChangePassword=usingPilotPassword||user.must_change_password;
    const payload={userId:user.user_id,username:user.username,email:user.email,displayName:user.display_name,role:user.role_id,permissions,mustChangePassword};
    const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:mustChangePassword?"30m":"12h"});
    await audit(req,{user,action:"LOGIN",success:true,detail:usingPilotPassword?"Pilot password; change required":"Per-user password"});
    res.json({token,user:payload});
  }catch(error){console.error("Login failed",error);res.status(500).json({error:"Login failed"})}
});

router.post("/forgot-password",recoveryLimiter,async(req,res)=>{
  const generic={message:"หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว"};
  try{
    const email=String(req.body?.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){await consumeComparableDelay(email);return res.status(202).json(generic)}
    const {data:user}=await supabaseAdmin.from("app_users").select("user_id,username,email,display_name,active_flag").eq("email",email).maybeSingle();
    if(!user?.active_flag){await consumeComparableDelay(email);await audit(req,{email,action:"PASSWORD_RESET_REQUEST",success:true,detail:"Generic response"});return res.status(202).json(generic)}
    await supabaseAdmin.from("password_reset_tokens").update({used_at:new Date().toISOString()}).eq("user_id",user.user_id).is("used_at",null);
    const {token,tokenHash}=createPasswordResetToken(),expiresAt=new Date(Date.now()+30*60_000).toISOString();
    const {data:created,error}=await supabaseAdmin.from("password_reset_tokens").insert({user_id:user.user_id,token_hash:tokenHash,expires_at:expiresAt,requested_ip:req.ip,requested_user_agent:String(req.headers["user-agent"]||"").slice(0,500)}).select("reset_token_id").single();
    if(error)throw error;
    res.status(202).json(generic);
    void sendPasswordResetEmail({email:user.email,displayName:user.display_name,token})
      .then(()=>audit(req,{user,action:"PASSWORD_RESET_REQUEST",success:true,detail:"Email queued"}))
      .catch(async error=>{await supabaseAdmin.from("password_reset_tokens").update({used_at:new Date().toISOString()}).eq("reset_token_id",created.reset_token_id);await audit(req,{user,action:"PASSWORD_RESET_REQUEST",success:false,detail:"Email delivery failed"});console.error("Password reset email failed",error.message)});
  }catch(error){console.error("Forgot password failed",error);res.status(202).json(generic)}
});

router.post("/reset-password",recoveryLimiter,async(req,res)=>{
  try{
    const tokenHash=hashResetToken(req.body?.token),passwordHash=await hashPassword(req.body?.password);
    const {data:userId,error}=await supabaseAdmin.rpc("consume_password_reset",{p_token_hash:tokenHash,p_password_hash:passwordHash});
    if(error)throw error;
    await audit(req,{user:{user_id:userId},action:"PASSWORD_RESET_COMPLETE",success:true,detail:"Password reset token consumed"});
    res.json({success:true,message:"ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ"});
  }catch(error){await audit(req,{action:"PASSWORD_RESET_COMPLETE",success:false,detail:"Invalid, expired, or policy failure"});const policy=/Password must/.test(error.message||"");res.status(400).json({error:policy?error.message:"ลิงก์หมดอายุหรือถูกใช้งานแล้ว"})}
});

router.post("/change-password",requireAuth,rateLimit({windowMs:15*60_000,max:10}),async(req,res)=>{
  try{
    const {data:user,error}=await supabaseAdmin.from("app_users").select(publicUserFields).eq("user_id",req.user.userId).single();if(error)throw error;
    const pilotValid=!user.password_hash&&process.env.DEMO_PASSWORD&&req.body?.currentPassword===process.env.DEMO_PASSWORD;
    if(!pilotValid&&!await verifyPassword(req.body?.currentPassword,user.password_hash)){await audit(req,{user,action:"PASSWORD_CHANGE",success:false,detail:"Current password incorrect"});return res.status(400).json({error:"รหัสผ่านปัจจุบันไม่ถูกต้อง"})}
    if(req.body?.currentPassword===req.body?.newPassword)return res.status(400).json({error:"รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม"});
    const passwordHash=await hashPassword(req.body?.newPassword);
    await supabaseAdmin.from("app_users").update({password_hash:passwordHash,must_change_password:false,password_changed_at:new Date().toISOString(),failed_login_count:0,locked_until:null,updated_at:new Date().toISOString()}).eq("user_id",user.user_id);
    await audit(req,{user,action:"PASSWORD_CHANGE",success:true,detail:"Password changed"});res.json({success:true});
  }catch(error){const policy=/Password must/.test(error.message||"");res.status(400).json({error:policy?error.message:"เปลี่ยนรหัสผ่านไม่สำเร็จ"})}
});

router.get("/me",requireAuth,(req,res)=>res.json({user:req.user}));
export default router;
