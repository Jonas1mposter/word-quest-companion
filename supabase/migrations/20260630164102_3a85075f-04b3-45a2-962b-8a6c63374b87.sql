
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
  purchasable_cards int;
  owned_cards int;
  purchasable_packs int;
  owned_packs int;
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
  IF prof.lifetime_coins_earned >= 10000 THEN names := names || ARRAY['淘金客 IV']; END IF;

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

  -- 百万英镑：拥有商城内全部可购买名片 & 音效（gacha 池中的卡 + 有价格的音效）
  SELECT count(*) INTO purchasable_cards FROM name_cards WHERE in_gacha_pool = true;
  SELECT count(*) INTO owned_cards FROM user_name_cards u
    JOIN name_cards n ON n.id = u.name_card_id
    WHERE u.profile_id = p_id AND n.in_gacha_pool = true;
  SELECT count(*) INTO purchasable_packs FROM kill_sound_packs WHERE price > 0;
  SELECT count(*) INTO owned_packs FROM user_kill_sound_packs u
    JOIN kill_sound_packs k ON k.id = u.pack_id
    WHERE u.profile_id = p_id AND k.price > 0;
  IF purchasable_cards > 0 AND purchasable_packs > 0
     AND owned_cards >= purchasable_cards AND owned_packs >= purchasable_packs THEN
    names := names || ARRAY['百万英镑'];
  END IF;

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
