import jwt from "jsonwebtoken";
export function requireAuth(req,res,next){const h=req.headers.authorization||"";const t=h.startsWith("Bearer ")?h.slice(7):"";if(!t)return res.status(401).json({error:"Missing token"});try{req.user=jwt.verify(t,process.env.JWT_SECRET||"dev-secret");next()}catch(e){res.status(401).json({error:"Invalid token"})}}
export function requirePermission(p){return(req,res,next)=>{if(req.user?.role==="admin"||req.user?.permissions?.[p])return next();return res.status(403).json({error:`Permission denied: ${p}`})}}
