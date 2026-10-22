CREATE TABLE public.match_search_requests(request_id uuid PRIMARY KEY, profile_id uuid NOT NULL, mode text NOT NULL, party_id uuid, cancelled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.match_search_requests TO service_role;
ALTER TABLE public.match_search_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.match_bot_state(match_id uuid PRIMARY KEY REFERENCES public.ranked_matches(id) ON DELETE CASCADE, bot_slots integer[] NOT NULL, schedule jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.match_bot_state TO service_role;
ALTER TABLE public.match_bot_state ENABLE ROW LEVEL SECURITY;
-- All match makers share this lock, including older published clients.
ALTER FUNCTION public.find_match(uuid,integer,text,integer,text) RENAME TO find_match_human_legacy;
ALTER FUNCTION public.find_match_2v2(uuid,integer,integer,text,uuid) RENAME TO find_match_2v2_human_legacy;
REVOKE ALL ON FUNCTION public.find_match_human_legacy(uuid,integer,text,integer,text), public.find_match_2v2_human_legacy(uuid,integer,integer,text,uuid) FROM PUBLIC, anon, authenticated;
-- Preserve 2v2's first queue timestamp instead of restarting its wait on every poll.
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.find_match_2v2_human_legacy(uuid,integer,integer,text,uuid)'::regprocedure) INTO d;
 d=replace(d,'mq.status = ''searching''','false');
 d=replace(d,'WHERE mp.id = _party_id','WHERE mp.id = _party_id AND NOT EXISTS (SELECT 1 FROM match_queue q WHERE q.profile_id=p.id AND q.mode=''2v2'' AND q.status=''searching'')');
 d=replace(d,'VALUES (_profile_id, _grade, ''ranked'', _elo_rating, _subj, ''2v2'', 1);','SELECT _profile_id, _grade, ''ranked'', _elo_rating, _subj, ''2v2'', 1 WHERE NOT EXISTS (SELECT 1 FROM match_queue WHERE profile_id=_profile_id AND mode=''2v2'' AND status=''searching'');');
 EXECUTE d;
END $$;
CREATE FUNCTION public.find_match(_profile_id uuid,_grade integer,_match_type text,_elo_rating integer,_subject text DEFAULT 'mixed') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE mid uuid; BEGIN
 PERFORM pg_advisory_xact_lock(602026);
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_profile_id AND user_id=auth.uid() AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT id INTO mid FROM ranked_matches WHERE status='in_progress' AND _profile_id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id]) ORDER BY created_at DESC LIMIT 1;
 IF mid IS NOT NULL THEN RETURN mid; END IF;
 RETURN public.find_match_human_legacy(_profile_id,_grade,_match_type,_elo_rating,_subject);
END $$;
CREATE FUNCTION public.find_match_2v2(_profile_id uuid,_grade integer,_elo_rating integer,_subject text DEFAULT 'mixed',_party_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE mid uuid; BEGIN
 PERFORM pg_advisory_xact_lock(602026);
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_profile_id AND user_id=auth.uid() AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT id INTO mid FROM ranked_matches WHERE status='in_progress' AND _profile_id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id]) ORDER BY created_at DESC LIMIT 1;
 IF mid IS NOT NULL THEN RETURN mid; END IF;
 IF _party_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM match_parties mp JOIN profiles p ON p.id=mp.member_id WHERE mp.id=_party_id AND mp.leader_id=_profile_id AND mp.status IN ('ready','queued') AND mp.expires_at>now() AND (CASE WHEN p.grade>=9 THEN 9 ELSE p.grade END)=_grade AND (p.banned_until IS NULL OR p.banned_until<=now())) THEN RAISE EXCEPTION 'Party not ready'; END IF;
 RETURN public.find_match_2v2_human_legacy(_profile_id,_grade,_elo_rating,_subject,_party_id);
END $$;
REVOKE ALL ON FUNCTION public.find_match(uuid,integer,text,integer,text),public.find_match_2v2(uuid,integer,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_match(uuid,integer,text,integer,text),public.find_match_2v2(uuid,integer,integer,text,uuid) TO authenticated,service_role;
CREATE FUNCTION public.guard_single_active_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(602026);
 IF NEW.status='in_progress' AND EXISTS(SELECT 1 FROM ranked_matches m WHERE m.status='in_progress' AND m.id<>NEW.id AND ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id] && ARRAY[NEW.player1_id,NEW.player2_id,NEW.player3_id,NEW.player4_id]) THEN RAISE EXCEPTION 'Player already in active match'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_single_active_match BEFORE INSERT OR UPDATE OF status,player1_id,player2_id,player3_id,player4_id ON public.ranked_matches FOR EACH ROW EXECUTE FUNCTION public.guard_single_active_match();
-- Bot-bearing matches may only be constructed by the privileged service.
CREATE FUNCTION public.matchmaking_action(p_profile_id uuid,p_request_id uuid,p_mode text,p_type text,p_subject text,p_party_id uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles; r match_search_requests; mid uuid; mate uuid; ids uuid[]; slots integer[]; ws jsonb; n integer; sched jsonb; g integer; qtime timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(602026);
 SELECT * INTO p FROM profiles WHERE id=p_profile_id;
 IF NOT FOUND OR (p.banned_until IS NOT NULL AND p.banned_until>now()) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_mode NOT IN ('1v1','2v2') OR p_type NOT IN ('ranked','free') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
 INSERT INTO match_search_requests(request_id,profile_id,mode,party_id,cancelled) VALUES(p_request_id,p_profile_id,p_mode,p_party_id,p_cancel) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM match_search_requests WHERE request_id=p_request_id FOR UPDATE;
 IF r.profile_id<>p_profile_id OR r.mode<>p_mode OR r.party_id IS DISTINCT FROM p_party_id THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT id INTO mid FROM ranked_matches WHERE status='in_progress' AND p_profile_id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id]) ORDER BY created_at DESC LIMIT 1;
 IF p_cancel THEN
  UPDATE match_search_requests SET cancelled=true,updated_at=now() WHERE request_id=p_request_id;
  DELETE FROM match_queue WHERE status='searching' AND mode=p_mode AND (profile_id=p_profile_id OR (p_party_id IS NOT NULL AND party_id=p_party_id));
  RETURN jsonb_build_object('matchId',mid,'cancelled',true);
 END IF;
 IF r.cancelled THEN RETURN jsonb_build_object('cancelled',true); END IF;
 IF mid IS NOT NULL THEN RETURN jsonb_build_object('matchId',mid); END IF;
 g=CASE WHEN p.grade>=9 THEN 9 ELSE p.grade END;
 PERFORM set_config('request.jwt.claim.sub',p.user_id::text,true);
 IF p_mode='1v1' THEN mid=public.find_match(p_profile_id,g,p_type,CASE WHEN p_type='free' THEN p.elo_free ELSE p.elo_rating END,p_subject);
 ELSE mid=public.find_match_2v2(p_profile_id,g,p.elo_rating,p_subject,p_party_id); END IF;
 IF mid IS NOT NULL THEN RETURN jsonb_build_object('matchId',mid); END IF;
 SELECT min(created_at) INTO qtime FROM match_queue WHERE profile_id=p_profile_id AND mode=p_mode AND status='searching';
 IF qtime IS NULL OR now()<greatest(r.created_at,qtime)+interval '60 seconds' THEN RETURN jsonb_build_object('matchId',NULL); END IF;
 IF p_party_id IS NOT NULL THEN
  SELECT member_id INTO mate FROM match_parties WHERE id=p_party_id AND leader_id=p_profile_id AND status IN ('ready','queued') AND expires_at>now() FOR UPDATE;
  IF mate IS NULL THEN RAISE EXCEPTION 'Party not ready'; END IF;
 END IF;
 ids=ARRAY[p_profile_id,mate]; n=CASE WHEN p_mode='2v2' THEN 15 ELSE 10 END;
 IF p_subject='math' THEN SELECT jsonb_agg(to_jsonb(w)) INTO ws FROM (SELECT id,word,meaning,phonetic,example FROM math_words ORDER BY random() LIMIT n) w;
 ELSIF p_subject='science' THEN SELECT jsonb_agg(to_jsonb(w)) INTO ws FROM (SELECT id,word,meaning,phonetic,example FROM science_words ORDER BY random() LIMIT n) w;
 ELSIF p_subject='mixed' THEN SELECT jsonb_agg(to_jsonb(w)) INTO ws FROM (
 (SELECT id,word,meaning,phonetic,example FROM words WHERE grade=g ORDER BY random() LIMIT (CASE WHEN n=15 THEN 5 ELSE 4 END)) UNION ALL
 (SELECT id,word,meaning,phonetic,example FROM math_words ORDER BY random() LIMIT (CASE WHEN n=15 THEN 5 ELSE 3 END)) UNION ALL
 (SELECT id,word,meaning,phonetic,example FROM science_words ORDER BY random() LIMIT (CASE WHEN n=15 THEN 5 ELSE 3 END))) w;
 ELSE SELECT jsonb_agg(to_jsonb(w)) INTO ws FROM (SELECT id,word,meaning,phonetic,example FROM words WHERE grade=g ORDER BY random() LIMIT n) w; END IF;
 INSERT INTO ranked_matches(player1_id,player2_id,player3_id,player4_id,grade,match_type,subject,status,words,started_at,mode) VALUES(p_profile_id,NULL,mate,NULL,g,p_type,p_subject,'in_progress',ws,now(),p_mode) RETURNING id INTO mid;
 SELECT question_count INTO n FROM ranked_matches WHERE id=mid;
 IF n<=0 THEN RAISE EXCEPTION 'No vocabulary available'; END IF;
 slots=CASE WHEN p_mode='1v1' THEN ARRAY[2] WHEN mate IS NULL THEN ARRAY[2,3,4] ELSE ARRAY[2,4] END;
 SELECT jsonb_agg(jsonb_build_object('slot',s,'at',i*8+random()*4,'delta',CASE WHEN random()<0.7 THEN 1 WHEN p_type='ranked' THEN -1 ELSE 0 END)) INTO sched FROM unnest(slots) s CROSS JOIN generate_series(1,n) i;
 INSERT INTO match_bot_state(match_id,bot_slots,schedule) VALUES(mid,slots,sched);
 UPDATE match_queue SET status='matched',match_id=mid WHERE status='searching' AND (profile_id=ANY(ids) OR (p_party_id IS NOT NULL AND party_id=p_party_id));
 IF p_party_id IS NOT NULL THEN UPDATE match_parties SET status='matched',match_id=mid WHERE id=p_party_id; END IF;
 RETURN jsonb_build_object('matchId',mid,'bots',true);
END $$;
REVOKE ALL ON FUNCTION public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean) TO service_role;
CREATE FUNCTION public.tick_match_bots(p_match_id uuid,p_profile_id uuid,p_finish boolean DEFAULT false,p_forfeit boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches; b match_bot_state; s1 integer; s2 integer; t1 integer; t2 integer; wt integer; done boolean;
BEGIN
 SELECT * INTO m FROM ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR NOT p_profile_id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL)) THEN RAISE EXCEPTION 'Not in match'; END IF;
 SELECT * INTO b FROM match_bot_state WHERE match_id=p_match_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('ok',true,'winnerId',m.winner_id,'winnerTeam',m.winner_team,'coinsEarned',0,'xpEarned',0); END IF;
 SELECT coalesce(sum((v->>'delta')::integer) FILTER(WHERE (v->>'slot')::integer IN (1,3)),0),coalesce(sum((v->>'delta')::integer) FILTER(WHERE (v->>'slot')::integer IN (2,4)),0) INTO s1,s2 FROM jsonb_array_elements(b.schedule) v WHERE (v->>'at')::numeric<=extract(epoch FROM now()-m.started_at);
 SELECT coalesce(sum(CASE WHEN is_correct THEN 1 WHEN m.match_type='ranked' THEN -1 ELSE 0 END) FILTER(WHERE player_id IN (m.player1_id,m.player3_id)),0),coalesce(sum(CASE WHEN is_correct THEN 1 WHEN m.match_type='ranked' THEN -1 ELSE 0 END) FILTER(WHERE player_id IN (m.player2_id,m.player4_id)),0) INTO t1,t2 FROM match_answers WHERE match_id=p_match_id;
 t1=t1+s1;t2=t2+s2;
 done=now()>=m.started_at+interval '300 seconds' OR p_forfeit OR (p_finish AND NOT EXISTS(SELECT 1 FROM unnest(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL)) pid WHERE (SELECT count(*) FROM match_answers WHERE match_id=p_match_id AND player_id=pid)<m.question_count));
 wt=CASE WHEN p_forfeit THEN CASE WHEN p_profile_id IN (m.player1_id,m.player3_id) THEN 2 ELSE 1 END WHEN t1>t2 THEN 1 WHEN t2>t1 THEN 2 ELSE NULL END;
 UPDATE ranked_matches SET player1_score=CASE WHEN mode='1v1' THEN t1 ELSE player1_score END,player2_score=CASE WHEN mode='1v1' THEN t2 ELSE player2_score END,team1_score=t1,team2_score=t2,status=CASE WHEN done THEN 'completed' ELSE status END,ended_at=CASE WHEN done THEN now() ELSE ended_at END,winner_team=CASE WHEN done THEN wt ELSE winner_team END,winner_id=CASE WHEN done AND mode='1v1' AND wt=1 THEN player1_id ELSE winner_id END WHERE id=p_match_id;
 UPDATE match_bot_state SET updated_at=now() WHERE match_id=p_match_id;
 IF done THEN DELETE FROM match_queue WHERE match_id=p_match_id; END IF;
 RETURN jsonb_build_object('ok',true,'pending',NOT done,'winnerId',CASE WHEN wt=1 THEN m.player1_id ELSE NULL END,'winnerTeam',wt,'coinsEarned',0,'xpEarned',0);
END $$;
REVOKE ALL ON FUNCTION public.tick_match_bots(uuid,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tick_match_bots(uuid,uuid,boolean,boolean) TO service_role;