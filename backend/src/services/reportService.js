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
    pickupLocation:person.pickupLocation||"",transportationMethod:person.transportationMethod||booking.transportationMethod||"",transportationAmount:money(person.transportationAmount),passengerTravelDate:person.passengerTravelDate||booking.travelDate||"",outboundDestination:person.outboundDestination||person.transportationDestination||person.pickupLocation||"",passengerReturnDate:person.passengerReturnDate||booking.returnDate||"",returnDestination:person.returnDestination||"",
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
const incomeCategory=name=>{const value=String(name||"").toLowerCase();if(value.includes("น้ำแข็ง"))return"น้ำแข็ง";if(value.includes("น้ำเกาะ"))return"ค่าน้ำเกาะ";if(value.includes("น้ำ"))return"ค่าน้ำ";if(value.includes("หน้ากาก"))return"หน้ากาก";if(value.includes("ชูชีพ"))return"ชูชีพ";if(value.includes("ฟิน")||value.includes("ตีนกบ"))return"ฟิน";if(value.includes("เต็นท์"))return"เต็นท์";if(value.includes("เหมาเรือ"))return"เหมาเรือ";if(value.includes("ระวาง"))return"ค่าระวาง";return"อื่นๆ"};
function managementReport(bookings,financialRows,expenseRows,date,toDate=date){
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
    equipment:equipmentSummary(movements(bookings,date).filter(row=>row.movement==="arrival")),
    accommodation:accommodationSummary(movements(bookings,date).filter(row=>row.movement==="arrival"))
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
const paymentKind=(name,methods)=>methods.find(method=>method.method_name===name)?.payment_type==="cash"?"cash":"transfer";
function dailyReceiptSummary(bookings,date,paymentMethods){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),totals={depositCash:0,depositTransfer:0,creditCash:0,creditTransfer:0,balanceCash:0,balanceTransfer:0,totalCash:0,totalTransfer:0,grandTotal:0};
  const rows=daily.map((booking,index)=>{const deposit=money(booking.depositAmount),credit=money(booking.creditAmount),balance=Math.max(money(booking.totalAmount)-deposit-credit,0),row={no:index+1,agent:booking.agentName||"",leader:leaderName(booking),program:uniqueValues(passengersOf(booking),p=>programShort(p.program?.name)),depositCash:0,depositTransfer:0,creditCash:0,creditTransfer:0,balanceCash:0,balanceTransfer:0,totalCash:0,totalTransfer:0,grandTotal:money(booking.totalAmount)};row[`deposit${paymentKind(booking.depositPaymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=deposit;row[`credit${paymentKind(booking.creditPaymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=credit;row[`balance${paymentKind(booking.paymentMethod,paymentMethods)==="cash"?"Cash":"Transfer"}`]=balance;row.totalCash=row.depositCash+row.creditCash+row.balanceCash;row.totalTransfer=row.depositTransfer+row.creditTransfer+row.balanceTransfer;for(const key of Object.keys(totals))totals[key]+=row[key];return row});
  return{date,type:"receipt_summary",title:"ใบสรุปยอดใบสำคัญรับเงิน",purpose:"รายงานประจำวัน",rows,receiptTotals:totals,summary:{bookings:daily.length,pax:daily.reduce((sum,booking)=>sum+passengersOf(booking).length,0)}};
}
function dailyEquipmentSummary(bookings,date){const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),groups=new Map();for(const booking of daily)for(const person of passengersOf(booking))for(const addon of person.preAddOns||[]){if(addon.selected===false)continue;const key=addon.id||addon.name||"other",qty=money(addon.qty||1),amount=qty*money(addon.price),row=groups.get(key)||{name:addon.name||key,qty:0,total:0};row.qty+=qty;row.total+=amount;groups.set(key,row)}const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"th")).map((row,index)=>({no:index+1,...row,unitPrice:row.qty?row.total/row.qty:0}));return{date,type:"equipment_summary",title:"รายงานรวมยอดอุปกรณ์",purpose:"รายการเบิกอุปกรณ์ประจำวัน",rows,equipmentTotals:{qty:rows.reduce((sum,row)=>sum+row.qty,0),amount:rows.reduce((sum,row)=>sum+row.total,0)},summary:{bookings:daily.length,pax:rows.reduce((sum,row)=>sum+row.qty,0)}}}

export function buildPrintCenterReport({bookings=[],financialRows=[],expenseRows=[],paymentMethods=[],date,toDate,type}){
  const active=bookings.filter(activeBooking);
  toDate=toDate||(type==="management"?isoDate(date,6):date);
  const selectedDays=reportDays(date,toDate),entries=selectedDays.flatMap(day=>movements(active,day).map(row=>({...row,date:day})));
  const arrivals=entries.filter(row=>row.movement==="arrival");
  if(type==="register_summary")return dailyRegisterSummary(active,date);
  if(type==="receipt_summary")return dailyReceiptSummary(active,date,paymentMethods);
  if(type==="equipment_summary")return dailyEquipmentSummary(active,date);
  if(type==="management")return{date,type,...managementReport(active,financialRows,expenseRows,date,toDate)};

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
