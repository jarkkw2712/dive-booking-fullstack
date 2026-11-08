import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { bookingForUser } from "../services/permissionViews.js";

const router=express.Router();
router.use(requireAuth);

router.get('/other-service-defaults',async(req,res)=>{const {data,error}=await supabaseAdmin.from('other_service_document_defaults').select('document_visibility').eq('singleton',true).maybeSingle();if(error)return res.status(503).json({error:'ยังไม่สามารถโหลดค่าตั้งต้นค่าบริการอื่น ๆ'});res.json(data?.document_visibility||{})});
router.put('/other-service-defaults',requirePermission('editMasterData'),async(req,res)=>{const {data,error}=await supabaseAdmin.rpc('set_other_service_document_defaults',{p_visibility:req.body?.visibility,p_actor:req.user.username,p_role:req.user.role});if(error)return res.status(400).json({error:error.message});res.json(data)});

router.get("/",async(req,res)=>{
  const tables={programs:"master_programs",addOns:"master_addons",islandAddOns:"master_island_addons",accommodations:"master_accommodations",bookingOriginals:"master_booking_originals",customerSources:"master_customer_sources",transportationMethods:"master_transportation_methods",paymentMethods:"master_payment_methods",islands:"master_islands",islandBoatDuties:"master_island_boat_duties",packageCostRates:"master_package_cost_rates"};
  const fallbacks={islandAddOns:[],islands:[],islandBoatDuties:[],packageCostRates:[],customerSources:[{source_id:"existing_customer",source_name:"ลูกค้าเก่า"},{source_id:"facebook",source_name:"Facebook"},{source_id:"agent",source_name:"Agent"},{source_id:"walk_in",source_name:"Walk-in"}],transportationMethods:[{method_id:"private_car",method_name:"รถยนต์ส่วนตัว"},{method_id:"van",method_name:"รถตู้"},{method_id:"coach",method_name:"รถทัวร์"}]};
  const entries=await Promise.all(Object.entries(tables).map(async([key,table])=>[key,await supabaseAdmin.from(table).select("*").eq("active_flag",true).order("sort_order")]));
  const failed=entries.find(([key,result])=>result.error&&!fallbacks[key]);
  if(failed)return res.status(500).json({error:failed[1].error.message});
  res.json(bookingForUser(Object.fromEntries(entries.map(([key,result])=>[key,result.error?fallbacks[key]:result.data||[]])),req.user));
});

export default router;
