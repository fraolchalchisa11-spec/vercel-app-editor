# Connect your own Supabase project

Goal: keep editing in Lovable, deploy to Vercel, and use your existing Supabase project (database, auth, storage, realtime) as the only backend — no Lovable Cloud.

## What you'll provide

I'll open a secure form for:
- `VITE_SUPABASE_URL` — your project URL (`https://xxxx.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon/publishable key (safe in the browser)
- `SUPABASE_URL` — same URL, for server-side use
- `SUPABASE_PUBLISHABLE_KEY` — same anon key, server-side
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only, never sent to the browser)

The same values go into Vercel's Environment Variables when you deploy.

## What I'll build

1. **Supabase clients**
   - Browser client for components, auth, and realtime (respects your RLS).
   - Server publishable client for public reads inside server functions.
   - Server-only admin client (service role) for privileged work, loaded lazily so it never reaches the browser bundle.

2. **Auth**
   - Auth middleware for server functions so they act as the signed-in user.
   - Bearer-token attacher registered in `src/start.ts`.
   - A public `/auth` route (email/password sign in + sign up) and an `_authenticated/` protected layout that redirects signed-out visitors to `/auth`.
   - Session listener wired once in the root route so the app reacts to sign in/out.
   - Social providers (Google/Apple) are enabled directly in your Supabase dashboard, since your own project handles OAuth — I'll add the buttons if you want them.

3. **Storage & realtime helpers**
   - An upload/download helper hook against a Supabase Storage bucket you name.
   - A realtime subscription helper for live table updates.

4. **Types**
   - A `Database` types file so queries are typed. You can regenerate it from your Supabase project as your schema changes.

5. **Vercel readiness**
   - Confirm the build works with these env vars and document the exact variables to set in Vercel.

## Technical notes

- No Lovable Cloud is enabled; nothing writes to a Lovable-managed database.
- Migrations and SQL run in your own Supabase dashboard (SQL editor or Supabase CLI) — Lovable's migration tooling won't manage your project.
- Any table you create needs RLS enabled plus `GRANT` statements for `anon`/`authenticated`, or the Data API returns permission errors.
- Server logic uses TanStack `createServerFn` / server routes rather than Supabase Edge Functions, so it deploys with the app on Vercel.

## Open item

Tell me which schema/tables already exist (or paste your schema) and I'll generate matching types and data-access hooks. Otherwise I'll wire the clients and auth first, then add data access once the schema is in place.
