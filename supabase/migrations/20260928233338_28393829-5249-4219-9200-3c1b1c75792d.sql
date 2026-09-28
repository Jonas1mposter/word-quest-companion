-- 1. 兑换码表
CREATE TABLE public.redemption_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  reward_type text NOT NULL DEFAULT 'coins',
  reward_value integer NOT NULL DEFAULT 0,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.redemption_codes TO service_role;
ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;

-- 2. 兑换记录表
CREATE TABLE public.code_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id uuid NOT NULL REFERENCES public.redemption_codes(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (code_id, profile_id)
);
GRANT ALL ON public.code_redemptions TO service_role;
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;

-- 3. 兑换函数（仅 service_role 可执行，前端走 Edge Function 或 authenticated 调用）
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $redeem$
DECLARE
  v_uid uuid := auth.uid();
  v_profile profiles%ROWTYPE;
  v_code redemption_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_code FROM redemption_codes WHERE upper(code) = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_disabled');
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired');
  END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_used_up');
  END IF;
  IF EXISTS (SELECT 1 FROM code_redemptions WHERE code_id = v_code.id AND profile_id = v_profile.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO code_redemptions (code_id, profile_id) VALUES (v_code.id, v_profile.id);
  UPDATE redemption_codes SET uses_count = uses_count + 1 WHERE id = v_code.id;

  IF v_code.reward_type = 'coins' THEN
    UPDATE profiles SET coins = coins + v_code.reward_value WHERE id = v_profile.id;
    PERFORM bump_lifetime_coins(v_profile.id, v_code.reward_value);
  END IF;

  RETURN jsonb_build_object('ok', true, 'reward_type', v_code.reward_type, 'reward_value', v_code.reward_value);
END;
$redeem$;
REVOKE ALL ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated, service_role;

-- 4. 预置兑换码：DIPONTWORDMASTERS2 = 1000 狄邦豆
INSERT INTO public.redemption_codes (code, reward_type, reward_value)
VALUES ('DIPONTWORDMASTERS2', 'coins', 1000);

-- 5. 淘金客 IV 条件：10000 -> 30000
CREATE OR REPLACE FUNCTION public.award_badges_for_profile(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof profiles%ROWTYPE; learn_cnt int; inserted int := 0; names text[] := ARRAY[]::text[];
  purchasable_cards int; owned_cards int; purchasable_packs int; owned_packs int;
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
$function$;