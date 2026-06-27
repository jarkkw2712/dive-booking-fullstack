# Phase 2D: Supabase Auth + Permissions + Master Data

This completes Phase 2 scaffolding.

## Added

- `authService.js`
- `APP_CONFIG.AUTH_MODE`
- Supabase Auth login adapter
- role permissions loader through DataService
- master data loader/saver through DataService
- `database/auth_setup.sql`

## Modes

Default is still safe prototype mode:

```js
DATA_MODE: "localStorage"
AUTH_MODE: "mock"
```

Production target:

```js
DATA_MODE: "supabase"
AUTH_MODE: "supabase"
```

## Supabase Auth Setup

1. Create users in Supabase Auth.
2. Link `auth.users.id` to `app_users.auth_user_id`.
3. In `supabase-config.js`, set:

```js
APP_CONFIG.DATA_MODE = "supabase"
APP_CONFIG.AUTH_MODE = "supabase"
```

4. Login username becomes email.

## Current Limitations

This is still a frontend prototype.

For production:
- RLS policies must be tested carefully.
- Do not expose service_role key.
- Consider moving complex writes to Edge Functions or backend API.
- Add server-side audit guarantees.
- Add payment/LINE jobs on backend, not frontend.
