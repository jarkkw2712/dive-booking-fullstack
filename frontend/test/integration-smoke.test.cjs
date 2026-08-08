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
test("booking captures credit payment, passenger logistics and ranged management reports",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["depositPaymentMethod","creditAmount","creditPaymentMethod","pcPeriod","pcToDate"])assert.match(html,new RegExp(`id=["']${id}["']`));
  for(const field of ["nationalityType","pickupLocation","transportationMethod","transportationAmount"])assert.match(app,new RegExp(field));
  assert.match(app,/function managementIncomeMatrix/);
  assert.match(app,/ค่าอุปกรณ์- /);
  assert.doesNotMatch(app,/name:`\$\{idx\+1\}/);
});
test("boat ticket book and serial remain separate from receipt references",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),api=fs.readFileSync(path.join(root,"js","api.js"),"utf8"),app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["receiptBookNo","manualReceiptNo","boatTicketBookNo","boatTicketNo"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(api,/boatTicketBookNo/);assert.match(api,/boatTicketNo/);assert.match(app,/เล่มที่ \(ตั๋วเรือ\)/);assert.match(app,/bookingSearchTextBase/);
});
test("frontend assets are cache-busted and expose a visible deployment version",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.match(html,/id="appVersion"/);
  assert.match(html,/Version 2026\.08\.08-2/);
  for(const asset of ["css/style.css","js/api.js","js/smartPaste.js","js/app.js","js/financial.js"])assert.match(html,new RegExp(`${asset.replace(/[/.]/g,"\\$&")}\\?v=20260808-2`));
});
test("booking draft fields allow minimum leader contact without travel dates",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["contactEmail","depositAmount","receiptBookNo","manualReceiptNo"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/<label>ติดต่อได้จาก<\/label><input id="contactEmail"/);
  assert.match(html,/id="contactEmail" type="text"/);
  assert.match(html,/LINE ID, Facebook, อีเมล/);
  assert.doesNotMatch(app,/รูปแบบ Email ไม่ถูกต้อง/);
  assert.equal(html.includes("(ประมาณการและแก้ภายหลังได้)"),false);
  assert.doesNotMatch(app,/if\s*\(\s*!b\.travelDate\s*\)\s*return/);
  assert.match(app,/if\(b\.travelDate&&b\.returnDate/);
  assert.match(app,/กรุณาระบุชื่อหัวหน้าทริป/);
  assert.match(app,/กรุณาระบุเบอร์โทรหัวหน้าทริป/);
});
test("booking dropdowns are master-driven and new booking fully resets edit state",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  const masterRoute=fs.readFileSync(path.join(root,"..","backend","src","routes","masterData.js"),"utf8");
  for(const id of ["source","transportationMethod","paymentMethod"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/loadMasterDataPro\('customer_sources'\)/);
  assert.match(html,/loadMasterDataPro\('transportation_methods'\)/);
  assert.match(html,/onclick=["']openNewBooking\(\)/);
  assert.match(html,/onclick=["']backToBookingEditor\(\)/);
  assert.match(app,/function populateBookingMasterSelects/);
  assert.match(app,/master\.customerSources/);
  assert.match(app,/master\.transportationMethods/);
  assert.match(app,/master\.paymentMethods/);
  assert.match(app,/async function openNewBooking\(\)\{try\{await loadMaster\(\)/);
  assert.match(app,/function startNewBooking\(\)\{editingCode=null;selectedBooking=null/);
  for(const field of ["travelDate","returnDate","leaderFirstName","phone","contactEmail","receiptBookNo","manualReceiptNo","bookingNote","passengerText"])assert.match(app,new RegExp(field));
  for(const table of ["master_customer_sources","master_transportation_methods","master_payment_methods"])assert.match(masterRoute,new RegExp(table));
});
test("passenger composition auto-builds adult child infant and FOC placeholders",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["adultCount","childCount","infantCount","focCount","paxCount"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/id="paxCount"[^>]*readonly/);
  assert.doesNotMatch(html,/onclick=["']syncPassengerCount\(/);
  assert.match(app,/function syncPassengerComposition/);
  assert.match(app,/passengerTypeLabels=\{adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"\}/);
  assert.match(app,/ผู้โดยสารคนที่/);
  assert.match(app,/if\(passengerType==="foc"\)return 0/);
  assert.match(app,/passengers=b\.passengers\?\.length\?b\.passengers\.map/);
});
test("program master prices adult child and infant separately and applies category defaults",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  const route=fs.readFileSync(path.join(root,"..","backend","src","routes","masterDataPro.js"),"utf8");
  for(const id of ["mdpPrice","mdpChildPrice","mdpInfantPrice"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(app,/function programPriceForType/);
  assert.match(app,/program\.child_price\?\?program\.default_price/);
  assert.match(app,/program\.infant_price\?\?program\.default_price/);
  assert.match(app,/passengerType==="foc"\)return 0/);
  assert.match(app,/tiered:true/);
  assert.match(route,/p\.child_price=req\.body\.child_price/);
  assert.match(route,/p\.infant_price=req\.body\.infant_price/);
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
test("booking list owns flexible document search while print center remains date-based",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["blDate","blDateMode","blStatus","blSearch","bookingList"])assert.match(html,new RegExp(`id=["']${id}["']`));
  for(const id of ["pcDocumentTab","pcDocumentPanel","pcSearchDate","pcSearchText","pcDocumentResults"])assert.doesNotMatch(html,new RegExp(`id=["']${id}["']`));
  assert.match(app,/function bookingSearchText/);
  assert.match(app,/function clearBookingListFilters/);
  assert.match(app,/b\.travelDate===d\|\|b\.returnDate===d/);
  for(const field of ["bookingCode","receiptBookNo","manualReceiptNo","leaderFirstName","leaderLastName","phone","contactEmail"])assert.match(app,new RegExp(field));
  assert.match(app,/if\(!date\)return alert/);
  assert.match(html,/Booking Confirmation/);
  assert.doesNotMatch(html,/Voucher/i);
});
test("passenger editor records non-revenue park accommodation",()=>{
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const field of ["parkAccommodationType","parkAccommodationBookedBy","parkAccommodationReference","parkAccommodationNote"])assert.match(app,new RegExp(field));
  assert.match(app,/บ้านพักอุทยาน/);
  assert.match(app,/เต็นท์อุทยาน/);
});
test("simple accommodation fields follow Program Tour and use editable master data",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  const financial=fs.readFileSync(path.join(root,"js","financial.js"),"utf8");
  assert.match(html,/loadMasterDataPro\('accommodations'\)/);
  assert.doesNotMatch(html,/id=["']mdpAccommodationPolicy["']/);
  assert.match(app,/function setPassengerAccommodation/);
  assert.match(app,/accommodationBookedBy/);
  assert.match(app,/>ลูกค้าจองเอง</);
  assert.match(app,/>จองให้</);
  assert.match(app,/tentCreditAmount/);
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
test("authorized users have a searchable unified audit page",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const api=fs.readFileSync(path.join(root,"js","api.js"),"utf8");
  const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");
  for(const id of ["auditPage","auditFrom","auditTo","auditActor","auditAction","auditSource","auditSuccess","auditBookingCode","auditLogRoot"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/data-permission="viewAudit"/);
  assert.match(api,/audit-logs\/unified/);
  assert.match(app,/function loadAuditLogs/);
});
