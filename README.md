# Dive Booking ERP

Internal ERP using a vanilla JavaScript frontend, an Express API, and Supabase PostgreSQL.

The booking flow remains `frontend → Render API → Supabase`. Financial records are append-only business history: use void, reversal, or refund actions rather than deleting rows.

Setup and deployment instructions are in `docs/DEPLOY.md`. Never commit `.env` files or expose the Supabase service-role key to the frontend.
