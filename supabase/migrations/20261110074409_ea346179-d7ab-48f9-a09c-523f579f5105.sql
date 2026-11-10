CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
 SELECT id FROM (VALUES
  ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid),
  ('bcfb301e-e3e6-48cd-9ef6-6b42dcee8326'::uuid)
 ) AS v(id)
 UNION
 SELECT p.id FROM public.profiles p
 WHERE p.id IN ('c457ac22-0540-473b-94b9-bb5f2713e106'::uuid, '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid)
   AND now() < '2026-11-01 00:00:00+08'::timestamptz
$function$;
GRANT EXECUTE ON FUNCTION public.leaderboard_excluded_ids() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.leaderboard_admin_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
 SELECT p.id FROM public.profiles p
 WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
$function$;
REVOKE EXECUTE ON FUNCTION public.leaderboard_admin_profile_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_admin_profile_ids() TO authenticated, service_role;
DO $test$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id) WHERE id='bcfb301e-e3e6-48cd-9ef6-6b42dcee8326'::uuid) THEN
  RAISE EXCEPTION 'simon_jiang must be excluded from all leaderboards';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id) WHERE id='dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid) THEN
  RAISE EXCEPTION '000871 must remain excluded from leaderboards';
 END IF;
END;
$test$;