
-- Revoke EXECUTE on internal trigger functions from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_columns() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_user_badges_columns() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_user_name_cards_columns() FROM anon, authenticated, public;

-- has_role and find_match: only authenticated callers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_match(uuid, integer, text, integer, text) FROM anon, public;

-- Tighten avatars bucket: only authenticated may list. Public URLs still work
-- because public buckets bypass RLS for direct file fetches.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Authenticated can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
