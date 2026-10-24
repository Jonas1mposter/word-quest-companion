ALTER TABLE public.kill_sound_packs ADD COLUMN IF NOT EXISTS variant_urls jsonb;

INSERT INTO public.kill_sound_packs (code, name, description, rarity, icon_url, sound_urls, variant_urls) VALUES
('orax','ORA X 颗秒','主套 · 局内控制台可随时切换 5 套连杀音效','legendary','/__l5e/assets-v1/7ecdc7a0-d0d7-4afc-8c74-7d47db5bf813/orax.png',
 '["/__l5e/assets-v1/ba06b955-d00a-4d56-a6a3-a69d9d47c542/ora_ignition_1.mp3","/__l5e/assets-v1/e5c285f6-c783-4b10-b6db-1956986d20f2/ora_ignition_2.mp3","/__l5e/assets-v1/93e07fbe-1f97-4ec6-8b90-652a872d76e2/ora_ignition_3.mp3","/__l5e/assets-v1/72e6d600-08f4-4479-a4e3-e113d45b9c06/ora_ignition_4.mp3","/__l5e/assets-v1/8cab2b27-d33c-45d2-8031-9d1cabe5f320/ora_ignition_5.mp3","/__l5e/assets-v1/ff9689c1-1b6a-49b5-bf96-22fba8f3262e/ora_ignition_6.mp3"]',
 '{"ignition":["/__l5e/assets-v1/ba06b955-d00a-4d56-a6a3-a69d9d47c542/ora_ignition_1.mp3","/__l5e/assets-v1/e5c285f6-c783-4b10-b6db-1956986d20f2/ora_ignition_2.mp3","/__l5e/assets-v1/93e07fbe-1f97-4ec6-8b90-652a872d76e2/ora_ignition_3.mp3","/__l5e/assets-v1/72e6d600-08f4-4479-a4e3-e113d45b9c06/ora_ignition_4.mp3","/__l5e/assets-v1/8cab2b27-d33c-45d2-8031-9d1cabe5f320/ora_ignition_5.mp3","/__l5e/assets-v1/ff9689c1-1b6a-49b5-bf96-22fba8f3262e/ora_ignition_6.mp3"],"lawyer":["/__l5e/assets-v1/56024ed3-11c1-4049-8556-07c482d7a33d/ora_lawyer_1.mp3","/__l5e/assets-v1/8e5e5970-73a3-4a2b-88ae-c9006c91ae74/ora_lawyer_2.mp3","/__l5e/assets-v1/f7a173fc-051f-4f9a-a801-288bbf5c6bcf/ora_lawyer_3.mp3","/__l5e/assets-v1/57619df2-238b-4c4a-b482-f4fc8f376ec3/ora_lawyer_4.mp3","/__l5e/assets-v1/5f15be30-855f-4916-b71a-ab6199918055/ora_lawyer_5.mp3","/__l5e/assets-v1/4b00f247-e6ec-43cd-a25e-e185fd0b1a7c/ora_lawyer_6.mp3"],"raja":["/__l5e/assets-v1/770b4e7b-6286-4d18-aed8-a84e863d97af/ora_raja_1.mp3","/__l5e/assets-v1/dd53b3c7-09bd-4d20-82f8-4d2922ef2832/ora_raja_2.mp3","/__l5e/assets-v1/a57fa9b6-a3bb-4875-8f78-f4e8760847a6/ora_raja_3.mp3","/__l5e/assets-v1/08783761-6ecd-4dd9-80a3-17c119acf562/ora_raja_4.mp3","/__l5e/assets-v1/0f7d7e36-a730-46ee-959d-4b794ee1b198/ora_raja_5.mp3","/__l5e/assets-v1/6e0fb2d9-8aa6-48d2-8ed7-edb669dd511c/ora_raja_6.mp3"],"renegade":["/__l5e/assets-v1/b611a288-6ab5-4532-adea-b7a050723c85/ora_renegade_1.mp3","/__l5e/assets-v1/f8698141-8509-4d37-925c-a4325d0bbce5/ora_renegade_2.mp3","/__l5e/assets-v1/1daf4833-6bcc-4db7-b395-90874fb4424e/ora_renegade_3.mp3","/__l5e/assets-v1/5670588f-3fdb-4fe3-a54f-29160f5c738b/ora_renegade_4.mp3","/__l5e/assets-v1/92ac2975-a506-426f-8bd1-1173ac57e2c3/ora_renegade_5.mp3","/__l5e/assets-v1/766769d1-badb-47e7-8bf3-a5eb240cb5a5/ora_renegade_6.mp3"],"watch":["/__l5e/assets-v1/ac2ee674-86ef-4fc7-a0e1-879d7fa20cb1/ora_watch_1.mp3","/__l5e/assets-v1/991beb68-55ed-4e9d-8df7-830e9b1401c8/ora_watch_2.mp3","/__l5e/assets-v1/83e9b04a-8057-48ef-ae22-2b3654af80f3/ora_watch_3.mp3","/__l5e/assets-v1/3986b53d-2ff0-44dc-a903-182a774b50de/ora_watch_4.mp3","/__l5e/assets-v1/4c73a619-4ba9-498f-878f-66912399aa5c/ora_watch_5.mp3","/__l5e/assets-v1/302555ac-29d1-476d-b854-bb456f3b60b9/ora_watch_6.mp3"]}'),
('primordium','洪荒怒焰','副套 · 6 段连杀音效','epic','/__l5e/assets-v1/d99b21b0-8bc4-4ebb-8b82-c2ba719ac216/primordium.png',
 '["/__l5e/assets-v1/d105aed0-2ad2-4e93-b31e-d0e5b270571b/primordium_1.mp3","/__l5e/assets-v1/f743fc05-e127-4ad0-aad3-12c2baac46ec/primordium_2.mp3","/__l5e/assets-v1/47799618-b86c-4f8e-9bb8-1a6c9f0ae747/primordium_3.mp3","/__l5e/assets-v1/b2c617f0-50ff-4623-b0d6-dedd234e7d25/primordium_4.mp3","/__l5e/assets-v1/5c17a34e-fd65-416f-b161-35b218645870/primordium_5.mp3","/__l5e/assets-v1/0390e9aa-90df-4486-89ea-ca8e1c5dd139/primordium_6.mp3"]',NULL),
('rogue','逆命中队','副套 · 6 段连杀音效','epic','/__l5e/assets-v1/303984ae-a21b-4478-891b-dc7bde4b077a/rogue.png',
 '["/__l5e/assets-v1/bb2219bc-c57d-4bf6-8daf-07ac96e68c7b/rogue_1.mp3","/__l5e/assets-v1/355a3cac-fc30-4c3d-8a6c-e58bbb61aee9/rogue_2.mp3","/__l5e/assets-v1/f8cc9bec-439e-4b49-a97a-540a1905d6bb/rogue_3.mp3","/__l5e/assets-v1/f8107bf0-ec46-49e4-80e4-7abbdbaccfe1/rogue_4.mp3","/__l5e/assets-v1/17681b24-f627-4142-b3c1-927d4b34c237/rogue_5.mp3","/__l5e/assets-v1/7821be55-2f7a-4b39-8ba8-a4b74927acc5/rogue_6.mp3"]',NULL),
('singularity','奇点','副套 · 6 段连杀音效','epic','/__l5e/assets-v1/528d6f02-b943-4a34-a49b-5bbfa5538096/singularity.png',
 '["/__l5e/assets-v1/9dd69640-928e-4709-b943-5c840ce451ff/singularity_1.mp3","/__l5e/assets-v1/3a6153eb-d6b2-4b02-83d4-50afdd948ee1/singularity_2.mp3","/__l5e/assets-v1/9d811b99-829d-4530-8b5a-94018e5a9f45/singularity_3.mp3","/__l5e/assets-v1/8cfa8103-dfb0-43cb-b487-e47103a0952b/singularity_4.mp3","/__l5e/assets-v1/5e588e52-7bf6-49f2-9514-ee846781bce1/singularity_5.mp3","/__l5e/assets-v1/5e84f34d-3bb6-4f0b-9c97-5d1c34f1f3be/singularity_6.mp3"]',NULL),
('neofrontier','西部未来','副套 · 6 段连杀音效','epic','/__l5e/assets-v1/81b898eb-e831-4926-84f5-fff1a5b25c08/neofrontier.png',
 '["/__l5e/assets-v1/0cd9af4d-39f7-4a49-8d0a-7f16d99d15ec/neofrontier_1.mp3","/__l5e/assets-v1/7959c243-dbe6-4a49-8da7-d04083f18686/neofrontier_2.mp3","/__l5e/assets-v1/a77089a1-8052-4b84-9f4f-d8c43c3564fd/neofrontier_3.mp3","/__l5e/assets-v1/ddaae2cd-b3e1-4805-8200-9235bcc37383/neofrontier_4.mp3","/__l5e/assets-v1/b6e9498a-995e-4506-ab58-b1d9365fb3c4/neofrontier_5.mp3","/__l5e/assets-v1/440f98ba-437a-4bb6-9e82-144232db4a6d/neofrontier_6.mp3"]',NULL)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, rarity=EXCLUDED.rarity, icon_url=EXCLUDED.icon_url, sound_urls=EXCLUDED.sound_urls, variant_urls=EXCLUDED.variant_urls;

CREATE OR REPLACE FUNCTION public.orax_beats_policy()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
 SELECT jsonb_build_object('pool_id','orax-beats','discount_price',150,'discount_limit',10,'standard_price',200,
  'main_pct',2,'sub_pct',8,'coins_200_pct',30,'coins_100_pct',60,
  'pity_sub_limit',15,'pity_main_limit',50,
  'main_codes',jsonb_build_array('orax'),'sub_codes',jsonb_build_array('primordium','rogue','singularity','neofrontier'))
$$;

CREATE OR REPLACE FUNCTION public.orax_beats_tier(p_roll numeric, p_since_main integer, p_since_sub integer, p_main_left boolean, p_sub_left boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN
 IF p_roll IS NULL OR p_roll < 0 OR p_roll >= 100 OR p_since_main IS NULL OR p_since_sub IS NULL
   OR p_since_main < 0 OR p_since_sub < 0 OR p_main_left IS NULL OR p_sub_left IS NULL THEN RAISE EXCEPTION 'invalid lottery input'; END IF;
 IF p_main_left AND p_since_main >= 49 THEN RETURN 'main_sound'; END IF;
 IF p_sub_left AND p_since_sub >= 14 THEN RETURN 'sub_sound'; END IF;
 IF p_roll < 2 THEN RETURN 'main_sound';
 ELSIF p_roll < 10 THEN RETURN 'sub_sound';
 ELSIF p_roll < 40 THEN RETURN 'coins_200';
 ELSE RETURN 'coins_100'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.orax_beats_draw(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; it public.backpack_items%ROWTYPE; prog public.lottery_progress%ROWTYPE;
 main_left boolean; sub_left boolean; tier text; kind text; ref uuid; lbl text; coins_amt integer := 0; old_claims text;
 main_codes text[] := ARRAY['orax']; sub_codes text[] := ARRAY['primordium','rogue','singularity','neofrontier'];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 SELECT * INTO it FROM public.backpack_items WHERE id=p_item_id AND profile_id=prof.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF it.status <> 'unused' THEN RETURN jsonb_build_object('error','used'); END IF;
 IF it.item_type <> 'lottery_ticket' THEN RETURN jsonb_build_object('error','not_ticket'); END IF;
 IF COALESCE(it.lottery_pool_id,'glory-crown') <> 'orax-beats' THEN RETURN jsonb_build_object('error','wrong_pool'); END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,'orax-beats') ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id='orax-beats' FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM kill_sound_packs k WHERE k.code=ANY(main_codes) AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id)) INTO main_left;
 SELECT EXISTS(SELECT 1 FROM kill_sound_packs k WHERE k.code=ANY(sub_codes) AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id)) INTO sub_left;
 tier := public.orax_beats_tier((floor(random()*100000)/1000)::numeric, prog.pity_main, prog.pity_sub, main_left, sub_left);
 IF tier IN ('main_sound','sub_sound') THEN
  kind := 'sound_pack';
  SELECT k.id,k.name INTO ref,lbl FROM kill_sound_packs k WHERE k.code=ANY(CASE WHEN tier='main_sound' THEN main_codes ELSE sub_codes END)
    AND NOT EXISTS(SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id) ORDER BY random() LIMIT 1;
 ELSE kind := 'coins'; coins_amt := CASE WHEN tier='coins_200' THEN 200 ELSE 100 END; END IF;
 IF kind <> 'coins' AND ref IS NULL THEN kind := 'coins'; coins_amt := 200; END IF;
 IF kind='sound_pack' THEN
  INSERT INTO user_kill_sound_packs(profile_id,pack_id) VALUES(prof.id,ref) ON CONFLICT DO NOTHING; lbl := '连杀音效·'||lbl;
 ELSE
  old_claims := current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET coins=coins+coins_amt WHERE id=prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  PERFORM bump_lifetime_coins(prof.id,coins_amt); lbl := coins_amt||' 狄邦豆';
 END IF;
 UPDATE lottery_progress SET
  pity_main = CASE WHEN tier='main_sound' THEN 0 ELSE pity_main+1 END,
  pity_sub = CASE WHEN tier='sub_sound' THEN 0 ELSE pity_sub+1 END
 WHERE profile_id=prof.id AND pool_id='orax-beats';
 UPDATE backpack_items SET status='used',used_at=now(),label='抽奖券 → '||lbl WHERE id=it.id;
 RETURN jsonb_build_object('ok',true,'lottery',true,'kind',kind,'tier',tier,'label',lbl);
END $$;

CREATE OR REPLACE FUNCTION public.get_lottery_state(p_pool_id text DEFAULT 'champions-2024'::text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS NULL OR p_pool_id NOT IN ('champions-2024','glory-crown','orax-beats') THEN RAISE EXCEPTION 'invalid pool'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id;
 IF p_pool_id='glory-crown' THEN
  RETURN public.glory_crown_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),
   'pity_main',COALESCE(prog.pity_main,0),'pity_sub',COALESCE(prog.pity_sub,0),'pity_mythology',COALESCE(prog.pity_mythology,0),'pity_legendary',COALESCE(prog.pity_legendary,0));
 END IF;
 IF p_pool_id='orax-beats' THEN
  RETURN public.orax_beats_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),
   'pity_main',COALESCE(prog.pity_main,0),'pity_sub',COALESCE(prog.pity_sub,0));
 END IF;
 RETURN public.champions_lottery_policy() || jsonb_build_object('discounted_purchases',COALESCE(prog.discounted_purchases,0),'promotion_draws',COALESCE(prog.promotion_draws,0),'owns_sound',EXISTS(SELECT 1 FROM public.user_kill_sound_packs u JOIN public.kill_sound_packs k ON k.id=u.pack_id WHERE u.profile_id=prof.id AND k.code='champions2024'));
END $$;

CREATE OR REPLACE FUNCTION lottery_private.purchase_lottery_ticket(p_pool_id text, p_discounted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE; price integer; ticket uuid; old_claims text; quote jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS NULL OR p_pool_id NOT IN ('champions-2024','glory-crown','orax-beats') OR p_discounted IS NULL THEN RAISE EXCEPTION 'invalid input'; END IF;
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
  VALUES(prof.id,'lottery_ticket',1,CASE p_pool_id WHEN 'glory-crown' THEN '荣光铸冠抽奖券' WHEN 'orax-beats' THEN '颗秒音浪抽奖券' ELSE '冠军限定抽奖券' END,'lottery_exchange',p_pool_id) RETURNING id INTO ticket;
 IF p_discounted THEN UPDATE public.lottery_progress SET discounted_purchases=discounted_purchases+1 WHERE profile_id=prof.id AND pool_id=p_pool_id; END IF;
 RETURN jsonb_build_object('ok',true,'ticket_id',ticket,'price',price);
END $$;

REVOKE ALL ON FUNCTION public.orax_beats_draw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orax_beats_draw(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orax_beats_tier(numeric,integer,integer,boolean,boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orax_beats_policy() TO anon, authenticated, service_role;