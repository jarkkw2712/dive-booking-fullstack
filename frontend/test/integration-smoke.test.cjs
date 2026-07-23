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
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");for(const id of ["loginPassword","changePasswordModal","currentPassword","newPassword","userEmail","userTemporaryPassword"])assert.match(html,new RegExp(`id=["']${id}["']`));for(const id of ["forgotPasswordModal","forgotEmail","resetPasswordModal","resetPassword"])assert.doesNotMatch(html,new RegExp(`id=["']${id}["']`));assert.equal(html.includes('id="loginPassword" type="password" value="1234"'),false);
});
test("self-service password recovery API is disabled",()=>{
  const auth=fs.readFileSync(path.join(root,"..","backend","src","routes","auth.js"),"utf8");
  assert.match(auth,/router\.all\(\["\/forgot-password","\/reset-password"\]/);
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
