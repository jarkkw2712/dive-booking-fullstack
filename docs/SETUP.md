# Setup

1. Supabase SQL Editor:
   - run database/schema.sql
   - run database/seed.sql

2. Render backend:
   - deploy backend/
   - set env from backend/.env.example
   - SUPABASE_URL must not include /rest/v1
   - set real SUPABASE_SERVICE_ROLE_KEY

3. Vercel frontend:
   - deploy frontend/
   - API base is in frontend/js/api.js

Login:
admin / 1234

This version includes:
- Mobile responsive menu
- Booking
- Booking List
- Print Center
- Receipt/Voucher/Invoice
- Company Profile
- Master Data
- User Management
- Permission Matrix
