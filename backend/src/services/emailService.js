import nodemailer from "nodemailer";

let transporter;
function getTransporter(){
  if(transporter)return transporter;
  const host=process.env.SMTP_HOST,port=Number(process.env.SMTP_PORT||587),user=process.env.SMTP_USER,pass=process.env.SMTP_PASSWORD;
  if(!host||!user||!pass||!process.env.SMTP_FROM)throw new Error("SMTP is not configured");
  transporter=nodemailer.createTransport({
    host,port,
    secure:process.env.SMTP_SECURE==="true"||port===465,
    pool:true,
    connectionTimeout:10_000,
    greetingTimeout:10_000,
    socketTimeout:20_000,
    auth:{user,pass}
  });
  return transporter;
}

function publicFrontendUrl(){
  const explicit=String(process.env.FRONTEND_PUBLIC_URL||"").replace(/\/$/,"");
  if(explicit)return explicit;
  return (process.env.FRONTEND_ORIGIN||"").split(",").map(x=>x.trim()).find(x=>/^https:\/\//.test(x))?.replace(/\/$/,"")||"";
}

export async function sendPasswordResetEmail({email,displayName,token}){
  const baseUrl=publicFrontendUrl();
  if(!baseUrl)throw new Error("FRONTEND_PUBLIC_URL is not configured");
  const resetUrl=`${baseUrl}/?reset_token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
    from:process.env.SMTP_FROM,to:email,
    subject:"ตั้งรหัสผ่านใหม่ — Sabina Tour Booking",
    text:`สวัสดี ${displayName||""}\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ภายใน 30 นาที:\n${resetUrl}\n\nหากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ให้ละเว้นอีเมลนี้`,
    html:`<p>สวัสดี</p><p>เปิดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ภายใน 30 นาที:</p><p><a href="${resetUrl}">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ให้ละเว้นอีเมลนี้</p>`
  });
}

