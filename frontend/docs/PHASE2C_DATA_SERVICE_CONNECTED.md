# Phase 2C: Frontend Data Service Connection

This version starts connecting the frontend to `DataService`.

## What changed

Previously, the UI directly used:

```js
localStorage.getItem("bookings")
localStorage.setItem("bookings")
```

Now the main booking workflow uses adapter functions:

```js
loadBookingCache()
persistNewBooking()
persistUpdatedBooking()
persistCancelBooking()
```

These call `DataService` when available.

## Modes

### localStorage mode

Default:

```js
APP_CONFIG.DATA_MODE = "localStorage"
```

No setup required.

### Supabase mode

Edit `supabase-config.js`:

```js
APP_CONFIG.DATA_MODE = "supabase"
APP_CONFIG.SUPABASE_URL = "..."
APP_CONFIG.SUPABASE_ANON_KEY = "..."
```

Then run SQL:

1. `database/schema.sql`
2. `database/seed.sql`
3. `database/rpc.sql`

## Connected flows

- Save new booking
- Update booking
- Cancel booking
- Manage booking list
- Print booking list
- Export backup reads through DataService

## Still local/prototype

These parts are not fully migrated yet:

- Auth/login is still frontend mock.
- Master data UI still mostly reads local structure.
- Permission matrix still uses localStorage.
- Report rendering uses cached booking list.

## Next Phase 2D

- Replace mock login with Supabase Auth.
- Load role permissions from database.
- Load master data from Supabase.
- Remove frontend password list.
