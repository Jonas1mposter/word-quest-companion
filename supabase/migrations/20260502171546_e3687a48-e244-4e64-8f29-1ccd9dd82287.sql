-- 1. Storage: scope avatar writes to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;

CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. combo_records: require auth
DROP POLICY IF EXISTS "Combo records are publicly readable" ON public.combo_records;
CREATE POLICY "Combo records are readable by authenticated"
ON public.combo_records FOR SELECT TO authenticated USING (true);

-- 3. ranked_matches: require auth
DROP POLICY IF EXISTS "Matches are publicly readable" ON public.ranked_matches;
CREATE POLICY "Matches are readable by authenticated"
ON public.ranked_matches FOR SELECT TO authenticated USING (true);

-- 4. class_assignments: scope to owning teacher OR matching student grade/class
DROP POLICY IF EXISTS "Class assignments are viewable by members" ON public.class_assignments;
CREATE POLICY "Assignments visible to teacher or matching students"
ON public.class_assignments FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'teacher'::app_role) AND auth.uid() = teacher_id)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (class_assignments.grade IS NULL OR p.grade = class_assignments.grade)
      AND (class_assignments.class_name IS NULL OR p.class = class_assignments.class_name)
      AND (class_assignments.profile_id IS NULL OR class_assignments.profile_id = p.id)
  )
);

-- 5. has_role: switch to SECURITY INVOKER so users can only verify their own role via user_roles RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
-- Re-grant since signature owner changes can affect grants
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 6. user_season_milestones: remove client write access (route via edge functions)
DROP POLICY IF EXISTS "Users can insert own milestones" ON public.user_season_milestones;
DROP POLICY IF EXISTS "Users can update own milestones" ON public.user_season_milestones;
-- SELECT policy ("Users can view own milestones") remains.
