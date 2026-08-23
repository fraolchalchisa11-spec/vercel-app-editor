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