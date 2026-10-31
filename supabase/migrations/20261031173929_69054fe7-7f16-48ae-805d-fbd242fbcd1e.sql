-- All fixture changes roll back; runs through the same server RPCs as real matches.
DO $$
DECLARE ids uuid[]; mid uuid; kind text; mode text; r jsonb; p uuid; snapshot jsonb; after_state jsonb;
BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM profiles WHERE (banned_until IS NULL OR banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM ranked_matches WHERE status='in_progress' AND profiles.id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id])) ORDER BY id LIMIT 4) x;
  IF cardinality(ids)<>4 THEN RAISE EXCEPTION 'Four idle fixtures required'; END IF;
  IF has_function_privilege('authenticated','public.void_dac_match_rank(uuid,uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.claim_match_completion(uuid,uuid,integer,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'Client bypass'; END IF;
  INSERT INTO profile_boosts(profile_id,boost_type,uses_remaining) SELECT id,'rank_shield',3 FROM unnest(ids) id;
  FOREACH mode IN ARRAY ARRAY['1v1','2v2'] LOOP
   FOREACH kind IN ARRAY ARRAY['empty','human','fallback'] LOOP
    SELECT jsonb_agg(jsonb_build_array(id,elo_rating,rank_tier,rank_stars,rank_points) ORDER BY id) INTO snapshot FROM profiles WHERE id=ANY(ids);
    INSERT INTO ranked_matches(player1_id,player2_id,player3_id,player4_id,grade,status,mode,match_type,question_count,words,started_at)
    VALUES(ids[1],CASE WHEN kind='fallback' AND mode='1v1' THEN NULL ELSE ids[2] END,CASE WHEN mode='2v2' THEN ids[3] END,CASE WHEN mode='2v2' AND kind<>'fallback' THEN ids[4] END,7,'in_progress',mode,'ranked',15,'[]',now()) RETURNING id INTO mid;
    IF kind='fallback' THEN INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,CASE WHEN mode='1v1' THEN ARRAY[2] ELSE ARRAY[4] END,'[]'); END IF;
    IF kind<>'empty' THEN INSERT INTO match_answers(match_id,player_id,question_index,is_correct) VALUES(mid,ids[1],0,true); END IF;
    IF NOT void_dac_match_rank(mid,ids[1],'synthetic_input') THEN RAISE EXCEPTION 'Kick not persisted'; END IF;
    IF kind='fallback' THEN
     r=tick_match_bots(mid,ids[1],true,true);
     IF r->>'eloDelta'<>'0' OR r->>'rankVoided'<>'true' THEN RAISE EXCEPTION 'Fallback not void: %',r; END IF;
     PERFORM tick_match_bots(mid,ids[1],true,true);
    ELSIF kind='empty' THEN
     PERFORM complete_empty_match(mid,ids[1]); PERFORM complete_empty_match(mid,ids[2]);
    ELSE
     r=claim_match_completion(mid,ids[2],2,1,0);
     IF r->>'claimed'<>'true' OR r->>'rankVoided'<>'true' THEN RAISE EXCEPTION 'Completion lost void'; END IF;
     r=claim_match_completion(mid,ids[1],1,0,1);
     IF r->>'claimed'<>'false' THEN RAISE EXCEPTION 'Duplicate claim'; END IF;
    END IF;
    SELECT jsonb_agg(jsonb_build_array(id,elo_rating,rank_tier,rank_stars,rank_points) ORDER BY id) INTO after_state FROM profiles WHERE id=ANY(ids);
    IF snapshot IS DISTINCT FROM after_state THEN RAISE EXCEPTION 'DAC changed rank'; END IF;
   END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM profile_boosts WHERE profile_id=ANY(ids) AND boost_type='rank_shield' AND uses_remaining<3) THEN RAISE EXCEPTION 'Shield consumed'; END IF;
  RAISE EXCEPTION 'ROLLBACK_DAC_RANK_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_DAC_RANK_OK' THEN RAISE; END IF;
 END;
END $$;