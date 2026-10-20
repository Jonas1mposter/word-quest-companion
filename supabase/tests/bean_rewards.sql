-- Rollback-only tests; no real balances or rewards retained.
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$
DECLARE pid uuid; uid uuid; sid uuid; r jsonb; again jsonb; before_coins bigint; after_coins bigint; factor integer; i integer; d text; o text; expected integer;
 weekdays timestamptz='2026-10-20T14:33:00Z'; weekend timestamptz='2026-10-23T16:00:00Z'; ws jsonb; ans jsonb;
BEGIN
 -- Seven exact check-in amounts, including Beijing weekend boundary.
 FOR i IN 1..7 LOOP
  expected=(ARRAY[40,50,60,70,80,100,200])[i];
  IF checkin_coin_reward(i,weekdays)<>expected OR checkin_coin_reward(i,weekend)<>expected*2 THEN RAISE EXCEPTION 'Check-in amount day %',i; END IF;
 END LOOP;
 IF checkin_coin_reward(30,weekdays)<>200 OR checkin_coin_reward(7,'2026-10-23T15:59:59Z')<>200 OR checkin_coin_reward(7,weekend)<>400 THEN RAISE EXCEPTION 'Check-in cap or Beijing boundary'; END IF;
 -- Every difficulty and outcome has a concrete expected payout.
 FOREACH d IN ARRAY ARRAY['easy','medium','hard'] LOOP
  i=0;
  FOREACH o IN ARRAY ARRAY['win','draw','loss'] LOOP
   i=i+1;
   expected=CASE d WHEN 'easy' THEN (ARRAY[10,5,2])[i] WHEN 'medium' THEN (ARRAY[20,10,4])[i] ELSE (ARRAY[30,15,6])[i] END;
   IF (bot_coin_reward(d,o,false,false,weekdays)->>'coinsEarned')::integer<>expected THEN RAISE EXCEPTION 'Base reward % %',d,o; END IF;
  END LOOP;
 END LOOP;
 r=bot_coin_reward('hard','win',true,true,weekdays);
 IF r->>'coinsEarned'<>'100' OR r->>'firstWinCoins'<>'50' OR r->>'perfectCoins'<>'20' THEN RAISE EXCEPTION 'Bonus values'; END IF;
 r=bot_coin_reward('hard','win',true,true,weekend);
 IF r->>'coinsEarned'<>'200' OR r->>'firstWinCoins'<>'100' OR r->>'perfectCoins'<>'40' THEN RAISE EXCEPTION 'Weekend bonus'; END IF;
 IF bot_coin_reward('easy','loss',false,true,weekdays)->>'firstWinCoins'<>'0' THEN RAISE EXCEPTION 'Loss got first-win bonus'; END IF;
 SELECT id,user_id,coins INTO pid,uid,before_coins FROM profiles WHERE banned_until IS NULL ORDER BY id LIMIT 1;
 IF pid IS NULL THEN RAISE EXCEPTION 'Fixture missing'; END IF;
 factor=CASE WHEN extract(isodow FROM now() AT TIME ZONE 'Asia/Shanghai') IN (6,7) THEN 2 ELSE 1 END;
 -- Today's existing eligibility changes only within this rolled-back test.
 UPDATE bot_battle_sessions SET status='abandoned' WHERE profile_id=pid AND status='completed' AND result->>'result'='win' AND (updated_at AT TIME ZONE 'Asia/Shanghai')::date=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 SELECT jsonb_agg(jsonb_build_object('word','fixture'||n,'meaning','词'||n)),jsonb_agg(jsonb_build_object('answer','fixture'||n)) INTO ws,ans FROM generate_series(1,10)n;
 sid=gen_random_uuid();
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,answers,player_score,bot_score,started_at) VALUES(sid,pid,'hard',ws,ans,10,0,now()-interval '60 seconds');
 r=bot_battle_action(pid,sid,'finish');
 IF (r->>'coinsEarned')::integer<>100*factor OR (r->>'firstWinCoins')::integer<>50*factor OR (r->>'perfectCoins')::integer<>20*factor THEN RAISE EXCEPTION 'Settlement bonuses'; END IF;
 SELECT coins INTO after_coins FROM profiles WHERE id=pid;
 IF after_coins-before_coins<>100*factor THEN RAISE EXCEPTION 'Balance delta'; END IF;
 again=bot_battle_action(pid,sid,'finish');
 IF again<>r OR (SELECT coins FROM profiles WHERE id=pid)<>after_coins THEN RAISE EXCEPTION 'Duplicate settlement'; END IF;
 sid=gen_random_uuid();
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,answers,player_score,bot_score,started_at) VALUES(sid,pid,'easy',ws,ans,1,0,now()-interval '60 seconds');
 r=bot_battle_action(pid,sid,'finish');
 IF (r->>'coinsEarned')::integer<>10*factor OR r->>'firstWinCoins'<>'0' OR r->>'perfectCoins'<>'0' THEN RAISE EXCEPTION 'Second win bonus'; END IF;
 sid=gen_random_uuid();
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,answers,player_score,bot_score,started_at) VALUES(sid,pid,'easy',ws,ans,0,0,now()-interval '60 seconds');
 r=bot_battle_action(pid,sid,'finish');
 IF r->>'coinsEarned'<>'0' THEN RAISE EXCEPTION 'Zero-correct beans'; END IF;
 sid=gen_random_uuid();
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,started_at) VALUES(sid,pid,'hard',ws,now()-interval '60 seconds');
 r=bot_battle_action(pid,sid,'forfeit','hard',NULL,'','synthetic_click','{}');
 IF r->>'coinsEarned'<>'0' THEN RAISE EXCEPTION 'Forfeit beans'; END IF;
 -- Real caller identity used only inside rollback to verify check-in idempotency.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',uid)::text,true);
 UPDATE profiles SET last_login_date=(now() AT TIME ZONE 'Asia/Shanghai')::date-1,streak=6 WHERE id=pid;
 SELECT coins INTO before_coins FROM profiles WHERE id=pid;
 r=record_daily_login();
 IF (r->>'coins')::integer<>200*factor OR r->>'streak'<>'7' THEN RAISE EXCEPTION 'Check-in settlement'; END IF;
 again=record_daily_login();
 IF again->>'already'<>'true' OR (SELECT coins FROM profiles WHERE id=pid)-before_coins<>200*factor THEN RAISE EXCEPTION 'Duplicate check-in'; END IF;
 IF has_function_privilege('authenticated','public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Settlement exposed'; END IF;
END $$;
ROLLBACK;