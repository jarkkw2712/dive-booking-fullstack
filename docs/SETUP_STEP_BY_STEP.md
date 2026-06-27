# Dive Booking Fullstack V1 Setup

## Architecture

Frontend → Backend API → Supabase PostgreSQL

Browser no longer writes database directly.

## Step 1: Supabase

In Supabase SQL Editor run:

1. `database/schema.sql`
2. `database/seed.sql`
3. `database/rpc.sql`

## Step 2: Backend

Open terminal:

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=any-long-random-text
DEMO_PASSWORD=1234
```

Important: service_role key must stay only in backend `.env`.

Run:

```bash
npm run dev
```

Backend should run at:

```text
http://dive-booking-api.onrender.com
```

Test:

```text
http://dive-booking-api.onrender.com/api/health
```

## Step 3: Frontend

Open `frontend/index.html` with Live Server.

Login:

```text
admin / 1234
```

Then create booking.

## Step 4: Check Supabase

Open Table Editor:

- bookings
- passengers
- booking_programs
- booking_addons
- audit_logs

You should see rows after saving.

## Notes

This is still a development version, but the architecture is now correct for real business use.

Next phases:
- Real Supabase Auth or password hashes
- PDF receipt generation
- LINE daily scheduler
- Bank payment API
- Deployment to Render/Railway/Vercel
