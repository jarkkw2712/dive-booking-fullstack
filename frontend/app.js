const API_BASE = "http://localhost:3000/api";
let token = localStorage.getItem("token") || "";
let currentUser = JSON.parse(localStorage.getItem("user") || "null");
let masterData = { programs: [], addOns: [] };
let passengers = [];
let editingBookingCode = null;

function money(n){ return Number(n||0).toLocaleString("th-TH"); }
function fullName(p){ return [p.title,p.firstName,p.lastName].filter(Boolean).join(" "); }

async function api(path, options={}){
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function login(){
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  try{
    const data = await api("/auth/login", {method:"POST", body:JSON.stringify({username,password})});
    token = data.token; currentUser = data.user;
    localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(currentUser));
    applyLogin();
    await loadMasterData();
    startNewBooking();
  }catch(e){ document.getElementById("loginError").innerText = e.message; }
}
function logout(){ localStorage.clear(); location.reload(); }
function applyLogin(){
  if(currentUser){
    document.getElementById("loginScreen").style.display="none";
    document.getElementById("userBox").innerHTML = `<b>${currentUser.displayName}</b><br>${currentUser.role}`;
  }
}
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(id==="managePage") loadBookings();
}
function toggleReturnDate(){
  const round = document.getElementById("tripType").value === "round_trip";
  document.getElementById("returnDate").disabled = !round;
  if(!round) document.getElementById("returnDate").value = "";
}
async function testApi(){
  try{ document.getElementById("adminOutput").innerText = JSON.stringify(await api("/health"),null,2); }
  catch(e){ document.getElementById("adminOutput").innerText=e.message; }
}
async function loadMasterData(){
  masterData = await api("/master-data");
  document.getElementById("adminOutput").innerText = JSON.stringify(masterData,null,2);
}
function createPassenger(i=0){
  const p = masterData.programs[0] || {program_id:"boat_ticket",program_name:"ตั๋วเรือ",default_price:1500};
  return {
    title:i===0?document.getElementById("leaderTitle").value:"",
    firstName:i===0?document.getElementById("leaderFirstName").value:"",
    lastName:i===0?document.getElementById("leaderLastName").value:"",
    age:"", phone:i===0?document.getElementById("phone").value:"",
    island:"", foodAllergy:"", medicalNote:"", isLeader:i===0,
    program:{programId:p.program_id,name:p.program_name,qty:1,price:Number(p.default_price),defaultPrice:Number(p.default_price),priceReason:"ราคา Default",priceReasonOther:""},
    preAddOns:(masterData.addOns||[]).map(a=>({id:a.addon_id,name:a.addon_name,selected:false,qty:1,price:Number(a.default_price),defaultPrice:Number(a.default_price),customName:""})),
    islandAddOns:[]
  };
}
function syncPassengerCount(){
  const target = Number(document.getElementById("paxCount").value||1), current=passengers.length;
  if(target>current){ for(let i=current;i<target;i++) passengers.push(createPassenger(i)); }
  else if(target<current){
    if(!confirm(`ลดจำนวนจาก ${current} เหลือ ${target} จะลบคนท้ายๆ`)){ document.getElementById("paxCount").value=current; return; }
    passengers = passengers.slice(0,target);
  }
  renderPassengers(); refreshSummary();
}
function parsePassengerText(){
  const text = document.getElementById("passengerText").value.trim();
  const lines = text.split("\n").map(x=>x.trim()).filter(Boolean);
  const parsed = [];
  for(let i=0;i<lines.length;i++){
    const clean = lines[i].replace(/^\d+[\.\)]\s*/,"").replace(/^[-•]\s*/,"").replace(/\s+/g," ").trim();
    const m = clean.match(/^(นาย|นาง|นางสาว|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s+(\S+)\s+(.+)$/);
    if(!m){ alert(`Parse ไม่สำเร็จบรรทัด ${i+1}: ${lines[i]}`); return; }
    let title=m[1]; if(title==="ด.ช.") title="เด็กชาย"; if(title==="ด.ญ.") title="เด็กหญิง";
    parsed.push({title,firstName:m[2],lastName:m[3]});
  }
  passengers = parsed.map((x,i)=>({...createPassenger(i),...x,isLeader:i===0}));
  document.getElementById("paxCount").value=passengers.length;
  if(passengers[0]){
    document.getElementById("leaderTitle").value=passengers[0].title;
    document.getElementById("leaderFirstName").value=passengers[0].firstName;
    document.getElementById("leaderLastName").value=passengers[0].lastName;
  }
  renderPassengers(); refreshSummary();
}
function renderPassengers(){
  const root = document.getElementById("passengerList"); root.innerHTML="";
  passengers.forEach((p,pi)=>{
    const editablePre = p.program.programId==="boat_ticket";
    const div=document.createElement("div"); div.className="passenger";
    div.innerHTML=`
    <h3>ผู้เดินทาง ${pi+1} ${p.isLeader?"(หัวหน้าทริป)":""}</h3>
    <div class="form-grid">
      <div><label>คำนำหน้า</label><select onchange="passengers[${pi}].title=this.value;refreshSummary()">${["","นาย","นาง","นางสาว","เด็กชาย","เด็กหญิง"].map(x=>`<option ${p.title===x?"selected":""}>${x}</option>`).join("")}</select></div>
      <div><label>ชื่อ</label><input value="${p.firstName||""}" oninput="passengers[${pi}].firstName=this.value;refreshSummary()"></div>
      <div><label>นามสกุล</label><input value="${p.lastName||""}" oninput="passengers[${pi}].lastName=this.value;refreshSummary()"></div>
      <div><label>อายุ</label><input value="${p.age||""}" oninput="passengers[${pi}].age=this.value"></div>
      <div><label>เบอร์โทร</label><input value="${p.phone||""}" oninput="passengers[${pi}].phone=this.value"></div>
      <div><label>จุดหมาย</label><select onchange="passengers[${pi}].island=this.value"><option></option><option ${p.island==="อ่าวไม้งาม"?"selected":""}>อ่าวไม้งาม</option><option ${p.island==="อ่าวช่องขาด"?"selected":""}>อ่าวช่องขาด</option></select></div>
      <div><label>แพ้อาหาร</label><input value="${p.foodAllergy||""}" oninput="passengers[${pi}].foodAllergy=this.value"></div>
      <div><label>โรคประจำตัว</label><input value="${p.medicalNote||""}" oninput="passengers[${pi}].medicalNote=this.value"></div>
    </div>
    <div class="service">
      <b>Program</b>
      <select onchange="changeProgram(${pi},this.value)">
        ${masterData.programs.map(x=>`<option value="${x.program_id}" ${p.program.programId===x.program_id?"selected":""}>${x.program_name} - ${money(x.default_price)}</option>`).join("")}
      </select>
      <div class="form-grid">
        <div><label>จำนวน</label><input type="number" value="${p.program.qty}" onchange="paxProgram(${pi},'qty',Number(this.value||1))"></div>
        <div><label>ราคา</label><input type="number" value="${p.program.price}" onchange="paxProgram(${pi},'price',Number(this.value||0))"></div>
      </div>
    </div>
    <div class="service">
      <b>Pre Add-on ${editablePre?"":"(ล็อกเพราะเป็น package)"}</b>
      ${p.preAddOns.map((a,ai)=>`<div class="line"><label><input type="checkbox" ${a.selected?"checked":""} ${editablePre?"":"disabled"} onchange="passengers[${pi}].preAddOns[${ai}].selected=this.checked;refreshSummary()"> ${a.name}</label><span><input style="width:70px" type="number" value="${a.qty}" ${editablePre?"":"disabled"} onchange="passengers[${pi}].preAddOns[${ai}].qty=Number(this.value||1);refreshSummary()"> <input style="width:90px" type="number" value="${a.price}" ${editablePre?"":"disabled"} onchange="passengers[${pi}].preAddOns[${ai}].price=Number(this.value||0);refreshSummary()"></span></div>`).join("")}
    </div>
    <div class="service">
      <b>Island Add-on</b>
      ${p.islandAddOns.map(a=>`<div class="line"><span>${a.name} x ${a.qty}</span><b>${money(a.qty*a.price)}</b></div>`).join("")}
      <button class="btn" onclick="addIslandAddon(${pi})">เพิ่มซื้อบนเกาะ</button>
    </div>`;
    root.appendChild(div);
  });
}
function changeProgram(pi,id){
  const pr=masterData.programs.find(x=>x.program_id===id);
  passengers[pi].program={programId:pr.program_id,name:pr.program_name,qty:1,price:Number(pr.default_price),defaultPrice:Number(pr.default_price),priceReason:"ราคา Default",priceReasonOther:""};
  if(id!=="boat_ticket") passengers[pi].preAddOns.forEach(a=>a.selected=false);
  renderPassengers(); refreshSummary();
}
function paxProgram(pi,k,v){ passengers[pi].program[k]=v; refreshSummary(); }
function addIslandAddon(pi){
  const name=prompt("รายการซื้อเพิ่ม เช่น Fin/หน้ากาก/ชูชีพ/เต็นท์");
  if(!name) return;
  const qty=Number(prompt("จำนวน",1)||1), price=Number(prompt("ราคา",0)||0);
  const paymentMethod=prompt("ชำระเงิน: เงินสด / โอนผ่านธนาคาร","เงินสด")||"เงินสด";
  passengers[pi].islandAddOns.push({id:"other",name,qty,price,defaultPrice:price,paymentMethod,receivedBy:currentUser?.displayName||""});
  renderPassengers(); refreshSummary();
}
function personTotal(p){ return p.program.qty*p.program.price + p.preAddOns.filter(a=>a.selected).reduce((s,a)=>s+a.qty*a.price,0) + p.islandAddOns.reduce((s,a)=>s+a.qty*a.price,0); }
function refreshSummary(){
  let total=0;
  document.getElementById("summary").innerHTML=passengers.map((p,i)=>{const t=personTotal(p); total+=t; return `<div class="line"><span>${i+1}. ${fullName(p)||"-"}</span><b>${money(t)}</b></div>`}).join("");
  document.getElementById("grandTotal").innerText=money(total);
}
function buildBooking(){
  const total=passengers.reduce((s,p)=>s+personTotal(p),0);
  const programRevenue=passengers.reduce((s,p)=>s+p.program.qty*p.program.price,0);
  const preAddOnRevenue=passengers.reduce((s,p)=>s+p.preAddOns.filter(a=>a.selected).reduce((x,a)=>x+a.qty*a.price,0),0);
  const islandAddOnRevenue=passengers.reduce((s,p)=>s+p.islandAddOns.reduce((x,a)=>x+a.qty*a.price,0),0);
  return {
    bookingCode: editingBookingCode || "BK"+Date.now(),
    tripType:document.getElementById("tripType").value,
    travelDate:document.getElementById("travelDate").value,
    returnDate:document.getElementById("returnDate").value,
    leaderTitle:document.getElementById("leaderTitle").value,
    leaderFirstName:document.getElementById("leaderFirstName").value,
    leaderLastName:document.getElementById("leaderLastName").value,
    phone:document.getElementById("phone").value,
    source:document.getElementById("source").value,
    agentName:document.getElementById("agentName").value,
    status:document.getElementById("status").value,
    bookingNote:document.getElementById("bookingNote").value,
    paymentMethod:document.getElementById("paymentMethod").value,
    passengers,totalAmount:total,programRevenue,preAddOnRevenue,islandAddOnRevenue
  };
}
function validate(){
  if(!document.getElementById("travelDate").value) return alert("กรุณาระบุวันเดินทาง"), false;
  if(!document.getElementById("leaderFirstName").value || !document.getElementById("leaderLastName").value) return alert("กรุณาระบุชื่อหัวหน้าทริป"), false;
  return true;
}
async function saveBooking(){
  if(!validate()) return;
  const b=buildBooking();
  await api("/bookings",{method:"POST",body:JSON.stringify(b)});
  editingBookingCode=b.bookingCode;
  alert("บันทึกเข้า database แล้ว");
  document.getElementById("saveNewBtn").classList.add("hidden");
  document.getElementById("saveEditBtn").classList.remove("hidden");
  loadBookings();
}
async function updateBooking(){
  if(!editingBookingCode) return alert("ยังไม่ได้เลือก booking");
  const b=buildBooking();
  await api(`/bookings/${editingBookingCode}`,{method:"PUT",body:JSON.stringify(b)});
  alert("อัปเดตแล้ว");
  loadBookings();
}
async function cancelBooking(){
  if(!editingBookingCode) return alert("ยังไม่ได้เลือก booking");
  const reason=prompt("เหตุผลยกเลิก"); if(!reason) return;
  await api(`/bookings/${editingBookingCode}/cancel`,{method:"POST",body:JSON.stringify({reason})});
  alert("ยกเลิกแล้ว");
  loadBookings();
}
async function loadBookings(){
  const q=document.getElementById("manageDate")?.value;
  const data=await api("/bookings"+(q?`?travelDate=${q}`:""));
  const root=document.getElementById("bookingList");
  if(!root) return;
  root.innerHTML=data.map(b=>`<div class="card"><span class="status-badge status-${b.status}">${b.status}</span><b>${b.bookingCode}</b><br>${b.leaderFirstName} ${b.leaderLastName}<br>${b.travelDate} | ${b.passengers?.length||0} คน | ${money(b.totalAmount)} บาท<br><button class="btn" onclick='loadBookingToForm(${JSON.stringify(b)})'>แก้ไข</button></div>`).join("") || "ไม่พบ booking";
}
function loadBookingToForm(b){
  editingBookingCode=b.bookingCode; passengers=b.passengers||[];
  ["tripType","travelDate","returnDate","leaderTitle","leaderFirstName","leaderLastName","phone","source","agentName","status","bookingNote","paymentMethod"].forEach(id=>{document.getElementById(id).value=b[id]||""});
  toggleReturnDate(); document.getElementById("paxCount").value=passengers.length||1;
  renderPassengers(); refreshSummary(); showPage("bookingPage");
  document.getElementById("saveNewBtn").classList.add("hidden");
  document.getElementById("saveEditBtn").classList.remove("hidden");
}
function startNewBooking(){
  editingBookingCode=null; passengers=[createPassenger(0)];
  document.querySelectorAll("#bookingPage input,#bookingPage textarea").forEach(x=>{ if(x.type!=="number") x.value=""; });
  document.getElementById("paxCount").value=1;
  document.getElementById("tripType").value="one_way"; toggleReturnDate();
  renderPassengers(); refreshSummary();
  document.getElementById("saveNewBtn").classList.remove("hidden");
  document.getElementById("saveEditBtn").classList.add("hidden");
}
async function loadDailyManagementReport(){
  const date=document.getElementById("reportDate").value;
  if(!date) return alert("เลือกวันที่");
  const data=await api(`/reports/daily-management?date=${date}`);
  document.getElementById("reportOutput").innerText=JSON.stringify(data,null,2);
}
async function sendLineDailyReport(){
  const date=document.getElementById("reportDate").value;
  if(!date) return alert("เลือกวันที่");
  const data=await api(`/line/daily-management`,{method:"POST",body:JSON.stringify({date})});
  document.getElementById("reportOutput").innerText=JSON.stringify(data,null,2);
}
(async function init(){
  applyLogin();
  if(currentUser){ await loadMasterData(); startNewBooking(); }
})();
