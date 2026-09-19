# Second app, same features, its own audience and its own data

## What you'll end up with

A separate Lovable project that behaves exactly like this one (notes, exams, search,
results requests, admin panel, PWA install, notifications), but with its own name,
logo and colours, its own Supabase database, and its own web address. Nothing
students or content from this app will ever appear in the new one, or the other way
round. Editing the two apps stays independent: you keep using Lovable for both.

## Step 1 — Create the new project (a few clicks, done by you)

Lovable copies a project through a "remix", which I can't trigger from chat:

1. Open this project in Lovable → click the project name at the top left → Settings.
2. Press "Remix this project".

That gives you a brand-new project with this exact code and its own chat thread.
If "Remix" is greyed out for this project, use the source zip you already have:
start a new Lovable project and upload `btr-learning-app-source.zip` as the first
message, asking it to set the app up.

Then come back to the new project and paste this instruction so its agent picks up
where this plan leaves off:

```text
Set up this copy for a new audience. I'll give you the new brand name, logo,
colours, web address and a fresh Supabase project. Rebrand the app, point it at the
new Supabase, clear all demo content, and create my admin login.
```

## Step 2 — A fresh database for it (Supabase, done by you)

1. supabase.com → New project. Any name that matches the new brand, any region
   near your students.
2. SQL Editor → New query → paste the contents of `supabase/setup-your-supabase.sql`
   → Run. This creates the single state table and the private uploads storage
   bucket with the same lock-down this app uses.
3. Project Settings → API Keys → copy the project URL, the publishable key
   (`sb_publishable_...`) and the secret/service-role key (`sb_secret_...`).

The new app is fully separate from this one at this point: different database,
different storage, different logins.

## Step 3 — Rewire the connection

In the new project:

- Replace the two hardcoded fallback values in `src/integrations/supabase/env.ts`
  (`FALLBACK_SUPABASE_URL`, `FALLBACK_SUPABASE_PUBLISHABLE_KEY`) with the new URL
  and publishable key.
- Add the new secret key as a Lovable project secret named
  `APP_SUPABASE_SERVICE_ROLE_KEY`.
- Delete the old project's Supabase migrations from `supabase/migrations/` so the
  new project's history starts clean.

## Step 4 — Rebrand it

Everything that says "BTR" or "Freshman" today gets the new identity:

| What | Where |
| --- | --- |
| Install/app name, short name, description, theme colour | `public/manifest.webmanifest` |
| Page title, description, social preview tags | `src/routes/__root.tsx`, `src/routes/index.tsx` |
| Install banner wording | `src/components/InstallPrompt.tsx` |
| Logo files (auth screen, home, viewer) | `src/assets/btr-*.png.asset.json` → replaced with new logo |
| Home screen icon, favicon, notification icon | `public/icon-192.png`, `icon-512.png`, `favicon.png` regenerated from the new logo |
| Accent colour in dark/light mode | `src/styles.css` |
| Background artwork | `public/app-background.png`, `exam-notes-background.png` swapped if you want new artwork |
| Offline cache name (so the two apps never share saved data on a phone) | `LOCAL_CACHE_KEY` and the admin session key in `src/components/BtrApp.jsx` |

I regenerate the icons from your logo file so the install prompt and the home
screen show the new mark instead of the current one.

## Step 5 — Clean start and your admin login

- The new database begins empty: no students, no notes, no exams, no announcements.
- Your admin login is created on first run inside the new app. Today's admin
  credentials live only in the Supabase record, not in the code, so the new app
  starts with none — you set the username and password yourself.
- The first admin must be created before anyone can sign in as admin; unknown
  usernames are rejected, exactly as here.

## Step 6 — Ship it separately

Deploy the new project as its own Vercel project with its own domain (a subdomain
like `newbrand.yourdomain.com` keeps the PWA install working cleanly), and set its
own environment variables:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | new project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | new publishable key |
| `SUPABASE_URL` | same URL (server side) |
| `SUPABASE_PUBLISHABLE_KEY` | same publishable key (server side) |
| `SUPABASE_SERVICE_ROLE_KEY` | new secret key (never exposed to the browser) |

Both apps keep the same edit workflow: Lovable → GitHub → Vercel auto-deploys.

## Step 7 — Check it works

Before calling it done I verify in the new app: it loads and installs as a PWA under
the new name and icon, a student can sign up and see the new brand, an admin can
sign in with the new credentials and post a note/exam, a results request reaches
the admin and the answer shows up in the student's notifications, and the current
app still behaves normally afterwards (nothing shared between them).

## What I need from you to run this

1. New brand name and short name (the one shown under the home-screen icon).
2. Logo image — square, ideally 512×512 or larger, transparent background.
3. Accent colour, or "pick one that suits the logo".
4. Confirmation that the Supabase project is created, plus the URL, publishable key
   and secret key (or you can paste them one at a time).
5. The web address you want for it.

Steps 1 and 2 above (remix, create Supabase) are clicks only you can do; everything
from Step 3 onward I can carry out once the new project exists.
