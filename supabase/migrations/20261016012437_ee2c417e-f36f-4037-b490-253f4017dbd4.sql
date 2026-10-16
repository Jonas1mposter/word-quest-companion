DROP FUNCTION public.champions_lottery_tier(double precision, integer, boolean, timestamp with time zone);
CREATE OR REPLACE FUNCTION public.use_backpack_item(p_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE prof public.profiles%ROWTYPE; it public.backpack_items%ROWTYPE; prog public.lottery_progress%ROWTYPE; policy jsonb; tier text; ref uuid; lbl text; kind text; coins_amt integer := 0; owned boolean; old_claims text; active boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT * INTO it FROM public.backpack_items WHERE id=p_item_id AND profile_id=prof.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF it.status <> 'unused' THEN RETURN jsonb_build_object('error','used'); END IF;
 IF it.item_type <> 'lottery_ticket' THEN RETURN public.use_backpack_item_legacy(p_item_id); END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 IF COALESCE(it.lottery_pool_id,'champions-2024') <> 'champions-2024' THEN RAISE EXCEPTION 'invalid pool'; END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,'champions-2024') ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id='champions-2024' FOR UPDATE;
 policy := public.champions_lottery_policy(); active := (policy->>'promotion_active')::boolean;
 SELECT EXISTS(SELECT 1 FROM public.user_kill_sound_packs u JOIN public.kill_sound_packs k ON k.id=u.pack_id WHERE u.profile_id=prof.id AND k.code='champions2024') INTO owned;
 tier := public.champions_lottery_tier((random()*100)::numeric,prog.promotion_draws,owned);
 IF tier='sound_pack' THEN
  kind := 'sound_pack';
  SELECT id,name INTO ref,lbl FROM public.kill_sound_packs WHERE code='champions2024';
  IF NOT FOUND THEN RAISE EXCEPTION 'sound prize unavailable'; END IF;
  IF owned THEN ref := NULL; END IF;
 ELSIF tier IN ('mythology','epic_legendary') THEN
  kind := 'name_card';
  SELECT n.id,n.name INTO ref,lbl FROM public.name_cards n WHERE n.category='lottery' AND ((tier='mythology' AND n.rarity='mythology') OR (tier='epic_legendary' AND n.rarity IN ('epic','legendary'))) AND NOT EXISTS(SELECT 1 FROM public.user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id) ORDER BY random() LIMIT 1;
 ELSE kind := 'coins'; coins_amt := CASE WHEN tier='coins_200' THEN 200 ELSE 100 END; END IF;
 IF kind <> 'coins' AND ref IS NULL THEN kind := 'coins'; coins_amt := 200; END IF;
 IF kind='sound_pack' THEN
  INSERT INTO public.user_kill_sound_packs(profile_id,pack_id) VALUES(prof.id,ref) ON CONFLICT DO NOTHING; lbl := '连杀音效·'||lbl;
 ELSIF kind='name_card' THEN
  INSERT INTO public.user_name_cards(profile_id,name_card_id) VALUES(prof.id,ref); lbl := '名片·'||lbl;
 ELSE
  old_claims := current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE public.profiles SET coins=coins+coins_amt WHERE id=prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  PERFORM public.bump_lifetime_coins(prof.id,coins_amt); lbl := coins_amt||' 狄邦豆';
 END IF;
 IF active THEN UPDATE public.lottery_progress SET promotion_draws=promotion_draws+1 WHERE profile_id=prof.id AND pool_id='champions-2024'; END IF;
 UPDATE public.backpack_items SET status='used',used_at=now(),label='抽奖券 → '||lbl WHERE id=it.id;
 RETURN jsonb_build_object('ok',true,'lottery',true,'kind',kind,'label',lbl,'pity_triggered',active AND NOT owned AND prog.promotion_draws>=24);
END $function$;