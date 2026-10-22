BEGIN;
DO $$
DECLARE ids uuid[]; users uuid[]; tid uuid; rid uuid; s jsonb; q public.team_boss_questions; n integer; j integer; k integer; attempt integer; round_no integer; caught boolean; before_coins integer; used integer; initial_used integer; expected integer; claims text;
BEGIN
 SELECT t.id INTO STRICT tid FROM public.teams t JOIN public.team_members m ON m.team_id=t.id JOIN public.profiles p ON p.id=m.profile_id WHERE coalesce(p.grade,0)>=1 AND (p.banned_until IS NULL OR p.banned_until<now()) AND NOT EXISTS(SELECT 1 FROM public.team_boss_runs b WHERE b.team_id=t.id AND b.phase IN ('lobby','combat')) GROUP BY t.id HAVING count(*)>=5 LIMIT 1;
 SELECT array_agg(p.id ORDER BY p.id),array_agg(p.user_id ORDER BY p.id) INTO ids,users FROM public.team_members m JOIN public.profiles p ON p.id=m.profile_id WHERE m.team_id=tid AND (p.banned_until IS NULL OR p.banned_until<now());
 IF has_table_privilege('authenticated','public.team_boss_questions','SELECT') OR has_function_privilege('authenticated','public.team_boss_dispatch(uuid,text,uuid,integer,text,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.team_boss_action(text,uuid,integer,text,uuid)','EXECUTE') OR has_function_privilege('anon','public.team_boss_view(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Private access leaked'; END IF;
 FOR n IN 3..5 LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
  s:=public.team_boss_action('create'); rid:=(s->'state'->>'id')::uuid;
  IF public.team_boss_action('create')->'state'->>'id'<>rid::text THEN RAISE EXCEPTION 'Duplicate lobby'; END IF;
  FOR j IN 2..n LOOP
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[j],'role','authenticated')::text,true);
   PERFORM public.team_boss_action('join');
  END LOOP;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
  caught:=false; BEGIN PERFORM public.team_boss_action('start',rid); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Unready players started'; END IF;
  FOR j IN 1..n LOOP
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[j],'role','authenticated')::text,true);
   PERFORM public.team_boss_action('ready',rid);
  END LOOP;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[2],'role','authenticated')::text,true);
  caught:=false; BEGIN PERFORM public.team_boss_action('start',rid); EXCEPTION WHEN OTHERS THEN caught:=true; END;
  IF NOT caught THEN RAISE EXCEPTION 'Non-host started'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
  s:=public.team_boss_action('start',rid)->'state';
  IF (s->>'partySize')::integer<>n OR (s->>'bossMax')::integer<>120*n THEN RAISE EXCEPTION '3-5 scaling failed'; END IF;
  IF s->'question' ? 'word' OR s->'question' ? 'meaning' OR s->'question' ? 'answer' OR s->'question'->'feedback'<>'null'::jsonb THEN RAISE EXCEPTION 'Answer privacy failed'; END IF;
  PERFORM public.team_boss_settle(rid,'cancelled');
 END LOOP;
 -- Too few players must be rejected even if both are ready.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
 s:=public.team_boss_action('create'); rid:=(s->'state'->>'id')::uuid; PERFORM public.team_boss_action('ready',rid);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[2],'role','authenticated')::text,true);
 PERFORM public.team_boss_action('join'); PERFORM public.team_boss_action('ready',rid);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
 caught:=false; BEGIN PERFORM public.team_boss_action('start',rid); EXCEPTION WHEN OTHERS THEN caught:=true; END;
 IF NOT caught THEN RAISE EXCEPTION 'Two players started'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[3],'role','authenticated')::text,true); PERFORM public.team_boss_action('join'); PERFORM public.team_boss_action('ready',rid);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true); PERFORM public.team_boss_action('start',rid);
 UPDATE public.team_boss_questions SET created_at=now()-interval '2 seconds' WHERE run_id=rid;
 caught:=false; BEGIN PERFORM public.team_boss_action('act',rid,1,'attack'); EXCEPTION WHEN OTHERS THEN caught:=true; END;
 IF NOT caught THEN RAISE EXCEPTION 'Act before answer'; END IF;
 SELECT * INTO STRICT q FROM public.team_boss_questions WHERE run_id=rid AND profile_id=ids[1] AND round=1;
 s:=public.team_boss_action('answer',rid,1,q.meaning);
 PERFORM public.team_boss_action('answer',rid,1,q.meaning);
 IF (SELECT answered FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[1])<>1 THEN RAISE EXCEPTION 'Duplicate answer contribution'; END IF;
 caught:=false; BEGIN PERFORM public.team_boss_action('answer',rid,1,'changed'); EXCEPTION WHEN OTHERS THEN caught:=true; END;
 IF NOT caught THEN RAISE EXCEPTION 'Changed answer accepted'; END IF;
 UPDATE public.team_boss_players SET role='healer' WHERE run_id=rid AND profile_id=ids[1];
 UPDATE public.team_boss_players SET hp=0 WHERE run_id=rid AND profile_id=ids[3];
 PERFORM public.team_boss_action('act',rid,1,'heal',ids[3]);
 PERFORM public.team_boss_action('act',rid,1,'heal',ids[3]);
 UPDATE public.team_boss_questions SET answer=meaning,is_correct=true,action='guard',target_id=ids[3] WHERE run_id=rid AND profile_id=ids[2] AND round=1;
 UPDATE public.team_boss_questions SET answer='wrong',is_correct=false,action='miss' WHERE run_id=rid AND profile_id=ids[3] AND round=1;
 PERFORM public.team_boss_tick(rid);
 IF (SELECT hp FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[3])<>29 THEN RAISE EXCEPTION 'Heal rescue / guard reduction failed'; END IF;
 IF (SELECT hp FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[2])<>90 THEN RAISE EXCEPTION 'Base incoming damage'; END IF;
 -- Charge round: all 3 correct interrupt; only 2 do not.
 UPDATE public.team_boss_runs SET round=3,deadline=now()-interval '1 second' WHERE id=rid;
 PERFORM public.team_boss_issue(rid);
 UPDATE public.team_boss_questions SET answer=word,is_correct=true,action='guard',target_id=profile_id WHERE run_id=rid AND round=3;
 PERFORM public.team_boss_tick(rid);
 IF (SELECT log->>'interrupted' FROM public.team_boss_runs WHERE id=rid)<>'true' OR (SELECT log->>'incoming' FROM public.team_boss_runs WHERE id=rid)<>'0' THEN RAISE EXCEPTION 'Charge interruption failed'; END IF;
 UPDATE public.team_boss_runs SET round=6,deadline=now()-interval '1 second' WHERE id=rid; PERFORM public.team_boss_issue(rid);
 UPDATE public.team_boss_questions SET answer=word,is_correct=true,action='attack' WHERE run_id=rid AND round=6 AND profile_id<>ids[3];
 UPDATE public.team_boss_questions SET answer='wrong',is_correct=false,action='miss' WHERE run_id=rid AND round=6 AND profile_id=ids[3];
 PERFORM public.team_boss_tick(rid);
 IF (SELECT log->>'interrupted' FROM public.team_boss_runs WHERE id=rid)<>'false' OR (SELECT log->>'incoming' FROM public.team_boss_runs WHERE id=rid)<>'28' THEN RAISE EXCEPTION 'Failed charge damage'; END IF;
 PERFORM public.team_boss_settle(rid,'cancelled');
 -- Four complete runs, actual issued answers/actions, reward cap and idempotency.
 SELECT coins INTO before_coins FROM public.profiles WHERE id=ids[1];
 SELECT coalesce(sum(coins),0) INTO used FROM public.team_boss_rewards WHERE profile_id=ids[1] AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 initial_used:=used;
 FOR attempt IN 1..4 LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
  s:=public.team_boss_action('create'); rid:=(s->'state'->>'id')::uuid;
  FOR j IN 1..3 LOOP
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[j],'role','authenticated')::text,true);
   IF j>1 THEN PERFORM public.team_boss_action('join'); END IF;
   PERFORM public.team_boss_action('ready',rid);
  END LOOP;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true); PERFORM public.team_boss_action('start',rid);
  UPDATE public.team_boss_runs SET started_at=now()-interval '61 seconds' WHERE id=rid;
  FOR round_no IN 1..7 LOOP
   UPDATE public.team_boss_questions SET created_at=now()-interval '2 seconds' WHERE run_id=rid AND round=round_no;
   FOR j IN 1..3 LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[j],'role','authenticated')::text,true);
    SELECT * INTO STRICT q FROM public.team_boss_questions WHERE run_id=rid AND profile_id=ids[j] AND round=round_no;
    PERFORM public.team_boss_action('answer',rid,round_no,CASE WHEN q.kind='spelling' THEN q.word ELSE q.meaning END);
    s:=public.team_boss_action('act',rid,round_no,'attack')->'state';
   END LOOP;
  END LOOP;
  IF s->>'phase'<>'won' OR (SELECT correct FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[1])<>7 THEN RAISE EXCEPTION 'Complete run failed'; END IF;
  expected:=least(60,greatest(0,180-used)); used:=used+expected;
  IF (SELECT coins FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[1])<>expected THEN RAISE EXCEPTION '60 win /180 cap failed'; END IF;
  PERFORM public.team_boss_action('state',rid); PERFORM public.team_boss_settle(rid,'won');
  IF (SELECT count(*) FROM public.team_boss_rewards WHERE run_id=rid)<>3 THEN RAISE EXCEPTION 'Reward deduplication failed'; END IF;
 END LOOP;
 IF (SELECT coins-before_coins FROM public.profiles WHERE id=ids[1])<>used-initial_used THEN RAISE EXCEPTION 'Payout did not read back'; END IF;
 -- Unauthorized profile / guest rejected.
 PERFORM set_config('request.jwt.claims','{}',true);
 caught:=false; BEGIN PERFORM public.team_boss_action('state',rid); EXCEPTION WHEN OTHERS THEN caught:=true; END;
 IF NOT caught THEN RAISE EXCEPTION 'Guest accepted'; END IF;
 RAISE NOTICE 'Team Boss: 3-5 scaling, readiness, privacy, answer/action retry, revive, shield, interruption, four full runs and cap verified';
END $$;
ROLLBACK;