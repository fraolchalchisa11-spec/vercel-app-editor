-- ===== 20260731225146_a396ce4f-879c-46bf-8992-3574d59f05de.sql =====
CREATE TABLE public.app_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_state readable" ON public.app_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "app_state insertable" ON public.app_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "app_state updatable" ON public.app_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_state (id, data) VALUES ('main', '{}'::jsonb) ON CONFLICT (id) DO NOTHING;
-- ===== 20260731225158_1b6ae4a8-0573-4cd9-8ad9-d139be741a1e.sql =====
DROP POLICY IF EXISTS "app_state insertable" ON public.app_state;
DROP POLICY IF EXISTS "app_state updatable" ON public.app_state;
DROP POLICY IF EXISTS "app_state readable" ON public.app_state;
REVOKE ALL ON public.app_state FROM anon, authenticated;
-- ===== 20260803082557_dd209409-3830-4e4d-ba36-8836050f95f1.sql =====
UPDATE public.app_state
SET data = jsonb_set(
  data,
  '{students}',
  (
    SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    FROM jsonb_array_elements(data->'students') AS value
    WHERE NOT (
      value->>'email' LIKE '%@test.com'
      OR value->>'name' = 'Meseret Test'
    )
  )
)
WHERE id = 'main';
-- ===== 20260803082609_06085ffd-9c8f-495c-a6a2-508dfb2700d9.sql =====
CREATE POLICY "app_state_service_role_only" ON public.app_state FOR ALL USING (false) WITH CHECK (false);
-- ===== 20260810003140_f877934f-c318-40ae-bf1b-534edeb10e51.sql =====
DROP POLICY IF EXISTS "uploads_no_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_no_public_delete" ON storage.objects;

CREATE POLICY "uploads_no_public_select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "uploads_no_public_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "uploads_no_public_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "uploads_no_public_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (false);
