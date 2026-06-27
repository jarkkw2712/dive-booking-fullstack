# Phase 2: Database Layer

This folder contains the PostgreSQL/Supabase database design.

## Files

- `schema.sql` — creates tables, views, constraints, duplicate passenger trigger.
- `seed.sql` — inserts roles, default programs, add-ons, permissions, prototype users.
- `rls.sql` — draft Supabase Row Level Security policies.

## Recommended Setup on Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `schema.sql`.
4. Run `seed.sql`.
5. After connecting Supabase Auth users, run and adjust `rls.sql`.
6. Export current localStorage backup from System Admin.
7. Migrate backup JSON into these tables.

## Current Prototype vs Phase 2

Current prototype:
- Stores data in browser localStorage.
- Login is mock frontend login.
- Permissions are frontend-based.

Phase 2 target:
- PostgreSQL stores real data.
- Supabase Auth handles real login.
- Role permissions are stored in database.
- Audit logs use real users.
- Duplicate passenger checks are enforced at database level.

## Next Step

The next development step is creating a `dataService.js` adapter:
- localStorage mode for prototype
- Supabase mode for production

That lets the same UI use either storage backend.
