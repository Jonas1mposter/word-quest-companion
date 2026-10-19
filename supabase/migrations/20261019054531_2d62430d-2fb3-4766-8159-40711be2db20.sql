CREATE TABLE public.bot_battle_sessions (
 id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 difficulty text NOT NULL, status text NOT NULL DEFAULT 'active', words jsonb NOT NULL,
 issues jsonb NOT NULL DEFAULT '[]', answers jsonb NOT NULL DEFAULT '[]',
 player_score integer NOT NULL DEFAULT 0, bot_score integer NOT NULL DEFAULT 0,
 result jsonb, started_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_battle_sessions TO service_role;
ALTER TABLE public.bot_battle_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY bot_sessions_service ON public.bot_battle_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX bot_sessions_profile ON public.bot_battle_sessions(profile_id, created_at DESC);
CREATE FUNCTION public.bot_sessions_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER bot_sessions_touch BEFORE UPDATE ON public.bot_battle_sessions FOR EACH ROW EXECUTE FUNCTION public.bot_sessions_touch();
CREATE FUNCTION public.bot_battle_action(p_profile_id uuid,p_session_id uuid,p_action text,p_difficulty text DEFAULT 'medium',p_index integer DEFAULT NULL,p_answer text DEFAULT '',p_reason text DEFAULT NULL,p_meta jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.bot_battle_sessions; p public.profiles; ws jsonb; w jsonb; issue jsonb; opts jsonb; kind text; field text; idx integer; correct boolean; response jsonb; elapsed numeric; coins_gain integer; xp_gain integer; lv integer; xp_now integer; xp_next integer; outcome text; min_delay integer; max_delay integer; accuracy numeric; gaps numeric[]; avg_gap numeric; std_gap numeric;
BEGIN
 IF coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 SELECT * INTO p FROM profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND OR p.banned_until>now() THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 SELECT * INTO s FROM bot_battle_sessions WHERE id=p_session_id FOR UPDATE;
 IF FOUND AND s.profile_id<>p_profile_id THEN RAISE EXCEPTION 'Not your session'; END IF;
 IF p_action='start' THEN
  IF s.id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'sessionId',s.id,'total',jsonb_array_length(s.words),'startedAt',s.started_at); END IF;
  IF p_difficulty NOT IN ('easy','medium','hard') THEN RAISE EXCEPTION 'Invalid difficulty'; END IF;
  UPDATE bot_battle_sessions SET status='abandoned' WHERE profile_id=p_profile_id AND status='active';
  IF p.grade>=9 THEN SELECT jsonb_agg(to_jsonb(t)) INTO ws FROM (SELECT id,word,meaning FROM hs_words ORDER BY random() LIMIT 10)t;
  ELSE SELECT jsonb_agg(to_jsonb(t)) INTO ws FROM (SELECT id,word,meaning FROM words WHERE grade=p.grade ORDER BY random() LIMIT 10)t; END IF;
  IF coalesce(jsonb_array_length(ws),0)<4 THEN RAISE EXCEPTION 'Insufficient vocabulary'; END IF;
  INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,started_at) VALUES(p_session_id,p_profile_id,p_difficulty,ws,now()+interval '3 seconds') RETURNING * INTO s;
  RETURN jsonb_build_object('ok',true,'sessionId',s.id,'total',jsonb_array_length(ws),'startedAt',s.started_at);
 END IF;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF p_action='finish' AND s.result IS NOT NULL THEN RETURN s.result; END IF;
 IF p_action='answer' AND p_index>=0 AND p_index<jsonb_array_length(s.answers) THEN RETURN s.answers->p_index->'response'; END IF;
 IF s.status<>'active' THEN RAISE EXCEPTION 'Session ended'; END IF;
 IF p_action='forfeit' THEN
  IF p_reason NOT IN ('tab_switch_limit','background_away','webdriver','robotic_mouse','synthetic_click') THEN RAISE EXCEPTION 'Invalid reason'; END IF;
  PERFORM dac_flag(p_profile_id,'bot-battle',p_reason,'high',jsonb_build_object('sessionId',s.id,'clientReported',true,'evidence',p_meta));
  response=jsonb_build_object('ok',true,'forfeited',true,'result','loss','playerScore',s.player_score,'botScore',s.bot_score,'xpEarned',0,'coinsEarned',0);
  UPDATE bot_battle_sessions SET status='forfeited',result=response WHERE id=s.id;
  RETURN response;
 END IF;
 idx=jsonb_array_length(s.answers);
 IF p_action IN ('question','answer','audio') AND (now()<s.started_at OR now()>s.started_at+interval '180 seconds') THEN RAISE EXCEPTION 'Session outside time window'; END IF;
 IF p_action='question' THEN
  IF idx>=jsonb_array_length(s.words) THEN RETURN jsonb_build_object('done',true); END IF;
  w=s.words->idx; kind=(ARRAY['meaning','reverse','spelling','listening'])[1+idx%4];
  issue=s.issues->idx;
  IF issue IS NULL THEN
   opts='[]';
   IF kind IN ('meaning','reverse') THEN
    field=CASE WHEN kind='meaning' THEN 'meaning' ELSE 'word' END;
    SELECT jsonb_agg(v ORDER BY random()) INTO opts FROM (SELECT w->>field v UNION ALL SELECT v FROM (SELECT DISTINCT value->>field v FROM jsonb_array_elements(s.words) WHERE value->>field<>w->>field ORDER BY v LIMIT 3)t)q;
    IF jsonb_array_length(opts)<>4 THEN RAISE EXCEPTION 'Insufficient choices'; END IF;
   END IF;
   min_delay=CASE s.difficulty WHEN 'easy' THEN 5000 WHEN 'medium' THEN 3000 ELSE 2000 END;
   max_delay=CASE s.difficulty WHEN 'easy' THEN 9000 WHEN 'medium' THEN 6000 ELSE 4000 END;
   accuracy=CASE s.difficulty WHEN 'easy' THEN .30 WHEN 'medium' THEN .60 ELSE .85 END;
   issue=jsonb_build_object('type',kind,'options',opts,'issuedAt',now(),'botDelay',min_delay+random()*(max_delay-min_delay),'botCorrect',random()<accuracy);
   UPDATE bot_battle_sessions SET issues=issues||jsonb_build_array(issue) WHERE id=s.id;
  END IF;
  response=jsonb_build_object('questionIndex',idx,'total',jsonb_array_length(s.words),'quizType',kind,'options',issue->'options','prompt',CASE WHEN kind='meaning' THEN w->>'word' WHEN kind='listening' THEN '' ELSE w->>'meaning' END);
  RETURN response;
 END IF;
 IF p_action='audio' THEN
  IF p_index IS DISTINCT FROM idx OR s.issues->idx->>'type'<>'listening' THEN RAISE EXCEPTION 'Audio not issued'; END IF;
  RETURN jsonb_build_object('target',s.words->idx->>'word');
 END IF;
 IF p_action='answer' THEN
  IF p_index IS DISTINCT FROM idx OR s.issues->idx IS NULL THEN RAISE EXCEPTION 'Question not issued or out of order'; END IF;
  issue=s.issues->idx; kind=issue->>'type'; w=s.words->idx;
  IF kind IN ('meaning','reverse') AND p_answer<>'' AND NOT (issue->'options' ? p_answer) THEN RAISE EXCEPTION 'Invalid option'; END IF;
  correct=CASE WHEN kind='meaning' THEN p_answer=w->>'meaning' WHEN kind='reverse' THEN p_answer=w->>'word' ELSE battle_spelling_correct(p_answer,w->>'word') END;
  elapsed=extract(epoch from (now()-(issue->>'issuedAt')::timestamptz))*1000;
  s.player_score=s.player_score+CASE WHEN correct THEN 1 ELSE 0 END;
  s.bot_score=s.bot_score+CASE WHEN (issue->>'botCorrect')::boolean AND elapsed>=(issue->>'botDelay')::numeric THEN 1 ELSE 0 END;
  response=jsonb_build_object('ok',true,'isCorrect',correct,'playerScore',s.player_score,'botScore',s.bot_score);
  IF kind IN ('spelling','listening') THEN response=response||jsonb_build_object('correctAnswer',w->>'word'); END IF;
  UPDATE bot_battle_sessions SET player_score=s.player_score,bot_score=s.bot_score,answers=answers||jsonb_build_array(jsonb_build_object('answer',p_answer,'elapsedMs',elapsed,'answeredAt',now(),'response',response)) WHERE id=s.id;
  RETURN response;
 END IF;
 IF p_action='finish' THEN
  IF idx<jsonb_array_length(s.words) AND now()<s.started_at+interval '180 seconds' THEN RAISE EXCEPTION 'Answers incomplete'; END IF;
  IF idx<jsonb_array_length(s.words) THEN
   response=jsonb_build_object('ok',true,'result','loss','playerScore',s.player_score,'botScore',s.bot_score,'xpEarned',0,'coinsEarned',0);
   UPDATE bot_battle_sessions SET status='expired',result=response WHERE id=s.id; RETURN response;
  END IF;
  outcome=CASE WHEN s.player_score>s.bot_score THEN 'win' WHEN s.player_score=s.bot_score THEN 'draw' ELSE 'loss' END;
  xp_gain=CASE outcome WHEN 'win' THEN 3 WHEN 'draw' THEN 2 ELSE 1 END;
  coins_gain=CASE s.difficulty WHEN 'easy' THEN CASE outcome WHEN 'win' THEN 4 WHEN 'draw' THEN 2 ELSE 0 END WHEN 'medium' THEN CASE outcome WHEN 'win' THEN 7 WHEN 'draw' THEN 3 ELSE 1 END ELSE CASE outcome WHEN 'win' THEN 11 WHEN 'draw' THEN 4 ELSE 1 END END;
  IF extract(isodow from now() AT TIME ZONE 'Asia/Shanghai') IN (6,7) THEN coins_gain=coins_gain*2; END IF;
  xp_now=p.xp+xp_gain; lv=p.level; xp_next=p.xp_to_next_level;
  WHILE xp_now>=xp_next LOOP xp_now=xp_now-xp_next; lv=lv+1; xp_next=100*lv; END LOOP;
  UPDATE profiles SET xp=xp_now,level=lv,xp_to_next_level=xp_next,total_xp=total_xp+xp_gain,coins=coins+coins_gain,lifetime_coins_earned=lifetime_coins_earned+coins_gain,bot_wins=bot_wins+CASE WHEN outcome='win' THEN 1 ELSE 0 END WHERE id=p_profile_id;
  PERFORM add_season_pass_xp(p_profile_id,xp_gain);
  PERFORM award_badges_for_profile(p_profile_id);
  response=jsonb_build_object('ok',true,'result',outcome,'playerScore',s.player_score,'botScore',s.bot_score,'xpEarned',xp_gain,'coinsEarned',coins_gain);
  UPDATE bot_battle_sessions SET status='completed',result=response WHERE id=s.id; RETURN response;
 END IF;
 RAISE EXCEPTION 'Invalid action';
END $$;
REVOKE ALL ON FUNCTION public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bot_sessions_touch() FROM PUBLIC,anon,authenticated;