const activeBooking=booking=>booking.status!=="cancelled";
const passengersOf=booking=>Array.isArray(booking.passengers)?booking.passengers:[];
const personName=person=>[person.title,person.firstName,person.lastName].filter(Boolean).join(" ");
const leaderName=booking=>[booking.leaderTitle,booking.leaderFirstName,booking.leaderLastName].filter(Boolean).join(" ");
const isoDate=(date,offset=0)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)};
const money=value=>Number(value||0);
const accommodationLabel={none:"ไม่นอน",park_house:"บ้านพักอุทยาน",park_tent:"เต็นท์อุทยาน"};
const passengerTypeLabel={adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"};

function equipmentSummary(entries){
  const totals=new Map();
  for(const {booking} of entries)for(const person of passengersOf(booking))for(const addon of person.preAddOns||[]){
    if(addon.selected===false)continue;
    const key=addon.id||addon.name||"other",current=totals.get(key)||{code:key,name:addon.name||key,qty:0};
    current.qty+=Number(addon.qty||1);totals.set(key,current);
  }
  return [...totals.values()].sort((a,b)=>a.name.localeCompare(b.name,"th"));
}

function accommodationSummary(entries){
  const people=entries.flatMap(({booking})=>passengersOf(booking));
  return{
    parkHouse:people.filter(person=>person.accommodationId==="park_house").length,
    parkTent:people.filter(person=>person.accommodationId==="park_tent").length,
    none:people.filter(person=>!person.accommodationId).length,
    customerSelfBooked:people.filter(person=>person.accommodationId&&person.accommodationBookedBy==="customer").length,
    note:"ข้อมูลที่พักของอุทยาน ไม่รวมในรายได้บริษัท"
  };
}

function movements(bookings,date){
  return bookings.filter(activeBooking).flatMap(booking=>{
    const result=[];
    if(booking.travelDate===date)result.push({booking,direction:"ลงเกาะ",movement:"arrival"});
    if(booking.returnDate===date)result.push({booking,direction:"ขึ้นจากเกาะ",movement:"departure"});
    return result;
  });
}

function passengerRows(entries,{includeHealth=false}={}){
  return entries.flatMap(({booking,direction,date})=>passengersOf(booking).map(person=>({
    date:date||booking.travelDate,direction,
    bookingCode:booking.bookingCode,
    passenger:personName(person),
    passengerType:passengerTypeLabel[person.passengerType||"adult"]||"ผู้ใหญ่",
    nationality:person.nationalityType==="foreign"?"ต่างชาติ":"ไทย",
    age:person.age||"",
    phone:person.phone||booking.phone||"",
    pickupLocation:person.pickupLocation||"",transportationMethod:person.transportationMethod||booking.transportationMethod||"",returnTransportationMethod:person.returnTransportationMethod||person.transportationMethod||booking.transportationMethod||"",transportationAmount:money(person.transportationAmount),returnTransportationAmount:money(person.returnTransportationAmount),passengerTravelDate:person.passengerTravelDate||booking.travelDate||"",outboundDestination:person.outboundDestination||person.transportationDestination||person.pickupLocation||"",passengerReturnDate:person.passengerReturnDate||booking.returnDate||"",returnDestination:person.returnDestination||"",
    program:person.program?.name||"",
    island:person.island||"",
    accommodation:person.accommodationName||accommodationLabel[person.parkAccommodationType||"none"]||"",
    accommodationBookedBy:person.accommodationId?(person.accommodationBookedBy==="company"?"จองให้":"ลูกค้าจองเอง"):"",
    accommodationReference:person.parkAccommodationReference||"",
    accommodationArrangement:person.accommodationId?(person.accommodationBookedBy==="company"?"จองให้":"ลูกค้าจองเอง"):"",
    ...(includeHealth?{foodAllergy:person.foodAllergy||"",medicalNote:person.medicalNote||""}:{}),
    status:booking.status
  })));
}

function financeMap(financialRows){
  return new Map((financialRows||[]).map(row=>[row.booking_code||row.bookingCode,row]));
}

const reportDays=(from,to)=>{const days=[];for(let day=from;day<=to&&days.length<366;day=isoDate(day,1))days.push(day);return days};
const namedPaymentAccounts=["นฤมล","เรืองโรจน์","รุ่งฤดี","ลัดดาวรรณ์","รุจิโรจน์"];
const paymentDefaultName={general:"นฤมล",equipment:"ลัดดาวรรณ์",island:"เรืองโรจน์",transport:"ลัดดาวรรณ์"};
const paymentDefaultField={general:"default_general",equipment:"default_equipment",island:"default_island",transport:"default_transport"};
const normalized=value=>String(value||"").trim().toLocaleLowerCase("th-TH");
const paymentMeta=(name,methods=[])=>methods.find(method=>method.method_name===name)||null;
const paymentKind=(name,methods=[])=>{const method=paymentMeta(name,methods),code=normalized(method?.method_id);if(code==="cash")return"cash";if(code.includes("bank_transfer"))return"transfer";if(method?.payment_type==="cash")return"cash";if(method?.payment_type==="transfer")return"transfer";return/สด/.test(String(name||""))?"cash":"transfer"};
const defaultPayment=(methods,scope)=>methods.find(method=>method[paymentDefaultField[scope]]===true)?.method_name||methods.find(method=>String(method.method_name||"").trim()===paymentDefaultName[scope])?.method_name||"";
const namedAccount=name=>namedPaymentAccounts.find(account=>String(name||"").includes(account))||"";
const isBoatProgram=program=>normalized(program?.programId||program?.id)==="boat_ticket"||String(program?.name||"").includes("ตั๋วเรือ");
const isTentAddon=addon=>normalized(addon?.id||addon?.code)==="tent";
const isVanMethod=name=>/รถตู้|\bvan\b/i.test(String(name||""));
const lineAmount=(qty,price)=>money(qty||1)*money(price);

function transportationRevenueLines(booking,paymentMethods){
  const rows=[];
  for(const person of passengersOf(booking)){
    const outboundMethod=person.transportationMethod||booking.transportationMethod||"",outboundAmount=money(person.transportationAmount);
    if(outboundMethod||outboundAmount)rows.push({source:"transport",direction:"ขาไป",method:outboundMethod,amount:outboundAmount,paymentMethod:person.transportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(outboundMethod)?"transport":"general")||booking.paymentMethod||"",operationalDate:person.passengerTravelDate||booking.travelDate||"",destination:person.outboundDestination||person.transportationDestination||person.pickupLocation||""});
    const returnMethod=person.returnTransportationMethod||"",returnAmount=money(person.returnTransportationAmount);
    if(returnMethod||returnAmount)rows.push({source:"transport",direction:"ขากลับ",method:returnMethod,amount:returnAmount,paymentMethod:person.returnTransportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(returnMethod)?"transport":"general")||booking.paymentMethod||"",operationalDate:person.passengerReturnDate||booking.returnDate||"",destination:person.returnDestination||""});
  }
  return rows;
}

function serviceRevenueLines(booking,paymentMethods){
  const rows=[];
  for(const person of passengersOf(booking)){
    if(person.program)rows.push({source:isBoatProgram(person.program)?"boat":"package",amount:lineAmount(person.program.qty,person.program.price),paymentMethod:booking.paymentMethod||defaultPayment(paymentMethods,"general")});
    for(const addon of person.preAddOns||[]){if(addon.selected===false)continue;rows.push({source:isTentAddon(addon)?"tent":"equipment",amount:lineAmount(addon.qty,addon.price),paymentMethod:addon.paymentMethod||defaultPayment(paymentMethods,"equipment")||booking.paymentMethod||""})}
    for(const addon of person.islandAddOns||[])rows.push({source:"island",amount:lineAmount(addon.qty,addon.price),paymentMethod:addon.paymentMethod||defaultPayment(paymentMethods,"island")||booking.paymentMethod||""});
  }
  rows.push(...transportationRevenueLines(booking,paymentMethods));
  return rows;
}

function tourExpenseReferenceReport(bookings,date,toDate,paymentMethods){
  const days=reportDays(date,toDate),rows=days.map(day=>{
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day),services=daily.flatMap(booking=>serviceRevenueLines(booking,paymentMethods));
    const sum=(source,kind)=>services.filter(line=>(!source||line.source===source)&&(!kind||paymentKind(line.paymentMethod,paymentMethods)===kind)).reduce((total,line)=>total+line.amount,0);
    const deposits=daily.map(booking=>({amount:money(booking.depositAmount),method:booking.depositPaymentMethod||booking.paymentMethod||""}));
    const accountLines=[...services,...deposits.map(row=>({amount:row.amount,paymentMethod:row.method,source:"deposit"}))],accountTotals=Object.fromEntries(namedPaymentAccounts.map(account=>[account,accountLines.filter(line=>namedAccount(line.paymentMethod)===account).reduce((total,line)=>total+line.amount,0)]));
    return{date:day,boatCash:sum("boat","cash"),boatTransfer:sum("boat","transfer"),packageCash:sum("package","cash"),packageTransfer:sum("package","transfer"),tentCash:sum("tent","cash"),tentTransfer:sum("tent","transfer"),deposit:deposits.reduce((total,row)=>total+row.amount,0),credit:daily.reduce((total,booking)=>total+money(booking.creditAmount),0),naruemonTransfer:accountLines.filter(line=>namedAccount(line.paymentMethod)==="นฤมล"&&paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((total,line)=>total+line.amount,0),rungruedeeTransfer:accountLines.filter(line=>namedAccount(line.paymentMethod)==="รุ่งฤดี"&&paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((total,line)=>total+line.amount,0),rujirojDepositCash:deposits.filter(row=>namedAccount(row.method)==="รุจิโรจน์"&&paymentKind(row.method,paymentMethods)==="cash").reduce((total,row)=>total+row.amount,0),rujirojDepositTransfer:deposits.filter(row=>namedAccount(row.method)==="รุจิโรจน์"&&paymentKind(row.method,paymentMethods)==="transfer").reduce((total,row)=>total+row.amount,0),totalRevenue:services.reduce((total,line)=>total+line.amount,0),accounts:accountTotals};
  }),moneyFields=["boatCash","boatTransfer","packageCash","packageTransfer","tentCash","tentTransfer","deposit","credit","naruemonTransfer","rungruedeeTransfer","rujirojDepositCash","rujirojDepositTransfer","totalRevenue"],totals=Object.fromEntries(moneyFields.map(field=>[field,rows.reduce((sum,row)=>sum+money(row[field]),0)]));
  totals.accounts=Object.fromEntries(namedPaymentAccounts.map(account=>[account,rows.reduce((sum,row)=>sum+money(row.accounts?.[account]),0)]));
  return{date,type:"tour_expense_reference",title:"รายงานทัวร์และค่าใช้จ่าย",purpose:"ยอดตามวันเดินทางไป แยกหมวดรายได้และช่องทางชำระเงิน",range:{from:date,to:toDate},rows,totals,accountNames:namedPaymentAccounts,sourceNotes:["วันที่อ้างอิงวันเดินทางไปของ Booking","ตั๋วเรือใช้ Program code boat_ticket; Program อื่นเป็นแพ็คเกจ","เต็นท์ใช้อุปกรณ์ code tent","มัดจำและขายเชื่อแสดงเพื่อประกอบ ไม่บวกซ้ำในรวมรายได้"]};
}

function tentFeeReferenceReport(bookings,date,toDate){
  const rows=[];for(const booking of bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate)){
    const tents=passengersOf(booking).flatMap(person=>(person.preAddOns||[]).filter(addon=>addon.selected!==false&&isTentAddon(addon))),people=tents.reduce((sum,addon)=>sum+money(addon.qty||1),0);if(!people)continue;
    const start=new Date(`${booking.travelDate}T00:00:00Z`),end=booking.returnDate?new Date(`${booking.returnDate}T00:00:00Z`):start,nights=Math.max(Math.round((end-start)/86400000),0),program=uniqueValues(passengersOf(booking),person=>person.program?.name);
    rows.push({leader:leaderName(booking),program,travelDate:booking.travelDate||"",returnDate:booking.returnDate||"",nights,people,rate:80,total:nights*people*80,note:booking.bookingNote||""});
  }
  return{date,type:"tent_fee_reference",title:"รายงานค่าธรรมเนียมเต็นท์",purpose:"อุปกรณ์ code tent × จำนวนคืน × 80 บาท",range:{from:date,to:toDate},rows,totals:{people:rows.reduce((sum,row)=>sum+row.people,0),amount:rows.reduce((sum,row)=>sum+row.total,0)},sourceNotes:["วันที่อ้างอิงวันเดินทางไป","จำนวนคนอ้างอิง Qty ของอุปกรณ์ code tent","อัตราคงที่ 80 บาทต่อคนต่อคืน"]};
}

function vanDailyReferenceReport(bookings,date,toDate,paymentMethods){
  const days=reportDays(date,toDate),rows=days.map(day=>{const lines=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day).flatMap(booking=>transportationRevenueLines(booking,paymentMethods)).filter(line=>isVanMethod(line.method)),cash=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash").reduce((sum,line)=>sum+line.amount,0),transfer=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0);return{date:day,cash,transfer,total:cash+transfer}}),totals={cash:rows.reduce((sum,row)=>sum+row.cash,0),transfer:rows.reduce((sum,row)=>sum+row.transfer,0),total:rows.reduce((sum,row)=>sum+row.total,0)};
  return{date,type:"van_daily_reference",title:"รายงานรถตู้ (เฉพาะรถตู้)",purpose:"ยอดค่ารถตู้ตามวันเดินทางไป แยกเงินสดและเงินโอน",range:{from:date,to:toDate},rows,totals,sourceNotes:["รวมเฉพาะวิธีการเดินทางรถตู้","ยอดขาไปและขากลับใช้ช่องทางชำระของแต่ละขา","เงินสด/โอนพิจารณาจาก code ใน Payment Method Master"]};
}

function vanWorkOrderReferenceReport(bookings,date,toDate,paymentMethods){
  const groups=new Map();for(const booking of bookings.filter(activeBooking))for(const leg of transportationRevenueLines(booking,paymentMethods)){if(!isVanMethod(leg.method)||!leg.operationalDate||leg.operationalDate<date||leg.operationalDate>toDate)continue;const key=[booking.bookingCode,leg.direction,leg.operationalDate,leg.destination].join("|");const row=groups.get(key)||{date:leg.operationalDate,direction:leg.direction,leader:leaderName(booking),phone:booking.phone||"",pax:0,location:leg.destination||"ไม่ระบุ",note:booking.bookingNote||"",bookingCode:booking.bookingCode};row.pax++;groups.set(key,row)}
  const rows=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.bookingCode.localeCompare(b.bookingCode)||a.direction.localeCompare(b.direction)).map((row,index)=>({no:index+1,...row}));
  return{date,type:"van_work_order_reference",title:"ใบงานรับ-ส่งรถตู้",purpose:"รายการปฏิบัติงานรถตู้แยกขาไปและขากลับ",range:{from:date,to:toDate},rows,summary:{jobs:rows.length,pax:rows.reduce((sum,row)=>sum+row.pax,0)},sourceNotes:["วันปฏิบัติงานอ้างอิงวันเดินทางรายบุคคลของแต่ละขา","จำนวนคือผู้โดยสารที่เลือกวิธีการเดินทางรถตู้ในขานั้น"]};
}

function reportMonths(date,toDate){const months=[];let cursor=date.slice(0,7);const last=toDate.slice(0,7);while(cursor<=last&&months.length<120){months.push(cursor);const [year,month]=cursor.split("-").map(Number),next=new Date(Date.UTC(year,month,1));cursor=next.toISOString().slice(0,7)}return months}
function tourMonthlyReferenceReport(bookings,date,toDate,paymentMethods){
  const rows=reportMonths(date,toDate).map(month=>{const selected=bookings.filter(booking=>activeBooking(booking)&&String(booking.travelDate||"").slice(0,7)===month),services=selected.flatMap(booking=>serviceRevenueLines(booking,paymentMethods)),cash=services.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash").reduce((sum,line)=>sum+line.amount,0),transfer=services.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0);return{month,cash,transfer,deposit:selected.reduce((sum,booking)=>sum+money(booking.depositAmount),0),credit:selected.reduce((sum,booking)=>sum+money(booking.creditAmount),0),rungruedeeTransfer:services.filter(line=>namedAccount(line.paymentMethod)==="รุ่งฤดี"&&paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0)}});
  return{date,type:"tour_monthly_reference",title:"รายงานสรุปรายการทัวร์",purpose:"สรุปรายเดือนตามวันเดินทางไป",range:{from:date,to:toDate},rows,sourceNotes:["มัดจำและขายเชื่อเป็นข้อมูลประกอบและไม่บวกซ้ำกับยอดสด/โอน","ตัดคอลัมน์เบิกทัวร์และคงเหลือตามข้อกำหนด"]};
}
function vanMonthlyReferenceReport(bookings,date,toDate,paymentMethods){
  const rows=reportMonths(date,toDate).map(month=>{const lines=bookings.filter(booking=>activeBooking(booking)&&String(booking.travelDate||"").slice(0,7)===month).flatMap(booking=>transportationRevenueLines(booking,paymentMethods)).filter(line=>isVanMethod(line.method)),cash=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash").reduce((sum,line)=>sum+line.amount,0),transfer=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0);return{month,cash,transfer,total:cash+transfer}});
  return{date,type:"van_monthly_reference",title:"รายงานสรุปรายการรถตู้",purpose:"สรุปค่ารถตู้รายเดือนตามวันเดินทางไป",range:{from:date,to:toDate},rows,sourceNotes:["รวมเฉพาะวิธีการเดินทางรถตู้","เงินสด/โอนพิจารณาจาก code ใน Payment Method Master"]};
}
const incomeCategory=name=>{const value=String(name||"").toLowerCase();if(value.includes("น้ำแข็ง"))return"น้ำแข็ง";if(value.includes("น้ำเกาะ"))return"ค่าน้ำเกาะ";if(value.includes("น้ำ"))return"ค่าน้ำ";if(value.includes("หน้ากาก"))return"หน้ากาก";if(value.includes("ชูชีพ"))return"ชูชีพ";if(value.includes("ฟิน")||value.includes("ตีนกบ"))return"ฟิน";if(value.includes("เต็นท์"))return"เต็นท์";if(value.includes("เหมาเรือ"))return"เหมาเรือ";if(value.includes("ระวาง"))return"ค่าระวาง";return"อื่นๆ"};
function managementReport(bookings,financialRows,expenseRows,date,toDate=date,masterAddOns=[],masterAccommodations=[]){
  const finances=financeMap(financialRows);
  const expensesByDay=new Map();for(const expense of expenseRows||[]){const day=expense.expense_date||expense.expenseDate,current=expensesByDay.get(day)||[];current.push(expense);expensesByDay.set(day,current)}
  const days=reportDays(date,toDate);
  const rows=days.map(day=>{
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);
    const dailyPeople=daily.flatMap(passengersOf);
    const dailyArrivals=daily.map(booking=>({booking,direction:"ลงเกาะ",movement:"arrival"}));
    const lodging=accommodationSummary(dailyArrivals);
    const expectedRevenue=daily.reduce((sum,booking)=>sum+money(booking.totalAmount),0);
    const deposits=daily.reduce((sum,booking)=>sum+money(booking.depositAmount),0);
    const actualReceived=daily.reduce((sum,booking)=>sum+money(finances.get(booking.bookingCode)?.net_cash_received),0);
    const operatingExpenses=(expensesByDay.get(day)||[]).reduce((sum,item)=>sum+money(item.amount),0);
    return{
      date:day,
      bookings:daily.length,
      pax:dailyPeople.length,
      adult:dailyPeople.filter(person=>(person.passengerType||"adult")==="adult").length,
      child:dailyPeople.filter(person=>person.passengerType==="child").length,
      infant:dailyPeople.filter(person=>person.passengerType==="infant").length,
      foreign:dailyPeople.filter(person=>person.nationalityType==="foreign").length,
      foc:dailyPeople.filter(person=>person.passengerType==="foc").length,
      pending:daily.filter(booking=>booking.status==="pending").length,
      confirmed:daily.filter(booking=>booking.status==="confirmed").length,
      checkedIn:daily.filter(booking=>booking.status==="checked-in").length,
      parkHouse:lodging.parkHouse,
      parkTent:lodging.parkTent,
      equipmentUnits:equipmentSummary(dailyArrivals).reduce((sum,item)=>sum+item.qty,0),
      expectedRevenue,
      deposits,
      actualReceived,
      outstanding:Math.max(expectedRevenue-actualReceived,0),operatingExpenses,netAfterExpenses:expectedRevenue-operatingExpenses
    };
  });
  const today=rows[0]||{};
  const categoryNames=["ค่าตั๋วเรือ","มัดจำ","ขายเชื่อ","ค่าน้ำ","ค่าน้ำเกาะ","หน้ากาก","ชูชีพ","ฟิน","น้ำแข็ง","เต็นท์","เหมาเรือ","ค่าระวาง","อื่นๆ","รวมรายได้"];
  const incomeMatrix=categoryNames.map(category=>({category,values:Object.fromEntries(days.map(day=>{const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);let amount=0;if(category==="ค่าตั๋วเรือ")amount=daily.flatMap(passengersOf).reduce((sum,p)=>sum+money(p.program?.qty||1)*money(p.program?.price),0);else if(category==="มัดจำ")amount=daily.reduce((sum,b)=>sum+money(b.depositAmount),0);else if(category==="ขายเชื่อ")amount=daily.reduce((sum,b)=>sum+money(b.creditAmount),0);else if(category==="รวมรายได้")amount=daily.reduce((sum,b)=>sum+money(b.totalAmount),0);else amount=daily.flatMap(passengersOf).flatMap(p=>[...(p.preAddOns||[]).filter(a=>a.selected),...(p.islandAddOns||[])]).filter(a=>incomeCategory(a.name)===category).reduce((sum,a)=>sum+money(a.qty||1)*money(a.price),0);return[day,amount]}))}));
  const standardExpenseCategories=[
    {code:"boat_fee",name:"ค่าธรรมเนียมเรือ"},{code:"thai_adult_fee",name:"คนไทย - ผู้ใหญ่"},{code:"thai_child_fee",name:"คนไทย - เด็ก"},
    {code:"foreign_adult_fee",name:"ต่างชาติ - ผู้ใหญ่"},{code:"foreign_child_fee",name:"ต่างชาติ - เด็ก"},{code:"tent_fee",name:"ค่าธรรมเนียมกางเต็นท์ (ยอดรวม)"},{code:"ice",name:"ค่าน้ำแข็งประจำวัน"}
  ];
  const knownCodes=new Set(standardExpenseCategories.map(item=>item.code)),customExpenseCategories=[];
  for(const item of expenseRows||[]){const code=item.category_code||item.categoryCode||"other",name=item.category_name_snapshot||item.categoryName||"ค่าใช้จ่ายอื่น";if(!knownCodes.has(code)&&!customExpenseCategories.some(row=>row.code===code&&row.name===name))customExpenseCategories.push({code,name})}
  const expenseMatrix=[...standardExpenseCategories,...customExpenseCategories].map(category=>({category:category.name,values:Object.fromEntries(days.map(day=>[day,(expensesByDay.get(day)||[]).filter(item=>(item.category_code||item.categoryCode||"other")===category.code&&(knownCodes.has(category.code)||(item.category_name_snapshot||item.categoryName||"ค่าใช้จ่ายอื่น")===category.name)).reduce((sum,item)=>sum+money(item.amount),0)]))}));
  const arrivalEntries=movements(bookings,date).filter(row=>row.movement==="arrival"),usedEquipment=equipmentSummary(arrivalEntries),equipmentByCode=new Map(usedEquipment.map(item=>[item.code,item]));
  const equipment=[...(masterAddOns||[]).map(item=>equipmentByCode.get(item.addon_id)||{code:item.addon_id,name:item.addon_name,qty:0}),...usedEquipment.filter(item=>!(masterAddOns||[]).some(master=>master.addon_id===item.code))];
  const arrivalPeople=arrivalEntries.flatMap(({booking})=>passengersOf(booking)),accommodationItems=(masterAccommodations||[]).map(item=>({code:item.accommodation_id,name:item.accommodation_name,qty:arrivalPeople.filter(person=>person.accommodationId===item.accommodation_id).length}));
  return{
    title:"Management / CEO Daily & 7-Day Forecast",
    purpose:"สรุปภาพรวมสำหรับ CEO และผู้บริหาร พร้อมประมาณการ 7 วัน",
    rows,
    summary:{
      bookings:today.bookings,
      pax:today.pax,
      arrivals:movements(bookings,date).filter(row=>row.movement==="arrival").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      departures:movements(bookings,date).filter(row=>row.movement==="departure").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      expectedRevenue:today.expectedRevenue,
      deposits:today.deposits,
      actualReceived:today.actualReceived,
      outstanding:today.outstanding,
      sevenDayExpected:rows.reduce((sum,row)=>sum+row.expectedRevenue,0),operatingExpenses:today.operatingExpenses||0,netAfterExpenses:today.netAfterExpenses||0,totalOperatingExpenses:rows.reduce((sum,row)=>sum+row.operatingExpenses,0),totalNetAfterExpenses:rows.reduce((sum,row)=>sum+row.netAfterExpenses,0),
    },
    range:{from:date,to:toDate},incomeMatrix,expenseMatrix,expenseDetails:(expenseRows||[]).map(item=>({date:item.expense_date||item.expenseDate,name:item.category_name_snapshot||item.categoryName||"ค่าใช้จ่าย",qty:Number(item.qty||0),unitPrice:money(item.unit_price??item.unitPrice),amount:money(item.amount)})),
    equipment,
    accommodation:accommodationSummary(arrivalEntries),accommodationItems
  };
}

const passengerCounts=booking=>passengersOf(booking).reduce((counts,person)=>{const type=person.passengerType||"adult";counts[type]=(counts[type]||0)+1;return counts},{adult:0,child:0,infant:0,foc:0});
const uniqueValues=(people,getter)=>[...new Set(people.map(getter).filter(Boolean))].join(", ");
const programShort=name=>String(name||"").replace(/(\d+)\s*(?:วัน|days?)\s*(\d+)\s*(?:คืน|nights?)/gi,"$1D$2N");
function dailyRegisterSummary(bookings,date){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),totals={adult:0,child:0,infant:0,foc:0};
  const rows=daily.map((booking,index)=>{const people=passengersOf(booking),counts=passengerCounts(booking);for(const key of Object.keys(totals))totals[key]+=counts[key];return{no:index+1,leader:leaderName(booking),returnDate:booking.returnDate||"",adult:counts.adult,child:counts.child,infant:counts.infant,foc:counts.foc,program:uniqueValues(people,p=>programShort(p.program?.name)),island:uniqueValues(people,p=>p.island),accommodation:uniqueValues(people,p=>p.accommodationName),transportation:uniqueValues(people,p=>p.transportationMethod)||booking.transportationMethod||"",agent:booking.agentName||"",note:booking.bookingNote||""}});
  return{date,type:"register_summary",title:"ใบสรุปยอดยืนยันการจอง",purpose:"รายงานประจำวัน",rows,registerTotals:totals,manualTotals:{guide:"",mogan:"",parkOfficer:"",grandTotal:""},summary:{bookings:daily.length,pax:Object.values(totals).reduce((sum,value)=>sum+value,0)}};
}
function rangeRegisterSummary(bookings,date,toDate){
  const selected=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate),totals={adult:0,child:0,infant:0,foc:0};
  const rows=selected.sort((a,b)=>String(a.travelDate).localeCompare(String(b.travelDate))||String(a.bookingCode).localeCompare(String(b.bookingCode))).map((booking,index)=>{const people=passengersOf(booking),counts=passengerCounts(booking);for(const key of Object.keys(totals))totals[key]+=counts[key];return{no:index+1,travelDate:booking.travelDate||"",leader:leaderName(booking),returnDate:booking.returnDate||"",adult:counts.adult,child:counts.child,infant:counts.infant,foc:counts.foc,program:uniqueValues(people,p=>programShort(p.program?.name)),island:uniqueValues(people,p=>p.island),accommodation:uniqueValues(people,p=>p.accommodationName),transportation:uniqueValues(people,p=>p.transportationMethod)||booking.transportationMethod||"",agent:booking.agentName||"",note:booking.bookingNote||""}});
  return{date,type:"register_summary_range",title:"ใบสรุปยอดยืนยันการจอง (ช่วงวันที่)",purpose:`รายงานช่วงวันที่ ${date} ถึง ${toDate}`,range:{from:date,to:toDate},rows,registerTotals:totals,manualTotals:{guide:"",mogan:"",parkOfficer:"",grandTotal:""},summary:{bookings:selected.length,pax:Object.values(totals).reduce((sum,value)=>sum+value,0)}};
}
function dailyReceiptSummary(bookings,date,paymentMethods){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),totals={depositCash:0,depositTransfer:0,creditCash:0,creditTransfer:0,balanceCash:0,balanceTransfer:0,totalCash:0,totalTransfer:0,grandTotal:0};
  const rows=daily.map((booking,index)=>{const deposit=money(booking.depositAmount),credit=money(booking.creditAmount),balance=Math.max(money(booking.totalAmount)-deposit-credit,0),row={no:index+1,agent:booking.agentName||"",leader:leaderName(booking),program:uniqueValues(passengersOf(booking),p=>programShort(p.program?.name)),depositCash:0,depositTransfer:0,creditCash:0,creditTransfer:0,balanceCash:0,balanceTransfer:0,totalCash:0,totalTransfer:0,grandTotal:money(booking.totalAmount)};row[`deposit${paymentKind(booking.depositPaymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=deposit;row[`credit${paymentKind(booking.creditPaymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=credit;row[`balance${paymentKind(booking.paymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=balance;row.totalCash=row.depositCash+row.creditCash+row.balanceCash;row.totalTransfer=row.depositTransfer+row.creditTransfer+row.balanceTransfer;for(const key of Object.keys(totals))totals[key]+=row[key];return row});
  return{date,type:"receipt_summary",title:"ใบสรุปยอดใบสำคัญรับเงิน",purpose:"รายงานประจำวัน",rows,receiptTotals:totals,summary:{bookings:daily.length,pax:daily.reduce((sum,booking)=>sum+passengersOf(booking).length,0)}};
}
function dailyEquipmentSummary(bookings,date){const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),groups=new Map();for(const booking of daily)for(const person of passengersOf(booking))for(const addon of person.preAddOns||[]){if(addon.selected===false)continue;const key=addon.id||addon.name||"other",qty=money(addon.qty||1),amount=qty*money(addon.price),row=groups.get(key)||{name:addon.name||key,qty:0,total:0};row.qty+=qty;row.total+=amount;groups.set(key,row)}const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"th")).map((row,index)=>({no:index+1,...row,unitPrice:row.qty?row.total/row.qty:0}));return{date,type:"equipment_summary",title:"รายงานรวมยอดอุปกรณ์",purpose:"รายการเบิกอุปกรณ์ประจำวัน",rows,equipmentTotals:{qty:rows.reduce((sum,row)=>sum+row.qty,0),amount:rows.reduce((sum,row)=>sum+row.total,0)},summary:{bookings:daily.length,pax:rows.reduce((sum,row)=>sum+row.qty,0)}}}

export function buildPrintCenterReport({bookings=[],financialRows=[],expenseRows=[],paymentMethods=[],masterAddOns=[],masterAccommodations=[],date,toDate,type}){
  const active=bookings.filter(activeBooking);
  toDate=toDate||(type==="management"?isoDate(date,6):date);
  const selectedDays=reportDays(date,toDate),entries=selectedDays.flatMap(day=>movements(active,day).map(row=>({...row,date:day})));
  const arrivals=entries.filter(row=>row.movement==="arrival");
  if(type==="register_summary")return dailyRegisterSummary(active,date);
  if(type==="register_summary_range")return rangeRegisterSummary(active,date,toDate);
  if(type==="receipt_summary")return dailyReceiptSummary(active,date,paymentMethods);
  if(type==="equipment_summary")return dailyEquipmentSummary(active,date);
  if(type==="management")return{date,type,...managementReport(active,financialRows,expenseRows,date,toDate,masterAddOns,masterAccommodations)};
  if(type==="tour_expense_reference")return tourExpenseReferenceReport(active,date,toDate,paymentMethods);
  if(type==="tent_fee_reference")return tentFeeReferenceReport(active,date,toDate);
  if(type==="van_daily_reference")return vanDailyReferenceReport(active,date,toDate,paymentMethods);
  if(type==="van_work_order_reference")return vanWorkOrderReferenceReport(active,date,toDate,paymentMethods);
  if(type==="tour_monthly_reference")return tourMonthlyReferenceReport(active,date,toDate,paymentMethods);
  if(type==="van_monthly_reference")return vanMonthlyReferenceReport(active,date,toDate,paymentMethods);

  let title="",purpose="",rows=[],insuranceSummary=null;
  if(type==="counter"){
    title="Counter Daily Booking Report";
    purpose="ตรวจรายการจอง ติดต่อผู้โดยสาร และติดตามสถานะหน้าเคาน์เตอร์";
    rows=active.filter(booking=>booking.travelDate>=date&&booking.travelDate<=toDate).map(booking=>({
      date:booking.travelDate,
      bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",email:booking.contactEmail||"",
      pax:passengersOf(booking).length,status:booking.status,paymentMethod:booking.paymentMethod||"",
      transportationMethod:booking.transportationMethod||"",
      totalAmount:money(booking.totalAmount),depositAmount:money(booking.depositAmount),
      depositPaymentMethod:booking.depositPaymentMethod||booking.paymentMethod||"",creditAmount:money(booking.creditAmount),creditPaymentMethod:booking.creditPaymentMethod||"",
      balanceAmount:Math.max(money(booking.totalAmount)-money(booking.depositAmount)-money(booking.creditAmount),0),
      agent:booking.agentName||booking.source||""
    }));
  }else if(type==="boat"){
    title="Boat Passenger Manifest";
    purpose="รายชื่อและจำนวนผู้โดยสารสำหรับทีมเรือ แยกเที่ยวลงเกาะและขึ้นจากเกาะ";
    rows=passengerRows(entries,{includeHealth:true});
  }else if(type==="island"){
    title="Island Arrival & Departure Report";
    purpose="รายชื่อผู้ลงเกาะและผู้ขึ้นจากเกาะสำหรับพนักงานประจำเกาะ";
    rows=passengerRows(entries,{includeHealth:true});
  }else if(type==="insurance"){
    title="ใบส่งประกัน";
    purpose="รายชื่อผู้เดินทางสำหรับส่งทำประกัน แยกตามหัวหน้าทริป";
    const people=arrivals.flatMap(({booking})=>passengersOf(booking));
    const isChildTitle=person=>["เด็กชาย","เด็กหญิง"].includes(String(person.title||"").trim());
    insuranceSummary={adult:people.filter(person=>!isChildTitle(person)).length,child:people.filter(isChildTitle).length,total:people.length};
    rows=arrivals.flatMap(({booking})=>passengersOf(booking).map((person,index)=>({leader:index===0?leaderName(booking):"",passenger:personName(person)})));
  }else if(type==="driver"){
    title="Driver Transfer Report";
    purpose="รายการรับส่งหัวหน้ากลุ่ม เบอร์ติดต่อ และจำนวนผู้โดยสาร";
    rows=entries.map(({booking,direction,date})=>({
      date:date||booking.travelDate,direction,bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",
      pax:passengersOf(booking).length,program:[...new Set(passengersOf(booking).map(person=>person.program?.name).filter(Boolean))].join(", "),
      island:[...new Set(passengersOf(booking).map(person=>person.island).filter(Boolean))].join(", "),
      accommodation:[...new Set(passengersOf(booking).map(person=>person.accommodationName).filter(Boolean))].join(", "),
      note:booking.bookingNote||""
    }));
  }else{
    throw new Error("Invalid report type");
  }

  const uniqueBookings=new Map(entries.map(({booking})=>[booking.bookingCode,booking]));
  const reportBookings=type==="counter"?active.filter(booking=>booking.travelDate>=date&&booking.travelDate<=toDate):[...uniqueBookings.values()];
  const reportPax=["counter","driver"].includes(type)?reportBookings.reduce((sum,booking)=>sum+passengersOf(booking).length,0):rows.length;
  return{
    date,type,title,purpose,range:{from:date,to:toDate},rows,equipment:equipmentSummary(arrivals),accommodation:accommodationSummary(arrivals),insuranceSummary,
    summary:{
      bookings:reportBookings.length,
      pax:reportPax,
      arrivals:arrivals.reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      departures:entries.filter(row=>row.movement==="departure").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      expectedRevenue:reportBookings.reduce((sum,booking)=>sum+money(booking.totalAmount),0)
    }
  };
}
