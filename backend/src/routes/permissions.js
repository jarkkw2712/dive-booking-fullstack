import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { writeAudit } from "../services/auditService.js";

const router=express.Router();
router.use(requireAuth);

router.get("/matrix",requirePermission("editPermissions"),async(req,res)=>{
  const {data,error}=await supabaseAdmin.from("role_permissions").select("role_id,permission_key,allowed");
  if(error)return res.status(500).json({error:error.message});
  const matrix={};
  for(const row of data||[]){matrix[row.role_id]??={};matrix[row.role_id][row.permission_key]=row.allowed}
  res.json(matrix);
});

router.put("/matrix",requirePermission("editPermissions"),async(req,res)=>{
  const input=req.body?.matrix;
  if(!input||typeof input!=="object"||Array.isArray(input))return res.status(400).json({error:"Invalid permission matrix"});
  const [{data:before,error:readError},{data:roles,error:roleError}]=await Promise.all([
    supabaseAdmin.from("role_permissions").select("role_id,permission_key,allowed"),
    supabaseAdmin.from("app_roles").select("role_id")
  ]);
  if(readError||roleError)return res.status(500).json({error:(readError||roleError).message});
  const validRoles=new Set((roles||[]).map(row=>row.role_id));
  const validKeys=new Set((before||[]).map(row=>row.permission_key));
  const rows=[];
  for(const [role,permissions] of Object.entries(input)){
    if(!validRoles.has(role)||!permissions||typeof permissions!=="object"||Array.isArray(permissions))return res.status(400).json({error:`Invalid role: ${role}`});
    for(const [key,allowed] of Object.entries(permissions)){
      if(!validKeys.has(key)||typeof allowed!=="boolean")return res.status(400).json({error:`Invalid permission: ${key}`});
      if(role==="admin"&&allowed===false)return res.status(400).json({error:"Admin permissions cannot be disabled"});
      rows.push({role_id:role,permission_key:key,allowed,updated_at:new Date().toISOString()});
    }
  }
  if(!rows.length)return res.status(400).json({error:"Permission matrix is empty"});
  const projected=new Map((before||[]).map(row=>[`${row.role_id}:${row.permission_key}`,row.allowed===true]));
  for(const row of rows)projected.set(`${row.role_id}:${row.permission_key}`,row.allowed);
  const enabled=(role,key)=>projected.get(`${role}:${key}`)===true;
  const requiresMoney=["createBooking","editBooking","editMasterData","viewFinancial","createInvoice","voidInvoice","receivePayment","verifyPayment","reversePayment","issueReceipt","voidReceipt","createRefund","approveRefund","markRefundPaid","exportFinancialReport","viewOperatingExpenses","editOperatingExpenses","printManagementReport"];
  for(const role of validRoles){
    if(enabled(role,"editOperatingExpenses")&&!enabled(role,"viewOperatingExpenses"))return res.status(400).json({error:`${role}: editOperatingExpenses requires viewOperatingExpenses`});
    if(role!=="admin"&&!enabled(role,"viewMoney")){const conflicting=requiresMoney.find(key=>enabled(role,key));if(conflicting)return res.status(400).json({error:`${role}: ${conflicting} requires viewMoney`})}
  }
  const {error}=await supabaseAdmin.from("role_permissions").upsert(rows,{onConflict:"role_id,permission_key"});
  if(error)return res.status(500).json({error:error.message});
  const changed=rows.filter(row=>(before||[]).find(old=>old.role_id===row.role_id&&old.permission_key===row.permission_key)?.allowed!==row.allowed);
  await writeAudit(req,{action:"PERMISSION_MATRIX_UPDATED",detail:`แก้ไขสิทธิ์ ${changed.length} รายการ`,entityType:"role_permissions",entityId:"matrix",before:before?.filter(row=>changed.some(item=>item.role_id===row.role_id&&item.permission_key===row.permission_key)),after:changed});
  res.json({success:true,changed:changed.length});
});

export default router;
