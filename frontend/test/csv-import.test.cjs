const test=require("node:test");
const assert=require("node:assert/strict");
const {parsePassengerCsv}=require("../js/csvImport.js");

test("CSV import parses quoted Thai fields and passenger categories",()=>{
  const csv='ชื่อ,นามสกุล,ประเภทผู้โดยสาร,สัญชาติ,จุดรับ,ค่าเดินทาง\r\n"สมชาย","ใจดี",ผู้ใหญ่,ไทย,"โรงแรม, ตัวเมือง",400\r\nAnna,Smith,เด็ก,ต่างชาติ,บขส.,600';
  const result=parsePassengerCsv(csv);assert.equal(result.ok,true);assert.equal(result.rows.length,2);assert.equal(result.rows[0].pickupLocation,"โรงแรม, ตัวเมือง");assert.equal(result.rows[1].passengerType,"child");assert.equal(result.rows[1].nationalityType,"foreign");
});
test("CSV import rejects missing required columns and incomplete names",()=>{
  assert.equal(parsePassengerCsv("ชื่อ,โทร\nสมชาย,081").ok,false);
  const result=parsePassengerCsv("ชื่อ,นามสกุล\nสมชาย,");assert.equal(result.ok,false);assert.match(result.errors[0],/แถว 2/);
});
test("CSV import flags duplicate names and phones before confirmation",()=>{
  const result=parsePassengerCsv("ชื่อ,นามสกุล,เบอร์โทร\nสมชาย,ใจดี,0812345678\nสมชาย,ใจดี,0812345678");assert.equal(result.duplicates.length>=1,true);
});
