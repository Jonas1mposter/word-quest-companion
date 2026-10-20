CREATE OR REPLACE FUNCTION public.glory_crown_policy()
 RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $f$
 SELECT jsonb_build_object('pool_id','glory-crown','discount_price',150,'discount_limit',10,'standard_price',200,
  'main_pct',2,'sub_pct',4,'mythology_pct',8,'legendary_pct',10,'coins_200_pct',30,'coins_100_pct',46,
  'pity_legendary_limit',14,'pity_mythology_limit',17,'pity_sub_limit',34,'pity_main_limit',67,
  'main_codes',jsonb_build_array('champions2021','recon'),'sub_codes',jsonb_build_array('champions2025','mystbloom','sovereign'))
$f$;

CREATE OR REPLACE FUNCTION public.glory_crown_tier(p_roll numeric, p_since_main integer, p_since_sub integer, p_since_myth integer, p_since_leg integer, p_main_left boolean, p_sub_left boolean, p_myth_left boolean, p_leg_left boolean)
 RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $f$
BEGIN
 IF p_roll IS NULL OR p_roll < 0 OR p_roll >= 100 OR p_since_main IS NULL OR p_since_sub IS NULL OR p_since_myth IS NULL OR p_since_leg IS NULL
   OR p_since_main < 0 OR p_since_sub < 0 OR p_since_myth < 0 OR p_since_leg < 0
   OR p_main_left IS NULL OR p_sub_left IS NULL OR p_myth_left IS NULL OR p_leg_left IS NULL THEN RAISE EXCEPTION 'invalid lottery input'; END IF;
 IF p_main_left AND p_since_main >= 66 THEN RETURN 'main_sound'; END IF;
 IF p_sub_left AND p_since_sub >= 33 THEN RETURN 'sub_sound'; END IF;
 IF p_myth_left AND p_since_myth >= 16 THEN RETURN 'mythology'; END IF;
 IF p_leg_left AND p_since_leg >= 13 THEN RETURN 'legendary'; END IF;
 IF p_roll < 2 THEN RETURN 'main_sound';
 ELSIF p_roll < 6 THEN RETURN 'sub_sound';
 ELSIF p_roll < 14 THEN RETURN 'mythology';
 ELSIF p_roll < 24 THEN RETURN 'legendary';
 ELSIF p_roll < 54 THEN RETURN 'coins_200';
 ELSE RETURN 'coins_100'; END IF;
END $f$;

-- 三人解封可正常游玩；排行榜排除到北京时间2026-10-31结束
CREATE OR REPLACE FUNCTION public.leaderboard_excluded_ids()
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
 SELECT p.id FROM public.profiles p
 WHERE (p.id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid, '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid)
        AND now() < '2026-11-01 00:00:00+08'::timestamptz)
 OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
$f$;

UPDATE public.profiles SET banned_until = NULL, ban_reason = NULL
WHERE id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1','c457ac22-0540-473b-94b9-bb5f2713e106','15a5b0fc-a058-4de1-b3d3-421d99055802');