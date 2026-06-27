Dive Booking V2.11 Phase 1

เพิ่ม:
- System Admin / Data Center
- Data Tables: bookings, passengers, add-ons, audit logs, master data, permissions
- Export Backup JSON
- Import Backup JSON
- Reset เฉพาะส่วน
- Factory Reset
- Validation ก่อน Save

บัญชีทดสอบ:
admin / 1234
counter / 1234
island / 1234
boat / 1234
manager / 1234


Phase 2 added:
- database/schema.sql
- database/seed.sql
- database/rls.sql
- docs/PHASE2_DATABASE_SETUP.md
- docs/LOCALSTORAGE_TO_DATABASE_MAPPING.md
- dataService.js scaffold


Phase 2B added:
- supabase-config.js
- dataService.js
- database/rpc.sql
- migrationTool.js
- docs/PHASE2B_SUPABASE_ADAPTER_SETUP.md


Phase 2C added:
- booking save/update/cancel now call DataService adapter
- manage/print list reload via adapter
- backup export reads via adapter
- docs/PHASE2C_DATA_SERVICE_CONNECTED.md


Phase 2D added:
- authService.js
- Supabase Auth scaffold
- role permission load/save through DataService
- master data load/save through DataService
- database/auth_setup.sql
- docs/PHASE2D_AUTH_PERMISSIONS_MASTERDATA.md

Phase 2 is now complete as a scaffold.


V2.16 Debug added:
- Test Supabase Connection button
- DataService.testConnection()
- console logs for Supabase save
- fixed current_app_user_id fallback in database/rpc.sql
- docs/SUPABASE_DEBUG_CHECKLIST.md
