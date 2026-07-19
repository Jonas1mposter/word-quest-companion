
-- Season pass XP grant + level up
CREATE OR REPLACE FUNCTION public.add_season_pass_xp(p_profile_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid;
  v_pass user_season_pass%ROWTYPE;
  v_max_level int;
  v_xp int;
  v_lv int;
  v_next int;
BEGIN
  IF p_xp IS NULL OR p_xp <= 0 THEN RETURN; END IF;

  SELECT id INTO v_season FROM seasons
    WHERE is_active = true
    ORDER BY start_date DESC NULLS LAST LIMIT 1;
  IF v_season IS NULL THEN RETURN; END IF;

  SELECT * INTO v_pass FROM user_season_pass
    WHERE profile_id = p_profile_id AND season_id = v_season;
  IF NOT FOUND THEN
    INSERT INTO user_season_pass (profile_id, season_id)
      VALUES (p_profile_id, v_season)
      RETURNING * INTO v_pass;
  END IF;

  SELECT COALESCE(MAX(level), 50) INTO v_max_level FROM season_pass_items WHERE season_id = v_season;

  v_xp := COALESCE(v_pass.current_xp, 0) + p_xp;
  v_lv := COALESCE(v_pass.current_level, 1);
  v_next := COALESCE(v_pass.xp_to_next_level, 100);

  WHILE v_xp >= v_next AND v_lv < v_max_level LOOP
    v_xp := v_xp - v_next;
    v_lv := v_lv + 1;
    v_next := 100 + (v_lv - 1) * 20;
  END LOOP;

  IF v_lv >= v_max_level THEN
    v_lv := v_max_level;
    v_xp := 0;
  END IF;

  UPDATE user_season_pass
    SET current_xp = v_xp, current_level = v_lv, xp_to_next_level = v_next
    WHERE id = v_pass.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_season_pass_xp(uuid, integer) TO authenticated, service_role;

-- Gacha: full refund when nothing left in pool
CREATE OR REPLACE FUNCTION public.gacha_draw(p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  cost int;
  unit_cost int := 100;
  results jsonb := '[]'::jsonb;
  i int;
  roll int;
  myth_roll int;
  v_rarity text;
  picked record;
  refund int := 0;
  rarity_order text[] := ARRAY['common','rare','epic','legendary'];
  fallback_idx int;
  old_claims text;
  unowned_regular int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_count NOT IN (1,10) THEN RAISE EXCEPTION 'invalid count'; END IF;

  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;

  cost := CASE WHEN p_count = 10 THEN 900 ELSE 100 END;
  IF prof.coins < cost THEN
    RETURN jsonb_build_object('error','not_enough_coins','required',cost,'have',prof.coins);
  END IF;

  -- Pre-check: any unowned regular pool card?
  SELECT count(*) INTO unowned_regular
  FROM name_cards n
  WHERE n.in_gacha_pool = true
    AND n.rarity = ANY(rarity_order)
    AND NOT EXISTS (
      SELECT 1 FROM user_name_cards u
      WHERE u.profile_id = prof.id AND u.name_card_id = n.id
    );
  IF unowned_regular = 0 THEN
    RETURN jsonb_build_object('error','pool_exhausted');
  END IF;

  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE profiles SET coins = coins - cost
    WHERE id = prof.id AND coins >= cost;
  IF NOT FOUND THEN
    PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);
    RAISE EXCEPTION 'concurrent update';
  END IF;

  FOR i IN 1..p_count LOOP
    picked := NULL;

    myth_roll := floor(random() * 1000)::int;
    IF myth_roll < 5 THEN
      SELECT n.* INTO picked
      FROM name_cards n
      WHERE n.in_gacha_pool = true AND n.rarity = 'mythology'
        AND NOT EXISTS (
          SELECT 1 FROM user_name_cards u
          WHERE u.profile_id = prof.id AND u.name_card_id = n.id
        )
      ORDER BY random() LIMIT 1;
    END IF;

    IF picked.id IS NULL THEN
      roll := floor(random() * 100)::int;
      v_rarity := CASE
        WHEN roll < 45 THEN 'common'
        WHEN roll < 80 THEN 'rare'
        WHEN roll < 95 THEN 'epic'
        ELSE 'legendary'
      END;

      SELECT n.* INTO picked
      FROM name_cards n
      WHERE n.in_gacha_pool = true AND n.rarity = v_rarity
        AND NOT EXISTS (
          SELECT 1 FROM user_name_cards u
          WHERE u.profile_id = prof.id AND u.name_card_id = n.id
        )
      ORDER BY random() LIMIT 1;

      IF picked.id IS NULL THEN
        fallback_idx := array_position(rarity_order, v_rarity);
        WHILE picked.id IS NULL AND fallback_idx > 1 LOOP
          fallback_idx := fallback_idx - 1;
          SELECT n.* INTO picked
          FROM name_cards n
          WHERE n.in_gacha_pool = true AND n.rarity = rarity_order[fallback_idx]
            AND NOT EXISTS (
              SELECT 1 FROM user_name_cards u
              WHERE u.profile_id = prof.id AND u.name_card_id = n.id
            )
          ORDER BY random() LIMIT 1;
        END LOOP;
      END IF;

      -- 向上兜底：低稀有度也拿不到就往高稀有度找
      IF picked.id IS NULL THEN
        fallback_idx := array_position(rarity_order, v_rarity);
        WHILE picked.id IS NULL AND fallback_idx < array_length(rarity_order,1) LOOP
          fallback_idx := fallback_idx + 1;
          SELECT n.* INTO picked
          FROM name_cards n
          WHERE n.in_gacha_pool = true AND n.rarity = rarity_order[fallback_idx]
            AND NOT EXISTS (
              SELECT 1 FROM user_name_cards u
              WHERE u.profile_id = prof.id AND u.name_card_id = n.id
            )
          ORDER BY random() LIMIT 1;
        END LOOP;
      END IF;
    END IF;

    IF picked.id IS NULL THEN
      -- 全额返还该次抽取的费用
      refund := refund + unit_cost;
      results := results || jsonb_build_array(jsonb_build_object('refunded',true,'rarity',COALESCE(v_rarity,'common')));
      CONTINUE;
    END IF;

    INSERT INTO user_name_cards (profile_id, name_card_id)
    VALUES (prof.id, picked.id)
    ON CONFLICT DO NOTHING;

    results := results || jsonb_build_array(jsonb_build_object(
      'id', picked.id,
      'name', picked.name,
      'rarity', picked.rarity,
      'icon', picked.icon,
      'background_gradient', picked.background_gradient,
      'description', picked.description
    ));
  END LOOP;

  IF refund > 0 THEN
    UPDATE profiles SET coins = coins + refund WHERE id = prof.id;
  END IF;

  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);

  RETURN jsonb_build_object('ok',true,'cost',cost,'refund',refund,'results',results);
END;
$$;
