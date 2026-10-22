CREATE OR REPLACE FUNCTION public.guard_single_active_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status<>'in_progress' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF OLD.status='in_progress' AND ROW(OLD.player1_id,OLD.player2_id,OLD.player3_id,OLD.player4_id) IS NOT DISTINCT FROM ROW(NEW.player1_id,NEW.player2_id,NEW.player3_id,NEW.player4_id) THEN RETURN NEW; END IF; END IF;
 PERFORM pg_advisory_xact_lock(602026);
 IF EXISTS(SELECT 1 FROM ranked_matches m WHERE m.status='in_progress' AND m.id<>NEW.id AND ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id] && ARRAY[NEW.player1_id,NEW.player2_id,NEW.player3_id,NEW.player4_id]) THEN RAISE EXCEPTION 'Player already in active match'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.find_match_human_legacy(uuid,integer,text,integer,text)'::regprocedure) INTO d;
 d=replace(d,$old$rm.status = 'in_progress' AND rm.mode = '1v1'$old$,$new$rm.status = 'in_progress'$new$); EXECUTE d;
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.find_match_2v2_human_legacy(uuid,integer,integer,text,uuid)'::regprocedure) INTO d;
 d=replace(d,'AND NOT EXISTS (SELECT 1 FROM match_queue q WHERE q.profile_id=p.id', 'AND NOT EXISTS(SELECT 1 FROM ranked_matches rm WHERE rm.status=''in_progress'' AND p.id=ANY(ARRAY[rm.player1_id,rm.player2_id,rm.player3_id,rm.player4_id])) AND NOT EXISTS (SELECT 1 FROM match_queue q WHERE q.profile_id=p.id');
 d=replace(d,$old$AND party_id IS NOT NULL$old$, $new$AND party_id IS NOT NULL AND EXISTS(SELECT 1 FROM match_parties mp WHERE mp.id=match_queue.party_id AND mp.status IN ('ready','queued') AND mp.expires_at>now()) AND (SELECT count(DISTINCT q.profile_id) FROM match_queue q WHERE q.party_id=match_queue.party_id AND q.status='searching' AND q.mode='2v2')=2$new$);
 d=replace(d,$old$status = 'searching' AND mode = '2v2' AND grade = _grade$old$, $new$status = 'searching' AND mode = '2v2' AND grade = _grade AND NOT EXISTS(SELECT 1 FROM ranked_matches rm WHERE rm.status='in_progress' AND match_queue.profile_id=ANY(ARRAY[rm.player1_id,rm.player2_id,rm.player3_id,rm.player4_id]))$new$);
 EXECUTE d;
END $$;
ALTER TABLE public.match_search_requests ADD COLUMN match_type text, ADD COLUMN subject text;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean)'::regprocedure) INTO d;
 d=replace(d,'g integer; qtime timestamptz;', 'g integer; qtime timestamptz; newer boolean;');
 d=replace(d,'INSERT INTO match_search_requests(request_id,profile_id,mode,party_id,cancelled) VALUES(p_request_id,p_profile_id,p_mode,p_party_id,p_cancel)', 'SELECT EXISTS(SELECT 1 FROM match_search_requests WHERE profile_id=p_profile_id AND request_id<>p_request_id AND NOT cancelled AND created_at>coalesce((SELECT created_at FROM match_search_requests WHERE request_id=p_request_id),now())) INTO newer; INSERT INTO match_search_requests(request_id,profile_id,mode,party_id,cancelled,match_type,subject) VALUES(p_request_id,p_profile_id,p_mode,p_party_id,p_cancel,p_type,p_subject)');
 d=replace(d,'IF p_cancel THEN', 'IF NOT p_cancel AND (r.match_type IS DISTINCT FROM p_type OR r.subject IS DISTINCT FROM p_subject) THEN RAISE EXCEPTION ''Changed search parameters''; END IF; IF p_cancel THEN');
 d=replace(d,$old$DELETE FROM match_queue WHERE status='searching' AND mode=p_mode$old$, $new$DELETE FROM match_queue WHERE NOT newer AND status='searching' AND mode=p_mode$new$);
 d=replace(d,'IF r.cancelled THEN', 'IF r.cancelled OR newer THEN');
 d=replace(d,'g=CASE WHEN', 'DELETE FROM match_queue WHERE profile_id=p_profile_id AND status=''searching'' AND (mode<>p_mode OR subject IS DISTINCT FROM p_subject OR match_type<>p_type OR party_id IS DISTINCT FROM p_party_id); g=CASE WHEN');
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.find_match_2v2(_profile_id uuid,_grade integer,_elo_rating integer,_subject text DEFAULT 'mixed',_party_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE mid uuid; BEGIN
 PERFORM pg_advisory_xact_lock(602026);
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_profile_id AND user_id=auth.uid() AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 SELECT id INTO mid FROM ranked_matches WHERE status='in_progress' AND _profile_id=ANY(ARRAY[player1_id,player2_id,player3_id,player4_id]) ORDER BY created_at DESC LIMIT 1;
 IF mid IS NOT NULL THEN RETURN mid; END IF;
 IF _party_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM match_parties mp JOIN profiles p ON p.id=mp.member_id WHERE mp.id=_party_id AND mp.leader_id=_profile_id AND mp.status IN ('ready','queued') AND mp.expires_at>now() AND (CASE WHEN p.grade>=9 THEN 9 ELSE p.grade END)=_grade AND (p.banned_until IS NULL OR p.banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM ranked_matches rm WHERE rm.status='in_progress' AND p.id=ANY(ARRAY[rm.player1_id,rm.player2_id,rm.player3_id,rm.player4_id]))) THEN RAISE EXCEPTION 'Party not ready'; END IF;
 RETURN public.find_match_2v2_human_legacy(_profile_id,_grade,_elo_rating,_subject,_party_id);
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.tick_match_bots(uuid,uuid,boolean,boolean)'::regprocedure) INTO d;
 d=replace(d,'wt=CASE WHEN p_forfeit', 'IF NOT EXISTS(SELECT 1 FROM match_answers WHERE match_id=p_match_id) THEN t1=0; t2=0; END IF; wt=CASE WHEN NOT EXISTS(SELECT 1 FROM match_answers WHERE match_id=p_match_id) THEN NULL WHEN p_forfeit');
 d=replace(d,'IF m.status=''completed'' THEN RETURN jsonb_build_object', 'IF m.status=''completed'' THEN RETURN jsonb_build_object');
 EXECUTE d;
 SELECT pg_get_functiondef('public.complete_empty_match(uuid,uuid)'::regprocedure) INTO d;
 d=replace(d,$old$IF EXISTS(SELECT 1 FROM public.match_answers WHERE match_id=m.id)$old$, $new$IF EXISTS(SELECT 1 FROM public.match_bot_state WHERE match_id=m.id) THEN RETURN jsonb_build_object('handled',false); END IF; IF EXISTS(SELECT 1 FROM public.match_answers WHERE match_id=m.id)$new$);
 EXECUTE d;
END $$;