# Sprint 1.4 Master Data Pro

เพิ่ม:
- หน้า Master Data Pro
- API:
  - GET /api/master-data-pro/:category
  - POST /api/master-data-pro/:category
  - PUT /api/master-data-pro/:category/:id
- Tables:
  - master_agents
  - master_boats
  - master_islands
  - master_price_reasons
  - master_payment_methods
  - master_statuses

Deploy:
- Vercel: ต้อง redeploy frontend
- Render: ต้อง redeploy backend
- Supabase: ต้องรัน SQL ใหม่:
  1. database/schema.sql
  2. database/seed.sql
