-- Exercise production settlement rules using existing profiles; all writes roll back.
DO $$
DECLARE ids uuid[]; mid uuid; result jsonb; before_state jsonb; after_state jsonb; p public.profiles; mode text; kind text;
BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.profiles ORDER BY id LIMIT 4) t;
  IF cardinality(ids)<>4 THEN RAISE EXCEPTION 'Four profiles required'; END IF;
  IF has_function_privilege('authenticated','public.complete_empty_match(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.complete_empty_match(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client settlement bypass'; END IF;
  FOREACH mode IN ARRAY ARRAY['1v1','2v2'] LOOP
   FOREACH kind IN ARRAY ARRAY['ranked','free'] LOOP
    INSERT INTO public.ranked_matches(player1_id,player2_id,player3_id,player4_id,grade,status,mode,match_type,words)
    VALUES(ids[1],ids[2],CASE WHEN mode='2v2' THEN ids[3] END,CASE WHEN mode='2v2' THEN ids[4] END,1,'in_progress',mode,kind,'[]') RETURNING id INTO mid;
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_state FROM public.profiles t WHERE id=ANY(ids);
    result=public.complete_empty_match(mid,NULL);
    IF result->>'handled'<>'true' OR (result->>'coinsEarned')::int<>0 OR (result->>'xpEarned')::int<>0 THEN RAISE EXCEPTION 'Empty match rewards'; END IF;
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO after_state FROM public.profiles t WHERE id=ANY(ids);
    IF before_state<>after_state THEN RAISE EXCEPTION 'Empty draw changed profiles'; END IF;
    IF EXISTS(SELECT 1 FROM public.ranked_matches WHERE id=mid AND (status<>'completed' OR winner_id IS NOT NULL OR winner_team IS NOT NULL)) THEN RAISE EXCEPTION 'Empty winner'; END IF;

    INSERT INTO public.ranked_matches(player1_id,player2_id,player3_id,player4_id,grade,status,mode,match_type,words)
    VALUES(ids[1],ids[2],CASE WHEN mode='2v2' THEN ids[3] END,CASE WHEN mode='2v2' THEN ids[4] END,1,'in_progress',mode,kind,'[]') RETURNING id INTO mid;
    UPDATE public.profiles SET elo_rating=1000,elo_free=1000,rank_tier='silver',rank_stars=10 WHERE id=ANY(ids);
    SELECT * INTO p FROM public.profiles WHERE id=ids[1];
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_state FROM public.profiles t WHERE id=ANY(ids) AND id<>ids[1];
    result=public.complete_empty_match(mid,ids[1]);
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=ids[1] AND coins=p.coins AND xp=p.xp AND total_xp=p.total_xp AND wins=p.wins AND ranked_wins=p.ranked_wins AND free_match_wins=p.free_match_wins AND
      CASE WHEN kind='free' AND mode='1v1' THEN elo_free=984 AND free_match_losses=p.free_match_losses+1 AND rank_stars=10 AND elo_rating=1000
      ELSE elo_rating=984 AND losses=p.losses+1 AND rank_stars=9 AND elo_free=1000 END) THEN RAISE EXCEPTION 'Forfeit penalty or no-benefit rule failed'; END IF;
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO after_state FROM public.profiles t WHERE id=ANY(ids) AND id<>ids[1];
    IF before_state<>after_state THEN RAISE EXCEPTION 'Other players received benefits or penalties'; END IF;
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_state FROM public.profiles t WHERE id=ANY(ids);
    PERFORM public.complete_empty_match(mid,ids[1]);
    PERFORM public.complete_empty_match(mid,ids[2]);
    SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO after_state FROM public.profiles t WHERE id=ANY(ids);
    IF before_state<>after_state THEN RAISE EXCEPTION 'Repeated penalty'; END IF;
   END LOOP;
  END LOOP;
  INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,mode,match_type,words) VALUES(ids[1],ids[2],1,'in_progress','1v1','free','[]') RETURNING id INTO mid;
  INSERT INTO public.match_answers(match_id,player_id,question_index,answer,is_correct) VALUES(mid,ids[1],0,'wrong',false);
  result=public.complete_empty_match(mid,ids[2]);
  IF result->>'handled'<>'false' OR (SELECT status FROM public.ranked_matches WHERE id=mid)<>'in_progress' THEN RAISE EXCEPTION 'Answered zero-score match blocked'; END IF;
  RAISE EXCEPTION 'ROLLBACK_EMPTY_MATCH_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_EMPTY_MATCH_OK' THEN RAISE; END IF;
 END;
END $$;