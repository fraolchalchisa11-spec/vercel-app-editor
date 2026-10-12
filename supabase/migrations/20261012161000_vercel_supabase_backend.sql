-- Dedicated Supabase backend for BTR app.
-- Keep app state and uploaded files inaccessible to browser roles.
CREATE TABLE IF NOT EXISTS public.app_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_state FROM anon, authenticated;
GRANT ALL ON TABLE public.app_state TO service_role;

DROP POLICY IF EXISTS "app_state_service_role_only" ON public.app_state;
CREATE POLICY "app_state_service_role_only"
  ON public.app_state
  FOR ALL
  USING (false)
  WITH CHECK (false);

INSERT INTO public.app_state (id, data)
VALUES ('main', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

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
