CREATE POLICY "Server manages match secrets" ON public.match_question_secrets FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "Server manages issued questions" ON public.match_question_issues FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE public.match_question_secrets ALTER CONSTRAINT match_question_secrets_match_id_fkey DEFERRABLE INITIALLY DEFERRED;
DROP TRIGGER zz_capture_match_questions ON public.ranked_matches;
CREATE TRIGGER zz_protect_match_questions BEFORE INSERT OR UPDATE OF words ON public.ranked_matches FOR EACH ROW EXECUTE FUNCTION public.protect_match_questions();
CREATE OR REPLACE FUNCTION public.match_next_question(p_match_id uuid,p_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; ws jsonb; w jsonb; idx integer; opts jsonb;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF p_profile_id IS DISTINCT FROM m.player1_id AND p_profile_id IS DISTINCT FROM m.player2_id AND p_profile_id IS DISTINCT FROM m.player3_id AND p_profile_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('done',true,'total',m.question_count); END IF;
 SELECT words INTO ws FROM public.match_question_secrets WHERE match_id=p_match_id;
 SELECT count(*) INTO idx FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id;
 IF idx>=coalesce(jsonb_array_length(ws),0) THEN RETURN jsonb_build_object('done',true,'total',m.question_count); END IF;
 w=ws->idx;
 SELECT options INTO opts FROM public.match_question_issues WHERE match_id=p_match_id AND profile_id=p_profile_id AND question_index=idx;
 IF opts IS NULL THEN
 SELECT jsonb_agg(v ORDER BY random()) INTO opts FROM (
 SELECT w->>'meaning' AS v UNION ALL
 SELECT v FROM (SELECT v FROM (SELECT DISTINCT value->>'meaning' AS v FROM jsonb_array_elements(ws) WHERE value->>'meaning'<>w->>'meaning' UNION SELECT meaning FROM public.words WHERE meaning<>w->>'meaning') candidates ORDER BY random() LIMIT 3) distractors
 ) choices;
 IF jsonb_array_length(opts)<>4 THEN RAISE EXCEPTION 'Insufficient options'; END IF;
 INSERT INTO public.match_question_issues(match_id,profile_id,question_index,options) VALUES(p_match_id,p_profile_id,idx,opts);
 END IF;
 RETURN jsonb_build_object('questionIndex',idx,'total',m.question_count,'word',w->>'word','options',opts);
END $$;