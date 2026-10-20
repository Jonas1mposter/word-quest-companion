DO $$
DECLARE ids uuid[]; u uuid; mid uuid; pid uuid; q jsonb;
BEGIN
 BEGIN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.profiles ORDER BY id LIMIT 4) p;
  IF cardinality(ids)<>4 THEN RAISE EXCEPTION 'Four profiles required'; END IF;
  DELETE FROM public.match_queue WHERE profile_id=ANY(ids);
  FOREACH pid IN ARRAY ids LOOP
   SELECT user_id INTO u FROM public.profiles WHERE id=pid;
   PERFORM set_config('request.jwt.claim.sub',u::text,true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
   mid=public.find_match_2v2(pid,997,1000,'math',NULL);
  END LOOP;
  IF mid IS NULL THEN RAISE EXCEPTION 'Matching failed'; END IF;
  IF (SELECT question_count FROM public.ranked_matches WHERE id=mid)<>15 THEN RAISE EXCEPTION '2v2 must issue 15 per player'; END IF;
  FOREACH pid IN ARRAY ids LOOP
   q=public.match_next_question_v2(mid,pid,true);
   IF (q->>'total')::integer<>15 OR (q->>'questionIndex')::integer<>0 THEN RAISE EXCEPTION 'Each player needs own 15-question progress'; END IF;
  END LOOP;
  RAISE EXCEPTION 'ROLLBACK_TEAM_COUNT_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_TEAM_COUNT_OK' THEN RAISE; END IF;
 END;
END $$;