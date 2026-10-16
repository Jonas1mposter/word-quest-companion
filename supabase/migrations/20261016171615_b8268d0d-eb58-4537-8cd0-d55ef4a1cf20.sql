ALTER TABLE public.lottery_progress
  ADD COLUMN IF NOT EXISTS pity_main integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pity_sub integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pity_mythology integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pity_legendary integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.glory_crown_policy()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
 SELECT jsonb_build_object('pool_id','glory-crown','discount_price',150,'discount_limit',10,'standard_price',200,
  'main_pct',1,'sub_pct',2,'mythology_pct',4,'legendary_pct',5,'coins_200_pct',30,'coins_100_pct',58,
  'pity_legendary_limit',20,'pity_mythology_limit',25,'pity_sub_limit',50,'pity_main_limit',100,
  'main_codes',jsonb_build_array('champions2021','recon'),'sub_codes',jsonb_build_array('champions2025','mystbloom','sovereign'))
$$;

CREATE OR REPLACE FUNCTION public.glory_crown_tier(p_roll numeric, p_since_main integer, p_since_sub integer, p_since_myth integer, p_since_leg integer,
  p_main_left boolean, p_sub_left boolean, p_myth_left boolean, p_leg_left boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN
 IF p_roll IS NULL OR p_roll < 0 OR p_roll >= 100 OR p_since_main IS NULL OR p_since_sub IS NULL OR p_since_myth IS NULL OR p_since_leg IS NULL
   OR p_since_main < 0 OR p_since_sub < 0 OR p_since_myth < 0 OR p_since_leg < 0
   OR p_main_left IS NULL OR p_sub_left IS NULL OR p_myth_left IS NULL OR p_leg_left IS NULL THEN RAISE EXCEPTION 'invalid lottery input'; END IF;
 IF p_main_left AND p_since_main >= 99 THEN RETURN 'main_sound'; END IF;
 IF p_sub_left AND p_since_sub >= 49 THEN RETURN 'sub_sound'; END IF;
 IF p_myth_left AND p_since_myth >= 24 THEN RETURN 'mythology'; END IF;
 IF p_leg_left AND p_since_leg >= 19 THEN RETURN 'legendary'; END IF;
 IF p_roll < 1 THEN RETURN 'main_sound';
 ELSIF p_roll < 3 THEN RETURN 'sub_sound';
 ELSIF p_roll < 7 THEN RETURN 'mythology';
 ELSIF p_roll < 12 THEN RETURN 'legendary';
 ELSIF p_roll < 42 THEN RETURN 'coins_200';
 ELSE RETURN 'coins_100'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.glory_crown_draw(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; it public.backpack_items%ROWTYPE; prog public.lottery_progress%ROWTYPE;
 main_left boolean; sub_left boolean; myth_left boolean; leg_left boolean; tier text; kind text; ref uuid; lbl text; coins_amt integer := 0; old_claims text;
 main_codes text[] := ARRAY['champions2021','recon']; sub_codes text[] := ARRAY['champions2025','mystbloom','sovereign'];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 SELECT * INTO it FROM public.backpack_items WHERE id=p_item_id AND profile_id=prof.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF it.status <> 'unused' THEN RETURN jsonb_build_object('error','used'); END IF;
 IF it.item_type <> 'lottery_ticket' THEN RETURN jsonb_build_object('error','not_ticket'); END IF;
 IF COALESCE(it.lottery_pool_id,'glory-crown') <> 'glory-crown' THEN RETURN jsonb_build_object('error','wrong_pool'); END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,'glory-crown') ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id='glory-crown' FOR UPDATE;

 SELECT EXISTS(SELECT 1 FROM kill_sound_packs k WHERE k.code=ANY(main_codes) AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id)) INTO main_left;
 SELECT EXISTS(SELECT 1 FROM kill_sound_packs k WHERE k.code=ANY(sub_codes) AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id)) INTO sub_left;
 SELECT EXISTS(SELECT 1 FROM name_cards n WHERE n.category='lottery_glory' AND n.rarity='mythology' AND NOT EXISTS(SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id)) INTO myth_left;
 SELECT EXISTS(SELECT 1 FROM name_cards n WHERE n.category='lottery_glory' AND n.rarity='legendary' AND NOT EXISTS(SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id)) INTO leg_left;

 tier := public.glory_crown_tier((floor(random()*100000)/1000)::numeric, prog.pity_main, prog.pity_sub, prog.pity_mythology, prog.pity_legendary, main_left, sub_left, myth_left, leg_left);

 IF tier IN ('main_sound','sub_sound') THEN
  kind := 'sound_pack';
  SELECT k.id,k.name INTO ref,lbl FROM kill_sound_packs k WHERE k.code=ANY(CASE WHEN tier='main_sound' THEN main_codes ELSE sub_codes END)
    AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id) ORDER BY random() LIMIT 1;
 ELSIF tier IN ('mythology','legendary') THEN
  kind := 'name_card';
  SELECT n.id,n.name INTO ref,lbl FROM name_cards n WHERE n.category='lottery_glory' AND n.rarity=tier
    AND NOT EXISTS(SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id) ORDER BY random() LIMIT 1;
 ELSE kind := 'coins'; coins_amt := CASE WHEN tier='coins_200' THEN 200 ELSE 100 END; END IF;
 IF kind <> 'coins' AND ref IS NULL THEN kind := 'coins'; coins_amt := 200; END IF;

 IF kind='sound_pack' THEN
  INSERT INTO user_kill_sound_packs(profile_id,pack_id) VALUES(prof.id,ref) ON CONFLICT DO NOTHING; lbl := '连杀音效·'||lbl;
 ELSIF kind='name_card' THEN
  INSERT INTO user_name_cards(profile_id,name_card_id) VALUES(prof.id,ref); lbl := '名片·'||lbl;
 ELSE
  old_claims := current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET coins=coins+coins_amt WHERE id=prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  PERFORM bump_lifetime_coins(prof.id,coins_amt); lbl := coins_amt||' 狄邦豆';
 END IF;

 UPDATE lottery_progress SET
  pity_main = CASE WHEN tier='main_sound' THEN 0 ELSE pity_main+1 END,
  pity_sub = CASE WHEN tier='sub_sound' THEN 0 ELSE pity_sub+1 END,
  pity_mythology = CASE WHEN tier='mythology' THEN 0 ELSE pity_mythology+1 END,
  pity_legendary = CASE WHEN tier='legendary' THEN 0 ELSE pity_legendary+1 END
 WHERE profile_id=prof.id AND pool_id='glory-crown';
 UPDATE backpack_items SET status='used',used_at=now(),label='抽奖券 → '||lbl WHERE id=it.id;
 RETURN jsonb_build_object('ok',true,'lottery',true,'kind',kind,'tier',tier,'label',lbl);
END $$;

CREATE OR REPLACE FUNCTION public.get_lottery_state(p_pool_id text DEFAULT 'champions-2024'::text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS NULL OR p_pool_id NOT IN ('champions-2024','glory-crown') THEN RAISE EXCEPTION 'invalid pool'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id;
 IF p_pool_id='glory-crown' THEN
  RETURN public.glory_crown_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),
   'pity_main',COALESCE(prog.pity_main,0),'pity_sub',COALESCE(prog.pity_sub,0),'pity_mythology',COALESCE(prog.pity_mythology,0),'pity_legendary',COALESCE(prog.pity_legendary,0));
 END IF;
 RETURN public.champions_lottery_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),'promotion_draws',COALESCE(prog.promotion_draws,0),'owns_sound',EXISTS(SELECT 1 FROM public.user_kill_sound_packs u JOIN public.kill_sound_packs k ON k.id=u.pack_id WHERE u.profile_id=prof.id AND k.code='champions2024'));
END $$;

CREATE OR REPLACE FUNCTION lottery_private.purchase_lottery_ticket(p_pool_id text, p_discounted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE; price integer; ticket uuid; old_claims text; quote jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS NULL OR p_pool_id NOT IN ('champions-2024','glory-crown') OR p_discounted IS NULL THEN RAISE EXCEPTION 'invalid input'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,p_pool_id) ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id FOR UPDATE;
 quote := public.lottery_ticket_quote(p_discounted,prog.discounted_purchases,prof.coins);
 IF quote ? 'error' THEN RETURN quote; END IF;
 price := (quote->>'price')::integer;
 old_claims := current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 UPDATE public.profiles SET coins=coins-price WHERE id=prof.id;
 PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source,lottery_pool_id)
  VALUES(prof.id,'lottery_ticket',1,CASE WHEN p_pool_id='glory-crown' THEN '荣光铸冠抽奖券' ELSE '冠军限定抽奖券' END,'lottery_exchange',p_pool_id) RETURNING id INTO ticket;
 IF p_discounted THEN UPDATE public.lottery_progress SET discounted_purchases=discounted_purchases+1 WHERE profile_id=prof.id AND pool_id=p_pool_id; END IF;
 RETURN jsonb_build_object('ok',true,'ticket_id',ticket,'price',price);
END $$;

REVOKE ALL ON FUNCTION public.glory_crown_draw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.glory_crown_draw(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.glory_crown_tier(numeric,integer,integer,integer,integer,boolean,boolean,boolean,boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.glory_crown_policy() TO anon, authenticated, service_role;