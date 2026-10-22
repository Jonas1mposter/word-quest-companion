CREATE OR REPLACE FUNCTION public.hw_tick(p_match uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; b record; v_target int; v_gain int; v_done boolean; s0 int; s1 int; v_team int;
  pl record; v_base int; v_today int; v_coins int; v_day date := (now() AT TIME ZONE 'Asia/Shanghai')::date; v_rc int;
  v_claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT * INTO m FROM halloween_matches WHERE id=p_match FOR UPDATE;
  IF m IS NULL OR m.status <> 'active' THEN RETURN; END IF;
  SELECT bool_and(answered >= 30) INTO v_done FROM halloween_players WHERE match_id=p_match AND NOT is_bot;
  v_done := coalesce(v_done,true) OR now() >= m.ends_at;
  FOR b IN SELECT * FROM halloween_players WHERE match_id=p_match AND is_bot FOR UPDATE LOOP
    v_target := CASE WHEN v_done THEN 30 ELSE least(30, floor(extract(epoch FROM now() - m.started_at) / 6)::int) END;
    WHILE b.answered < v_target LOOP
      b.answered := b.answered + 1;
      IF random() < 0.68 THEN
        v_gain := 10;
        IF 'curse' = ANY(b.effects) THEN v_gain := 5; b.effects := array_remove(b.effects,'curse'); END IF;
        b.score := b.score + v_gain; b.correct := b.correct + 1;
      END IF;
    END LOOP;
    UPDATE halloween_players SET answered=b.answered, score=b.score, correct=b.correct, effects=b.effects
     WHERE match_id=p_match AND slot=b.slot;
  END LOOP;
  IF NOT v_done THEN RETURN; END IF;
  SELECT coalesce(sum(score) FILTER (WHERE team=0),0), coalesce(sum(score) FILTER (WHERE team=1),0) INTO s0, s1
    FROM halloween_players WHERE match_id=p_match;
  v_team := CASE WHEN s0 > s1 THEN 0 WHEN s1 > s0 THEN 1 END;
  UPDATE halloween_matches SET status='completed', winner_team=v_team, ends_at=least(ends_at, now()) WHERE id=p_match;
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  FOR pl IN SELECT * FROM halloween_players WHERE match_id=p_match AND NOT is_bot AND profile_id IS NOT NULL LOOP
    v_coins := 0;
    IF pl.answered >= 1 THEN
      v_base := CASE WHEN v_team IS NULL THEN 25 WHEN v_team = pl.team THEN 50 ELSE 15 END;
      PERFORM 1 FROM profiles WHERE id=pl.profile_id FOR UPDATE;
      SELECT coalesce(sum(coins),0) INTO v_today FROM halloween_rewards WHERE profile_id=pl.profile_id AND day=v_day;
      v_coins := greatest(0, least(v_base, 250 - v_today));
      INSERT INTO halloween_rewards(profile_id, match_id, coins, day) VALUES (pl.profile_id, p_match, v_coins, v_day)
        ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_rc = ROW_COUNT;
      IF v_rc = 1 AND v_coins > 0 THEN
        UPDATE profiles SET coins = coalesce(coins,0) + v_coins WHERE id=pl.profile_id;
        PERFORM bump_lifetime_coins(pl.profile_id, v_coins);
      END IF;
    END IF;
    UPDATE halloween_players SET reward=v_coins WHERE match_id=p_match AND slot=pl.slot;
  END LOOP;
  PERFORM set_config('request.jwt.claims', coalesce(v_claims,''), true);
END $$;
REVOKE ALL ON FUNCTION public.hw_tick(uuid) FROM PUBLIC, anon, authenticated;