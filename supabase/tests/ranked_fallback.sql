-- Server-authoritative ranked fallback rules. All fixtures and awards roll back.
DO $$
DECLARE pid uuid; mid uuid; kind text; mode text; b match_bot_state; s int; n int; r jsonb; before_elo int; after_elo int; stars int;
BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SELECT id INTO pid FROM profiles WHERE (banned_until IS NULL OR banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM ranked_matches WHERE status='in_progress' AND profiles.id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id])) ORDER BY id LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Idle fixture required'; END IF;
  IF has_function_privilege('authenticated','public.settle_fallback_rank(uuid,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client rank bypass'; END IF;
  DELETE FROM profile_boosts WHERE profile_id=pid;
  FOREACH mode IN ARRAY ARRAY['1v1','2v2'] LOOP
   n=CASE WHEN mode='1v1' THEN 10 ELSE 15 END;
   UPDATE profiles SET elo_rating=1000,rank_tier='silver',rank_stars=10 WHERE id=pid;
   INSERT INTO ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress',mode,'ranked',n,'[]',now()) RETURNING id INTO mid;
   INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,CASE WHEN mode='1v1' THEN ARRAY[2] ELSE ARRAY[2,3,4] END,'[]') RETURNING * INTO b;
   FOREACH s IN ARRAY b.bot_slots LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(b.schedule) v WHERE (v->>'slot')::int=s)<>n THEN RAISE EXCEPTION 'Incorrect question count'; END IF;
    IF (SELECT count(*) FILTER(WHERE (v->>'delta')::int=1)::numeric/count(*) FROM jsonb_array_elements(b.schedule) v WHERE (v->>'slot')::int=s) NOT BETWEEN .60 AND .75 THEN RAISE EXCEPTION 'Accuracy outside 60-75%%'; END IF;
    IF b.identities->>s::text IS NULL OR b.identities->>s::text NOT LIKE '%·%' THEN RAISE EXCEPTION 'Missing roster identity'; END IF;
   END LOOP;
   INSERT INTO match_answers(match_id,player_id,question_index,is_correct) SELECT mid,pid,i,true FROM generate_series(0,n-1) i;
   r=tick_match_bots(mid,pid,true,false);
   IF (r->>'eloDelta')::int<>16 OR (SELECT elo_rating FROM profiles WHERE id=pid)<>1016 OR (SELECT rank_stars FROM profiles WHERE id=pid)<>11 THEN RAISE EXCEPTION 'Ranked win not credited: %',r; END IF;
   r=tick_match_bots(mid,pid,true,false);
   IF (SELECT elo_rating FROM profiles WHERE id=pid)<>1016 OR (r->>'eloDelta')::int<>16 THEN RAISE EXCEPTION 'Retry double credited'; END IF;
  END LOOP;
  -- Winning double-ELO card yields 32, not 16.
  INSERT INTO profile_boosts(profile_id,boost_type,expires_at) VALUES(pid,'double_elo',now()+interval '24 hours');
  INSERT INTO ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress','1v1','ranked',10,'[]',now()) RETURNING id INTO mid;
  INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,ARRAY[2],'[]');
  INSERT INTO match_answers(match_id,player_id,question_index,is_correct) SELECT mid,pid,i,true FROM generate_series(0,9) i;
  before_elo=(SELECT elo_rating FROM profiles WHERE id=pid);
  r=tick_match_bots(mid,pid,true,false);
  IF (SELECT elo_rating FROM profiles WHERE id=pid)<>before_elo+32 OR (r->>'eloDelta')::int<>32 THEN RAISE EXCEPTION 'Double ELO missing'; END IF;
  -- Loss shield is consumed only once and preserves stars/ELO.
  INSERT INTO profile_boosts(profile_id,boost_type,uses_remaining) VALUES(pid,'rank_shield',3);
  INSERT INTO ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress','1v1','ranked',10,'[]',now()) RETURNING id INTO mid;
  INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,ARRAY[2],'[]');
  INSERT INTO match_answers(match_id,player_id,question_index,is_correct) SELECT mid,pid,i,false FROM generate_series(0,9) i;
  before_elo=(SELECT elo_rating FROM profiles WHERE id=pid); stars=(SELECT rank_stars FROM profiles WHERE id=pid);
  r=tick_match_bots(mid,pid,true,false); PERFORM tick_match_bots(mid,pid,true,false);
  IF (SELECT elo_rating FROM profiles WHERE id=pid)<>before_elo OR (SELECT rank_stars FROM profiles WHERE id=pid)<>stars OR (SELECT uses_remaining FROM profile_boosts WHERE profile_id=pid AND boost_type='rank_shield')<>2 OR r->>'shielded'<>'true' THEN RAISE EXCEPTION 'Shield retry error'; END IF;
  -- Free fallback never changes ranked rating, even with answers.
  INSERT INTO ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress','1v1','free',10,'[]',now()) RETURNING id INTO mid;
  INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,ARRAY[2],'[]');
  INSERT INTO match_answers(match_id,player_id,question_index,is_correct) SELECT mid,pid,i,true FROM generate_series(0,9) i;
  PERFORM tick_match_bots(mid,pid,true,false);
  IF (SELECT elo_rating FROM profiles WHERE id=pid)<>before_elo THEN RAISE EXCEPTION 'Free match changed rank'; END IF;
  -- Empty non-forfeit game grants no rating.
  INSERT INTO ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress','1v1','ranked',10,'[]',now()-interval '301 seconds') RETURNING id INTO mid;
  INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,ARRAY[2],'[]');
  PERFORM tick_match_bots(mid,pid,true,false);
  IF (SELECT elo_rating FROM profiles WHERE id=pid)<>before_elo THEN RAISE EXCEPTION 'Empty game credited'; END IF;
  RAISE EXCEPTION 'ROLLBACK_RANKED_FALLBACK_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_RANKED_FALLBACK_OK' THEN RAISE; END IF;
 END;
END $$;