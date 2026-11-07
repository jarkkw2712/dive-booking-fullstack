// Credit settlements are staged with the Booking and saved atomically by the API.
(()=>{
  let saved=[],pending=[],loading=false,loadFailed=false,loadSequence=0;
  const el=id=>document.getElementById(id),cents=value=>Math.round(Number(value||0)*100);
  const paid=()=>[...saved.filter(row=>!row.voided_at),...pending].reduce((total,row)=>total+cents(row.amount),0);
  function methods(){return(master.paymentMethods||[]).filter(method=>method.active_flag!==false&&["เงินสด","โอนธนาคาร"].includes(paymentTypeLabel(method.method_name)))}
  function refresh(){
    const panel=el("creditSettlementPanel"),fields=el("creditSettlementFields"),credit=Number(el("creditAmount")?.value||0);
    if(!panel||!fields)return;
    const permitted=hasPermission("viewMoney")&&(editingCode?hasPermission("editBooking"):hasPermission("createBooking"));
    panel.classList.toggle("permission-hidden",!hasPermission("viewMoney"));
    fields.disabled=!permitted||!Number.isFinite(credit)||credit<=0||loading||loadFailed;
    const select=el("creditSettlementMethod"),current=select.value;
    select.innerHTML='<option value="">เลือกช่องทาง</option>'+methods().map(method=>`<option value="${escapeHtml(method.method_id)}">${escapeHtml(method.method_name)}</option>`).join("");
    if(current)select.value=current;
    el("creditSettlementStatus").textContent=loading?"กำลังโหลดประวัติรับชำระ...":loadFailed?"โหลดประวัติไม่สำเร็จ กรุณาเปิด Booking ใหม่ก่อนเพิ่มรายการ":credit<=0?"กรอกยอดขายเชื่อก่อนเพิ่มรายการชำระ":`ชำระแล้ว / รอบันทึก ${money(paid()/100)} บาท · ยอดเชื่อคงเหลือ ${money(Math.max(cents(credit)-paid(),0)/100)} บาท`;
    const rows=[...saved.map(row=>({...row,pending:false})),...pending.map(row=>({...row,pending:true}))];
    el("creditSettlementHistory").innerHTML=rows.map(row=>`<div class="credit-settlement-history-row"><span>${escapeHtml(row.date||row.settlement_date)} · ${escapeHtml(row.methodName||row.payment_method_name)}${row.pending?" · รอบันทึก Booking":row.voided_at?" · ลบแล้ว":""}</span><span><b>${money(row.amount)} บาท</b>${row.pending?` <button type="button" data-remove-credit-draft="${escapeHtml(row.idempotencyKey)}">ลบ</button>`:!row.voided_at&&permitted?` <button type="button" data-void-credit="${escapeHtml(row.idempotency_key)}" ${loading?"disabled":""}>ลบ</button>`:""}</span></div>`).join("");
  }
  function reset(){saved=[];pending=[];loading=false;loadFailed=false;loadSequence++;for(const id of ["creditSettlementDate","creditSettlementAmount"])if(el(id))el(id).value="";if(el("creditSettlementMessage"))el("creditSettlementMessage").textContent="";refresh()}
  async function load(code){
    const sequence=++loadSequence;loading=true;loadFailed=false;refresh();
    try{const rows=await API.creditSettlements(code);if(sequence!==loadSequence||editingCode!==code)return;saved=rows||[];const keys=new Set(saved.map(row=>row.idempotency_key));pending=pending.filter(row=>!keys.has(row.idempotencyKey));loadFailed=false}
    catch(error){if(sequence!==loadSequence)return;loadFailed=true;el("creditSettlementMessage").textContent="โหลดประวัติรับชำระไม่สำเร็จ: "+(error.message||"กรุณาลองใหม่")}
    finally{if(sequence===loadSequence){loading=false;refresh()}}
  }
  function add(){
    const date=el("creditSettlementDate").value,methodId=el("creditSettlementMethod").value,raw=el("creditSettlementAmount").value,amount=Number(raw),credit=Number(el("creditAmount").value||0),method=methods().find(row=>row.method_id===methodId),n=Math.round(amount*100);
    if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!method||!raw||!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-n)>1e-7){el("creditSettlementMessage").textContent="กรุณาเลือกวันที่ ช่องทาง และจำนวนเงินที่ถูกต้อง";return}
    if(n+paid()>cents(credit)){el("creditSettlementMessage").textContent="จำนวนเงินรวมเกินยอดขายเชื่อคงเหลือ";return}
    pending.push({idempotencyKey:crypto.randomUUID(),date,methodId,methodName:method.method_name,amount:n/100});el("creditSettlementAmount").value="";el("creditSettlementMessage").textContent="เพิ่มรายการแล้ว กรุณากดบันทึก Booking เพื่อบันทึกจริง";refresh();
  }
  const oldBuild=buildBooking;buildBooking=function(){const booking=oldBuild();if(pending.length)booking.creditSettlementsPending=pending.map(({idempotencyKey,date,methodId,amount})=>({idempotencyKey,date,methodId,amount}));return booking};
  const oldValidate=validateBooking;validateBooking=function(booking){const message=oldValidate(booking);if(message)return message;if(String(el("creditSettlementAmount")?.value||"").trim())return"กรุณากด + เพิ่มรายการชำระ หรือล้างจำนวนเงินก่อนบันทึก Booking";if(pending.length&&(loading||loadFailed))return"กรุณารอหรือโหลดประวัติรับชำระใหม่ก่อนบันทึก";if(paid()>cents(booking.creditAmount))return"ยอดขายเชื่อต้องไม่น้อยกว่ายอดที่บันทึกชำระแล้วและรายการรอบันทึก";return""};
  function discardDraft(){return !(pending.length||String(el("creditSettlementAmount")?.value||"").trim())||confirm("รายการรับชำระยอดเชื่อที่ยังไม่บันทึกจะหาย ต้องการดำเนินการต่อหรือไม่?")}
  const oldNew=startNewBooking;startNewBooking=function(){if(!discardDraft())return false;oldNew();reset()};
  const oldLoad=loadBookingToForm;loadBookingToForm=function(booking){if(!discardDraft())return false;reset();oldLoad(booking);if(booking.bookingCode)void load(booking.bookingCode);else refresh()};
  const oldSave=saveBooking;saveBooking=async function(){const result=await oldSave();if(result&&editingCode&&pending.length)await load(editingCode);return result};
  const oldUpdate=updateBooking;updateBooking=async function(){const result=await oldUpdate();if(result&&editingCode&&pending.length)await load(editingCode);return result};
  window.creditSettlementDraftSnapshot=()=>structuredClone(pending);
  window.creditSettlementRestoreDraft=rows=>{pending=Array.isArray(rows)?structuredClone(rows):[];refresh()};
  el("creditAmount").addEventListener("input",refresh);el("creditSettlementAdd").addEventListener("click",add);el("creditSettlementHistory").addEventListener("click",async event=>{const draft=event.target.closest("[data-remove-credit-draft]");if(draft){pending=pending.filter(row=>row.idempotencyKey!==draft.dataset.removeCreditDraft);refresh();return}const button=event.target.closest("[data-void-credit]");if(!button||loading||!editingCode)return;const key=button.dataset.voidCredit,code=editingCode,row=saved.find(item=>item.idempotency_key===key&&!item.voided_at);if(!row)return;if(!confirm(`ลบรายการ ${money(row.amount)} บาท? รายงานวันที่ชำระจะเปลี่ยนทันที`))return;loading=true;refresh();try{await API.voidCreditSettlement(code,key);if(editingCode===code){el("creditSettlementMessage").textContent="ลบรายการแล้ว";await load(code)}}catch(error){if(editingCode===code)el("creditSettlementMessage").textContent="ลบไม่สำเร็จ: "+(error.message||"กรุณาลองใหม่")}finally{if(editingCode===code){loading=false;refresh()}}});refresh();
})();
