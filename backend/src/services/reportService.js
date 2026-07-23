const activeBooking=booking=>booking.status!=="cancelled";
const passengersOf=booking=>Array.isArray(booking.passengers)?booking.passengers:[];
const personName=person=>[person.title,person.firstName,person.lastName].filter(Boolean).join(" ");
const leaderName=booking=>[booking.leaderTitle,booking.leaderFirstName,booking.leaderLastName].filter(Boolean).join(" ");
const isoDate=(date,offset=0)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)};
const money=value=>Number(value||0);

function movements(bookings,date){
  return bookings.filter(activeBooking).flatMap(booking=>{
    const result=[];
    if(booking.travelDate===date)result.push({booking,direction:"ลงเกาะ",movement:"arrival"});
    if(booking.returnDate===date)result.push({booking,direction:"ขึ้นจากเกาะ",movement:"departure"});
    return result;
  });
}

function passengerRows(entries,{includeHealth=false}={}){
  return entries.flatMap(({booking,direction})=>passengersOf(booking).map(person=>({
    direction,
    bookingCode:booking.bookingCode,
    passenger:personName(person),
    age:person.age||"",
    phone:person.phone||booking.phone||"",
    program:person.program?.name||"",
    island:person.island||"",
    ...(includeHealth?{foodAllergy:person.foodAllergy||"",medicalNote:person.medicalNote||""}:{}),
    status:booking.status
  })));
}

function financeMap(financialRows){
  return new Map((financialRows||[]).map(row=>[row.booking_code||row.bookingCode,row]));
}

function managementReport(bookings,financialRows,date){
  const finances=financeMap(financialRows);
  const rows=Array.from({length:7},(_,offset)=>{
    const day=isoDate(date,offset);
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);
    const expectedRevenue=daily.reduce((sum,booking)=>sum+money(booking.totalAmount),0);
    const actualReceived=daily.reduce((sum,booking)=>sum+money(finances.get(booking.bookingCode)?.net_cash_received),0);
    return{
      date:day,
      bookings:daily.length,
      pax:daily.reduce((sum,booking)=>sum+passengersOf(booking).length,0),
      pending:daily.filter(booking=>booking.status==="pending").length,
      confirmed:daily.filter(booking=>booking.status==="confirmed").length,
      checkedIn:daily.filter(booking=>booking.status==="checked-in").length,
      expectedRevenue,
      actualReceived,
      outstanding:Math.max(expectedRevenue-actualReceived,0)
    };
  });
  const today=rows[0];
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
      actualReceived:today.actualReceived,
      outstanding:today.outstanding,
      sevenDayExpected:rows.reduce((sum,row)=>sum+row.expectedRevenue,0)
    },
    range:{from:date,to:isoDate(date,6)}
  };
}

export function buildPrintCenterReport({bookings=[],financialRows=[],date,type}){
  const active=bookings.filter(activeBooking);
  const entries=movements(active,date);
  const arrivals=entries.filter(row=>row.movement==="arrival");
  if(type==="management")return{date,type,...managementReport(active,financialRows,date)};

  let title="",purpose="",rows=[];
  if(type==="counter"){
    title="Counter Daily Booking Report";
    purpose="ตรวจรายการจอง ติดต่อผู้โดยสาร และติดตามสถานะหน้าเคาน์เตอร์";
    rows=active.filter(booking=>booking.travelDate===date).map(booking=>({
      bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",
      pax:passengersOf(booking).length,status:booking.status,paymentMethod:booking.paymentMethod||"",
      totalAmount:money(booking.totalAmount),agent:booking.agentName||booking.source||""
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
    title="Passenger Insurance Report";
    purpose="ข้อมูลผู้โดยสารขาไปสำหรับจัดทำประกันและตรวจข้อมูลสุขภาพ";
    rows=passengerRows(arrivals,{includeHealth:true});
  }else if(type==="driver"){
    title="Driver Transfer Report";
    purpose="รายการรับส่งหัวหน้ากลุ่ม เบอร์ติดต่อ และจำนวนผู้โดยสาร";
    rows=entries.map(({booking,direction})=>({
      direction,bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",
      pax:passengersOf(booking).length,program:[...new Set(passengersOf(booking).map(person=>person.program?.name).filter(Boolean))].join(", "),
      island:[...new Set(passengersOf(booking).map(person=>person.island).filter(Boolean))].join(", "),note:booking.bookingNote||""
    }));
  }else{
    throw new Error("Invalid report type");
  }

  const uniqueBookings=new Map(entries.map(({booking})=>[booking.bookingCode,booking]));
  const reportBookings=type==="counter"?active.filter(booking=>booking.travelDate===date):[...uniqueBookings.values()];
  const reportPax=["counter","driver"].includes(type)?reportBookings.reduce((sum,booking)=>sum+passengersOf(booking).length,0):rows.length;
  return{
    date,type,title,purpose,rows,
    summary:{
      bookings:reportBookings.length,
      pax:reportPax,
      arrivals:arrivals.reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      departures:entries.filter(row=>row.movement==="departure").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      expectedRevenue:reportBookings.reduce((sum,booking)=>sum+money(booking.totalAmount),0)
    }
  };
}
