let financialBookingCode="",financialData=null;
const financialIdempotency=prefix=>`${prefix}-${financialBookingCode}-${crypto.randomUUID()}`;

async function loadFinancialPage(){
  if(!hasPermission("viewFinancial"))return;
  if(!financialBookingCode&&selectedBooking)financialBookingCode=selectedBooking.bookingCode;
  const input=document.getElementById("financialBookingCode");if(input&&financialBookingCode)input.value=financialBookingCode;
  if(financialBookingCode)await loadFinancialBooking();
}
async function loadFinancialBooking(){
  financialBookingCode=val("financialBookingCode").trim();if(!financialBookingCode)return alert("กรุณาระบุ Booking Code");
  try{financialData=await API.financial(financialBookingCode);renderFinancial();}catch(error){document.getElementById("financialWorkspace").innerHTML=`<div class="error">${escapeHtml(error.message)}</div>`;}
}
function renderFinancial(){
  const d=financialData||{},s=d.summary||{};
  document.getElementById("financialSummary").innerHTML=[
    ["Invoice Total",s.invoicedAmount],["Paid",s.verifiedPaidAmount],["Outstanding",s.outstandingAmount],
    ["Refund",s.refundedAmount],["Net Received",s.netCashReceived]
  ].map(([name,value])=>`<div class="kpi"><span>${name}</span><b>${money(value)}</b></div>`).join("");
  const action=(permission,html)=>hasPermission(permission)?html:"";
  document.getElementById("financialWorkspace").innerHTML=`
    <div class="financial-actions">
      ${action("createInvoice",'<button class="btn primary" onclick="createInitialInvoice()">Generate Initial Invoice</button>')}
      ${action("receivePayment",'<button class="btn primary" onclick="receiveFinancialPayment()">Receive Payment</button>')}
      ${action("createRefund",'<button class="btn soft" onclick="requestFinancialRefund()">Create Refund</button>')}
    </div>
    <h2>Invoices</h2>${financialTable((d.invoices||[]).map(x=>({no:x.invoice_no,type:x.invoice_type,total:x.grand_total,status:x.status,date:x.issue_date})))}
    <h2>Payments</h2>${financialTable((d.payments||[]).map(x=>({no:x.payment_no,amount:x.amount,method:x.method_snapshot,status:x.status,actions:paymentActions(x)})),true)}
    <h2>Receipts</h2>${financialTable((d.receipts||[]).map(x=>({no:x.receipt_no,status:x.status,issued:x.issued_at})))}
    <h2>Refunds</h2>${financialTable((d.refunds||[]).map(x=>({no:x.refund_no,amount:x.amount,method:x.method,status:x.status,actions:refundActions(x)})),true)}
    <h2>Timeline</h2>${(d.timeline||[]).map(x=>`<div class="service"><b>${escapeHtml(x.event_type)}</b> ${money(x.amount)}<br><span class="muted">${escapeHtml(x.created_by)} · ${escapeHtml(x.created_at)}</span></div>`).join("")||"ไม่มีรายการ"}`;
}
function financialTable(rows,allowHtml=false){if(!rows.length)return'<p class="muted">ไม่มีรายการ</p>';const keys=Object.keys(rows[0]);return`<div class="table-scroll"><table class="data-table"><thead><tr>${keys.map(k=>`<th>${escapeHtml(k)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${keys.map(k=>`<td>${allowHtml&&k==="actions"?row[k]:escapeHtml(row[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
function paymentActions(payment){return[
  hasPermission("verifyPayment")&&payment.status==="pending"?`<button class="btn soft" onclick="financialPaymentAction('${payment.payment_id}','verify')">Verify</button>`:"",
  hasPermission("reversePayment")&&payment.status==="verified"?`<button class="btn danger" onclick="financialPaymentAction('${payment.payment_id}','reverse')">Reverse</button>`:"",
  hasPermission("issueReceipt")&&payment.status==="verified"?`<button class="btn soft" onclick="issueFinancialReceipt('${payment.payment_id}')">Receipt</button>`:""
].join(" ")}
function refundActions(refund){return[
  hasPermission("approveRefund")&&refund.status==="requested"?`<button class="btn soft" onclick="financialRefundAction('${refund.refund_id}','approve')">Approve</button>`:"",
  hasPermission("markRefundPaid")&&refund.status==="approved"?`<button class="btn soft" onclick="financialRefundAction('${refund.refund_id}','mark-paid')">Mark paid</button>`:""
].join(" ")}
async function createInitialInvoice(){
  const booking=(bookings||[]).find(x=>x.bookingCode===financialBookingCode)||selectedBooking;if(!booking)return alert("กรุณาเปิด Booking List ก่อนสร้าง Invoice");
  const items=[];(booking.passengers||[]).forEach(person=>{const name=[person.title,person.firstName,person.lastName].filter(Boolean).join(" ");if(person.program)items.push({sourceType:"program",passengerName:name,itemCode:person.program.programId,itemName:person.program.name,qty:Number(person.program.qty||1),unitPrice:Number(person.program.price||0)});(person.preAddOns||[]).filter(x=>x.selected).forEach(x=>items.push({sourceType:"pre_addon",passengerName:name,itemCode:x.id,itemName:x.name,qty:Number(x.qty||1),unitPrice:Number(x.price||0)}));(person.islandAddOns||[]).forEach(x=>items.push({sourceType:"island_addon",passengerName:name,itemCode:x.id,itemName:x.name,qty:Number(x.qty||1),unitPrice:Number(x.price||0)}));});
  if(!confirm(`สร้าง Invoice จากรายการปัจจุบัน ${items.length} รายการ?`))return;await API.createInvoice(financialBookingCode,{invoiceType:"initial",items,idempotencyKey:financialIdempotency("invoice")});await loadFinancialBooking();
}
async function receiveFinancialPayment(){const amount=Number(prompt("จำนวนเงินที่รับ",financialData?.summary?.outstandingAmount||0));if(!amount)return;const method=prompt("วิธีชำระ: cash หรือ bank_transfer","cash");if(!method)return;const referenceNo=method==="bank_transfer"?prompt("เลขอ้างอิงธนาคาร")||"":"";let remaining=amount;const allocations=[];for(const invoice of (financialData.invoices||[]).filter(x=>["issued","partially_paid"].includes(x.status))){const allocated=(financialData.allocations||[]).filter(x=>x.invoice_id===invoice.invoice_id).reduce((sum,x)=>sum+Number(x.amount||0),0),available=Math.max(Number(invoice.grand_total||0)-allocated,0),part=Math.min(remaining,available);if(part>0)allocations.push({invoiceId:invoice.invoice_id,amount:part});remaining-=part;if(remaining<=0)break;}await API.createPayment(financialBookingCode,{amount,methodId:method,methodSnapshot:method,referenceNo,allocations,idempotencyKey:financialIdempotency("payment")});await loadFinancialBooking();}
async function financialPaymentAction(id,action){const reason=action==="reverse"?prompt("เหตุผลการ Reverse"):"";if(action==="reverse"&&!reason)return;await API.paymentAction(id,action,{reason});await loadFinancialBooking();}
async function issueFinancialReceipt(id){await API.issueReceipt(id,{documentSnapshot:{bookingCode:financialBookingCode,issuedFrom:"Financial page"},idempotencyKey:financialIdempotency("receipt")});await loadFinancialBooking();}
async function requestFinancialRefund(){const amount=Number(prompt("จำนวนเงินคืน"));if(!amount)return;const reason=prompt("เหตุผลคืนเงิน");if(!reason)return;const method=prompt("วิธีคืนเงิน","bank_transfer");if(!method)return;await API.createRefund(financialBookingCode,{amount,reason,method,idempotencyKey:financialIdempotency("refund")});await loadFinancialBooking();}
async function financialRefundAction(id,action){await API.refundAction(id,action);await loadFinancialBooking();}
