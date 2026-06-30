
-- 1. profiles 新增字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lifetime_coins_earned bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_login_days int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date date,
  ADD COLUMN IF NOT EXISTS leaderboard_appearances int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ranked_wins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfect_clears int NOT NULL DEFAULT 0;

-- 初始化 lifetime_coins_earned = coins, ranked_wins = wins (估计值)
UPDATE public.profiles SET lifetime_coins_earned = GREATEST(lifetime_coins_earned, coins)
  WHERE lifetime_coins_earned < coins;
UPDATE public.profiles p SET ranked_wins = GREATEST(p.ranked_wins, (
  SELECT count(*)::int FROM ranked_matches rm
  WHERE rm.winner_id = p.id AND rm.match_type = 'ranked' AND rm.status = 'completed'
));
UPDATE public.profiles p SET perfect_clears = GREATEST(p.perfect_clears, (
  SELECT count(*)::int FROM level_progress lp WHERE lp.profile_id = p.id AND lp.best_score = 100
));

-- 2. 清空旧徽章数据
TRUNCATE TABLE public.user_badges;
DELETE FROM public.badges;

-- 3. 插入 38 枚新徽章
INSERT INTO public.badges (name, description, icon, category, rarity) VALUES
-- 排位大师
('排位大师 I','传闻一战百神愁。','Swords','tier_rank','common'),
('排位大师 II','传闻一战百神愁。','Swords','tier_rank','rare'),
('排位大师 III','传闻一战百神愁。','Swords','tier_rank','epic'),
('排位大师 IV','传闻一战百神愁。','Swords','tier_rank','legendary'),
-- 词汇学者
('词汇学者 I','学富五车，词海无涯。','BookOpen','tier_words','common'),
('词汇学者 II','学富五车，词海无涯。','BookOpen','tier_words','rare'),
('词汇学者 III','学富五车，词海无涯。','BookOpen','tier_words','epic'),
('词汇学者 IV','学富五车，词海无涯。','BookOpen','tier_words','legendary'),
-- 淘金客
('淘金客 I','真正的强者，实力与机遇并存。','Coins','tier_coins','common'),
('淘金客 II','真正的强者，实力与机遇并存。','Coins','tier_coins','rare'),
('淘金客 III','真正的强者，实力与机遇并存。','Coins','tier_coins','epic'),
('淘金客 IV','真正的强者，实力与机遇并存。','Coins','tier_coins','legendary'),
-- 完美主义者
('完美主义者 I','我以前有错题恐惧症，现在治好了。','Target','tier_perfect','common'),
('完美主义者 II','我以前有错题恐惧症，现在治好了。','Target','tier_perfect','rare'),
('完美主义者 III','我以前有错题恐惧症，现在治好了。','Target','tier_perfect','epic'),
('完美主义者 IV','我以前有错题恐惧症，现在治好了。','Target','tier_perfect','legendary'),
-- 日积月累
('日积月累 I','不积跬步，无以至千里。','CalendarDays','tier_login_total','common'),
('日积月累 II','不积跬步，无以至千里。','CalendarDays','tier_login_total','rare'),
('日积月累 III','不积跬步，无以至千里。','CalendarDays','tier_login_total','epic'),
('日积月累 IV','不积跬步，无以至千里。','CalendarDays','tier_login_total','legendary'),
-- 坚持不懈
('坚持不懈 I','天选最强打工人。','Flame','tier_streak','common'),
('坚持不懈 II','天选最强打工人。','Flame','tier_streak','rare'),
('坚持不懈 III','天选最强打工人。','Flame','tier_streak','epic'),
('坚持不懈 IV','天选最强打工人。','Flame','tier_streak','legendary'),
-- 勇攀高峰
('勇攀高峰 I','勇敢的人先享受世界。','Mountain','tier_xp','common'),
('勇攀高峰 II','勇敢的人先享受世界。','Mountain','tier_xp','rare'),
('勇攀高峰 III','勇敢的人先享受世界。','Mountain','tier_xp','epic'),
('勇攀高峰 IV','勇敢的人先享受世界。','Mountain','tier_xp','legendary'),
-- 声名远扬
('声名远扬 I','大明星也会有烦恼。','Megaphone','tier_leaderboard','common'),
('声名远扬 II','大明星也会有烦恼。','Megaphone','tier_leaderboard','rare'),
('声名远扬 III','大明星也会有烦恼。','Megaphone','tier_leaderboard','epic'),
('声名远扬 IV','大明星也会有烦恼。','Megaphone','tier_leaderboard','legendary'),
-- 普通成就
('Bonjour!','Hello, World!','Sparkles','common','common'),
-- 特殊红色成就
('双子星','低山臭水遇知音，穷凶极恶双子星。','Users','special','mythology'),
('降维打击','都是同龄人，我原本没想____！','Zap','special','mythology'),
('GOAT','金字塔的尖，方程式的解。','Crown','special','mythology'),
('百万英镑','这得花不少钱，先生。','Banknote','special','mythology'),
('无限进步','于是我们，一拍即合。','Infinity','special','mythology');

-- 4. 重写徽章判定函数
CREATE OR REPLACE FUNCTION public.award_badges_for_profile(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof profiles%ROWTYPE;
  learn_cnt int;
  inserted int := 0;
  names text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO prof FROM profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- 注册即得
  names := names || ARRAY['Bonjour!'];

  -- 词汇学者（英语单词，mastery_level >= 1 视为已掌握）
  SELECT count(*) INTO learn_cnt FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  IF learn_cnt >= 10   THEN names := names || ARRAY['词汇学者 I']; END IF;
  IF learn_cnt >= 100  THEN names := names || ARRAY['词汇学者 II']; END IF;
  IF learn_cnt >= 500  THEN names := names || ARRAY['词汇学者 III']; END IF;
  IF learn_cnt >= 1000 THEN names := names || ARRAY['词汇学者 IV']; END IF;

  -- 排位大师
  IF prof.ranked_wins >= 10  THEN names := names || ARRAY['排位大师 I']; END IF;
  IF prof.ranked_wins >= 50  THEN names := names || ARRAY['排位大师 II']; END IF;
  IF prof.ranked_wins >= 100 THEN names := names || ARRAY['排位大师 III']; END IF;
  IF prof.ranked_wins >= 500 THEN names := names || ARRAY['排位大师 IV']; END IF;

  -- 淘金客（累计获得）
  IF prof.lifetime_coins_earned >= 500   THEN names := names || ARRAY['淘金客 I']; END IF;
  IF prof.lifetime_coins_earned >= 1000  THEN names := names || ARRAY['淘金客 II']; END IF;
  IF prof.lifetime_coins_earned >= 5000  THEN names := names || ARRAY['淘金客 III']; END IF;
  IF prof.lifetime_coins_earned >= 10000 THEN names := names || ARRAY['淘金客 IV']; END IF;

  -- 完美主义者（100% 准确率次数）
  IF prof.perfect_clears >= 1   THEN names := names || ARRAY['完美主义者 I']; END IF;
  IF prof.perfect_clears >= 10  THEN names := names || ARRAY['完美主义者 II']; END IF;
  IF prof.perfect_clears >= 50  THEN names := names || ARRAY['完美主义者 III']; END IF;
  IF prof.perfect_clears >= 100 THEN names := names || ARRAY['完美主义者 IV']; END IF;

  -- 日积月累（累计登录天数）
  IF prof.total_login_days >= 10  THEN names := names || ARRAY['日积月累 I']; END IF;
  IF prof.total_login_days >= 50  THEN names := names || ARRAY['日积月累 II']; END IF;
  IF prof.total_login_days >= 100 THEN names := names || ARRAY['日积月累 III']; END IF;
  IF prof.total_login_days >= 365 THEN names := names || ARRAY['日积月累 IV']; END IF;

  -- 坚持不懈（连续登录）
  IF prof.streak >= 3   THEN names := names || ARRAY['坚持不懈 I']; END IF;
  IF prof.streak >= 10  THEN names := names || ARRAY['坚持不懈 II']; END IF;
  IF prof.streak >= 50  THEN names := names || ARRAY['坚持不懈 III']; END IF;
  IF prof.streak >= 100 THEN names := names || ARRAY['坚持不懈 IV']; END IF;

  -- 勇攀高峰（累计经验值）
  IF prof.total_xp >= 100  THEN names := names || ARRAY['勇攀高峰 I']; END IF;
  IF prof.total_xp >= 500  THEN names := names || ARRAY['勇攀高峰 II']; END IF;
  IF prof.total_xp >= 1000 THEN names := names || ARRAY['勇攀高峰 III']; END IF;
  IF prof.total_xp >= 5000 THEN names := names || ARRAY['勇攀高峰 IV']; END IF;

  -- 声名远扬（登上排行榜次数）
  IF prof.leaderboard_appearances >= 1  THEN names := names || ARRAY['声名远扬 I']; END IF;
  IF prof.leaderboard_appearances >= 5  THEN names := names || ARRAY['声名远扬 II']; END IF;
  IF prof.leaderboard_appearances >= 10 THEN names := names || ARRAY['声名远扬 III']; END IF;
  IF prof.leaderboard_appearances >= 20 THEN names := names || ARRAY['声名远扬 IV']; END IF;

  WITH ins AS (
    INSERT INTO public.user_badges (profile_id, badge_id)
    SELECT p_id, b.id
    FROM public.badges b
    WHERE b.name = ANY(names)
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

-- 5. 特殊徽章发放：用于 Edge Function 调用（service_role）
CREATE OR REPLACE FUNCTION public.grant_special_badge(p_id uuid, p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
BEGIN
  SELECT id INTO bid FROM badges WHERE name = p_name LIMIT 1;
  IF bid IS NULL THEN RETURN false; END IF;
  INSERT INTO user_badges (profile_id, badge_id) VALUES (p_id, bid)
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- 6. 累加 lifetime coins 与 perfect_clears 的辅助函数（Edge Function 调用）
CREATE OR REPLACE FUNCTION public.bump_lifetime_coins(p_id uuid, p_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  UPDATE profiles SET lifetime_coins_earned = lifetime_coins_earned + p_amount WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_ranked_win(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET ranked_wins = ranked_wins + 1 WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_perfect_clear(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET perfect_clears = perfect_clears + 1 WHERE id = p_id;
END;
$$;

-- 7. 登录记录（SECURITY DEFINER，前端可直接调用）
CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  today date := (now() at time zone 'Asia/Shanghai')::date;
  diff int;
  awarded int := 0;
  old_claims text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  IF prof.last_login_date = today THEN
    awarded := public.award_badges_for_profile(prof.id);
    RETURN jsonb_build_object('ok', true, 'already', true, 'awarded', awarded);
  END IF;

  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  diff := COALESCE(today - prof.last_login_date, 999);
  UPDATE profiles SET
    total_login_days = total_login_days + 1,
    streak = CASE WHEN diff = 1 THEN streak + 1 ELSE 1 END,
    last_login_date = today
  WHERE id = prof.id;

  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);

  awarded := public.award_badges_for_profile(prof.id);
  RETURN jsonb_build_object('ok', true, 'awarded', awarded);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_badges_for_profile(uuid) TO authenticated;
