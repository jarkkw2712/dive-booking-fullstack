import jwt from "jsonwebtoken";

export function requireAuth(req,res,next){
  const header=req.headers.authorization||"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  if(!token)return res.status(401).json({error:"Missing token"});
  if(!process.env.JWT_SECRET)return res.status(503).json({error:"Authentication is not configured"});
  try{req.user=jwt.verify(token,process.env.JWT_SECRET);if(req.user.mustChangePassword&&!req.originalUrl.endsWith("/auth/change-password")&&!req.originalUrl.endsWith("/auth/me"))return res.status(403).json({error:"Password change required"});next()}
  catch{return res.status(401).json({error:"Invalid token"})}
}
export function requirePermission(permission){
  return(req,res,next)=>{
    if(req.user?.role==="admin"||req.user?.permissions?.[permission])return next();
    return res.status(403).json({error:`Permission denied: ${permission}`});
  };
}
