# Deploying to Vercel with your own Supabase

## 1. Supabase (one time)

Open your Supabase project (`hrvrinjsabwzgrvqpdxp`) → SQL Editor → New query, paste
`supabase/setup-your-supabase.sql` and run it. It creates the `app_state` table, the
private `uploads` storage bucket, and locks both to the service role.

## 2. Environment variables

The Supabase URL and publishable key have hardcoded fallbacks in
`src/integrations/supabase/env.ts` (both are public values), so the app runs anywhere
without extra config. The service role key must be supplied as an env var.

In Vercel → Project Settings → Environment Variables add:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://hrvrinjsabwzgrvqpdxp.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_...` key |
| `SUPABASE_URL` | same URL (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | same publishable key (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_...` / service role key (never exposed to the browser) |

In Lovable the service role key is stored as the secret `APP_SUPABASE_SERVICE_ROLE_KEY`
(the `SUPABASE_`/`VITE_` prefixes are reserved here), and the code accepts either name.

## 3. Vercel build settings

- Framework preset: **Other / Vite**
- Install command: `bun install` (or `npm install`)
- Build command: `npm run build`
- Output: handled by TanStack Start's Nitro output — no custom output directory needed.

## 4. Workflow

Edit in Lovable → sync to GitHub (Lovable → GitHub) → Vercel deploys from that repo.
