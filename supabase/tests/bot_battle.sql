-- Rollback-only fixtures: never retain rewards or change real player state.
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$
DECLARE pid uuid; sid uuid=gen_random_uuid(); sid2 uuid=gen_random_uuid(); q jsonb; r jsonb; original jsonb; i integer; before_coins bigint; after_coins bigint; ws jsonb='[{"word":"apple","meaning":"苹果"},{"word":"pear","meaning":"梨"},{"word":"banana","meaning":"香蕉"},{"word":"grape","meaning":"葡萄"}]';
BEGIN
 IF has_table_privilege('authenticated','public.bot_battle_sessions','SELECT') OR has_function_privilege('authenticated','public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Bot secrets exposed'; END IF;
 SELECT id,coins INTO pid,before_coins FROM profiles WHERE banned_until IS NULL ORDER BY id LIMIT 1;
 IF pid IS NULL THEN RAISE EXCEPTION 'Fixture profile missing'; END IF;
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,started_at) VALUES(sid,pid,'medium',ws,now()-interval '10 seconds');
 BEGIN
  PERFORM bot_battle_action(pid,sid,'finish'); RAISE EXCEPTION 'Incomplete payout accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Answers incomplete' THEN RAISE; END IF; END;
 FOR i IN 0..3 LOOP
  q=bot_battle_action(pid,sid,'question');
  IF q<>bot_battle_action(pid,sid,'question') THEN RAISE EXCEPTION 'Question retry changed'; END IF;
  IF q->>'quizType'<>(ARRAY['meaning','reverse','spelling','listening'])[i+1] OR q ? 'words' OR q ? 'correctAnswer' THEN RAISE EXCEPTION 'Question privacy'; END IF;
  IF i=3 AND (q->>'prompt'<>'' OR jsonb_array_length(q->'options')<>0) THEN RAISE EXCEPTION 'Listening leak'; END IF;
  BEGIN
   PERFORM bot_battle_action(pid,sid,'answer','medium',i+1,'skip'); RAISE EXCEPTION 'Skip accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Question not issued or out of order' THEN RAISE; END IF; END;
  r=bot_battle_action(pid,sid,'answer','medium',i,(ARRAY['苹果','pear','banana','grape'])[i+1]);
  IF NOT (r->>'isCorrect')::boolean THEN RAISE EXCEPTION 'Server grading'; END IF;
  IF i>=2 AND r->>'correctAnswer'<>ws->i->>'word' THEN RAISE EXCEPTION 'Submitted feedback missing'; END IF;
  IF r<>bot_battle_action(pid,sid,'answer','medium',i,'different retry') THEN RAISE EXCEPTION 'Answer duplicate changed'; END IF;
 END LOOP;
 r=bot_battle_action(pid,sid,'finish'); original=r;
 SELECT coins INTO after_coins FROM profiles WHERE id=pid;
 IF (r->>'playerScore')::integer<>4 OR (r->>'xpEarned')::integer<>3 OR after_coins-before_coins<>(r->>'coinsEarned')::integer THEN RAISE EXCEPTION 'Reward incorrect'; END IF;
 IF r<>bot_battle_action(pid,sid,'finish') OR (SELECT coins FROM profiles WHERE id=pid)<>after_coins THEN RAISE EXCEPTION 'Duplicate payout'; END IF;
 INSERT INTO bot_battle_sessions(id,profile_id,difficulty,words,started_at) VALUES(sid2,pid,'hard',ws,now()-interval '10 seconds');
 r=bot_battle_action(pid,sid2,'forfeit','medium',NULL,'','synthetic_click','{"untrusted":2}');
 IF (r->>'coinsEarned')::integer<>0 OR (r->>'xpEarned')::integer<>0 OR r<>bot_battle_action(pid,sid2,'finish') OR (SELECT coins FROM profiles WHERE id=pid)<>after_coins THEN RAISE EXCEPTION 'Forfeit paid rewards'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dac_flags WHERE profile_id=pid AND meta->>'sessionId'=sid2::text AND reason='synthetic_click') THEN RAISE EXCEPTION 'DAC missing'; END IF;
END $$;
ROLLBACK;