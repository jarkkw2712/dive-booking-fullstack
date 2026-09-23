import express from "express";
import { requireAuth,requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { writeAudit } from "../services/auditService.js";

const router=express.Router();
router.use(requireAuth,requirePermission("manageIslandBoatOperations"));
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const cleanText=(value,max)=>String(value||"").trim().slice(0,max);

router.get("/",async(req,res)=>{
  try{
    const {date}=req.query;
    if(!validDate(date))return res.status(400).json({error:"Valid date is required"});
    const {data,error}=await supabaseAdmin.from("v_current_island_boat_operations").select("*").eq("operation_date",date).order("island_name_snapshot").order("sort_order");
    if(error)throw error;
    res.json(data||[]);
  }catch(error){res.status(500).json({error:error.message})}
});

router.post("/:date",async(req,res)=>{
  try{
    if(!validDate(req.params.date))return res.status(400).json({error:"Valid date is required"});
    const items=(req.body.items||[]).map((item,index)=>({
      islandId:cleanText(item.islandId,100),islandName:cleanText(item.islandName,200),
      dutyId:cleanText(item.dutyId,100),dutyName:cleanText(item.dutyName,200),
      boatNo:cleanText(item.boatNo,100),fuelLiters:Number(item.fuelLiters||0),
      driverName:cleanText(item.driverName,200),passengerCount:Number(item.passengerCount||0),sortOrder:index
    }));
    if(items.some(item=>!item.islandId||!item.islandName||!item.dutyId||!item.dutyName||!Number.isFinite(item.fuelLiters)||item.fuelLiters<0||!Number.isInteger(item.passengerCount)||item.passengerCount<0))return res.status(400).json({error:"Island boat operation items are invalid"});
    const {data,error}=await supabaseAdmin.rpc("save_island_boat_operations",{p_date:req.params.date,p_items:items,p_note:cleanText(req.body.note,1000),p_actor:req.user.username});
    if(error)throw error;
    await writeAudit(req,{action:"ISLAND_BOAT_OPERATIONS_SAVED",detail:`บันทึกเรือบนเกาะประจำวันที่ ${req.params.date}`,entityType:"island_boat_operation_batches",entityId:data,after:{date:req.params.date,items,note:req.body.note}});
    res.json({success:true,batchId:data});
  }catch(error){res.status(400).json({error:error.message})}
});

export default router;
