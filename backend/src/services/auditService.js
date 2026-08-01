import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase.js";
import { sanitizeAuditValue } from "./auditSanitizer.js";
export { sanitizeAuditValue } from "./auditSanitizer.js";

export async function writeAudit(req,{action,detail="",entityType="api",entityId=null,bookingCode=null,before=null,after=null,success=true,statusCode=null,metadata=null}={}){
  const row={
    request_id:req.auditRequestId||randomUUID(),booking_code:bookingCode||null,action:action||"API_MUTATION",detail,
    before_json:sanitizeAuditValue(before),after_json:sanitizeAuditValue(after),changed_by:req.user?.username||null,
    actor_role:req.user?.role||null,actor_user_id:req.user?.userId||null,actor_username:req.user?.username||null,
    entity_type:entityType,entity_id:entityId?String(entityId):null,ip_address:req.ip||null,
    user_agent:String(req.headers?.["user-agent"]||"").slice(0,500),http_method:req.method||null,
    request_path:String(req.originalUrl||req.path||"").slice(0,1000),status_code:statusCode,success,
    metadata:sanitizeAuditValue(metadata)
  };
  const {error}=await supabaseAdmin.from("audit_logs").insert(row);
  if(error)throw error;
}

export function mutationAudit(req,res,next){
  if(!["POST","PUT","PATCH","DELETE"].includes(req.method))return next();
  req.auditRequestId=randomUUID();
  const startedAt=Date.now();
  res.on("finish",()=>{
    writeAudit(req,{action:"API_MUTATION",detail:`${req.method} ${req.originalUrl}`,entityType:String(req.path||req.originalUrl).split("/").filter(Boolean)[1]||"api",entityId:req.params?.id||req.params?.code||req.body?.bookingCode||null,bookingCode:req.params?.code||req.body?.bookingCode||null,after:req.body,success:res.statusCode<400,statusCode:res.statusCode,metadata:{durationMs:Date.now()-startedAt}}).catch(error=>console.error("Mutation audit failed",error.message));
  });
  next();
}
