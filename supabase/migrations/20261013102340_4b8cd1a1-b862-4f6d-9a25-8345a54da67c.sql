ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_since timestamptz,
  ADD COLUMN IF NOT EXISTS priority_last_claim date;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF jwt_role = 'service_role' THEN RETURN NEW; END IF;
  NEW.xp := OLD.xp; NEW.total_xp := OLD.total_xp; NEW.level := OLD.level;
  NEW.xp_to_next_level := OLD.xp_to_next_level; NEW.coins := OLD.coins;
  NEW.energy := OLD.energy; NEW.max_energy := OLD.max_energy;
  NEW.last_energy_restore := OLD.last_energy_restore; NEW.elo_rating := OLD.elo_rating;
  NEW.elo_free := OLD.elo_free; NEW.rank_tier := OLD.rank_tier; NEW.rank_stars := OLD.rank_stars;
  NEW.rank_points := OLD.rank_points; NEW.wins := OLD.wins; NEW.losses := OLD.losses;
  NEW.free_match_wins := OLD.free_match_wins; NEW.free_match_losses := OLD.free_match_losses;
  NEW.streak := OLD.streak; NEW.max_combo := OLD.max_combo;
  NEW.is_priority := OLD.is_priority; NEW.priority_since := OLD.priority_since;
  NEW.priority_last_claim := OLD.priority_last_claim;
  RETURN NEW;
END; $function$;

CREATE TABLE public.backpack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  amount integer NOT NULL DEFAULT 1,
  ref_id uuid,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'unused',
  source text NOT NULL DEFAULT 'priority_weekly',
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
GRANT SELECT ON public.backpack_items TO authenticated;
GRANT ALL ON public.backpack_items TO service_role;
ALTER TABLE public.backpack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own backpack readable" ON public.backpack_items FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(),'admin'));

INSERT INTO public.badges (name, description, icon, category, rarity)
SELECT '优先特权', '开通狄邦优先账户的尊贵玩家', 'Crown', 'special', 'mythology'
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name='优先特权');
INSERT INTO public.name_cards (name, description, background_gradient, icon, category, rarity, in_gacha_pool)
SELECT '优先铭牌', '狄邦优先账户专属', 'linear-gradient(135deg, #1a1a1a 0%, #b8860b 50%, #ffd700 100%)', 'Crown', 'priority', 'legendary', false
WHERE NOT EXISTS (SELECT 1 FROM name_cards WHERE name='优先铭牌');

CREATE OR REPLACE FUNCTION public.purchase_priority()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE prof profiles%ROWTYPE; cid uuid; old_claims text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF prof.is_priority THEN RETURN jsonb_build_object('error','already'); END IF;
  IF prof.coins < 2000 THEN RETURN jsonb_build_object('error','not_enough_coins','have',prof.coins); END IF;
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET coins = coins - 2000, is_priority = true, priority_since = now() WHERE id = prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  PERFORM grant_special_badge(prof.id, '优先特权');
  SELECT id INTO cid FROM name_cards WHERE name='优先铭牌' LIMIT 1;
  INSERT INTO user_name_cards (profile_id, name_card_id) SELECT prof.id, cid
    WHERE cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id=prof.id AND name_card_id=cid);
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.claim_priority_weekly()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE prof profiles%ROWTYPE; wk date := date_trunc('week', now() at time zone 'Asia/Shanghai')::date;
  r numeric := random()*100; t text; amt int := 1; ref uuid; lbl text; old_claims text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT prof.is_priority THEN RETURN jsonb_build_object('error','not_priority'); END IF;
  IF prof.priority_last_claim IS NOT NULL AND prof.priority_last_claim >= wk THEN
    RETURN jsonb_build_object('error','claimed', 'next', wk + 7); END IF;
  IF r < 0.01 THEN t := 'water_coupon'; lbl := '水吧券';
  ELSIF r < 1.00 THEN t := 'sound_pack';
    SELECT k.id, k.name INTO ref, lbl FROM kill_sound_packs k WHERE k.price > 0
      AND NOT EXISTS (SELECT 1 FROM user_kill_sound_packs u WHERE u.profile_id=prof.id AND u.pack_id=k.id) ORDER BY random() LIMIT 1;
    IF ref IS NULL THEN t := 'coins'; END IF;
  ELSIF r < 5.00 THEN t := 'name_card';
    SELECT n.id, n.name INTO ref, lbl FROM name_cards n WHERE n.in_gacha_pool
      AND NOT EXISTS (SELECT 1 FROM user_name_cards u WHERE u.profile_id=prof.id AND u.name_card_id=n.id) ORDER BY random() LIMIT 1;
    IF ref IS NULL THEN t := 'coins'; END IF;
  ELSIF r < 20.00 THEN t := 'lottery_ticket'; lbl := '抽奖券';
  ELSE t := 'coins'; END IF;
  IF t = 'coins' THEN amt := 1 + floor(random()*300)::int; lbl := amt || ' 狄邦豆'; ref := NULL; END IF;
  IF t = 'sound_pack' THEN lbl := '连杀音效·' || lbl; END IF;
  IF t = 'name_card' THEN lbl := '名牌·' || lbl; END IF;
  INSERT INTO backpack_items (profile_id, item_type, amount, ref_id, label) VALUES (prof.id, t, amt, ref, lbl);
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET priority_last_claim = wk WHERE id = prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  RETURN jsonb_build_object('ok',true,'item_type',t,'label',lbl,'amount',amt);
END $$;

CREATE OR REPLACE FUNCTION public.use_backpack_item(p_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE prof profiles%ROWTYPE; it backpack_items%ROWTYPE; old_claims text; adm record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO it FROM backpack_items WHERE id = p_item_id AND profile_id = prof.id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF it.status <> 'unused' THEN RETURN jsonb_build_object('error','used'); END IF;
  IF it.item_type = 'lottery_ticket' THEN RETURN jsonb_build_object('error','not_available'); END IF;
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
    FOR adm IN SELECT p.id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id AND r.role='admin' WHERE p.id <> prof.id LOOP
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES (prof.id, adm.id, '【水吧券兑换申请】' || prof.username || ' 申请使用 1 张水吧券，请线下兑换。券号：' || left(it.id::text, 8));
    END LOOP;
    UPDATE backpack_items SET status='pending', used_at=now() WHERE id = it.id;
    RETURN jsonb_build_object('ok',true,'pending',true);
  END IF;
  UPDATE backpack_items SET status='used', used_at=now() WHERE id = it.id;
  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE EXECUTE ON FUNCTION public.purchase_priority(), public.claim_priority_weekly(), public.use_backpack_item(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.purchase_priority(), public.claim_priority_weekly(), public.use_backpack_item(uuid) TO authenticated;