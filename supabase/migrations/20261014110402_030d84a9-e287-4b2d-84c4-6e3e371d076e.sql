CREATE OR REPLACE FUNCTION public.choose_backpack_reward(p_item_id uuid, p_choice text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prof_id uuid; it backpack_items%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_choice NOT IN ('merit','water_coupon') THEN RETURN jsonb_build_object('error','invalid_choice'); END IF;
  SELECT id INTO prof_id FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO it FROM backpack_items WHERE id = p_item_id AND profile_id = prof_id FOR UPDATE;
  IF NOT FOUND OR it.item_type <> 'merit_or_coupon' OR it.status <> 'unused' THEN RETURN jsonb_build_object('error','not_found'); END IF;
  UPDATE backpack_items SET item_type = p_choice, label = CASE WHEN p_choice='merit' THEN 'Merit' ELSE '水吧券' END WHERE id = it.id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.choose_backpack_reward(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.choose_backpack_reward(uuid, text) TO authenticated;

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
  IF it.item_type = 'merit_or_coupon' THEN RETURN jsonb_build_object('error','choose_first'); END IF;
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
  ELSIF it.item_type IN ('water_coupon','merit') THEN
    FOR adm IN SELECT p.id FROM profiles p JOIN user_roles r2 ON r2.user_id = p.user_id AND r2.role='admin' WHERE p.id <> prof.id LOOP
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES (prof.id, adm.id,
        CASE WHEN it.item_type='merit'
          THEN '【Merit 兑换申请】' || prof.username || ' 申请兑换 ' || it.amount || ' 个 Merit（排行榜奖励），请线下登记。券号：' || left(it.id::text, 8)
          ELSE '【水吧券兑换申请】' || prof.username || ' 申请使用 1 张水吧券，请线下兑换。券号：' || left(it.id::text, 8) END);
    END LOOP;
    UPDATE backpack_items SET status='pending', used_at=now() WHERE id = it.id;
    RETURN jsonb_build_object('ok',true,'pending',true);
  END IF;
  UPDATE backpack_items SET status='used', used_at=now() WHERE id = it.id;
  RETURN jsonb_build_object('ok',true);
END $function$;