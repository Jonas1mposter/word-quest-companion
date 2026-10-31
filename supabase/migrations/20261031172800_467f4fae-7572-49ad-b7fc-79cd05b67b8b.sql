CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
 SELECT p.id FROM public.profiles p
 WHERE p.id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid, '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid)
 OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
$function$;
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
    WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid
  ) THEN
    RAISE EXCEPTION '000243 must remain excluded from all personal leaderboards';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
    WHERE id = 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid
  ) THEN
    RAISE EXCEPTION '002330 must remain excluded from all personal leaderboards';
  END IF;
END;
$test$;