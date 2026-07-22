const test=require("node:test");
const assert=require("node:assert/strict");
const {parseSmartPasteText}=require("../js/smartPaste.js");

test("parses multiline Thai numbered list",()=>{
  const result=parseSmartPasteText("1. นาย สมชาย ใจดี\n2. นางสาว สมศรี สดใส");
  assert.equal(result.ok,true);assert.equal(result.passengers.length,2);assert.equal(result.passengers[1].title,"นางสาว");
});
test("accepts CRLF, bullets and extra spaces",()=>{
  const result=parseSmartPasteText("• เด็กชาย   ก้อง   ใจกล้า\r\n- นาง พร ดีมาก");
  assert.equal(result.ok,true);assert.equal(result.passengers[0].lastName,"ใจกล้า");
});
test("rejects malformed or incomplete names without guessing",()=>{
  assert.equal(parseSmartPasteText("สมชาย ใจดี").ok,false);
  assert.equal(parseSmartPasteText("1. นาย สมชาย").ok,false);
});
