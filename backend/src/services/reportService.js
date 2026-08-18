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
    tentCreditDue:people.reduce((sum,person)=>sum+Number(person.tentCreditAmount||0),0),
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
    pickupLocation:person.pickupLocation||"",transportationMethod:person.transportationMethod||booking.transportationMethod||"",transportationAmount:money(person.transportationAmount),
    program:person.program?.name||"",
    island:person.island||"",
    accommodation:person.accommodationName||accommodationLabel[person.parkAccommodationType||"none"]||"",
    accommodationBookedBy:person.accommodationId?(person.accommodationBookedBy==="company"?"จองให้":"ลูกค้าจองเอง"):"",
    accommodationReference:person.parkAccommodationReference||"",
    accommodationArrangement:person.accommodationId?(person.accommodationBookedBy==="company"?"จองให้":"ลูกค้าจองเอง"):"",
    tentCreditAmount:Number(person.tentCreditAmount||0),
    ...(includeHealth?{foodAllergy:person.foodAllergy||"",medicalNote:person.medicalNote||""}:{}),
    status:booking.status
  })));
}

function financeMap(financialRows){
  return new Map((financialRows||[]).map(row=>[row.booking_code||row.bookingCode,row]));
}

const reportDays=(from,to)=>{const days=[];for(let day=from;day<=to&&days.length<366;day=isoDate(day,1))days.push(day);return days};
const incomeCategory=name=>{const value=String(name||"").toLowerCase();if(value.includes("น้ำแข็ง"))return"น้ำแข็ง";if(value.includes("น้ำเกาะ"))return"ค่าน้ำเกาะ";if(value.includes("น้ำ"))return"ค่าน้ำ";if(value.includes("หน้ากาก"))return"หน้ากาก";if(value.includes("ชูชีพ"))return"ชูชีพ";if(value.includes("ฟิน")||value.includes("ตีนกบ"))return"ฟิน";if(value.includes("เต็นท์"))return"เต็นท์";if(value.includes("เหมาเรือ"))return"เหมาเรือ";if(value.includes("ระวาง"))return"ค่าระวาง";return"อื่นๆ"};
function managementReport(bookings,financialRows,date,toDate=date){
  const finances=financeMap(financialRows);
  const days=reportDays(date,toDate);
  const rows=days.map(day=>{
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);
    const dailyArrivals=daily.map(booking=>({booking,direction:"ลงเกาะ",movement:"arrival"}));
    const lodging=accommodationSummary(dailyArrivals);
    const expectedRevenue=daily.reduce((sum,booking)=>sum+money(booking.totalAmount),0);
    const deposits=daily.reduce((sum,booking)=>sum+money(booking.depositAmount),0);
    const actualReceived=daily.reduce((sum,booking)=>sum+money(finances.get(booking.bookingCode)?.net_cash_received),0);
    return{
      date:day,
      bookings:daily.length,
      pax:daily.reduce((sum,booking)=>sum+passengersOf(booking).length,0),
      pending:daily.filter(booking=>booking.status==="pending").length,
      confirmed:daily.filter(booking=>booking.status==="confirmed").length,
      checkedIn:daily.filter(booking=>booking.status==="checked-in").length,
      parkHouse:lodging.parkHouse,
      parkTent:lodging.parkTent,
      equipmentUnits:equipmentSummary(dailyArrivals).reduce((sum,item)=>sum+item.qty,0),
      tentCreditDue:lodging.tentCreditDue,
      expectedRevenue,
      deposits,
      actualReceived,
      outstanding:Math.max(expectedRevenue-actualReceived,0)
    };
  });
  const today=rows[0]||{};
  const categoryNames=["ค่าตั๋วเรือ","มัดจำ","ขายเชื่อ","ค่าน้ำ","ค่าน้ำเกาะ","หน้ากาก","ชูชีพ","ฟิน","น้ำแข็ง","เต็นท์","เหมาเรือ","ค่าระวาง","อื่นๆ","รวมรายได้"];
  const incomeMatrix=categoryNames.map(category=>({category,values:Object.fromEntries(days.map(day=>{const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);let amount=0;if(category==="ค่าตั๋วเรือ")amount=daily.flatMap(passengersOf).reduce((sum,p)=>sum+money(p.program?.qty||1)*money(p.program?.price),0);else if(category==="มัดจำ")amount=daily.reduce((sum,b)=>sum+money(b.depositAmount),0);else if(category==="ขายเชื่อ")amount=daily.reduce((sum,b)=>sum+money(b.creditAmount),0);else if(category==="รวมรายได้")amount=daily.reduce((sum,b)=>sum+money(b.totalAmount),0);else amount=daily.flatMap(passengersOf).flatMap(p=>[...(p.preAddOns||[]).filter(a=>a.selected),...(p.islandAddOns||[])]).filter(a=>incomeCategory(a.name)===category).reduce((sum,a)=>sum+money(a.qty||1)*money(a.price),0);return[day,amount]}))}));
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
      sevenDayExpected:rows.reduce((sum,row)=>sum+row.expectedRevenue,0),
      sevenDayTentCredit:rows.reduce((sum,row)=>sum+row.tentCreditDue,0)
    },
    range:{from:date,to:toDate},incomeMatrix,
    equipment:equipmentSummary(movements(bookings,date).filter(row=>row.movement==="arrival")),
    accommodation:accommodationSummary(movements(bookings,date).filter(row=>row.movement==="arrival"))
  };
}

export function buildPrintCenterReport({bookings=[],financialRows=[],date,toDate,type}){
  const active=bookings.filter(activeBooking);
  toDate=toDate||(type==="management"?isoDate(date,6):date);
  const selectedDays=reportDays(date,toDate),entries=selectedDays.flatMap(day=>movements(active,day).map(row=>({...row,date:day})));
  const arrivals=entries.filter(row=>row.movement==="arrival");
  if(type==="management")return{date,type,...managementReport(active,financialRows,date,toDate)};

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
    const titleCounts=people.reduce((counts,person)=>{const title=person.title||"ไม่ระบุคำนำหน้า";counts[title]=(counts[title]||0)+1;return counts},{});
    insuranceSummary={adult:people.filter(person=>(person.passengerType||"adult")==="adult").length,child:people.filter(person=>person.passengerType==="child").length,infant:people.filter(person=>person.passengerType==="infant").length,foc:people.filter(person=>person.passengerType==="foc").length,total:people.length,titleCounts};
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
