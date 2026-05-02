-- Restrict avatars listing to file owners only (public URLs still render because avatars bucket is public)
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;

CREATE POLICY "Users can list own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);