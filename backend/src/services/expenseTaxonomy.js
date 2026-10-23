// Stable codes are stored with each revision; labels are snapshots for printed reports.
export const expenseCategories=[
  {code:"tour_operations",name:"งานทัวร์และอุทยาน",items:[
    {code:"park_food_expense",name:"ค่าอาหารอุทยาน"},
    {code:"boat_trip_fee",name:"ค่าเที่ยวเรือ"},
    {code:"park_tent_fee",name:"ค่าธรรมเนียมกางเต็นท์"},
    {code:"other",name:"อื่น ๆ"}
  ]},
  {code:"food_supplies",name:"อาหารและวัสดุสิ้นเปลือง",items:[{code:"ice",name:"ค่าน้ำแข็ง"},{code:"other",name:"อื่น ๆ"}]},
  {code:"transportation",name:"การเดินทางและขนส่ง",items:[{code:"boat_towing",name:"ค่าลากเรือสปีด SB 222"},{code:"vehicle_expense",name:"ค่ารถ (ระบุทะเบียน)"},{code:"other",name:"อื่น ๆ"}]},
  {code:"staff_labor",name:"พนักงานและค่าแรง",items:[{code:"day_trip_staff_fee",name:"ค่าเล่น DT (Day Trip)"},{code:"tour_guide_fee",name:"ค่าจ้างไกด์"},{code:"assistant_fee",name:"ค่าจ้างผู้ช่วย"},{code:"other_staff_wages",name:"ค่าจ้างพนักงาน (ระบุชื่อ)"},{code:"technician_labor",name:"ค่าจ้างช่าง / ค่าแรงงานซ่อม"},{code:"other",name:"อื่น ๆ"}]},
  {code:"maintenance_repair",name:"บำรุงรักษาและซ่อมแซม",items:[{code:"vehicle_parts",name:"ค่าลูกปืนรถ"},{code:"vehicle_repair",name:"ค่าซ่อมรถ (ทำสี)"},{code:"other",name:"อื่น ๆ"}]},
  {code:"payroll_advance",name:"เงินเดือนและเงินเบิกล่วงหน้า",items:[{code:"salary_advance",name:"เบิกเงินเดือนล่วงหน้า"},{code:"salary_payment",name:"เบิกเงินเดือน"},{code:"other",name:"อื่น ๆ"}]},
  {code:"customer_refunds",name:"เงินคืนลูกค้า",items:[{code:"customer_refund",name:"คืนเงินค่าทัวร์ / คืนเงินมัดจำลูกค้า"},{code:"other",name:"อื่น ๆ"}]},
  {code:"other",name:"อื่น ๆ",items:[{code:"other",name:"อื่น ๆ"}]}
];

export const legacyExpenseCategories={
  boat_fee:{groupCode:"tour_operations",itemCode:"boat_park_fee"},
  thai_adult_fee:{groupCode:"tour_operations",itemCode:"national_park_fee"},
  thai_child_fee:{groupCode:"tour_operations",itemCode:"national_park_fee"},
  foreign_adult_fee:{groupCode:"tour_operations",itemCode:"national_park_fee"},
  foreign_child_fee:{groupCode:"tour_operations",itemCode:"national_park_fee"},
  tent_fee:{groupCode:"tour_operations",itemCode:"park_tent_fee"},
  ice:{groupCode:"food_supplies",itemCode:"ice"}
};

export const parkFeeLines={
  park_boat_total:{groupCode:"tour_operations",itemCode:"boat_park_fee",name:"ค่าธรรมเนียมเรือ",codes:["boat_fee"]},
  park_people_total:{groupCode:"tour_operations",itemCode:"national_park_fee",name:"ค่าธรรมเนียมอุทยาน",codes:["thai_adult_fee","thai_child_fee","thai_infant_fee","foreign_adult_fee","foreign_child_fee","foreign_infant_fee","foc_fee"]}
};

export function validateParkFeeLine(item){
  const definition=parkFeeLines[item.code];
  if(!definition)return null;
  const rows=item.breakdown;
  if(!Array.isArray(rows)||rows.length!==definition.codes.length||Number(item.qty)!==1)throw new Error("ข้อมูลคำนวณค่าธรรมเนียมอุทยานไม่ครบ");
  const seen=new Set();
  let totalCents=0;
  for(const row of rows){
    const code=String(row.code||""),qty=Number(row.qty),unitPrice=Number(row.unitPrice);
    if(!definition.codes.includes(code)||seen.has(code)||!Number.isFinite(qty)||!Number.isFinite(unitPrice)||qty<0||unitPrice<0||Math.abs(unitPrice*100-Math.round(unitPrice*100))>1e-7)
      throw new Error("รายละเอียดค่าธรรมเนียมอุทยานไม่ถูกต้อง");
    seen.add(code);
    totalCents+=Math.round(qty*unitPrice*100);
  }
  if(Math.round(Number(item.unitPrice)*100)!==totalCents)throw new Error("ยอดค่าธรรมเนียมอุทยานไม่ตรงกับรายละเอียด");
  return rows.map(row=>({code:row.code,name:String(row.name||"").slice(0,200),qty:Number(row.qty),unitPrice:Number(row.unitPrice)}));
}

export function expenseClassification(item){
  if(parkFeeLines[item.code])return{groupCode:parkFeeLines[item.code].groupCode,itemCode:parkFeeLines[item.code].itemCode};
  const legacy=legacyExpenseCategories[item.code];
  if(legacy)return legacy;
  if(String(item.code||"").startsWith("other_")&&item.groupCode==="tour_operations"&&["boat_park_fee","national_park_fee"].includes(item.itemCode))return{groupCode:item.groupCode,itemCode:item.itemCode};
  const group=expenseCategories.find(row=>row.code===item.groupCode);
  const sub=group?.items.find(row=>row.code===item.itemCode);
  if(!sub)throw new Error("กรุณาเลือกประเภทและรายการค่าใช้จ่ายให้ถูกต้อง");
  if(sub.code==="other"&&!String(item.detail||"").trim())throw new Error("รายการอื่น ๆ ต้องระบุรายละเอียดเพิ่มเติม");
  return{groupCode:group.code,itemCode:sub.code};
}
