-- 1. 每周排行榜奖励发放台账（幂等，防重复发放）
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  week_start date NOT NULL,
  rank_position int NOT NULL,
  coins int NOT NULL DEFAULT 0,
  xp int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, category, week_start)
);
GRANT ALL ON public.weekly_leaderboard_rewards TO service_role;
ALTER TABLE public.weekly_leaderboard_rewards ENABLE ROW LEVEL SECURITY;

-- 2. 新增红色成就（6 神话 + 6 传说）
INSERT INTO public.badges (name, description, icon, category, rarity)
SELECT * FROM (VALUES
  ('富甲一方', '狄邦首富，非你莫属。', 'Banknote', 'special', 'mythology'),
  ('登峰造极', '山高人为峰。', 'Mountain', 'special', 'mythology'),
  ('人机噩梦', '机器的噩梦，人类的骄傲。', 'Target', 'special', 'mythology'),
  ('无懈可击', '完美，已成习惯。', 'Shield', 'special', 'mythology'),
  ('经验之神', '经验的尽头是你。', 'TrendingUp', 'special', 'mythology'),
  ('大满贯', '三榜尽归一人手。', 'Crown', 'special', 'mythology'),
  ('学贯中西', '词海无涯，你已上岸。', 'Library', 'special', 'legendary'),
  ('千胜传说', '千胜之后，皆是传说。', 'Trophy', 'special', 'legendary'),
  ('全勤传奇', '两年如一日的坚持。', 'CalendarDays', 'special', 'legendary'),
  ('收藏大亨', '名片墙上，琳琅满目。', 'Gem', 'special', 'legendary'),
  ('连击之神', '手指与大脑的完美协奏。', 'Flame', 'special', 'legendary'),
  ('双冠王', '两榜提名，实力使然。', 'Medal', 'special', 'legendary')
) AS v(name, description, icon, category, rarity)
WHERE NOT EXISTS (SELECT 1 FROM public.badges b WHERE b.name = v.name);

-- 3. 成就自动发放函数：追加新红色成就条件
CREATE OR REPLACE FUNCTION public.award_badges_for_profile(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof profiles%ROWTYPE; learn_cnt int; inserted int := 0; names text[] := ARRAY[]::text[];
  purchasable_cards int; owned_cards int; purchasable_packs int; owned_packs int;
  all_cards int; lb_cards int;
BEGIN
  SELECT * INTO prof FROM profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  names := names || ARRAY['Bonjour!'];

  SELECT count(*) INTO learn_cnt FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  IF learn_cnt >= 10   THEN names := names || ARRAY['词汇学者 I']; END IF;
  IF learn_cnt >= 100  THEN names := names || ARRAY['词汇学者 II']; END IF;
  IF learn_cnt >= 500  THEN names := names || ARRAY['词汇学者 III']; END IF;
  IF learn_cnt >= 1000 THEN names := names || ARRAY['词汇学者 IV']; END IF;

  IF prof.ranked_wins >= 10  THEN names := names || ARRAY['排位大师 I']; END IF;
  IF prof.ranked_wins >= 50  THEN names := names || ARRAY['排位大师 II']; END IF;
  IF prof.ranked_wins >= 100 THEN names := names || ARRAY['排位大师 III']; END IF;
  IF prof.ranked_wins >= 500 THEN names := names || ARRAY['排位大师 IV']; END IF;

  IF prof.lifetime_coins_earned >= 500   THEN names := names || ARRAY['淘金客 I']; END IF;
  IF prof.lifetime_coins_earned >= 1000  THEN names := names || ARRAY['淘金客 II']; END IF;
  IF prof.lifetime_coins_earned >= 5000  THEN names := names || ARRAY['淘金客 III']; END IF;
  IF prof.lifetime_coins_earned >= 30000 THEN names := names || ARRAY['淘金客 IV']; END IF;

  IF prof.perfect_clears >= 1   THEN names := names || ARRAY['完美主义者 I']; END IF;
  IF prof.perfect_clears >= 10  THEN names := names || ARRAY['完美主义者 II']; END IF;
  IF prof.perfect_clears >= 50  THEN names := names || ARRAY['完美主义者 III']; END IF;
  IF prof.perfect_clears >= 100 THEN names := names || ARRAY['完美主义者 IV']; END IF;

  IF prof.total_login_days >= 10  THEN names := names || ARRAY['日积月累 I']; END IF;
  IF prof.total_login_days >= 50  THEN names := names || ARRAY['日积月累 II']; END IF;
  IF prof.total_login_days >= 100 THEN names := names || ARRAY['日积月累 III']; END IF;
  IF prof.total_login_days >= 365 THEN names := names || ARRAY['日积月累 IV']; END IF;

  IF prof.streak >= 3   THEN names := names || ARRAY['坚持不懈 I']; END IF;
  IF prof.streak >= 10  THEN names := names || ARRAY['坚持不懈 II']; END IF;
  IF prof.streak >= 50  THEN names := names || ARRAY['坚持不懈 III']; END IF;
  IF prof.streak >= 100 THEN names := names || ARRAY['坚持不懈 IV']; END IF;

  IF prof.total_xp >= 100  THEN names := names || ARRAY['勇攀高峰 I']; END IF;
  IF prof.total_xp >= 500  THEN names := names || ARRAY['勇攀高峰 II']; END IF;
  IF prof.total_xp >= 1000 THEN names := names || ARRAY['勇攀高峰 III']; END IF;
  IF prof.total_xp >= 5000 THEN names := names || ARRAY['勇攀高峰 IV']; END IF;

  IF prof.leaderboard_appearances >= 1  THEN names := names || ARRAY['声名远扬 I']; END IF;
  IF prof.leaderboard_appearances >= 5  THEN names := names || ARRAY['声名远扬 II']; END IF;
  IF prof.leaderboard_appearances >= 10 THEN names := names || ARRAY['声名远扬 III']; END IF;
  IF prof.leaderboard_appearances >= 20 THEN names := names || ARRAY['声名远扬 IV']; END IF;

  IF prof.bot_wins >= 10  THEN names := names || ARRAY['机械终结者 I']; END IF;
  IF prof.bot_wins >= 50  THEN names := names || ARRAY['机械终结者 II']; END IF;
  IF prof.bot_wins >= 100 THEN names := names || ARRAY['机械终结者 III']; END IF;
  IF prof.bot_wins >= 300 THEN names := names || ARRAY['机械终结者 IV']; END IF;

  -- 起航
  IF learn_cnt >= 1 OR EXISTS (SELECT 1 FROM hs_learning_progress WHERE profile_id=p_id)
     OR EXISTS (SELECT 1 FROM math_learning_progress WHERE profile_id=p_id)
     OR EXISTS (SELECT 1 FROM science_learning_progress WHERE profile_id=p_id) THEN names := names || ARRAY['初识词汇']; END IF;
  IF EXISTS (SELECT 1 FROM level_progress WHERE profile_id=p_id AND status='completed') THEN names := names || ARRAY['初出茅庐']; END IF;
  IF prof.ranked_wins >= 1 THEN names := names || ARRAY['首战告捷']; END IF;
  IF prof.bot_wins >= 1 THEN names := names || ARRAY['人机初胜']; END IF;
  IF EXISTS (SELECT 1 FROM friendships WHERE user1_id=p_id OR user2_id=p_id) THEN names := names || ARRAY['以文会友']; END IF;
  IF EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id=p_id) THEN names := names || ARRAY['开箱惊喜']; END IF;
  IF EXISTS (SELECT 1 FROM user_kill_sound_packs u JOIN kill_sound_packs k ON k.id=u.pack_id WHERE u.profile_id=p_id AND k.price>0) THEN names := names || ARRAY['声声入耳']; END IF;

  SELECT count(*) INTO purchasable_cards FROM name_cards WHERE in_gacha_pool = true;
  SELECT count(*) INTO owned_cards FROM user_name_cards u JOIN name_cards n ON n.id = u.name_card_id
    WHERE u.profile_id = p_id AND n.in_gacha_pool = true;
  SELECT count(*) INTO purchasable_packs FROM kill_sound_packs WHERE price > 0;
  SELECT count(*) INTO owned_packs FROM user_kill_sound_packs u JOIN kill_sound_packs k ON k.id = u.pack_id
    WHERE u.profile_id = p_id AND k.price > 0;
  IF purchasable_cards > 0 AND purchasable_packs > 0
     AND owned_cards >= purchasable_cards AND owned_packs >= purchasable_packs THEN
    names := names || ARRAY['百万英镑'];
  END IF;

  -- ===== 新增红色成就 =====
  IF prof.lifetime_coins_earned >= 100000 THEN names := names || ARRAY['富甲一方']; END IF;
  IF prof.level >= 50 THEN names := names || ARRAY['登峰造极']; END IF;
  IF prof.bot_wins >= 1000 THEN names := names || ARRAY['人机噩梦']; END IF;
  IF prof.perfect_clears >= 500 THEN names := names || ARRAY['无懈可击']; END IF;
  IF prof.total_xp >= 20000 THEN names := names || ARRAY['经验之神']; END IF;
  IF learn_cnt >= 2000 THEN names := names || ARRAY['学贯中西']; END IF;
  IF prof.ranked_wins >= 1000 THEN names := names || ARRAY['千胜传说']; END IF;
  IF prof.total_login_days >= 730 THEN names := names || ARRAY['全勤传奇']; END IF;
  IF COALESCE(prof.max_combo, 0) >= 50 THEN names := names || ARRAY['连击之神']; END IF;

  SELECT count(*) INTO all_cards FROM user_name_cards WHERE profile_id = p_id;
  IF all_cards >= 20 THEN names := names || ARRAY['收藏大亨']; END IF;

  SELECT count(*) INTO lb_cards FROM user_name_cards WHERE profile_id = p_id AND rank_position IS NOT NULL;
  IF lb_cards >= 2 THEN names := names || ARRAY['双冠王']; END IF;
  IF lb_cards >= 3 THEN names := names || ARRAY['大满贯']; END IF;

  WITH ins AS (
    INSERT INTO public.user_badges (profile_id, badge_id)
    SELECT p_id, b.id FROM public.badges b
    WHERE b.name = ANY(names)
      AND NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.profile_id = p_id AND ub.badge_id = b.id)
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END;
$function$