# Dive Booking Fullstack V2 Latest Setup

เวอร์ชันนี้ใช้ UI/Feature ล่าสุดจาก prototype แต่เปลี่ยน data layer เป็น:

```text
Frontend ล่าสุด → Backend API → Supabase PostgreSQL
```

## 1) Supabase

เข้า Supabase → SQL Editor แล้วรันเรียงตามนี้:

```text
database/schema.sql
database/seed.sql
database/rpc.sql
```

ถ้าเคยรันแล้ว รันซ้ำได้

## 2) Backend

เปิด terminal:

```bash
cd backend
npm install
copy .env.example .env
```

แก้ `.env`:

```env
PORT=3000
FRONTEND_ORIGIN=http://127.0.0.1:5500
JWT_SECRET=ใส่ข้อความยาวๆ อะไรก็ได้
DEMO_PASSWORD=1234

SUPABASE_URL=https://iythuzkmjjshwciooaum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=เอา service_role key จาก Supabase มาใส่
```

สำคัญ:
- `SUPABASE_URL` ห้ามมี `/rest/v1`
- `SERVICE_ROLE_KEY` อยู่เฉพาะ backend `.env`
- ห้ามใส่ service_role key ใน frontend

รัน backend:

```bash
npm run dev
```

เช็ก:

```text
http://localhost:3000/api/health
```

## 3) Frontend

เปิด:

```text
frontend/index.html
```

ด้วย Live Server

Login:

```text
admin / 1234
```

## 4) Test

1. สร้าง Booking
2. กด Save
3. ไป Supabase Table Editor
4. ดูตาราง:
   - bookings
   - passengers
   - booking_programs
   - booking_addons
   - audit_logs

## 5) ถ้าเจอ CORS

ดู `.env`:

```env
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

ถ้า Live Server เป็น port อื่น เช่น 5501 ให้แก้ให้ตรง
