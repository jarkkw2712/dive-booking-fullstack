# Sprint 1.3 System Setting / Company Profile

เพิ่ม:
- หน้า Company Setting
- เก็บข้อมูลบริษัทใน Supabase table `company_profile`
- API:
  - GET /api/company-profile
  - PUT /api/company-profile
- Receipt/Voucher/Invoice ดึงข้อมูลบริษัทจาก company_profile ผ่าน local cache
- รองรับ logo_url, signature_url, stamp_url, bank, promptpay

Deploy:
- Vercel: ต้อง redeploy frontend
- Render: ต้อง redeploy backend เพราะเพิ่ม route ใหม่
- Supabase: ต้องรัน SQL ใหม่:
  1. database/schema.sql
  2. database/seed.sql
