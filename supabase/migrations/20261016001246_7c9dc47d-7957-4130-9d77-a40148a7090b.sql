CREATE TABLE public.lottery_progress (
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 pool_id text NOT NULL,
 discounted_purchases integer NOT NULL DEFAULT 0,
 promotion_draws integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,pool_id)
);
GRANT SELECT ON public.lottery_progress TO authenticated;
GRANT ALL ON public.lottery_progress TO service_role;
ALTER TABLE public.lottery_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own lottery progress" ON public.lottery_progress FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));
CREATE FUNCTION public.touch_lottery_progress() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER touch_lottery_progress BEFORE UPDATE ON public.lottery_progress FOR EACH ROW EXECUTE FUNCTION public.touch_lottery_progress();
ALTER TABLE public.backpack_items ADD COLUMN lottery_pool_id text;

CREATE FUNCTION public.champions_lottery_policy(p_at timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('pool_id','champions-2024','discount_price',150,'discount_limit',10,'standard_price',200,'promotion_start','2026-10-16T00:11:56Z','promotion_end','2026-10-31T16:00:00Z','promotion_active',p_at >= '2026-10-16T00:11:56Z'::timestamptz AND p_at < '2026-10-31T16:00:00Z'::timestamptz,'pity_limit',25,'sound_pct',CASE WHEN p_at >= '2026-10-16T00:11:56Z'::timestamptz AND p_at < '2026-10-31T16:00:00Z'::timestamptz THEN 4 ELSE 1 END)
$$;
CREATE FUNCTION public.champions_lottery_tier(p_roll numeric,p_draws integer,p_owned boolean,p_at timestamptz DEFAULT now()) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE active boolean := (public.champions_lottery_policy(p_at)->>'promotion_active')::boolean; sound_pct integer := CASE WHEN active THEN 4 ELSE 1 END;
BEGIN
 IF p_roll IS NULL OR p_roll < 0 OR p_roll >= 100 OR p_draws IS NULL OR p_draws < 0 OR p_owned IS NULL THEN RAISE EXCEPTION 'invalid lottery input'; END IF;
 IF (active AND NOT p_owned AND p_draws >= 24) OR p_roll < sound_pct THEN RETURN 'sound_pack';
 ELSIF p_roll < sound_pct+4 THEN RETURN 'mythology';
 ELSIF p_roll < sound_pct+19 THEN RETURN 'epic_legendary';
 ELSIF p_roll < sound_pct+49 THEN RETURN 'coins_200';
 ELSE RETURN 'coins_100'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.champions_lottery_policy(timestamptz), public.champions_lottery_tier(numeric,integer,boolean,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.champions_lottery_policy(timestamptz),public.champions_lottery_tier(numeric,integer,boolean,timestamptz) TO authenticated,service_role;

CREATE FUNCTION public.get_lottery_state(p_pool_id text DEFAULT 'champions-2024') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS DISTINCT FROM 'champions-2024' THEN RAISE EXCEPTION 'invalid pool'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id;
 RETURN public.champions_lottery_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),'promotion_draws',COALESCE(prog.promotion_draws,0),'owns_sound',EXISTS(SELECT 1 FROM public.user_kill_sound_packs u JOIN public.kill_sound_packs k ON k.id=u.pack_id WHERE u.profile_id=prof.id AND k.code='champions2024'));
END $$;
CREATE FUNCTION public.purchase_lottery_ticket(p_pool_id text,p_discounted boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE; price integer; ticket uuid; old_claims text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS DISTINCT FROM 'champions-2024' OR p_discounted IS NULL THEN RAISE EXCEPTION 'invalid input'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,p_pool_id) ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id FOR UPDATE;
 IF p_discounted AND prog.discounted_purchases >= 10 THEN RETURN jsonb_build_object('error','discount_limit'); END IF;
 price := CASE WHEN p_discounted THEN 150 ELSE 200 END;
 IF prof.coins < price THEN RETURN jsonb_build_object('error','insufficient_coins'); END IF;
 old_claims := current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 UPDATE public.profiles SET coins=coins-price WHERE id=prof.id;
 PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source,lottery_pool_id) VALUES(prof.id,'lottery_ticket',1,'冠军限定抽奖券','lottery_exchange',p_pool_id) RETURNING id INTO ticket;
 IF p_discounted THEN UPDATE public.lottery_progress SET discounted_purchases=discounted_purchases+1 WHERE profile_id=prof.id AND pool_id=p_pool_id; END IF;
 RETURN jsonb_build_object('ok',true,'ticket_id',ticket,'price',price);
END $$;

ALTER FUNCTION public.use_backpack_item(uuid) RENAME TO use_backpack_item_legacy;
REVOKE ALL ON FUNCTION public.use_backpack_item_legacy(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.use_backpack_item(p_item_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 tier := public.champions_lottery_tier(random()*100,prog.promotion_draws,owned);
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
END $$;
REVOKE ALL ON FUNCTION public.get_lottery_state(text),public.purchase_lottery_ticket(text,boolean),public.use_backpack_item(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_lottery_state(text),public.purchase_lottery_ticket(text,boolean),public.use_backpack_item(uuid) TO authenticated,service_role;