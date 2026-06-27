# Supabase Debug Checklist

1. เปิด `supabase-config.js`

ต้องเป็น:

```js
DATA_MODE: "supabase",
AUTH_MODE: "mock",
```

2. ใส่ URL/Key ให้ถูก

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "..."
```

ใช้ anon/publishable key เท่านั้น

3. ใน Supabase SQL Editor รันตามลำดับ:

```text
database/schema.sql
database/seed.sql
database/rpc.sql
```

ถ้าเคยรัน `rpc.sql` เก่า ให้รัน `rpc.sql` เวอร์ชันนี้ทับอีกครั้ง

4. เปิดเว็บ → Login admin / 1234

5. ไปที่ System Admin → กด Test Supabase Connection

6. เปิด F12 → Console แล้วดูผล

หรือพิมพ์เอง:

```js
APP_CONFIG
await DataService.testConnection()
```

7. ตอน Save Booking ถ้าต่อ Supabase สำเร็จ Console จะขึ้น:

```text
[DataService] Saving booking to Supabase
[DataService] Supabase save result
```
