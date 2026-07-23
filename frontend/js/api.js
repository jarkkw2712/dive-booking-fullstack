const API_BASE = "https://dive-booking-api.onrender.com/api";

function token(){return localStorage.getItem("token")||""}
async function apiFetch(path, options={}){
  const headers=options.headers||{};
  headers["Content-Type"]="application/json";
  if(token()) headers.Authorization=`Bearer ${token()}`;
  const res=await fetch(API_BASE+path,{...options,headers});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||res.statusText);
  return data;
}

const API={
  login:(username,password)=>apiFetch("/auth/login",{method:"POST",body:JSON.stringify({username,password})}),
  changePassword:(currentPassword,newPassword)=>apiFetch("/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})}),
  me:()=>apiFetch("/auth/me"),
  bookings:()=>apiFetch("/bookings"),
  saveBooking:b=>apiFetch("/bookings",{method:"POST",body:JSON.stringify(b)}),
  updateBooking:(code,b)=>apiFetch(`/bookings/${encodeURIComponent(code)}`,{method:"PUT",body:JSON.stringify(b)}),
  cancelBooking:(code,reason)=>apiFetch(`/bookings/${encodeURIComponent(code)}/cancel`,{method:"POST",body:JSON.stringify({reason})}),
  duplicate:b=>apiFetch("/bookings/check-duplicate",{method:"POST",body:JSON.stringify(b)}),
  timeline:code=>apiFetch(`/bookings/${encodeURIComponent(code)}/timeline`),
  master:()=>apiFetch("/master-data"),
  report:(date,type)=>apiFetch(`/reports/print-center?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`),
  company:()=>apiFetch("/company-profile"),
  saveCompany:p=>apiFetch("/company-profile",{method:"PUT",body:JSON.stringify(p)}),
  mdp:cat=>apiFetch(`/master-data-pro/${encodeURIComponent(cat)}`),
  saveMdp:(cat,item)=>apiFetch(`/master-data-pro/${encodeURIComponent(cat)}`,{method:"POST",body:JSON.stringify(item)}),
  updateMdp:(cat,id,item)=>apiFetch(`/master-data-pro/${encodeURIComponent(cat)}/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(item)}),
  users:()=>apiFetch("/users"),
  saveUser:u=>apiFetch("/users",{method:"POST",body:JSON.stringify(u)}),
  updateUser:(id,u)=>apiFetch(`/users/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(u)}),
  roles:()=>apiFetch("/roles"),
  perms:()=>apiFetch("/permissions/matrix"),
  savePerms:m=>apiFetch("/permissions/matrix",{method:"PUT",body:JSON.stringify({matrix:m})}),
  financial:code=>apiFetch(`/financial/bookings/${encodeURIComponent(code)}`),
  createInvoice:(code,data)=>apiFetch(`/financial/bookings/${encodeURIComponent(code)}/invoices`,{method:"POST",body:JSON.stringify(data)}),
  createPayment:(code,data)=>apiFetch(`/financial/bookings/${encodeURIComponent(code)}/payments`,{method:"POST",body:JSON.stringify(data)}),
  paymentAction:(id,action,data={})=>apiFetch(`/financial/payments/${encodeURIComponent(id)}/${action}`,{method:"POST",body:JSON.stringify(data)}),
  issueReceipt:(id,data)=>apiFetch(`/financial/payments/${encodeURIComponent(id)}/receipts`,{method:"POST",body:JSON.stringify(data)}),
  createRefund:(code,data)=>apiFetch(`/financial/bookings/${encodeURIComponent(code)}/refunds`,{method:"POST",body:JSON.stringify(data)}),
  refundAction:(id,action)=>apiFetch(`/financial/refunds/${encodeURIComponent(id)}/${action}`,{method:"POST",body:"{}"}),
  financialReport:(type,date)=>apiFetch(`/financial/reports/${encodeURIComponent(type)}?date=${encodeURIComponent(date||"")}`)
};
