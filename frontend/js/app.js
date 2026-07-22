let currentUser=null, bookings=[], master={programs:[],addOns:[]}, passengers=[], editingCode=null, selectedBooking=null;
function money(n){return Number(n||0).toLocaleString("th-TH")}
function hasPermission(key){return currentUser?.role==="admin"||currentUser?.permissions?.[key]===true}
function showPage(id){const page=document.getElementById(id);if(!page||page.dataset.permission&&!hasPermission(page.dataset.permission))return alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));page.classList.add("active");document.querySelector(".sidebar")?.classList.remove("mobile-open");if(id==="dashboardPage")loadDashboard();if(id==="bookingListPage")loadBookingList();if(id==="companyPage")loadCompanyProfileToForm();if(id==="masterDataPage")loadMasterDataPro("programs");if(id==="userPage")loadUsers();if(id==="permissionPage")loadPermissionMatrix();if(id==="financialPage"&&typeof loadFinancialPage==="function")loadFinancialPage();}
function toggleMobileMenu(){document.querySelector(".sidebar")?.classList.toggle("mobile-open")}
async function login(){try{const u=document.getElementById("loginUsername").value.trim(),p=document.getElementById("loginPassword").value;const r=await API.login(u,p);localStorage.setItem("token",r.token);localStorage.setItem("user",JSON.stringify(r.user));currentUser=r.user;applyAuth();await initData();}catch(e){document.getElementById("loginError").innerText=e.message}}
function logout(){localStorage.clear();location.reload()}
function applyAuth(){currentUser=JSON.parse(localStorage.getItem("user")||"null");document.getElementById("loginScreen").style.display=currentUser?"none":"flex";document.getElementById("userBox").innerHTML=currentUser?`<b>${escapeHtml(currentUser.displayName)}</b><br>Username: ${escapeHtml(currentUser.username)}<br>Role: ${escapeHtml(currentUser.role)}`:"";document.querySelectorAll("[data-permission]").forEach(el=>el.classList.toggle("permission-hidden",!hasPermission(el.dataset.permission)));}
async function initData(){await loadMaster();startNewBooking();loadDashboard();}
async function loadMaster(){master=await API.master();}
function toggleReturnDate(){const r=document.getElementById("tripType").value==="round_trip";document.getElementById("returnDate").disabled=!r;if(!r)document.getElementById("returnDate").value=""}
function createPassenger(i=0){const pr=master.programs?.[0]||{program_id:"boat_ticket",program_name:"ตั๋วเรือ",default_price:1500};return{title:i===0?document.getElementById("leaderTitle").value:"",firstName:i===0?document.getElementById("leaderFirstName").value:"",lastName:i===0?document.getElementById("leaderLastName").value:"",age:"",phone:i===0?document.getElementById("phone").value:"",island:"",foodAllergy:"",medicalNote:"",isLeader:i===0,program:{programId:pr.program_id,name:pr.program_name,qty:1,price:Number(pr.default_price),defaultPrice:Number(pr.default_price),priceReason:"ราคา Default"},preAddOns:(master.addOns||[]).map(a=>({id:a.addon_id,name:a.addon_name,selected:false,qty:1,price:Number(a.default_price),defaultPrice:Number(a.default_price)})),islandAddOns:[]}}
function syncPassengerCount(){const n=Number(document.getElementById("paxCount").value||1);if(n>passengers.length){for(let i=passengers.length;i<n;i++)passengers.push(createPassenger(i))}else if(n<passengers.length){if(!confirm("ลดจำนวนผู้เดินทางและลบคนท้ายๆ?"))return;passengers=passengers.slice(0,n)}renderPassengers();refreshSummary();}
function parsePassengerText(){const result=parseSmartPasteText(document.getElementById("passengerText").value);if(!result.ok)return alert(`${result.error}\nตัวอย่าง: 1. นาย สมชาย ใจดี`);passengers=result.passengers.map((person,index)=>({...createPassenger(index),...person,isLeader:index===0}));const leader=passengers[0];document.getElementById("leaderTitle").value=leader.title;document.getElementById("leaderFirstName").value=leader.firstName;document.getElementById("leaderLastName").value=leader.lastName;document.getElementById("paxCount").value=passengers.length;renderPassengers();refreshSummary();}
function renderPassengers(){const root=document.getElementById("passengerList");root.innerHTML=passengers.map((p,pi)=>`<div class="passenger-card"><h3>${pi+1}. ${p.isLeader?"หัวหน้าทริป":""}</h3><div class="form-grid"><div><label>คำนำหน้า</label><select onchange="passengers[${pi}].title=this.value">${["","นาย","นาง","นางสาว","เด็กชาย","เด็กหญิง"].map(x=>`<option ${p.title===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>ชื่อ</label><input value="${p.firstName||""}" oninput="passengers[${pi}].firstName=this.value;refreshSummary()"></div><div><label>นามสกุล</label><input value="${p.lastName||""}" oninput="passengers[${pi}].lastName=this.value;refreshSummary()"></div><div><label>อายุ</label><input value="${p.age||""}" oninput="passengers[${pi}].age=this.value"></div><div><label>เบอร์</label><input value="${p.phone||""}" oninput="passengers[${pi}].phone=this.value"></div><div><label>เกาะ</label><select onchange="passengers[${pi}].island=this.value"><option></option><option ${p.island==="อ่าวไม้งาม"?"selected":""}>อ่าวไม้งาม</option><option ${p.island==="อ่าวช่องขาด"?"selected":""}>อ่าวช่องขาด</option></select></div></div><div class="service"><b>Program</b><select onchange="changeProgram(${pi},this.value)">${(master.programs||[]).map(pr=>`<option value="${pr.program_id}" ${p.program.programId===pr.program_id?"selected":""}>${pr.program_name} - ${money(pr.default_price)}</option>`).join("")}</select><div class="form-grid"><div><label>Qty</label><input type="number" value="${p.program.qty}" onchange="passengers[${pi}].program.qty=Number(this.value||1);refreshSummary()"></div><div><label>Price</label><input type="number" value="${p.program.price}" onchange="passengers[${pi}].program.price=Number(this.value||0);refreshSummary()"></div></div></div><div class="service"><b>Pre Add-on</b>${(p.preAddOns||[]).map((a,ai)=>`<div class="line"><label><input type="checkbox" ${a.selected?"checked":""} onchange="passengers[${pi}].preAddOns[${ai}].selected=this.checked;refreshSummary()"> ${a.name}</label><span><input style="width:70px" type="number" value="${a.qty}" onchange="passengers[${pi}].preAddOns[${ai}].qty=Number(this.value||1);refreshSummary()"> <input style="width:90px" type="number" value="${a.price}" onchange="passengers[${pi}].preAddOns[${ai}].price=Number(this.value||0);refreshSummary()"></span></div>`).join("")}</div><div class="service"><b>Island Add-on</b>${(p.islandAddOns||[]).map(a=>`<div class="line"><span>${a.name} x ${a.qty}</span><b>${money(a.qty*a.price)}</b></div>`).join("")}<button class="btn soft" onclick="addIslandAddon(${pi})">เพิ่มซื้อบนเกาะ</button></div></div>`).join("")}
function changeProgram(pi,id){const pr=master.programs.find(x=>x.program_id===id);if(!pr)return;passengers[pi].program={programId:pr.program_id,name:pr.program_name,qty:1,price:Number(pr.default_price),defaultPrice:Number(pr.default_price),priceReason:"ราคา Default"};if(id!=="boat_ticket")passengers[pi].preAddOns.forEach(item=>item.selected=false);renderPassengers();refreshSummary();}
function copyLeaderPackage(pi){if(pi===0||!passengers[0])return;passengers[pi].program=structuredClone(passengers[0].program);passengers[pi].preAddOns=structuredClone(passengers[0].preAddOns);renderPassengers();refreshSummary();}
function addIslandAddon(pi){const name=prompt("รายการ");if(!name)return;const qty=Number(prompt("จำนวน",1)||1),price=Number(prompt("ราคา",0)||0);passengers[pi].islandAddOns.push({id:"other",name,qty,price,defaultPrice:price,paymentMethod:"เงินสด",receivedBy:currentUser?.displayName||""});renderPassengers();refreshSummary();}
function personTotal(p){return Number(p.program.qty||1)*Number(p.program.price||0)+(p.preAddOns||[]).filter(a=>a.selected).reduce((s,a)=>s+Number(a.qty||1)*Number(a.price||0),0)+(p.islandAddOns||[]).reduce((s,a)=>s+Number(a.qty||1)*Number(a.price||0),0)}
function applyPassengerBusinessRules(){document.querySelectorAll("#passengerList .passenger-card").forEach((card,index)=>{if(index>0&&!card.querySelector(".copy-leader-package")){const button=document.createElement("button");button.type="button";button.className="btn soft copy-leader-package";button.textContent="คัดลอก Program/Add-on จากหัวหน้าทริป";button.addEventListener("click",()=>copyLeaderPackage(index));card.querySelector("h3")?.after(button)}const preSection=card.querySelectorAll(".service")[1],locked=passengers[index]?.program?.programId!=="boat_ticket";if(preSection){preSection.querySelectorAll("input").forEach(input=>input.disabled=locked);preSection.title=locked?"Package รวมบริการ Pre Add-on แล้ว":""}})}
function refreshSummary(){let total=0;document.getElementById("summary").innerHTML=passengers.map((p,i)=>{const t=personTotal(p);total+=t;return`<div class="line"><span>${i+1}. ${[p.title,p.firstName,p.lastName].filter(Boolean).join(" ")||"ยังไม่กรอกชื่อ"}</span><b>${money(t)}</b></div>`}).join("");document.getElementById("grandTotal").innerText=money(total);applyPassengerBusinessRules();}
function buildBooking(){const total=passengers.reduce((s,p)=>s+personTotal(p),0);const pr=passengers.reduce((s,p)=>s+Number(p.program.qty||1)*Number(p.program.price||0),0);const pre=passengers.reduce((s,p)=>s+(p.preAddOns||[]).filter(a=>a.selected).reduce((x,a)=>x+Number(a.qty||1)*Number(a.price||0),0),0);const isl=passengers.reduce((s,p)=>s+(p.islandAddOns||[]).reduce((x,a)=>x+Number(a.qty||1)*Number(a.price||0),0),0);return{bookingCode:editingCode||"BK"+Date.now(),tripType:val("tripType"),travelDate:val("travelDate"),returnDate:val("returnDate"),leaderTitle:val("leaderTitle"),leaderFirstName:val("leaderFirstName"),leaderLastName:val("leaderLastName"),phone:val("phone"),source:val("source"),agentName:val("agentName"),status:val("status"),paymentMethod:val("paymentMethod"),bookingNote:val("bookingNote"),passengers,totalAmount:total,programRevenue:pr,preAddOnRevenue:pre,islandAddOnRevenue:isl}}
function val(id){return document.getElementById(id)?.value||""}
function validateBooking(b){if(!b.travelDate)return"กรุณาระบุวันเดินทาง";if(b.tripType==="round_trip"&&!b.returnDate)return"กรุณาระบุวันเดินทางกลับ";if(b.returnDate&&b.returnDate<b.travelDate)return"วันเดินทางกลับต้องไม่ก่อนวันเดินทาง";if(!b.leaderFirstName||!b.leaderLastName)return"กรุณาระบุชื่อและนามสกุลหัวหน้าทริป";if(!b.passengers.length||b.passengers.some(p=>!p.firstName||!p.lastName))return"กรุณาระบุชื่อและนามสกุลผู้เดินทางทุกคน";return""}
async function saveBooking(){const b=buildBooking(),error=validateBooking(b);if(error)return alert(error);const dup=await API.duplicate(b);if(dup.duplicates?.length){const detail=dup.duplicates.map(x=>`${x.bookingCode}: ${x.name||x.phone||"ข้อมูลซ้ำ"}`).join("\n");if(!confirm(`พบข้อมูลที่อาจเป็น Booking ซ้ำ\n${detail}\n\nต้องการบันทึกต่อหรือไม่?`))return;}await API.saveBooking(b);editingCode=b.bookingCode;document.getElementById("saveNewBtn").classList.add("hidden");document.getElementById("saveEditBtn").classList.remove("hidden");alert("บันทึกแล้ว ระบบเปลี่ยนเป็นโหมดแก้ไขเพื่อป้องกันการสร้างซ้ำ");await loadBookingList();}
async function updateBooking(){if(!editingCode)return alert("ยังไม่ได้เลือก Booking");const b=buildBooking();await API.updateBooking(editingCode,b);alert("อัปเดตแล้ว");}
async function cancelBooking(){if(!editingCode)return alert("ยังไม่ได้เลือก Booking");const reason=prompt("เหตุผลยกเลิก");if(!reason)return;await API.cancelBooking(editingCode,reason);alert("ยกเลิกแล้ว");}
function startNewBooking(){editingCode=null;passengers=[createPassenger(0)];document.getElementById("paxCount").value=1;renderPassengers();refreshSummary();document.getElementById("saveNewBtn").classList.remove("hidden");document.getElementById("saveEditBtn").classList.add("hidden");}
async function loadBookingList(){bookings=await API.bookings();const d=val("blDate"),st=val("blStatus"),q=val("blSearch").toLowerCase();let rows=bookings;if(d)rows=rows.filter(b=>b.travelDate===d);if(st)rows=rows.filter(b=>b.status===st);if(q)rows=rows.filter(b=>JSON.stringify(b).toLowerCase().includes(q));document.getElementById("bookingList").innerHTML=rows.map(b=>`<div class="booking-item" onclick='selectBooking(${JSON.stringify(b).replace(/'/g,"&apos;")})'><span class="status-badge status-${b.status}">${b.status}</span><b>${b.bookingCode}</b><br>${b.leaderFirstName} ${b.leaderLastName}<br>${b.travelDate} | ${b.passengers?.length||0} คน | ${money(b.totalAmount)} บาท</div>`).join("")||"ไม่พบข้อมูล";}
function selectBooking(b){selectedBooking=b;document.getElementById("bookingDetail").innerHTML=`<h2>${b.bookingCode}</h2><p>${b.leaderFirstName} ${b.leaderLastName}</p><p>${b.travelDate} | ${b.status}</p><h3>${money(b.totalAmount)} บาท</h3>${(b.passengers||[]).map((p,i)=>`<div class="service">${i+1}. ${p.firstName} ${p.lastName} - ${p.program?.name||""}</div>`).join("")}`;}
function editSelectedBooking(){if(!selectedBooking)return;loadBookingToForm(selectedBooking);showPage("bookingPage")}
function loadBookingToForm(b){editingCode=b.bookingCode;["tripType","travelDate","returnDate","leaderTitle","leaderFirstName","leaderLastName","phone","source","agentName","status","paymentMethod","bookingNote"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=b[id]||""});passengers=b.passengers||[];document.getElementById("paxCount").value=passengers.length||1;toggleReturnDate();renderPassengers();refreshSummary();document.getElementById("saveNewBtn").classList.add("hidden");document.getElementById("saveEditBtn").classList.remove("hidden");}
async function loadTimeline(){if(!selectedBooking)return;const logs=await API.timeline(selectedBooking.bookingCode);document.getElementById("timelineRoot").innerHTML=logs.map(x=>`<div class="service"><b>${x.action}</b><br>${x.detail||""}<br><span class="muted">${x.changed_at||""}</span></div>`).join("")||"ไม่มี timeline";}
async function loadDashboard(){try{bookings=await API.bookings();const today=new Date().toISOString().slice(0,10);const rows=bookings.filter(b=>b.travelDate===today);document.getElementById("kpiBookings").innerText=rows.length;document.getElementById("kpiPax").innerText=rows.reduce((s,b)=>s+(b.passengers?.length||0),0);document.getElementById("kpiRevenue").innerText=money(rows.reduce((s,b)=>s+Number(b.totalAmount||0),0));document.getElementById("kpiCheckin").innerText=rows.filter(b=>b.status==="checked-in").length;document.getElementById("dashboardBookings").innerHTML=rows.map(b=>`<div class="line"><span>${b.bookingCode} ${b.leaderFirstName}</span><b>${money(b.totalAmount)}</b></div>`).join("")||"ไม่มี booking วันนี้";}catch(e){}}
async function generatePrintCenterReport(){
  const date=val("pcDate"), type=val("pcType");
  if(!date)return alert("เลือกวันที่");
  const r=await API.report(date,type);
  const rows=r.rows||[];
  const totalRevenue=rows.reduce((s,x)=>s+Number(x.totalAmount||x.revenue||0),0);
  const totalPax=rows.reduce((s,x)=>s+Number(x.pax||x.passengers||0),0);
  document.getElementById("printCenterOutput").innerHTML=`
    <div class="document-actions">
      <button class="btn primary" onclick="window.print()">Print / Save PDF</button>
    </div>
    <div class="report-paper">
      <div class="report-header">
        <div>
          <h1>${(r.title||type||"Report").toUpperCase()}</h1>
          <div>Date: ${date}</div>
        </div>
        <div>${getCompanySettings().company_name||"Dive Tour Company"}</div>
      </div>
      <div class="report-kpis">
        <div class="report-kpi"><span>Rows</span><b>${rows.length}</b></div>
        <div class="report-kpi"><span>Pax</span><b>${money(totalPax)}</b></div>
        <div class="report-kpi"><span>Revenue</span><b>${money(totalRevenue)}</b></div>
        <div class="report-kpi"><span>Generated</span><b>${new Date().toLocaleTimeString("th-TH")}</b></div>
      </div>
      ${table(rows)}
    </div>
  `;
}
function table(rows){if(!rows.length)return"ไม่มีข้อมูล";const keys=Object.keys(rows[0]);return`<table class="data-table"><thead><tr>${keys.map(k=>`<th>${k}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${r[k]??""}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function getCompanySettings(){return JSON.parse(localStorage.getItem("company_profile")||"null")||{company_name:"Dive Tour Company",phone:"",address:"",tax_id:""}}
function receiptItems(b){
  const items=[];
  (b.passengers||[]).forEach((p,idx)=>{
    if(p.program){
      const qty=Number(p.program.qty||1), price=Number(p.program.price||0);
      items.push({
        name:`${idx+1}. ${[p.title,p.firstName,p.lastName].filter(Boolean).join(" ")} - ${p.program.name||""}`,
        detail:`Program`,
        qty,
        unit:price,
        total:qty*price
      });
    }
    (p.preAddOns||[]).filter(a=>a.selected).forEach(a=>{
      const qty=Number(a.qty||1), price=Number(a.price||0);
      items.push({name:`Pre Add-on: ${a.name}`,detail:"",qty,unit:price,total:qty*price});
    });
    (p.islandAddOns||[]).forEach(a=>{
      const qty=Number(a.qty||1), price=Number(a.price||0);
      items.push({name:`Island Add-on: ${a.name}`,detail:a.paymentMethod||"",qty,unit:price,total:qty*price});
    });
  });
  return items;
}

function renderReceipt(b,type="RECEIPT"){
  const c=getCompanySettings();
  const items=receiptItems(b);
  const subtotal=items.reduce((s,x)=>s+Number(x.total||0),0);
  const total=Number(b.totalAmount||subtotal||0);
  const logo=c.logo_url||c.logoUrl
    ? `<img class="document-logo" src="${c.logo_url||c.logoUrl}" onerror="this.style.display='none'">`
    : `<div class="document-logo-placeholder"></div>`;

  return `
    <div class="document-actions">
      <button class="btn primary" onclick="window.print()">Print / Save PDF</button>
      <button class="btn soft" onclick="window.close()">Close</button>
    </div>

    <div class="document-page">
      <div class="document-header">
        <div class="document-company">
          ${logo}
          <div>
            <h2>${c.company_name||"Dive Tour Company"}</h2>
            <div>${c.address||""}</div>
            <div>Tel: ${c.phone||"-"}</div>
            <div>Tax ID: ${c.tax_id||"-"}</div>
          </div>
        </div>
        <div class="document-title">
          <h1>${type}</h1>
          <div>No: ${b.receiptNo||"RC-"+(b.bookingCode||"DRAFT")}</div>
          <div>Booking: ${b.bookingCode||"DRAFT"}</div>
          <div>Date: ${new Date().toISOString().slice(0,10)}</div>
        </div>
      </div>

      <div class="document-meta">
        <div class="document-box">
          <strong>Customer</strong><br>
          ${[b.leaderTitle,b.leaderFirstName,b.leaderLastName].filter(Boolean).join(" ")||"-"}<br>
          Phone: ${b.phone||"-"}<br>
          Source: ${b.source||"-"}<br>
          Agent: ${b.agentName||"-"}
        </div>
        <div class="document-box">
          <strong>Trip Detail</strong><br>
          Travel Date: ${b.travelDate||"-"}<br>
          Return Date: ${b.returnDate||"-"}<br>
          Status: ${b.status||"-"}<br>
          Payment: ${b.paymentMethod||"-"}
        </div>
      </div>

      <table class="document-table">
        <thead>
          <tr>
            <th>รายการ</th>
            <th style="width:80px">Qty</th>
            <th style="width:120px">Unit</th>
            <th style="width:130px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(x=>`
            <tr>
              <td>${x.name}${x.detail?`<br><span class="muted">${x.detail}</span>`:""}</td>
              <td class="num">${x.qty}</td>
              <td class="num">${money(x.unit)}</td>
              <td class="num">${money(x.total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="document-total">
        <div class="document-total-row"><span>Subtotal</span><b>${money(subtotal)}</b></div>
        <div class="document-total-row grand"><span>Total</span><b>${money(total)} บาท</b></div>
      </div>

      <div class="document-note">
        <strong>Payment Info:</strong>
        ${[c.bank_name,c.bank_account,c.bank_account_name,c.promptpay?`PromptPay: ${c.promptpay}`:""].filter(Boolean).join(" | ")||"-"}
        ${b.bookingNote?`<br><strong>Note:</strong> ${b.bookingNote}`:""}
      </div>

      ${type==="RECEIPT"?`<div class="paid-stamp">PAID</div>`:""}

      <div class="document-footer">
        <div><div class="signature-line">ผู้รับเงิน / Staff</div></div>
        <div><div class="signature-line">ลูกค้า / Customer</div></div>
      </div>
    </div>
  `;
}

function openPrintDoc(html,title="Document"){
  const w=window.open("","_blank");
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <link rel="stylesheet" href="css/style.css">
      </head>
      <body class="print-only-body">${html}</body>
    </html>
  `);
  w.document.close();
}

function printSelectedReceipt(type="RECEIPT"){
  if(!selectedBooking)return alert("เลือก booking ก่อน");
  openPrintDoc(renderReceipt(selectedBooking,type),`${type} ${selectedBooking.bookingCode}`);
}

function printCurrentReceipt(){
  const b=buildBooking();
  openPrintDoc(renderReceipt(b,"RECEIPT"),`RECEIPT ${b.bookingCode||"DRAFT"}`);
}

async function loadCompanyProfileToForm(){const p=await API.company();localStorage.setItem("company_profile",JSON.stringify(p));const map={csCompanyName:p.company_name,csTaxId:p.tax_id,csAddress:p.address,csPhone:p.phone,csEmail:p.email,csWebsite:p.website,csLineOa:p.line_oa,csFacebook:p.facebook,csLogoUrl:p.logo_url,csSignatureUrl:p.signature_url,csStampUrl:p.stamp_url,csBankName:p.bank_name,csBankAccount:p.bank_account,csBankAccountName:p.bank_account_name,csPromptPay:p.promptpay,csPromptPayQrUrl:p.promptpay_qr_url};Object.entries(map).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v||""})}
function companyPayload(){return{company_name:val("csCompanyName"),tax_id:val("csTaxId"),address:val("csAddress"),phone:val("csPhone"),email:val("csEmail"),website:val("csWebsite"),line_oa:val("csLineOa"),facebook:val("csFacebook"),logo_url:val("csLogoUrl"),signature_url:val("csSignatureUrl"),stamp_url:val("csStampUrl"),bank_name:val("csBankName"),bank_account:val("csBankAccount"),bank_account_name:val("csBankAccountName"),promptpay:val("csPromptPay"),promptpay_qr_url:val("csPromptPayQrUrl")}}
async function saveCompanyProfile(){const p=companyPayload();const r=await API.saveCompany(p);localStorage.setItem("company_profile",JSON.stringify(r.profile||p));alert("บันทึก Company Profile แล้ว")}
function previewCompanyReceipt(){document.getElementById("companyReceiptPreview").innerHTML=renderReceipt({bookingCode:"SAMPLE",leaderFirstName:"ตัวอย่าง",leaderLastName:"ลูกค้า",passengers:[createPassenger(0)],totalAmount:1500},"RECEIPT")}
let mdCat="programs",mdRows=[];async function loadMasterDataPro(cat){mdCat=cat;document.getElementById("mdpTitle").innerText=cat;mdRows=await API.mdp(cat);document.getElementById("masterDataProRoot").innerHTML=table(mdRows.map(r=>({id:Object.values(r)[0],name:Object.values(r)[1],active:r.active_flag,sort:r.sort_order,description:r.description})))}
function openMasterDataEditor(){document.getElementById("masterDataEditor").classList.remove("hidden");["mdpEditingId","mdpCode","mdpName","mdpDescription"].forEach(id=>document.getElementById(id).value="");document.getElementById("mdpPrice").value=0;document.getElementById("mdpSort").value=0}
function closeMasterDataEditor(){document.getElementById("masterDataEditor").classList.add("hidden")}
async function saveMasterDataProItem(){const item={code:val("mdpCode"),name:val("mdpName"),default_price:Number(val("mdpPrice")||0),sort_order:Number(val("mdpSort")||0),description:val("mdpDescription"),active_flag:val("mdpActive")==="true"};await API.saveMdp(mdCat,item);alert("บันทึกแล้ว");loadMasterDataPro(mdCat)}
async function loadUsers(){const users=await API.users();document.getElementById("userListRoot").innerHTML=table(users.map(u=>({username:u.username,name:u.display_name,role:u.role_id,active:u.active_flag})));await loadRoles();}
async function loadRoles(){const roles=await API.roles();document.getElementById("userRole").innerHTML=roles.map(r=>`<option value="${r.role_id}">${r.role_name}</option>`).join("")}
function openUserEditor(){document.getElementById("userEditor").classList.remove("hidden");loadRoles()}
function closeUserEditor(){document.getElementById("userEditor").classList.add("hidden")}
async function saveUser(){await API.saveUser({username:val("userUsername"),display_name:val("userDisplayName"),role_id:val("userRole"),active_flag:val("userActive")==="true"});alert("บันทึก User แล้ว");loadUsers()}
async function loadPermissionMatrix(){const roles=await API.roles();const m=await API.perms();const keys=[...new Set(Object.values(m).flatMap(o=>Object.keys(o)))];document.getElementById("permissionMatrixRoot").innerHTML=`<table class="permission-matrix"><thead><tr><th>Permission</th>${roles.map(r=>`<th>${r.role_id}</th>`).join("")}</tr></thead><tbody>${keys.map(k=>`<tr><td>${k}</td>${roles.map(r=>`<td><input type="checkbox" id="pm_${r.role_id}_${k}" ${m[r.role_id]?.[k]?"checked":""}></td>`).join("")}</tr>`).join("")}</tbody></table>`;window._pmRoles=roles;window._pmKeys=keys}
async function savePermissionMatrix(){const m={};(_pmRoles||[]).forEach(r=>{m[r.role_id]={};(_pmKeys||[]).forEach(k=>m[r.role_id][k]=document.getElementById(`pm_${r.role_id}_${k}`)?.checked||false)});await API.savePerms(m);alert("บันทึก Permission แล้ว")}
(async()=>{applyAuth();if(currentUser)await initData();})();
