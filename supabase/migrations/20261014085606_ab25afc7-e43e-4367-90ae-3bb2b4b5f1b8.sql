INSERT INTO name_cards (name, description, background_gradient, icon, category, rarity, in_gacha_pool) VALUES
('词锋破晓','抽奖券限定 · 晨光中第一个拼对的单词','linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #f472b6 100%)','Sunrise','lottery','epic',false),
('墨刃疾行','抽奖券限定 · 笔墨如刃，答题如风','linear-gradient(135deg, #0f172a 0%, #334155 45%, #ef4444 100%)','Swords','lottery','epic',false),
('赤金词典','抽奖券限定 · 燃烧的金色辞书','linear-gradient(135deg, #7f1d1d 0%, #dc2626 35%, #f59e0b 75%, #fde68a 100%)','BookOpen','lottery','legendary',false),
('霜语王座','抽奖券限定 · 冰封王座上的词汇之主','linear-gradient(135deg, #082f49 0%, #0ea5e9 45%, #e0f2fe 100%)','Crown','lottery','legendary',false),
('冠军之誓','抽奖券限定 · 神话 · 只献给真正的冠军','linear-gradient(135deg, #000000 0%, #b8860b 30%, #ffd700 55%, #ff4655 80%, #000000 100%)','Trophy','lottery','mythology',false);

INSERT INTO kill_sound_packs (code, name, description, price, is_default, rarity, preview_icon, icon_url, sound_urls, icon_urls) VALUES
('champions2024','2024 全球冠军赛','抽奖券限定 · 冠军赛专属连杀语音，最高 6 连杀',0,false,'mythology','🏆',
'/__l5e/assets-v1/dbf03053-6c1b-4913-995f-f30df78fc026/champions2024_6.png',
'["/__l5e/assets-v1/2f544aa1-c98b-4bc3-8a67-f82f8cea732a/champions2024_1.mp3","/__l5e/assets-v1/3128c6dd-c294-49dc-a635-bc2397e9f625/champions2024_2.mp3","/__l5e/assets-v1/616db38c-6ed5-45dc-9632-995a116011bd/champions2024_3.mp3","/__l5e/assets-v1/3d463573-103b-485d-b75a-a0c968b20bae/champions2024_4.mp3","/__l5e/assets-v1/8a090d42-9bb0-4e4f-96df-cecea9fd5c16/champions2024_5.mp3","/__l5e/assets-v1/f2d625f4-be37-4824-895e-315db80cf2cc/champions2024_6.mp3"]'::jsonb,
'["/__l5e/assets-v1/a773efee-965b-43ca-990e-40288b55062f/champions2024_1.png","/__l5e/assets-v1/d915dcfb-5d32-45d3-8042-19a7fd69fe9f/champions2024_2.png","/__l5e/assets-v1/9f356dae-95e3-4e37-96cb-da5cfa90e0c3/champions2024_3.png","/__l5e/assets-v1/37d2a8ed-c08a-49f6-9726-22ff32075d87/champions2024_4.png","/__l5e/assets-v1/c5740491-4a6f-4f9a-9471-39433778bf38/champions2024_5.png","/__l5e/assets-v1/dbf03053-6c1b-4913-995f-f30df78fc026/champions2024_6.png"]'::jsonb);

CREATE OR REPLACE FUNCTION public.use_backpack_item(p_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE prof profiles%ROWTYPE; it backpack_items%ROWTYPE; old_claims text; adm record;
  r numeric; coins_amt int := 0; ref uuid; lbl text; kind text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO it FROM backpack_items WHERE id = p_item_id AND profile_id = prof.id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF it.status <> 'unused' THEN RETURN jsonb_build_object('error','used'); END IF;
  IF it.item_type = 'lottery_ticket' THEN
    r := random()*100;
    IF r < 1 THEN kind := 'sound_pack';
      SELECT k.id, k.name INTO ref, lbl FROM kill_sound_packs k WHERE k.code='champions2024'
        AND NOT EXISTS (SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id);
    ELSIF r < 5 THEN kind := 'name_card';
      SELECT n.id, n.name INTO ref, lbl FROM name_cards n WHERE n.category='lottery' AND n.rarity='mythology'
        AND NOT EXISTS (SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id) ORDER BY random() LIMIT 1;
    ELSIF r < 20 THEN kind := 'name_card';
      SELECT n.id, n.name INTO ref, lbl FROM name_cards n WHERE n.category='lottery' AND n.rarity IN ('epic','legendary')
        AND NOT EXISTS (SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id) ORDER BY random() LIMIT 1;
    ELSIF r < 50 THEN kind := 'coins'; coins_amt := 200;
    ELSE kind := 'coins'; coins_amt := 100; END IF;
    IF kind <> 'coins' AND ref IS NULL THEN kind := 'coins'; coins_amt := 200; END IF;
    IF kind = 'sound_pack' THEN
      INSERT INTO user_kill_sound_packs (profile_id, pack_id) VALUES (prof.id, ref) ON CONFLICT DO NOTHING;
      lbl := '连杀音效·' || lbl;
    ELSIF kind = 'name_card' THEN
      INSERT INTO user_name_cards (profile_id, name_card_id) VALUES (prof.id, ref);
      lbl := '名片·' || lbl;
    ELSE
      old_claims := current_setting('request.jwt.claims', true);
      PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
      UPDATE profiles SET coins = coins + coins_amt WHERE id = prof.id;
      PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
      PERFORM bump_lifetime_coins(prof.id, coins_amt);
      lbl := coins_amt || ' 狄邦豆';
    END IF;
    UPDATE backpack_items SET status='used', used_at=now(), label = '抽奖券 → ' || lbl WHERE id = it.id;
    RETURN jsonb_build_object('ok',true,'lottery',true,'kind',kind,'label',lbl);
  END IF;
  IF it.item_type = 'coins' THEN
    old_claims := current_setting('request.jwt.claims', true);
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    UPDATE profiles SET coins = coins + it.amount WHERE id = prof.id;
    PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
    PERFORM bump_lifetime_coins(prof.id, it.amount);
  ELSIF it.item_type = 'name_card' THEN
    INSERT INTO user_name_cards (profile_id, name_card_id) SELECT prof.id, it.ref_id
      WHERE NOT EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id=prof.id AND name_card_id=it.ref_id);
  ELSIF it.item_type = 'sound_pack' THEN
    INSERT INTO user_kill_sound_packs (profile_id, pack_id) VALUES (prof.id, it.ref_id) ON CONFLICT DO NOTHING;
  ELSIF it.item_type = 'water_coupon' THEN
    FOR adm IN SELECT p.id FROM profiles p JOIN user_roles r2 ON r2.user_id = p.user_id AND r2.role='admin' WHERE p.id <> prof.id LOOP
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES (prof.id, adm.id, '【水吧券兑换申请】' || prof.username || ' 申请使用 1 张水吧券，请线下兑换。券号：' || left(it.id::text, 8));
    END LOOP;
    UPDATE backpack_items SET status='pending', used_at=now() WHERE id = it.id;
    RETURN jsonb_build_object('ok',true,'pending',true);
  END IF;
  UPDATE backpack_items SET status='used', used_at=now() WHERE id = it.id;
  RETURN jsonb_build_object('ok',true);
END $function$;