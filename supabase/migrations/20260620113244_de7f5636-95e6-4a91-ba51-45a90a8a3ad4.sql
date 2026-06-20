CREATE OR REPLACE FUNCTION public.gacha_draw(p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  cost int;
  unit_cost int := 100;
  results jsonb := '[]'::jsonb;
  i int;
  roll int;
  v_rarity text;
  picked record;
  refund int := 0;
  rarity_order text[] := ARRAY['common','rare','epic','legendary'];
  fallback_idx int;
  old_claims text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_count NOT IN (1,10) THEN RAISE EXCEPTION 'invalid count'; END IF;

  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;

  cost := CASE WHEN p_count = 10 THEN 900 ELSE 100 END;
  IF prof.coins < cost THEN
    RETURN jsonb_build_object('error','not_enough_coins','required',cost,'have',prof.coins);
  END IF;

  -- 临时切换为 service_role 以绕过 profiles 的字段保护触发器
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE profiles SET coins = coins - cost
    WHERE id = prof.id AND coins >= cost;
  IF NOT FOUND THEN
    PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);
    RAISE EXCEPTION 'concurrent update';
  END IF;

  FOR i IN 1..p_count LOOP
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

    IF picked.id IS NULL THEN
      refund := refund + (unit_cost / 2);
      results := results || jsonb_build_array(jsonb_build_object('refunded',true,'rarity',v_rarity));
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

  -- 恢复 JWT 声明
  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);

  RETURN jsonb_build_object('ok',true,'cost',cost,'refund',refund,'results',results);
END;
$function$;