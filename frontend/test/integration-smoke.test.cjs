const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("active HTML loads scripts in dependency order",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const order=["js/api.js","js/smartPaste.js","js/app.js","js/financial.js"].map(file=>html.indexOf(file));
  assert.ok(order.every(index=>index>=0));assert.deepEqual(order,[...order].sort((a,b)=>a-b));
});
test("Booking List, Print Center and Financial markup is connected",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  for(const id of ["bookingListPage","bookingList","bookingDetail","timelineRoot","blDate","blStatus","blSearch","printCenterPage","pcDate","pcType","printCenterOutput","financialPage","financialWorkspace"])assert.match(html,new RegExp(`id=["']${id}["']`));
});
test("login and forced password-change markup is connected without self-service recovery",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");for(const id of ["loginPassword","changePasswordModal","currentPassword","newPassword","userEmail","userTemporaryPassword","saveUserBtn","userSaveMessage"])assert.match(html,new RegExp(`id=["']${id}["']`));for(const id of ["forgotPasswordModal","forgotEmail","resetPasswordModal","resetPassword"])assert.doesNotMatch(html,new RegExp(`id=["']${id}["']`));assert.equal(html.includes('id="loginPassword" type="password" value="1234"'),false);
});
test("self-service password recovery API is disabled",()=>{
  const auth=fs.readFileSync(path.join(root,"..","backend","src","routes","auth.js"),"utf8");
  assert.match(auth,/router\.all\(\["\/forgot-password","\/reset-password"\]/);
});
test("inactivity logout and global mutation progress are connected",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const api=fs.readFileSync(path.join(root,"js","api.js"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  assert.match(html,/id=["']globalSavingIndicator["']/);
  assert.match(api,/setMutationPending\(true\)/);
  assert.match(api,/finally/);
  assert.match(app,/INACTIVITY_LIMIT_MS=15\*60\*1000/);
  assert.match(app,/startInactivityMonitor\(\)/);
});
test("master data exposes existing prices and edit actions",()=>{
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  assert.match(app,/masterDataConfig=/);
  assert.match(app,/ราคา Default/);
  assert.match(app,/function editMasterDataProItem/);
  assert.match(app,/API\.updateMdp\(mdCat,editingId,item\)/);
});
test("print center exposes role-specific reports and seven-day management output",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const type of ["counter","boat","island","insurance","driver","management"])assert.match(html,new RegExp(`value=["']${type}["']`));
  assert.match(html,/ผู้ลงเกาะ\/ขึ้นจากเกาะ/);
  assert.match(html,/สรุปวันนี้และ 7 วัน/);
  assert.match(app,/คาดการณ์รวม 7 วัน/);
  assert.match(app,/function configureReportOptions/);
  const css=fs.readFileSync(path.join(root,"css","style.css"),"utf8");
  assert.match(css,/@page report\{size:A4 landscape/);
  assert.match(css,/#printCenterPage>h1/);
  assert.match(app,/ยอดอุปกรณ์ที่ต้องเบิก/);
  assert.match(app,/ที่พักอุทยาน \(ไม่รวมรายได้บริษัท\)/);
});
test("passenger editor records non-revenue park accommodation",()=>{
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const field of ["parkAccommodationType","parkAccommodationBookedBy","parkAccommodationReference","parkAccommodationNote"])assert.match(app,new RegExp(field));
  assert.match(app,/บ้านพักอุทยาน/);
  assert.match(app,/เต็นท์อุทยาน/);
});
test("program policy controls stays and tent credits without locking boat return edits",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  const financial=fs.readFileSync(path.join(root,"js","financial.js"),"utf8");
  for(const id of ["mdpAccommodationPolicy","mdpTentCredit"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(app,/function programAccommodationPolicy/);
  assert.match(app,/customer_self_booked/);
  assert.match(app,/tentCreditAmount/);
  assert.match(app,/สามารถแก้ภายหลังได้/);
  assert.match(financial,/discountAmount:Number\(person\.tentCreditAmount/);
  assert.match(financial,/requestTentCreditRefund/);
});
test("active HTML does not contain known Thai mojibake markers",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  for(const marker of ["เน€เธ","โฐ","เธเธฑ"])assert.equal(html.includes(marker),false);
});
test("service-role key is not present in frontend",()=>{
  const files=["index.html","js/api.js","js/app.js","js/financial.js"].map(file=>fs.readFileSync(path.join(root,file),"utf8")).join("\n");
  assert.equal(files.includes("SUPABASE_SERVICE_ROLE_KEY"),false);
});
test("every HTML click handler has a loaded implementation",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const scripts=["js/api.js","js/smartPaste.js","js/app.js","js/financial.js"].map(file=>fs.readFileSync(path.join(root,file),"utf8")).join("\n");
  const handlers=[...html.matchAll(/onclick=["']([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  for(const name of new Set(handlers))assert.match(scripts,new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`),`missing click handler ${name}`);
});
test("active scripts do not declare duplicate global functions or constants",()=>{
  const sources=["js/api.js","js/smartPaste.js","js/app.js","js/financial.js"].map(file=>fs.readFileSync(path.join(root,file),"utf8"));
  const names=sources.flatMap(source=>[...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(match=>match[1]||match[2]));
  const duplicates=names.filter((name,index)=>names.indexOf(name)!==index);
  assert.deepEqual([...new Set(duplicates)],[]);
});
