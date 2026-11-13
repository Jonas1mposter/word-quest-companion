CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
 SELECT p.id FROM public.profiles p
 WHERE p.id = 'dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid
 OR p.id = 'bcfb301e-e3e6-48cd-9ef6-6b42dcee8326'::uuid
 OR p.id = 'b2409a98-6719-4cab-a9fb-8b06e1a553a7'::uuid
 OR (p.id IN ('c457ac22-0540-473b-94b9-bb5f2713e106'::uuid, '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid)
     AND now() < '2026-11-01 00:00:00+08'::timestamptz)
  OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
$function$;