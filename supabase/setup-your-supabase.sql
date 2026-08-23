-- ============================================================
-- BTR app: one-time setup for YOUR OWN Supabase project.
-- Run this whole file in Supabase Dashboard -> SQL Editor -> New query.
-- Safe to re-run.
-- ============================================================

-- 1. App state table (all app data lives in one JSON document,
--    reachable only through the service role in server functions).
CREATE TABLE IF NOT EXISTS public.app_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_state TO service_role;
REVOKE ALL ON public.app_state FROM anon, authenticated;

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_state readable" ON public.app_state;
DROP POLICY IF EXISTS "app_state insertable" ON public.app_state;
DROP POLICY IF EXISTS "app_state updatable" ON public.app_state;
DROP POLICY IF EXISTS "app_state_service_role_only" ON public.app_state;

-- No client (anon/authenticated) access at all; service role bypasses RLS.
CREATE POLICY "app_state_service_role_only"
ON public.app_state FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.app_state (id, data)
VALUES ('main', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Private storage bucket for uploaded images/HTML.
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Block direct client access to storage objects; files are served
--    through the app's /api/public/files/* route using the service role.
DROP POLICY IF EXISTS "uploads_no_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_delete" ON storage.objects;

CREATE POLICY "uploads_no_public_select"
ON storage.objects FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "uploads_no_public_insert"
ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "uploads_no_public_update"
ON storage.objects FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "uploads_no_public_delete"
ON storage.objects FOR DELETE TO anon, authenticated USING (false);
