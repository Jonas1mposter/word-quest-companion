
CREATE POLICY "Public read profile backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-backgrounds');

CREATE POLICY "Users upload own profile background"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own profile background"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'profile-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own profile background"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);
