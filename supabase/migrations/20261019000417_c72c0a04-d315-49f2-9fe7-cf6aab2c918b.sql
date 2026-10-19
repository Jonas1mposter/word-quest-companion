ALTER TABLE public.match_question_issues ADD COLUMN question_type text NOT NULL DEFAULT 'meaning';
CREATE OR REPLACE FUNCTION public.battle_clean_answer(p_text text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT trim(regexp_replace(regexp_replace(regexp_replace(translate(lower(coalesce(p_text,'')), '（）’‘`‐–—_-', '()''' || '''' || '''' || '      '), '[.,;:!?]+$', '', 'g'), '\s+', ' ', 'g'), '^\s+|\s+$', '', 'g')); $$;
REVOKE ALL ON FUNCTION public.battle_clean_answer(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.battle_clean_answer(text) TO service_role;
CREATE OR REPLACE FUNCTION public.battle_spelling_correct(p_answer text,p_target text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE a text; part text; candidate text; ab text[];
BEGIN
 a=replace(public.battle_clean_answer(p_answer),' ',''); IF a='' THEN RETURN false; END IF;
 IF a=replace(public.battle_clean_answer(p_target),' ','') THEN RETURN true; END IF;
 FOREACH part IN ARRAY regexp_split_to_array(public.battle_clean_answer(p_target),'\s*/\s*') LOOP
  IF a=replace(part,' ','') THEN RETURN true; END IF;
  candidate=public.battle_clean_answer(regexp_replace(part,'\([^)]*\)',' ','g'));
  IF a=replace(candidate,' ','') AND candidate<>'' THEN RETURN true; END IF;
  candidate=public.battle_clean_answer(translate(part,'()','  '));
  IF a=replace(candidate,' ','') AND candidate<>'' THEN RETURN true; END IF;
 END LOOP;
 FOR ab IN SELECT regexp_matches(p_target,'[(（]([^)）]+)[)）]','g') LOOP
  candidate=trim(ab[1]);
  IF candidate ~ '^[A-Za-z°µ]{1,6}$' AND candidate ~ '[A-Z°µ]' AND a=replace(public.battle_clean_answer(candidate),' ','') THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.battle_spelling_correct(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.battle_spelling_correct(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.match_next_question_v2(p_match_id uuid,p_profile_id uuid,p_mixed boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; ws jsonb; w jsonb; idx integer; opts jsonb; kind text; issue public.match_question_issues; field text; payload jsonb;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF p_profile_id IS DISTINCT FROM m.player1_id AND p_profile_id IS DISTINCT FROM m.player2_id AND p_profile_id IS DISTINCT FROM m.player3_id AND p_profile_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('done',true,'total',m.question_count); END IF;
 IF m.status<>'in_progress' THEN RAISE EXCEPTION 'Match not active'; END IF;
 SELECT words INTO ws FROM public.match_question_secrets WHERE match_id=p_match_id;
 SELECT count(*) INTO idx FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id;
 IF idx>=coalesce(jsonb_array_length(ws),0) THEN RETURN jsonb_build_object('done',true,'total',m.question_count); END IF;
 w=ws->idx;
 SELECT * INTO issue FROM public.match_question_issues WHERE match_id=p_match_id AND profile_id=p_profile_id AND question_index=idx;
 IF FOUND THEN kind=issue.question_type; opts=issue.options;
 ELSE
  kind=CASE WHEN NOT p_mixed THEN 'meaning' ELSE (ARRAY['meaning','reverse','spelling','listening'])[1+(idx%4)] END;
  opts='[]'::jsonb;
  IF kind IN ('meaning','reverse') THEN
   field=CASE WHEN kind='meaning' THEN 'meaning' ELSE 'word' END;
   SELECT jsonb_agg(v ORDER BY random()) INTO opts FROM (
    SELECT w->>field AS v UNION ALL
    SELECT v FROM (SELECT v FROM (
     SELECT DISTINCT value->>field AS v FROM jsonb_array_elements(ws) WHERE value->>field<>w->>field
     UNION SELECT CASE WHEN field='meaning' THEN meaning ELSE word END FROM public.words WHERE (CASE WHEN field='meaning' THEN meaning ELSE word END)<>w->>field
    ) candidates WHERE v IS NOT NULL AND v<>'' ORDER BY random() LIMIT 3) distractors
   ) choices;
   IF jsonb_array_length(opts)<>4 THEN RAISE EXCEPTION 'Insufficient options'; END IF;
  END IF;
  INSERT INTO public.match_question_issues(match_id,profile_id,question_index,options,question_type) VALUES(p_match_id,p_profile_id,idx,opts,kind);
 END IF;
 payload=jsonb_build_object('questionIndex',idx,'total',m.question_count,'quizType',kind,'options',opts);
 IF kind='meaning' THEN payload=payload || jsonb_build_object('word',w->>'word','prompt',w->>'word');
 ELSIF kind IN ('reverse','spelling') THEN payload=payload || jsonb_build_object('prompt',w->>'meaning');
 ELSE payload=payload || jsonb_build_object('prompt',''); END IF;
 RETURN payload;
END $$;
REVOKE ALL ON FUNCTION public.match_next_question_v2(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_next_question_v2(uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.match_submit_question(p_match_id uuid,p_profile_id uuid,p_question_index integer,p_answer text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; ws jsonb; issue public.match_question_issues; correct boolean; delta integer; prior public.match_answers; idx integer;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF p_profile_id IS DISTINCT FROM m.player1_id AND p_profile_id IS DISTINCT FROM m.player2_id AND p_profile_id IS DISTINCT FROM m.player3_id AND p_profile_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 SELECT * INTO prior FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id AND question_index=p_question_index LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'isCorrect',prior.is_correct,'duplicate',true); END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('ok',true,'matchEnded',true,'isCorrect',false); END IF;
 IF m.status<>'in_progress' THEN RAISE EXCEPTION 'Match not active'; END IF;
 IF p_answer IS NULL OR length(p_answer)>2000 THEN RAISE EXCEPTION 'Invalid answer'; END IF;
 SELECT count(*) INTO idx FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id;
 IF idx<>p_question_index THEN RAISE EXCEPTION 'Out of order'; END IF;
 SELECT * INTO issue FROM public.match_question_issues WHERE match_id=p_match_id AND profile_id=p_profile_id AND question_index=idx;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question not issued'; END IF;
 SELECT words INTO ws FROM public.match_question_secrets WHERE match_id=p_match_id;
 IF issue.question_type IN ('meaning','reverse') THEN
  IF NOT issue.options @> jsonb_build_array(p_answer) THEN RAISE EXCEPTION 'Invalid option'; END IF;
  correct=p_answer=ws->idx->>(CASE WHEN issue.question_type='meaning' THEN 'meaning' ELSE 'word' END);
 ELSIF issue.question_type IN ('spelling','listening') THEN correct=public.battle_spelling_correct(p_answer,ws->idx->>'word');
 ELSE RAISE EXCEPTION 'Invalid question type'; END IF;
 delta=CASE WHEN correct THEN 1 WHEN m.match_type='ranked' THEN -1 ELSE 0 END;
 INSERT INTO public.match_answers(match_id,player_id,question_index,answer,is_correct) VALUES(p_match_id,p_profile_id,idx,p_answer,correct);
 UPDATE public.ranked_matches SET
 player1_score=player1_score+CASE WHEN mode<>'2v2' AND player1_id=p_profile_id THEN delta ELSE 0 END,
 player2_score=player2_score+CASE WHEN mode<>'2v2' AND player2_id=p_profile_id THEN delta ELSE 0 END,
 team1_score=team1_score+CASE WHEN mode='2v2' AND (player1_id=p_profile_id OR player3_id=p_profile_id) THEN delta ELSE 0 END,
 team2_score=team2_score+CASE WHEN mode='2v2' AND (player2_id=p_profile_id OR player4_id=p_profile_id) THEN delta ELSE 0 END WHERE id=p_match_id;
 RETURN jsonb_build_object('ok',true,'isCorrect',correct);
END $$;
REVOKE ALL ON FUNCTION public.match_submit_question(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_submit_question(uuid,uuid,integer,text) TO service_role;
CREATE OR REPLACE FUNCTION public.match_listening_word(p_match_id uuid,p_profile_id uuid,p_question_index integer) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; kind text; idx integer; target text;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.status<>'in_progress' THEN RAISE EXCEPTION 'Match not active'; END IF;
 IF p_profile_id IS DISTINCT FROM m.player1_id AND p_profile_id IS DISTINCT FROM m.player2_id AND p_profile_id IS DISTINCT FROM m.player3_id AND p_profile_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 SELECT count(*) INTO idx FROM public.match_answers WHERE match_id=p_match_id AND player_id=p_profile_id;
 IF idx<>p_question_index THEN RAISE EXCEPTION 'Out of order'; END IF;
 SELECT question_type INTO kind FROM public.match_question_issues WHERE match_id=p_match_id AND profile_id=p_profile_id AND question_index=idx;
 IF kind IS DISTINCT FROM 'listening' THEN RAISE EXCEPTION 'Listening question not issued'; END IF;
 SELECT words->idx->>'word' INTO target FROM public.match_question_secrets WHERE match_id=p_match_id;
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.match_listening_word(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_listening_word(uuid,uuid,integer) TO service_role;