-- Exercise production RPCs with rollback-only fixtures, never real player scores.
SET LOCAL ROLE service_role;
DO $$
DECLARE p1 uuid; p2 uuid; mid uuid; q jsonb; r jsonb; ws jsonb; i integer; mode_name text;
BEGIN
 IF has_function_privilege('authenticated','public.match_next_question_v2(uuid,uuid,boolean)','EXECUTE') OR has_function_privilege('authenticated','public.match_listening_word(uuid,uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'Private RPC exposed'; END IF;
 IF NOT public.battle_spelling_correct('DWL','distance between wavefronts (DWL)') OR NOT public.battle_spelling_correct('wave length','wave-length') OR NOT public.battle_spelling_correct('tires','tyres / tires') OR public.battle_spelling_correct('trig','trigonometry (trig)') THEN RAISE EXCEPTION 'Spelling matching regression'; END IF;
 FOREACH mode_name IN ARRAY ARRAY['1v1','2v2'] LOOP
 BEGIN
  SELECT id INTO p1 FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO p2 FROM public.profiles WHERE id<>p1 ORDER BY id LIMIT 1;
  IF p1 IS NULL OR p2 IS NULL THEN RAISE EXCEPTION 'Two profiles required'; END IF;
  ws='[{"word":"apple","meaning":"苹果"},{"word":"pear","meaning":"梨"},{"word":"wave-length","meaning":"波长"},{"word":"distance between wavefronts (DWL)","meaning":"波前间距"}]'::jsonb;
  INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,words,mode,match_type) VALUES(p1,p2,7,'in_progress',ws,mode_name,'ranked') RETURNING id INTO mid;
  IF (SELECT words FROM public.ranked_matches WHERE id=mid)<>'[]'::jsonb THEN RAISE EXCEPTION 'Live words leaked'; END IF;
  FOR i IN 0..3 LOOP
   q=public.match_next_question_v2(mid,p1,true);
   IF q<>public.match_next_question_v2(mid,p1,true) THEN RAISE EXCEPTION 'Refresh changed question'; END IF;
   IF q->>'quizType'<>(ARRAY['meaning','reverse','spelling','listening'])[i+1] THEN RAISE EXCEPTION 'Mixed type missing'; END IF;
   IF q ? 'correctAnswer' OR q ? 'meaning' OR q ? 'words' THEN RAISE EXCEPTION 'Answer fields leaked'; END IF;
   IF i>0 AND q ? 'word' THEN RAISE EXCEPTION 'Written answer leaked'; END IF;
   IF i<2 AND (jsonb_array_length(q->'options')<>4 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(q->'options'))<>4) THEN RAISE EXCEPTION 'Choice count'; END IF;
   IF i>=2 AND jsonb_array_length(q->'options')<>0 THEN RAISE EXCEPTION 'Spelling options leak'; END IF;
   BEGIN
    PERFORM public.match_submit_question(mid,p1,i+1,'skip'); RAISE EXCEPTION 'Skipped question accepted';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Out of order' THEN RAISE; END IF; END;
   IF i=3 THEN
    IF q->>'prompt'<>'' OR public.match_listening_word(mid,p1,i)<>'distance between wavefronts (DWL)' THEN RAISE EXCEPTION 'Listening contract'; END IF;
   ELSE
    BEGIN
     PERFORM public.match_listening_word(mid,p1,3); RAISE EXCEPTION 'Future audio accepted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Out of order' THEN RAISE; END IF; END;
   END IF;
   r=public.match_submit_question(mid,p1,i,(ARRAY['苹果','pear','wave length','DWL'])[i+1]);
   IF NOT (r->>'isCorrect')::boolean THEN RAISE EXCEPTION 'Server grading failed'; END IF;
   r=public.match_submit_question(mid,p1,i,'different retry');
   IF NOT (r->>'duplicate')::boolean OR NOT (r->>'isCorrect')::boolean THEN RAISE EXCEPTION 'Duplicate lost original result'; END IF;
  END LOOP;
  IF (SELECT CASE WHEN mode_name='1v1' THEN player1_score ELSE team1_score END FROM public.ranked_matches WHERE id=mid)<>4 THEN RAISE EXCEPTION 'Atomic scoring'; END IF;
  q=public.match_next_question_v2(mid,p2,false);
  IF q->>'quizType'<>'meaning' OR jsonb_array_length(q->'options')<>4 THEN RAISE EXCEPTION 'Legacy compatibility failed'; END IF;
  r=public.match_submit_question(mid,p2,0,(SELECT value FROM jsonb_array_elements_text(q->'options') WHERE value<>'苹果' LIMIT 1));
  IF (r->>'isCorrect')::boolean OR (SELECT CASE WHEN mode_name='1v1' THEN player2_score ELSE team2_score END FROM public.ranked_matches WHERE id=mid)<>-1 THEN RAISE EXCEPTION 'Ranked wrong penalty'; END IF;
  RAISE EXCEPTION 'ROLLBACK_MIXED_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_MIXED_OK' THEN RAISE; END IF;
 END;
 END LOOP;
END $$;
RESET ROLE;