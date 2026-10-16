-- ===== 错题复习奖励：按天记录、服务端发放 =====
CREATE TABLE public.review_reward_daily (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_date date NOT NULL,
  words_total integer NOT NULL DEFAULT 0,
  words_correct integer NOT NULL DEFAULT 0,
  coins_claimed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, reward_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_reward_daily TO authenticated;
GRANT ALL ON public.review_reward_daily TO service_role;
ALTER TABLE public.review_reward_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own review reward records"
  ON public.review_reward_daily FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

-- 复习奖励：每答对1词2豆，周末（北京时间周六/周日）双倍，每天上限120豆
CREATE OR REPLACE FUNCTION public.claim_review_reward(p_correct integer, p_total integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  today date := (now() at time zone 'Asia/Shanghai')::date;
  dow int;
  factor int := 1;
  base int;
  granted int;
  cap_left int;
  row review_reward_daily%ROWTYPE;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_total IS NULL OR p_total < 1 OR p_total > 50
     OR p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad request');
  END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  dow := extract(dow from (now() at time zone 'Asia/Shanghai'))::int;
  IF dow IN (0, 6) THEN factor := 2; END IF;

  INSERT INTO review_reward_daily (profile_id, reward_date, words_total, words_correct, coins_claimed)
  VALUES (prof.id, today, p_total, p_correct, 0)
  ON CONFLICT (profile_id, reward_date) DO UPDATE
    SET words_total = review_reward_daily.words_total + p_total,
        words_correct = review_reward_daily.words_correct + p_correct;
  SELECT * INTO row FROM review_reward_daily
    WHERE profile_id = prof.id AND reward_date = today;

  base := p_correct * 2 * factor;
  cap_left := 120 - row.coins_claimed;
  granted := LEAST(base, GREATEST(cap_left, 0));
  IF granted > 0 THEN
    UPDATE profiles SET coins = coins + granted WHERE id = prof.id;
    PERFORM bump_lifetime_coins(prof.id, granted);
    UPDATE review_reward_daily SET coins_claimed = coins_claimed + granted
      WHERE profile_id = prof.id AND reward_date = today;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coins', granted,
    'weekend', factor = 2,
    'capped', granted < base,
    'todayCoins', row.coins_claimed + granted,
    'todayWords', row.words_correct
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_review_reward(integer, integer) TO authenticated;

-- ===== 每日签到：登录自动发豆，连签递增，周末双倍 =====
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
  v_coins int := 0;
  v_streak int := 1;
  dow int;
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
  v_streak := CASE WHEN diff = 1 THEN prof.streak + 1 ELSE 1 END;
  UPDATE profiles SET
    total_login_days = total_login_days + 1,
    streak = v_streak,
    last_login_date = today
  WHERE id = prof.id;

  -- 签到奖励：连签第1-7天 20/25/30/35/40/50/100，周末双倍
  dow := extract(dow from (now() at time zone 'Asia/Shanghai'))::int;
  v_coins := (ARRAY[20, 25, 30, 35, 40, 50, 100])[LEAST(v_streak, 7)];
  IF dow IN (0, 6) THEN v_coins := v_coins * 2; END IF;
  UPDATE profiles SET coins = coins + v_coins WHERE id = prof.id;
  IF v_coins > 0 THEN
    PERFORM bump_lifetime_coins(prof.id, v_coins);
  END IF;

  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);

  awarded := public.award_badges_for_profile(prof.id);
  RETURN jsonb_build_object('ok', true, 'awarded', awarded, 'coins', v_coins, 'streak', v_streak);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
