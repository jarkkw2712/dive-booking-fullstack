const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css","style.css"),"utf8");
const frontSource=app.slice(app.indexOf("function frontChargeReportHtml"),app.indexOf("function equipmentReportHtml"));
const tourSource=app.split("\n").find(line=>line.startsWith("function referencePrintReportHtml"));
const context={
  getCompanySettings:()=>({company_name:"Sabina Tour Surin Islands"}),
  referenceReportHeader:report=>`<header class="reference-report-header"><div><h1>${report.title}</h1><div>20/10/2026</div></div><div class="reference-report-company"><b>Sabina Tour Surin Islands</b><span>369 ม.3 ต.คุระ อ.คุระบุรี จ.พังงา 82150</span></div></header>`,
  referenceReportNotes:()=>"",
  referenceReportDate:value=>value,
  escapeHtml:value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]),
  money:value=>Number(value||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
};
vm.createContext(context);
vm.runInContext(`${frontSource}\n${tourSource}`,context);
const baseRows=Array.from({length:8},(_,index)=>({bookingNo:index+1,bookingPeople:3,isFirstGroup:true,travelDate:"20/10/2026",returnDate:"22/10/2026",leader:`ลูกค้าทดสอบ ${index+1}`,phone:"081 737 2625",people:3,adult:2,child:1,infant:0,foc:0,program:"3D2N",island:"อ่าวไม้งาม",accommodation:"เต็นท์ใหญ่",transportation:"รถยนต์ส่วนตัว",agent:"Agent ทดสอบ",note:""}));
const firstGroup={...baseRows[0],bookingRowSpan:2,people:2,adult:1,island:"อ่าวไม้งาม, อ่าวช่องขาด"};
const secondGroup={...baseRows[0],bookingRowSpan:2,isFirstGroup:false,returnDate:"23/10/2026",people:1,adult:1,child:0,island:"อ่าวไม้งาม, อ่าวช่องขาด",transportation:"สนามบินภูเก็ต"};
const frontRows=[firstGroup,secondGroup,...baseRows.slice(1)];
const front=context.frontChargeReportHtml({type:"front_charge",date:"2026-10-20",title:"ใบหน้าชาร์จ",rows:frontRows,totals:{people:24,adult:16,child:8,infant:0,foc:0},summary:{bookings:8}});
const tourRows=Array.from({length:8},(_,index)=>({date:`${20+index}/10/2026`,boatCash:4100,boatTransfer:5900,packageCash:10000,packageTransfer:28000,tentCash:0,tentTransfer:0,oneDayCash:2500,oneDayTransfer:3000,dayTripOvernightCash:3500,dayTripOvernightTransfer:4000,deposit:4700,credit:0,naruemonTransfer:5900,rungruedeeTransfer:700,rujirojDepositCash:0,rujirojDepositTransfer:0,totalRevenue:48000}));
const tourTotals=Object.fromEntries(Object.keys(tourRows[0]).filter(key=>key!=="date").map(key=>[key,tourRows.reduce((sum,row)=>sum+Number(row[key]||0),0)]));
const tour=context.referencePrintReportHtml({type:"tour_expense_reference",title:"รายงานทัวร์และค่าใช้จ่าย",rows:tourRows,totals:{...tourTotals,accounts:{}},accountNames:[]});
const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${css}\n@media print{body{margin:0;background:#fff}.document-actions{display:none!important}.report-paper{margin:0;box-shadow:none;border:0}.reference-tour-report{break-before:page}}</style></head><body>${front}${tour}</body></html>`;
const target=path.resolve(process.argv[2]||path.join(root,"..","tmp","pdfs","print-layout-qa.html"));
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,html,"utf8");
process.stdout.write(target+"\n");
