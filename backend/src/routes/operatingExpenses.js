import express from "express";
import { requireAuth,requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { writeAudit } from "../services/auditService.js";

const router=express.Router();
router.use(requireAuth);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));

router.get("/",requirePermission("manageOperatingExpenses"),async(req,res)=>{try{const {from,to=from}=req.query;if(!validDate(from)||!validDate(to))return res.status(400).json({error:"Valid date range is required"});const {data,error}=await supabaseAdmin.from("v_current_daily_operating_expenses").select("*").gte("expense_date",from).lte("expense_date",to).order("expense_date");if(error)throw error;res.json(data||[])}catch(error){res.status(500).json({error:error.message})}});
router.post("/:date",requirePermission("manageOperatingExpenses"),async(req,res)=>{try{if(!validDate(req.params.date))return res.status(400).json({error:"Valid date is required"});const items=(req.body.items||[]).map(item=>({code:String(item.code||"other").slice(0,80),name:String(item.name||"").trim().slice(0,200),qty:Number(item.qty||0),unitPrice:Number(item.unitPrice||0)}));if(items.some(item=>!item.name||!Number.isFinite(item.qty)||!Number.isFinite(item.unitPrice)||item.qty<0||item.unitPrice<0))return res.status(400).json({error:"Expense items are invalid"});const {data,error}=await supabaseAdmin.rpc("save_daily_operating_expenses",{p_date:req.params.date,p_items:items,p_note:String(req.body.note||"").slice(0,1000),p_actor:req.user.username});if(error)throw error;await writeAudit(req,{action:"DAILY_OPERATING_EXPENSES_SAVED",detail:`บันทึกค่าใช้จ่ายประจำวันที่ ${req.params.date}`,entityType:"daily_expense_batches",entityId:data,after:{date:req.params.date,items,note:req.body.note}});res.json({success:true,batchId:data})}catch(error){res.status(400).json({error:error.message})}});

export default router;
