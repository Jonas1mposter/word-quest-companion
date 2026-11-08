DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.match_next_question_v2(uuid,uuid,boolean)'::regprocedure) INTO definition;
 IF position('w=ws->idx;' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected issuer definition'; END IF;
 definition := replace(definition, 'w=ws->idx;', E'IF m.rank_voided THEN RAISE EXCEPTION ''Match invalidated by DAC''; END IF;\n p_mixed := coalesce(p_mixed,false) OR m.match_type=''ranked'';\n w=ws->idx;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.match_submit_question(uuid,uuid,integer,text)'::regprocedure) INTO definition;
 IF position('IF p_answer IS NULL' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected grader definition'; END IF;
 definition := replace(definition, 'IF p_answer IS NULL', E'IF m.rank_voided THEN RAISE EXCEPTION ''Match invalidated by DAC''; END IF;\n IF p_answer IS NULL');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.match_next_question_v2(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_next_question_v2(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.match_submit_question(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_submit_question(uuid,uuid,integer,text) TO service_role;