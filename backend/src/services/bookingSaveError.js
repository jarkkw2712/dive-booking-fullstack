export function bookingSaveError(error,migrationRequired=false){
  const message=String(error?.message||"ไม่สามารถบันทึก Booking ได้");
  if(message.includes("Booking has new route details"))return{status:409,message:"รายชื่อผู้เดินทางหรือข้อมูลเส้นทางเปลี่ยนไป กรุณาโหลด Booking ใหม่ แล้วแก้ประเภทผู้เดินทางที่รายชื่อโดยตรง อย่าลดจำนวนจนลบชื่อเดิม"};
  if(message.includes("Booking has vehicle quantities"))return{status:409,message:"ข้อมูลจำนวนรถของ Booking เปลี่ยนไป กรุณาโหลด Booking ใหม่ก่อนบันทึก"};
  return{status:migrationRequired?503:500,message};
}
