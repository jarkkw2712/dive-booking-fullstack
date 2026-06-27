# Phase 2B: Supabase Adapter Setup

## What changed

This version adds:

- `supabase-config.js`
- `dataService.js`
- `database/rpc.sql`
- `migrationTool.js`

The app still runs in `localStorage` mode by default.

## Supabase JS

The browser build uses the official `@supabase/supabase-js@2` CDN. Supabase docs show that v2 can be installed via npm or CDN, and the browser client is initialized with project URL and anon/publishable key.

## Setup Steps

### 1. Create Supabase project

Go to Supabase and create a new project.

### 2. Run SQL

Open SQL Editor and run in order:

1. `database/schema.sql`
2. `database/seed.sql`
3. `database/rpc.sql`

Do not enable RLS yet unless you are ready to configure Supabase Auth.

### 3. Configure frontend

Open `supabase-config.js`:

```js
const APP_CONFIG = {
  DATA_MODE: "supabase",
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};
```

Use anon/publishable key only. Never use service_role key in frontend.

### 4. Open app

Run with Live Server.

### 5. Test read/write

At this stage, the UI still mostly uses old localStorage functions. The adapter is ready for the next phase where we replace internal calls with `DataService`.

You can test from browser Console:

```js
await DataService.listBookings()
```

### 6. Migrate localStorage bookings

If you have bookings in localStorage:

```js
await migrateLocalStorageBookingsToSupabase()
```

## Next Phase

Phase 2C should replace these old functions:

- `getBookings()`
- `setBookings()`
- `saveBooking()`
- `updateExistingBooking()`
- `renderManageBookings()`
- `renderPrintPage()`

with async `DataService` calls.
