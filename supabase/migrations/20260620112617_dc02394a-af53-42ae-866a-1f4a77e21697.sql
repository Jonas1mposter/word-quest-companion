-- 1) 抽卡池标记
ALTER TABLE public.name_cards
  ADD COLUMN IF NOT EXISTS in_gacha_pool boolean NOT NULL DEFAULT false;

UPDATE public.name_cards
SET in_gacha_pool = true
WHERE category NOT IN ('leaderboard_coins','leaderboard_wins','leaderboard_xp','team','special');

-- 2) 徽章自动发放
CREATE OR REPLACE FUNCTION public.award_badges_for_profile(p_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof profiles%ROWTYPE;
  learn_cnt int;
  math_cnt int;
  sci_cnt int;
  math_total int;
  sci_total int;
  perfect_cnt int;
  three_star_cnt int;
  inserted int := 0;
  awarded_names text[];
BEGIN
  SELECT * INTO prof FROM profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT count(*) INTO learn_cnt FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO math_cnt FROM math_learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO sci_cnt FROM science_learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO math_total FROM math_words;
  SELECT count(*) INTO sci_total FROM science_words;
  SELECT count(*) INTO perfect_cnt FROM level_progress WHERE profile_id = p_id AND best_score = 100;
  SELECT count(*) INTO three_star_cnt FROM level_progress WHERE profile_id = p_id AND stars >= 3;

  awarded_names := ARRAY[]::text[];

  IF learn_cnt >= 1 OR prof.wins + prof.losses >= 0 THEN
    awarded_names := awarded_names || ARRAY['初出茅庐','初入江湖','初来乍到','新手上路','起步之星'];
  END IF;
  IF learn_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['词汇新秀','词汇学徒','学海无涯']; END IF;
  IF learn_cnt >= 500 THEN awarded_names := awarded_names || ARRAY['词海探险家','词汇达人']; END IF;
  IF learn_cnt >= 1000 THEN awarded_names := awarded_names || ARRAY['单词大师','词汇大师']; END IF;
  IF learn_cnt >= 2000 THEN awarded_names := awarded_names || ARRAY['博学多才','词汇宗师']; END IF;

  -- 战斗
  IF prof.wins >= 1 THEN awarded_names := awarded_names || ARRAY['首战告捷','初战告捷']; END IF;
  IF prof.wins >= 50 THEN awarded_names := awarded_names || ARRAY['常胜将军']; END IF;
  IF prof.wins + prof.losses >= 100 THEN awarded_names := awarded_names || ARRAY['百战勇士']; END IF;
  IF prof.wins >= 1000 THEN awarded_names := awarded_names || ARRAY['千胜传说']; END IF;
  IF prof.wins >= 100 AND prof.losses * 10 <= prof.wins THEN awarded_names := awarded_names || ARRAY['不败战神']; END IF;

  -- 连击
  IF prof.max_combo >= 3 THEN awarded_names := awarded_names || ARRAY['连胜新星']; END IF;
  IF prof.max_combo >= 10 THEN awarded_names := awarded_names || ARRAY['闪电侠']; END IF;
  IF prof.max_combo >= 20 THEN awarded_names := awarded_names || ARRAY['Combo之王']; END IF;

  -- 满分相关
  IF perfect_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['满分学霸','完美主义','完美主义者']; END IF;
  IF three_star_cnt >= 10 THEN awarded_names := awarded_names || ARRAY['三星收割机']; END IF;
  IF perfect_cnt >= 5 THEN awarded_names := awarded_names || ARRAY['完美碾压']; END IF;

  -- 段位
  IF prof.rank_tier IN ('silver','gold','platinum','diamond','master') THEN awarded_names := awarded_names || ARRAY['白银新秀']; END IF;
  IF prof.rank_tier IN ('gold','platinum','diamond','master') THEN awarded_names := awarded_names || ARRAY['黄金战士']; END IF;
  IF prof.rank_tier IN ('platinum','diamond','master') THEN awarded_names := awarded_names || ARRAY['铂金精英']; END IF;
  IF prof.rank_tier IN ('diamond','master') THEN awarded_names := awarded_names || ARRAY['钻石传说','王者荣耀']; END IF;
  IF prof.rank_tier = 'master' THEN awarded_names := awarded_names || ARRAY['最强王者','巅峰王者','传奇玩家']; END IF;

  -- 财富
  IF prof.coins >= 100 THEN awarded_names := awarded_names || ARRAY['小有积蓄']; END IF;
  IF prof.coins >= 1000 THEN awarded_names := awarded_names || ARRAY['财富新贵','富甲一方']; END IF;
  IF prof.coins >= 5000 THEN awarded_names := awarded_names || ARRAY['金库守护']; END IF;
  IF prof.coins >= 10000 THEN awarded_names := awarded_names || ARRAY['财富传奇']; END IF;

  -- 连续打卡
  IF prof.streak >= 3 THEN awarded_names := awarded_names || ARRAY['三日打卡']; END IF;
  IF prof.streak >= 7 THEN awarded_names := awarded_names || ARRAY['坚持不懈']; END IF;
  IF prof.streak >= 30 THEN awarded_names := awarded_names || ARRAY['月度达人','学霸之路']; END IF;
  IF prof.streak >= 100 THEN awarded_names := awarded_names || ARRAY['百日坚持']; END IF;
  IF prof.streak >= 365 THEN awarded_names := awarded_names || ARRAY['全年无休']; END IF;

  -- 等级
  IF prof.level >= 10 THEN awarded_names := awarded_names || ARRAY['经验丰富']; END IF;
  IF prof.level >= 20 THEN awarded_names := awarded_names || ARRAY['升级达人']; END IF;
  IF prof.level >= 50 THEN awarded_names := awarded_names || ARRAY['高手之路']; END IF;

  -- 数学
  IF math_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['数学启蒙']; END IF;
  IF math_cnt >= 50 THEN awarded_names := awarded_names || ARRAY['数学新手']; END IF;
  IF math_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['数学达人']; END IF;
  IF math_total > 0 AND math_cnt >= math_total THEN awarded_names := awarded_names || ARRAY['数学大师']; END IF;

  -- 科学
  IF sci_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['科学启蒙']; END IF;
  IF sci_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['科学新手']; END IF;
  IF sci_cnt >= 300 THEN awarded_names := awarded_names || ARRAY['科学探索者']; END IF;
  IF sci_cnt >= 500 THEN awarded_names := awarded_names || ARRAY['科学先锋']; END IF;
  IF sci_total > 0 AND sci_cnt >= sci_total THEN awarded_names := awarded_names || ARRAY['科学大师']; END IF;

  -- 批量插入（去重）
  WITH ins AS (
    INSERT INTO public.user_badges (profile_id, badge_id)
    SELECT p_id, b.id
    FROM public.badges b
    WHERE b.name = ANY(awarded_names)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_badges ub
        WHERE ub.profile_id = p_id AND ub.badge_id = b.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_badges_for_profile(uuid) TO authenticated, service_role;

-- 3) 抽卡函数
CREATE OR REPLACE FUNCTION public.gacha_draw(p_count int)
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
  rarity text;
  picked record;
  refund int := 0;
  rarity_order text[] := ARRAY['common','rare','epic','legendary'];
  fallback_idx int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_count NOT IN (1,10) THEN RAISE EXCEPTION 'invalid count'; END IF;

  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;

  cost := CASE WHEN p_count = 10 THEN 900 ELSE 100 END;
  IF prof.coins < cost THEN
    RETURN jsonb_build_object('error','not_enough_coins','required',cost,'have',prof.coins);
  END IF;

  -- 原子扣费（乐观锁）
  UPDATE profiles SET coins = coins - cost
    WHERE id = prof.id AND coins >= cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'concurrent update'; END IF;

  FOR i IN 1..p_count LOOP
    roll := floor(random() * 100)::int; -- 0-99
    rarity := CASE
      WHEN roll < 45 THEN 'common'
      WHEN roll < 80 THEN 'rare'
      WHEN roll < 95 THEN 'epic'
      ELSE 'legendary'
    END;

    -- 优先未拥有
    SELECT n.* INTO picked
    FROM name_cards n
    WHERE n.in_gacha_pool = true AND n.rarity = rarity
      AND NOT EXISTS (
        SELECT 1 FROM user_name_cards u
        WHERE u.profile_id = prof.id AND u.name_card_id = n.id
      )
    ORDER BY random() LIMIT 1;

    -- 该稀有度都已拥有：向下兼容去更低稀有度找
    IF picked.id IS NULL THEN
      fallback_idx := array_position(rarity_order, rarity);
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

    -- 池子全空：退一半钱并标记
    IF picked.id IS NULL THEN
      refund := refund + (unit_cost / 2);
      results := results || jsonb_build_array(jsonb_build_object('refunded',true,'rarity',rarity));
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

  RETURN jsonb_build_object('ok',true,'cost',cost,'refund',refund,'results',results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gacha_draw(int) TO authenticated;