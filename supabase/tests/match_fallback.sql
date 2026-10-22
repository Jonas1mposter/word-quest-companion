-- Production RPC tests; the inner subtransaction rolls every write back.
DO $$
DECLARE ids uuid[]; pid uuid; rid uuid; newer uuid; party uuid; mid uuid; again uuid; out jsonb; kind text; mode text; before_state jsonb; after_state jsonb;
BEGIN
 BEGIN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM profiles WHERE grade=7 AND (banned_until IS NULL OR banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM ranked_matches WHERE status='in_progress' AND profiles.id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id])) ORDER BY id LIMIT 2) t;
  IF cardinality(ids)<>2 THEN RAISE EXCEPTION 'Two idle G7 profiles required'; END IF;
  pid=ids[1];
  UPDATE match_search_requests SET cancelled=true WHERE profile_id=ANY(ids);
  DELETE FROM match_queue WHERE profile_id=ANY(ids) AND status='searching';
  IF has_function_privilege('authenticated','public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean)','EXECUTE') OR has_table_privilege('authenticated','public.match_bot_state','SELECT') THEN RAISE EXCEPTION 'Browser bypass'; END IF;
  FOREACH kind IN ARRAY ARRAY['ranked','free'] LOOP
   rid=gen_random_uuid();
   out=matchmaking_action(pid,rid,'1v1',kind,'fallback-test',NULL,false);
   IF out->>'matchId' IS NOT NULL THEN RAISE EXCEPTION 'Fallback before 60s'; END IF;
   UPDATE match_search_requests SET created_at=now()-interval '59 seconds' WHERE request_id=rid;
   UPDATE match_queue SET created_at=now()-interval '59 seconds' WHERE profile_id=pid AND status='searching';
   out=matchmaking_action(pid,rid,'1v1',kind,'fallback-test',NULL,false);
   IF out->>'matchId' IS NOT NULL THEN RAISE EXCEPTION 'Fallback at 59s'; END IF;
   UPDATE match_search_requests SET created_at=now()-interval '60 seconds' WHERE request_id=rid;
   UPDATE match_queue SET created_at=now()-interval '60 seconds' WHERE profile_id=pid AND status='searching';
   out=matchmaking_action(pid,rid,'1v1',kind,'fallback-test',NULL,false); mid=(out->>'matchId')::uuid;
   IF mid IS NULL OR NOT EXISTS(SELECT 1 FROM match_bot_state WHERE match_id=mid AND bot_slots=ARRAY[2]) THEN RAISE EXCEPTION '1v1 fallback missing'; END IF;
   again=(matchmaking_action(pid,rid,'1v1',kind,'fallback-test',NULL,false)->>'matchId')::uuid;
   IF again<>mid THEN RAISE EXCEPTION 'Duplicate fallback'; END IF;
   again=(matchmaking_action(pid,gen_random_uuid(),'2v2','ranked','fallback-test',NULL,false)->>'matchId')::uuid;
   IF again<>mid THEN RAISE EXCEPTION 'Cross-mode second match'; END IF;
   out=matchmaking_action(pid,rid,'1v1',kind,'fallback-test',NULL,true);
   IF (out->>'matchId')::uuid<>mid THEN RAISE EXCEPTION 'Late cancel lost match'; END IF;
   IF EXISTS(SELECT 1 FROM match_queue WHERE profile_id=pid AND status='searching') THEN RAISE EXCEPTION 'Still searching after fallback'; END IF;
   SELECT to_jsonb(p) INTO before_state FROM profiles p WHERE id=pid;
   out=complete_empty_match(mid,pid);
   IF out->>'handled'<>'false' THEN RAISE EXCEPTION 'Bot empty settlement bypass'; END IF;
   out=tick_match_bots(mid,pid,true,false);
   IF out->>'pending'<>'true' THEN RAISE EXCEPTION 'Premature finish'; END IF;
   out=tick_match_bots(mid,pid,true,true);
   PERFORM tick_match_bots(mid,pid,true,true);
   SELECT to_jsonb(p) INTO after_state FROM profiles p WHERE id=pid;
   IF before_state<>after_state OR (out->>'coinsEarned')::integer<>0 OR (out->>'xpEarned')::integer<>0 THEN RAISE EXCEPTION 'Bot competitive benefits'; END IF;
   IF EXISTS(SELECT 1 FROM ranked_matches WHERE id=mid AND (winner_id IS NOT NULL OR winner_team IS NOT NULL)) THEN RAISE EXCEPTION 'Empty bot winner'; END IF;
   UPDATE match_search_requests SET cancelled=true WHERE profile_id=ANY(ids);
  END LOOP;
  -- Cancel wins before a delayed search: the request stays cancelled.
  rid=gen_random_uuid(); PERFORM matchmaking_action(pid,rid,'1v1','ranked','fallback-test',NULL,true);
  out=matchmaking_action(pid,rid,'1v1','ranked','fallback-test',NULL,false);
  IF out->>'cancelled'<>'true' OR EXISTS(SELECT 1 FROM match_queue WHERE profile_id=pid AND status='searching') THEN RAISE EXCEPTION 'Cancelled search revived'; END IF;
  -- An old tab's cancel may not remove a newer request's queue.
  rid=gen_random_uuid(); PERFORM matchmaking_action(pid,rid,'1v1','ranked','fallback-test',NULL,false);
  UPDATE match_search_requests SET created_at=now()-interval '5 seconds' WHERE request_id=rid;
  newer=gen_random_uuid(); PERFORM matchmaking_action(pid,newer,'1v1','ranked','fallback-test',NULL,false);
  PERFORM matchmaking_action(pid,rid,'1v1','ranked','fallback-test',NULL,true);
  IF NOT EXISTS(SELECT 1 FROM match_queue WHERE profile_id=pid AND status='searching') THEN RAISE EXCEPTION 'Old cancel deleted new queue'; END IF;
  PERFORM matchmaking_action(pid,newer,'1v1','ranked','fallback-test',NULL,true);
  -- Solo and ready friends get 15 questions; friends occupy team-one slots.
  FOREACH mode IN ARRAY ARRAY['solo','friends'] LOOP
   rid=gen_random_uuid(); party=NULL;
   IF mode='friends' THEN
    party=gen_random_uuid(); INSERT INTO match_parties(id,leader_id,member_id,status,grade,subject,expires_at) VALUES(party,ids[1],ids[2],'ready',7,'fallback-test',now()+interval '10 minutes');
   END IF;
   PERFORM matchmaking_action(pid,rid,'2v2','ranked','fallback-test',party,false);
   UPDATE match_search_requests SET created_at=now()-interval '60 seconds' WHERE request_id=rid;
   UPDATE match_queue SET created_at=now()-interval '60 seconds' WHERE status='searching' AND (profile_id=pid OR party_id=party);
   out=matchmaking_action(pid,rid,'2v2','ranked','fallback-test',party,false); mid=(out->>'matchId')::uuid;
   IF mid IS NULL OR NOT EXISTS(SELECT 1 FROM ranked_matches WHERE id=mid AND question_count=15 AND player1_id=pid AND player3_id IS NOT DISTINCT FROM CASE WHEN mode='friends' THEN ids[2] END) THEN RAISE EXCEPTION '2v2 party or question total'; END IF;
   IF NOT EXISTS(SELECT 1 FROM match_bot_state WHERE match_id=mid AND bot_slots=CASE WHEN mode='friends' THEN ARRAY[2,4] ELSE ARRAY[2,3,4] END) THEN RAISE EXCEPTION '2v2 bot slots'; END IF;
   IF mode='friends' AND NOT EXISTS(SELECT 1 FROM match_parties WHERE id=party AND status='matched' AND match_id=mid) THEN RAISE EXCEPTION 'Friend not synchronized'; END IF;
   -- Winning bot-game result never changes either profile or competitive winner.
   SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO before_state FROM profiles p WHERE id=ANY(ids);
   INSERT INTO match_answers(match_id,player_id,question_index,is_correct) VALUES(mid,pid,0,true);
   out=tick_match_bots(mid,pid,true,true);
   PERFORM tick_match_bots(mid,pid,true,true);
   SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO after_state FROM profiles p WHERE id=ANY(ids);
   IF before_state<>after_state OR EXISTS(SELECT 1 FROM ranked_matches WHERE id=mid AND winner_id IS NOT NULL) THEN RAISE EXCEPTION 'Bot rank settlement'; END IF;
  END LOOP;
  RAISE EXCEPTION 'ROLLBACK_MATCH_FALLBACK_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_MATCH_FALLBACK_OK' THEN RAISE; END IF;
 END;
END $$;