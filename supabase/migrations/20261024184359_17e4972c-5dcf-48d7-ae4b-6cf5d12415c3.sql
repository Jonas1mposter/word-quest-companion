CREATE OR REPLACE FUNCTION public.orax_beats_policy()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
 SELECT jsonb_build_object('pool_id','orax-beats','discount_price',150,'discount_limit',10,'standard_price',200,
  'main_pct',2,'sub_pct',5,'coins_200_pct',30,'coins_100_pct',63,
  'pity_sub_limit',20,'pity_main_limit',50,
  'main_codes',jsonb_build_array('orax'),'sub_codes',jsonb_build_array('primordium','rogue','singularity','neofrontier'))
$$;

CREATE OR REPLACE FUNCTION public.orax_beats_tier(p_roll numeric, p_since_main integer, p_since_sub integer, p_main_left boolean, p_sub_left boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN
 IF p_roll IS NULL OR p_roll < 0 OR p_roll >= 100 OR p_since_main IS NULL OR p_since_sub IS NULL
   OR p_since_main < 0 OR p_since_sub < 0 OR p_main_left IS NULL OR p_sub_left IS NULL THEN RAISE EXCEPTION 'invalid lottery input'; END IF;
 IF p_main_left AND p_since_main >= 49 THEN RETURN 'main_sound'; END IF;
 IF p_sub_left AND p_since_sub >= 19 THEN RETURN 'sub_sound'; END IF;
 IF p_roll < 2 THEN RETURN 'main_sound';
 ELSIF p_roll < 7 THEN RETURN 'sub_sound';
 ELSIF p_roll < 37 THEN RETURN 'coins_200';
 ELSE RETURN 'coins_100'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.orax_beats_tier(numeric,integer,integer,boolean,boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orax_beats_policy() TO anon, authenticated, service_role;