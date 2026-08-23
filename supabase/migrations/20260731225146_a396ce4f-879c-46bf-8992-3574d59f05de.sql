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