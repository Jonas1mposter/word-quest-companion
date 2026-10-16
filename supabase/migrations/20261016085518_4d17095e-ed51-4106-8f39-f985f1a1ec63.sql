ALTER TABLE public.ranked_matches ADD COLUMN question_count integer NOT NULL DEFAULT 0;
CREATE TABLE public.match_question_secrets (match_id uuid PRIMARY KEY REFERENCES public.ranked_matches(id) ON DELETE CASCADE, words jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.match_question_secrets TO service_role;
ALTER TABLE public.match_question_secrets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.match_question_issues (match_id uuid NOT NULL REFERENCES public.ranked_matches(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, question_index integer NOT NULL, options jsonb NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(match_id,profile_id,question_index));
GRANT ALL ON public.match_question_issues TO service_role;
ALTER TABLE public.match_question_issues ENABLE ROW LEVEL SECURITY;
INSERT INTO public.match_question_secrets(match_id,words) SELECT id,words FROM public.ranked_matches WHERE jsonb_typeof(words)='array' AND jsonb_array_length(words)>0;
UPDATE public.ranked_matches SET question_count=jsonb_array_length(words), words='[]'::jsonb WHERE jsonb_typeof(words)='array' AND jsonb_array_length(words)>0;
CREATE FUNCTION public.protect_match_questions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF jsonb_typeof(NEW.words)='array' AND jsonb_array_length(NEW.words)>0 THEN
 INSERT INTO public.match_question_secrets(match_id,words) VALUES(NEW.id,NEW.words) ON CONFLICT(match_id) DO UPDATE SET words=excluded.words;
 NEW.question_count=jsonb_array_length(NEW.words); NEW.words='[]'::jsonb;
 END IF; RETURN NEW; END $$;
-- AFTER INSERT is needed because the secret has a foreign key to the new match.
CREATE FUNCTION public.capture_match_questions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF jsonb_typeof(NEW.words)='array' AND jsonb_array_length(NEW.words)>0 THEN
 INSERT INTO public.match_question_secrets(match_id,words) VALUES(NEW.id,NEW.words) ON CONFLICT(match_id) DO UPDATE SET words=excluded.words;
 UPDATE public.ranked_matches SET question_count=jsonb_array_length(NEW.words),words='[]'::jsonb WHERE id=NEW.id;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_capture_match_questions AFTER INSERT ON public.ranked_matches FOR EACH ROW EXECUTE FUNCTION public.capture_match_questions();
CREATE FUNCTION public.match_next_question(p_match_id uuid,p_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 SELECT v FROM (SELECT DISTINCT value->>'meaning' AS v FROM jsonb_array_elements(ws) WHERE value->>'meaning'<>w->>'meaning' UNION SELECT meaning FROM public.words WHERE meaning<>w->>'meaning') candidates ORDER BY v LIMIT 4
 ) choices;
 -- Randomize distractors and guarantee exactly three distinct wrong choices.
 SELECT jsonb_agg(v ORDER BY random()) INTO opts FROM (SELECT w->>'meaning' AS v UNION ALL SELECT v FROM (SELECT DISTINCT value->>'meaning' AS v FROM jsonb_array_elements(ws) WHERE value->>'meaning'<>w->>'meaning' UNION SELECT meaning FROM public.words WHERE meaning<>w->>'meaning') c ORDER BY v LIMIT 4) s;
 IF jsonb_array_length(opts)<>4 OR NOT opts @> jsonb_build_array(w->>'meaning') THEN
 SELECT jsonb_agg(v ORDER BY random()) INTO opts FROM (SELECT w->>'meaning' AS v UNION ALL SELECT v FROM (SELECT DISTINCT meaning AS v FROM public.words WHERE meaning<>w->>'meaning' ORDER BY meaning LIMIT 3) d) s;
 END IF;
 INSERT INTO public.match_question_issues(match_id,profile_id,question_index,options) VALUES(p_match_id,p_profile_id,idx,opts);
 END IF;
 RETURN jsonb_build_object('questionIndex',idx,'total',m.question_count,'word',w->>'word','options',opts);
END $$;
CREATE FUNCTION public.match_submit_question(p_match_id uuid,p_profile_id uuid,p_question_index integer,p_answer text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; ws jsonb; issue public.match_question_issues; correct boolean; delta integer; prior public.match_answers; idx integer;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF p_profile_id IS DISTINCT FROM m.player1_id AND p_profile_id IS DISTINCT FROM m.player2_id AND p_profile_id IS DISTINCT FROM m.player3_id AND p_profile_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('ok',true,'matchEnded',true,'isCorrect',false); END IF;
 SELECT * INTO prior FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id AND question_index=p_question_index LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'isCorrect',prior.is_correct,'duplicate',true); END IF;
 SELECT count(*) INTO idx FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id;
 IF idx<>p_question_index THEN RAISE EXCEPTION 'Out of order'; END IF;
 SELECT * INTO issue FROM public.match_question_issues WHERE match_id=p_match_id AND profile_id=p_profile_id AND question_index=idx;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question not issued'; END IF;
 IF NOT issue.options @> jsonb_build_array(p_answer) THEN RAISE EXCEPTION 'Invalid option'; END IF;
 SELECT words INTO ws FROM public.match_question_secrets WHERE match_id=p_match_id;
 correct=p_answer=ws->idx->>'meaning'; delta=CASE WHEN correct THEN 1 WHEN m.match_type='ranked' THEN -1 ELSE 0 END;
 INSERT INTO public.match_answers(match_id,player_id,question_index,answer,is_correct) VALUES(p_match_id,p_profile_id,idx,p_answer,correct);
 UPDATE public.ranked_matches SET
 player1_score=player1_score+CASE WHEN mode<>'2v2' AND player1_id=p_profile_id THEN delta ELSE 0 END,
 player2_score=player2_score+CASE WHEN mode<>'2v2' AND player2_id=p_profile_id THEN delta ELSE 0 END,
 team1_score=team1_score+CASE WHEN mode='2v2' AND (player1_id=p_profile_id OR player3_id=p_profile_id) THEN delta ELSE 0 END,
 team2_score=team2_score+CASE WHEN mode='2v2' AND (player2_id=p_profile_id OR player4_id=p_profile_id) THEN delta ELSE 0 END WHERE id=p_match_id;
 RETURN jsonb_build_object('ok',true,'isCorrect',correct);
END $$;
REVOKE ALL ON FUNCTION public.match_next_question(uuid,uuid),public.match_submit_question(uuid,uuid,integer,text),public.capture_match_questions(),public.protect_match_questions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_next_question(uuid,uuid),public.match_submit_question(uuid,uuid,integer,text) TO service_role;
DROP POLICY "Match answers are viewable" ON public.match_answers;
CREATE POLICY "Own answers or completed match review" ON public.match_answers FOR SELECT TO authenticated USING (player_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.ranked_matches WHERE id=match_id AND status='completed') OR public.has_role(auth.uid(),'admin'));
