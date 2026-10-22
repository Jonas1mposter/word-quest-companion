BEGIN;
DO $$
DECLARE ids uuid[]; tid uuid; rid uuid; s jsonb; j integer; before_coins integer; used integer; expected integer;
BEGIN
 SELECT t.id INTO STRICT tid FROM public.teams t JOIN public.team_members m ON m.team_id=t.id JOIN public.profiles p ON p.id=m.profile_id WHERE coalesce(p.grade,0)>=1 AND (p.banned_until IS NULL OR p.banned_until<now()) AND NOT EXISTS(SELECT 1 FROM public.team_boss_runs b WHERE b.team_id=t.id AND b.phase IN ('lobby','combat')) GROUP BY t.id HAVING count(*)>=3 LIMIT 1;
 SELECT array_agg(p.id ORDER BY p.id) INTO ids FROM public.team_members m JOIN public.profiles p ON p.id=m.profile_id WHERE m.team_id=tid;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 s:=public.team_boss_dispatch(ids[1],'create'); rid:=(s->'state'->>'id')::uuid;
 FOR j IN 1..3 LOOP
  IF j>1 THEN PERFORM public.team_boss_dispatch(ids[j],'join'); END IF;
  PERFORM public.team_boss_dispatch(ids[j],'ready',rid,NULL,'true');
  PERFORM public.team_boss_dispatch(ids[j],'ready',rid,NULL,'true');
 END LOOP;
 IF (SELECT count(*) FROM public.team_boss_players WHERE run_id=rid AND ready)<>3 THEN RAISE EXCEPTION 'Ready retry changed state'; END IF;
 PERFORM public.team_boss_dispatch(ids[1],'start',rid);
 UPDATE public.team_boss_players SET role='guardian' WHERE run_id=rid AND profile_id=ids[1];
 UPDATE public.team_boss_players SET hp=40 WHERE run_id=rid;
 UPDATE public.team_boss_questions SET answer=meaning,is_correct=true,action='guard',target_id=ids[2] WHERE run_id=rid AND profile_id=ids[1];
 UPDATE public.team_boss_questions SET answer='wrong',is_correct=false,action='miss' WHERE run_id=rid AND profile_id<>ids[1];
 PERFORM public.team_boss_tick(rid);
 IF (SELECT hp FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[2])<>37 THEN RAISE EXCEPTION 'Guardian 65 percent reduction'; END IF;
 UPDATE public.team_boss_players SET answered=5,correct=3 WHERE run_id=rid AND profile_id<>ids[3];
 UPDATE public.team_boss_runs SET started_at=now()-interval '61 seconds',ends_at=now()-interval '1 second' WHERE id=rid;
 SELECT coins INTO before_coins FROM public.profiles WHERE id=ids[1];
 SELECT coalesce(sum(coins),0) INTO used FROM public.team_boss_rewards WHERE profile_id=ids[1] AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 expected:=least(10,greatest(0,180-used));
 s:=public.team_boss_dispatch(ids[1],'state',rid);
 IF s->'state'->>'phase'<>'lost' THEN RAISE EXCEPTION 'Timeout did not settle'; END IF;
 IF (SELECT coins FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[1])<>expected OR (SELECT coins-before_coins FROM public.profiles WHERE id=ids[1])<>expected THEN RAISE EXCEPTION 'Loss payout/readback'; END IF;
 IF (SELECT coins FROM public.team_boss_players WHERE run_id=rid AND profile_id=ids[3])<>0 THEN RAISE EXCEPTION 'Inactive player rewarded'; END IF;
 PERFORM public.team_boss_dispatch(ids[1],'state',rid);
 IF (SELECT coins-before_coins FROM public.profiles WHERE id=ids[1])<>expected THEN RAISE EXCEPTION 'Duplicate loss payout'; END IF;
END $$;
ROLLBACK;