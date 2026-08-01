import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", requirePermission("viewAudit"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(1000);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get("/unified", requirePermission("viewAudit"), async (req, res) => {
  const [systemResult, authResult, financialResult] = await Promise.all([
    supabaseAdmin.from("audit_logs").select("*").order("changed_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("auth_audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("financial_events").select("*").order("created_at", { ascending: false }).limit(1000)
  ]);
  const failed=[systemResult,authResult,financialResult].find(result=>result.error);
  if(failed)return res.status(500).json({error:failed.error.message});
  const rows=[
    ...(systemResult.data||[]).map(row=>({id:row.audit_id,occurredAt:row.changed_at,source:"system",action:row.action,success:row.success!==false,actor:row.actor_username||row.changed_by,role:row.actor_role,entityType:row.entity_type,entityId:row.entity_id,bookingCode:row.booking_code,detail:row.detail,before:row.before_json,after:row.after_json,ipAddress:row.ip_address,requestPath:row.request_path,statusCode:row.status_code})),
    ...(authResult.data||[]).map(row=>({id:row.auth_audit_id,occurredAt:row.created_at,source:"auth",action:row.action,success:row.success,actor:row.username_snapshot,role:null,entityType:"app_user",entityId:row.user_id,bookingCode:null,detail:row.detail,before:null,after:null,ipAddress:row.ip_address,requestPath:null,statusCode:null})),
    ...(financialResult.data||[]).map(row=>({id:row.financial_event_id,occurredAt:row.created_at,source:"financial",action:row.event_type,success:true,actor:row.created_by,role:row.created_role,entityType:row.entity_type,entityId:row.entity_id,bookingCode:row.booking_code,detail:row.reason||row.reference_no||"",before:row.before_json,after:row.after_json,ipAddress:null,requestPath:null,statusCode:null,amount:row.amount}))
  ];
  const from=req.query.from?new Date(`${req.query.from}T00:00:00+07:00`).getTime():null,to=req.query.to?new Date(`${req.query.to}T23:59:59.999+07:00`).getTime():null;
  const includes=(value,query)=>!query||String(value||"").toLowerCase().includes(String(query).toLowerCase());
  const filtered=rows.filter(row=>(!from||new Date(row.occurredAt).getTime()>=from)&&(!to||new Date(row.occurredAt).getTime()<=to)&&includes(row.actor,req.query.actor)&&includes(row.action,req.query.action)&&(!req.query.source||row.source===req.query.source)&&(!req.query.success||String(row.success)===req.query.success)&&includes(row.bookingCode,req.query.bookingCode));
  filtered.sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt));
  res.json(filtered.slice(0,Math.min(Number(req.query.limit)||500,1000)));
});

export default router;
