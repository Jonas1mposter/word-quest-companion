CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT p.id FROM public.profiles p
 WHERE p.id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid, '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid)
 OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
$function$;
DO $block$
DECLARE v_start timestamptz := statement_timestamp(); v_count integer;
BEGIN
 PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
 UPDATE public.profiles SET banned_until = v_start + interval '30 days', ban_reason = '管理员决定：异常重复对战，封禁30天并移除排行榜（000243）', updated_at = v_start
 WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 IF v_count <> 1 THEN RAISE EXCEPTION 'Expected exactly one account'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid AND banned_until = v_start + interval '30 days') THEN RAISE EXCEPTION '30-day ban verification failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id) WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid) THEN RAISE EXCEPTION 'Leaderboard exclusion verification failed'; END IF;
END $block$;