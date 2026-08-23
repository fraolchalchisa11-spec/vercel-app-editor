DROP POLICY IF EXISTS "app_state insertable" ON public.app_state;
DROP POLICY IF EXISTS "app_state updatable" ON public.app_state;
DROP POLICY IF EXISTS "app_state readable" ON public.app_state;
REVOKE ALL ON public.app_state FROM anon, authenticated;