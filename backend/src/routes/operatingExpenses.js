import express from "express";
import { requireAuth,requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { writeAudit } from "../services/auditService.js";
import { expenseCategories,expenseClassification,parkFeeLines,validateParkFeeLine } from "../services/expenseTaxonomy.js";

const router=express.Router();
router.use(requireAuth);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));

router.get("/categories",requirePermission("viewOperatingExpenses"),(_req,res)=>res.json(expenseCategories));
router.get("/",requirePermission("viewOperatingExpenses"),async(req,res)=>{try{const {from,to=from}=req.query;if(!validDate(from)||!validDate(to))return res.status(400).json({error:"Valid date range is required"});const {data,error}=await supabaseAdmin.from("v_current_daily_operating_expenses").select("*").gte("expense_date",from).lte("expense_date",to).order("expense_date");if(error)throw error;res.json(data||[])}catch(error){res.status(500).json({error:error.message})}});
router.post("/:date",requirePermission("editOperatingExpenses"),async(req,res)=>{
  try{
    if(!validDate(req.params.date))return res.status(400).json({error:"Valid date is required"});
    if(!Array.isArray(req.body.items))return res.status(400).json({error:"กรุณาส่งรายการค่าใช้จ่าย"});
    const items=req.body.items.map(item=>{
      const code=String(item.code||"other").slice(0,80),qty=Number(item.qty??0),unitPrice=Number(item.unitPrice??0);
      const {groupCode,itemCode}=expenseClassification({...item,code});
      const breakdown=validateParkFeeLine({...item,code,qty,unitPrice});
      return{code,name:parkFeeLines[code]?.name||String(item.name||"").trim().slice(0,200),qty,unitPrice,groupCode,itemCode,detail:parkFeeLines[code]?"":String(item.detail||"").trim().slice(0,500),breakdown};
    });
    if(items.some(item=>!item.name||!Number.isFinite(item.qty)||!Number.isFinite(item.unitPrice)||item.qty<0||item.unitPrice<0))return res.status(400).json({error:"รายการค่าใช้จ่ายไม่ถูกต้อง"});
    for(const code of Object.keys(parkFeeLines))if(items.filter(item=>item.code===code).length>1)return res.status(400).json({error:"ค่าธรรมเนียมอุทยานซ้ำ"});
    const oldParkCodes=new Set(Object.values(parkFeeLines).flatMap(item=>item.codes));
    if(items.some(item=>parkFeeLines[item.code])&&items.some(item=>oldParkCodes.has(item.code)))return res.status(400).json({error:"ค่าธรรมเนียมรูปแบบเก่าและใหม่ห้ามบันทึกซ้ำกัน"});
    if(items.some(item=>parkFeeLines[item.code])&&items.some(item=>!parkFeeLines[item.code]&&["boat_park_fee","national_park_fee"].includes(item.itemCode)))return res.status(400).json({error:"มีค่าธรรมเนียมอุทยานซ้ำกับรายการเดิม"});
    const {data,error}=await supabaseAdmin.rpc("save_daily_operating_expenses",{p_date:req.params.date,p_items:items,p_note:String(req.body.note||"").slice(0,1000),p_actor:req.user.username});
    if(error)throw error;
    await writeAudit(req,{action:"DAILY_OPERATING_EXPENSES_SAVED",detail:`บันทึกค่าใช้จ่ายประจำวันที่ ${req.params.date}`,entityType:"daily_expense_batches",entityId:data,after:{date:req.params.date,items,note:req.body.note}});
    res.json({success:true,batchId:data});
  }catch(error){res.status(400).json({error:error.message})}
});

export default router;
