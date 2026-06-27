# Sprint 1.5 User + Permission Management

เพิ่ม:
- หน้า User Management
- หน้า Permission Matrix
- API:
  - GET /api/users
  - POST /api/users
  - PUT /api/users/:userId
  - GET /api/roles
  - GET /api/permissions/matrix
  - PUT /api/permissions/matrix
- เพิ่ม role:
  - finance
  - ceo
- เพิ่ม permission:
  - manageUsers

Deploy:
- Vercel: ต้อง redeploy frontend
- Render: ต้อง redeploy backend
- Supabase: ต้องรัน SQL ใหม่:
  1. database/seed.sql

หมายเหตุ:
- ตอนนี้ password ยังใช้ DEMO_PASSWORD จาก backend .env
- ขั้นถัดไปควรทำ Supabase Auth หรือ password_hash จริง
