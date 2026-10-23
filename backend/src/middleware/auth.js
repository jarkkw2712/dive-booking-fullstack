import jwt from "jsonwebtoken";

export async function validateAuthenticatedUser(payload,lookupUser=async userId=>{
  const {supabaseAdmin}=await import("../services/supabase.js");
  const {data,error}=await supabaseAdmin.from("app_users").select("user_id,username,display_name,email,role_id,active_flag,session_version").eq("user_id",userId).maybeSingle();
  if(error)throw error;
  return data;
},lookupPermissions=async roleId=>{
  const {supabaseAdmin}=await import("../services/supabase.js");
  const {data,error}=await supabaseAdmin.from("role_permissions").select("permission_key,allowed").eq("role_id",roleId);
  if(error)throw error;
  return Object.fromEntries((data||[]).map(row=>[row.permission_key,row.allowed===true]));
}){
  const [user,permissions]=await Promise.all([lookupUser(payload.userId),lookupPermissions(payload.role)]);
  if(!user?.active_flag||Number(payload.sessionVersion||0)!==Number(user.session_version||0)||user.role_id!==payload.role)throw new Error("SESSION_REVOKED");
  return {...payload,username:user.username,displayName:user.display_name,email:user.email,role:user.role_id,permissions};
}

export async function requireAuth(req,res,next){
  const header=req.headers.authorization||"",cookie=String(req.headers.cookie||"").match(/(?:^|;\s*)sabina_session=([^;]+)/);
  const token=header.startsWith("Bearer ")?header.slice(7):(cookie?decodeURIComponent(cookie[1]):"");
  if(!token)return res.status(401).json({error:"Missing token"});
  if(!process.env.JWT_SECRET)return res.status(503).json({error:"Authentication is not configured"});
  try{const payload=jwt.verify(token,process.env.JWT_SECRET);if(payload.mustChangePassword&&!req.originalUrl.endsWith("/auth/change-password")&&!req.originalUrl.endsWith("/auth/me"))return res.status(403).json({error:"Password change required"});req.user=await validateAuthenticatedUser(payload);next()}
  catch{return res.status(401).json({error:"Invalid or revoked token"})}
}
export function requirePermission(permission){
  return(req,res,next)=>{
    if(req.user?.role==="admin"||req.user?.permissions?.[permission])return next();
    return res.status(403).json({error:`Permission denied: ${permission}`});
  };
}
