-- 1) 结束第一赛季
UPDATE public.seasons SET is_active = false WHERE is_active = true;

-- 2) 创建第二赛季：远航（七年级 / 八年级 / 高中）
WITH src AS (
  SELECT * FROM public.seasons WHERE name = '第一赛季：起源' AND grade = 7 LIMIT 1
), new_seasons AS (
  INSERT INTO public.seasons (name, grade, is_active, start_date, end_date, theme, bonus_multiplier, description, icon, primary_color, secondary_color)
  SELECT '第二赛季：远航', g.grade, true, now(), now() + interval '60 days',
         COALESCE(src.theme, 'voyage'), COALESCE(src.bonus_multiplier, 1.0),
         '扬帆远航，征服新词海', COALESCE(src.icon, 'Ship'),
         COALESCE(src.primary_color, '#38bdf8'), COALESCE(src.secondary_color, '#a78bfa')
  FROM (VALUES (7),(8),(9)) AS g(grade), src
  RETURNING id, grade
)
INSERT INTO public.season_pass_items (season_id, level, is_premium, reward_type, reward_value, icon, name, description, reward_meta)
SELECT ns.id, i.level, i.is_premium, i.reward_type, i.reward_value, i.icon, i.name, i.description, i.reward_meta
FROM new_seasons ns
CROSS JOIN LATERAL (
  SELECT level, is_premium, reward_type, reward_value, icon, name, description, reward_meta
  FROM public.season_pass_items
  WHERE season_id = (SELECT id FROM public.seasons WHERE name = '第一赛季：起源' AND grade = 7 LIMIT 1)
) i;

-- 3) 赛季经验按玩家所在分区结算（原实现会随机挑一个赛季）
CREATE OR REPLACE FUNCTION public.add_season_pass_xp(p_profile_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grade int;
  v_season uuid;
  v_pass user_season_pass%ROWTYPE;
  v_max_level int;
  v_xp int;
  v_lv int;
  v_next int;
BEGIN
  IF p_xp IS NULL OR p_xp <= 0 THEN RETURN; END IF;

  SELECT grade INTO v_grade FROM profiles WHERE id = p_profile_id;

  SELECT id INTO v_season FROM seasons
    WHERE is_active = true AND grade = COALESCE(v_grade, 7)
    ORDER BY start_date DESC NULLS LAST LIMIT 1;

  IF v_season IS NULL THEN
    SELECT id INTO v_season FROM seasons
      WHERE is_active = true
      ORDER BY start_date DESC NULLS LAST LIMIT 1;
  END IF;
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