-- Production-function assertions; fixture data and scores are rolled back in a subtransaction.
DO $$
DECLARE ids uuid[]; mid uuid; q jsonb; r jsonb; mode_name text; ws jsonb;
BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.profiles WHERE NOT EXISTS(SELECT 1 FROM public.ranked_matches m WHERE m.status='in_progress' AND profiles.id=ANY(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id])) ORDER BY id LIMIT 4) x;
  IF cardinality(ids)<>4 THEN RAISE EXCEPTION 'Four idle fixtures required'; END IF;
  IF has_function_privilege('authenticated','public.match_submit_question(uuid,uuid,integer,text)','EXECUTE') OR has_function_privilege('authenticated','public.match_next_question_v2(uuid,uuid,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Client RPC exposed'; END IF;
  ws='[{"word":"apple","meaning":"苹果"},{"word":"pear","meaning":"梨"},{"word":"cat","meaning":"猫"},{"word":"dog","meaning":"狗"}]'::jsonb;
  FOREACH mode_name IN ARRAY ARRAY['1v1','2v2'] LOOP
   INSERT INTO public.ranked_matches(player1_id,player2_id,player3_id,player4_id,grade,status,mode,match_type,question_count,words,started_at)
   VALUES(ids[1],ids[2],CASE WHEN mode_name='2v2' THEN ids[3] END,CASE WHEN mode_name='2v2' THEN ids[4] END,7,'in_progress',mode_name,'ranked',4,ws,now()) RETURNING id INTO mid;
   q=public.match_next_question(mid,ids[1]);
   PERFORM public.match_submit_question(mid,ids[1],0,'苹果');
   q=public.match_next_question(mid,ids[1]);
   IF q->>'quizType'<>'reverse' THEN RAISE EXCEPTION 'Legacy ranked downgrade'; END IF;
   IF q<>public.match_next_question_v2(mid,ids[1],false) THEN RAISE EXCEPTION 'Refresh changed issue'; END IF;
   PERFORM public.match_submit_question(mid,ids[1],1,'pear');
   q=public.match_next_question_v2(mid,ids[1],false);
   IF q->>'quizType'<>'spelling' OR q ? 'word' OR q ? 'correctAnswer' THEN RAISE EXCEPTION 'Ranked spelling missing or answer leaked'; END IF;
   PERFORM public.void_dac_match_rank(mid,ids[1],'synthetic_input');
   BEGIN PERFORM public.match_submit_question(mid,ids[1],2,'cat'); RAISE EXCEPTION 'Invalidated match accepted score';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Match invalidated by DAC' THEN RAISE; END IF; END;
   BEGIN PERFORM public.match_next_question(mid,ids[2]); RAISE EXCEPTION 'Invalidated match issued next question';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Match invalidated by DAC' THEN RAISE; END IF; END;
   r=public.match_submit_question(mid,ids[1],1,'different');
   IF r->>'duplicate'<>'true' OR r->>'isCorrect'<>'true' THEN RAISE EXCEPTION 'Original retry lost'; END IF;
   IF (SELECT count(*) FROM public.match_answers WHERE match_id=mid)<>2 THEN RAISE EXCEPTION 'Invalidated match added answer'; END IF;
   UPDATE public.ranked_matches SET status='completed' WHERE id=mid;
  END LOOP;
  RAISE EXCEPTION 'ROLLBACK_RANKED_DAC_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_RANKED_DAC_OK' THEN RAISE; END IF;
 END;
END $$;