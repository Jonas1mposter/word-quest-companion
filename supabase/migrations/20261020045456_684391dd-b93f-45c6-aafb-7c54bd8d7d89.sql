CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select p.id from public.profiles p
  where p.id in ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid)
  or exists (select 1 from public.user_roles r where r.user_id=p.user_id and r.role='admin')
$function$;