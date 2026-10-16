-- All fixtures are rolled back inside a subtransaction, including scores and answer rows.
DO $$
DECLARE p1 uuid; p2 uuid; mid uuid; q jsonb; q2 jsonb; r jsonb; before_score integer; wrong text; ws jsonb;
BEGIN
 IF has_table_privilege('authenticated','public.match_question_secrets','SELECT') OR has_function_privilege('authenticated','public.match_next_question(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Answers publicly accessible'; END IF;
 IF has_table_privilege('authenticated','public.match_question_issues','SELECT') OR has_function_privilege('authenticated','public.match_submit_question(uuid,uuid,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'Submission bypass accessible'; END IF;
 BEGIN
 SELECT id INTO p1 FROM public.profiles ORDER BY id LIMIT 1;
 SELECT id INTO p2 FROM public.profiles WHERE id<>p1 ORDER BY id LIMIT 1;
 IF p1 IS NULL OR p2 IS NULL THEN RAISE EXCEPTION 'Fixtures need two profiles'; END IF;
 ws='[{"word":"apple","meaning":"苹果"},{"word":"pear","meaning":"梨"},{"word":"banana","meaning":"香蕉"},{"word":"grape","meaning":"葡萄"}]'::jsonb;
 INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,words,mode,match_type) VALUES(p1,p2,7,'in_progress',ws,'1v1','ranked') RETURNING id INTO mid;
 IF (SELECT words FROM public.ranked_matches WHERE id=mid)<>'[]'::jsonb THEN RAISE EXCEPTION 'Live match leaked words'; END IF;
 q=public.match_next_question(mid,p1); q2=public.match_next_question(mid,p1);
 IF q<>q2 OR q->>'questionIndex'<>'0' THEN RAISE EXCEPTION 'Refresh skipped question'; END IF;
 IF jsonb_array_length(q->'options')<>4 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(q->'options'))<>4 THEN RAISE EXCEPTION 'Not four unique choices'; END IF;
 IF NOT (q->'options') @> '["苹果"]'::jsonb OR q ? 'meaning' OR q ? 'correctAnswer' OR q ? 'words' THEN RAISE EXCEPTION 'Unsafe question payload'; END IF;
 BEGIN
 PERFORM public.match_submit_question(mid,p1,1,'梨'); RAISE EXCEPTION 'Skipped question accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Out of order' THEN RAISE; END IF; END;
 SELECT value INTO wrong FROM jsonb_array_elements_text(q->'options') WHERE value<>'苹果' LIMIT 1;
 r=public.match_submit_question(mid,p1,0,wrong);
 IF (r->>'isCorrect')::boolean OR (SELECT player1_score FROM public.ranked_matches WHERE id=mid)<>-1 THEN RAISE EXCEPTION 'Wrong answer scoring'; END IF;
 r=public.match_submit_question(mid,p1,0,'苹果');
 IF NOT (r->>'duplicate')::boolean OR (r->>'isCorrect')::boolean OR (SELECT player1_score FROM public.ranked_matches WHERE id=mid)<>-1 THEN RAISE EXCEPTION 'Retry re-scored'; END IF;
 q=public.match_next_question(mid,p1);
 IF q->>'questionIndex'<>'1' THEN RAISE EXCEPTION 'Next question did not advance'; END IF;
 r=public.match_submit_question(mid,p1,1,'梨');
 IF NOT (r->>'isCorrect')::boolean OR (SELECT player1_score FROM public.ranked_matches WHERE id=mid)<>0 THEN RAISE EXCEPTION 'Correct answer scoring'; END IF;
 UPDATE public.ranked_matches SET status='completed' WHERE id=mid;
 IF (SELECT words FROM public.ranked_matches WHERE id=mid)<>ws THEN RAISE EXCEPTION 'Review not restored'; END IF;
 RAISE EXCEPTION 'TEST_ROLLBACK_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'TEST_ROLLBACK_OK' THEN RAISE; END IF;
 END;
END $$;