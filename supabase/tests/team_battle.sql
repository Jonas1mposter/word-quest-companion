-- Server-authoritative 2v2 team battle (BO3) rules. All fixtures roll back.
DO $$
DECLARE sid uuid; sid2 uuid; p uuid[]; g record; s record; n int; win int;
BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  -- Internal helpers must not be client-callable; gameplay RPCs must be.
  IF has_function_privilege('authenticated','public.tb_issue(uuid,integer,integer,integer,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'Client issue bypass'; END IF;
  IF has_function_privilege('authenticated','public.tb_tick(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client tick bypass'; END IF;
  IF has_function_privilege('authenticated','public.tb_start_game(uuid,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'Client start bypass'; END IF;
  IF NOT has_function_privilege('authenticated','public.tb_create_series(text,text,text,uuid[],uuid[],integer,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Admin create missing'; END IF;
  IF NOT has_function_privilege('authenticated','public.tb_answer(uuid,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'Answer missing'; END IF;
  IF NOT has_function_privilege('authenticated','public.tb_state(uuid)','EXECUTE') THEN RAISE EXCEPTION 'State missing'; END IF;

  SELECT array_agg(id) INTO p FROM (SELECT id FROM profiles ORDER BY id LIMIT 4) x;
  IF coalesce(array_length(p,1),0) < 4 THEN RAISE EXCEPTION 'Need 4 fixture profiles'; END IF;

  -- Series 1: side A sweeps 2-0.
  INSERT INTO tb_series(kind, name_a, name_b, grade_key) VALUES('casual','甲队','乙队',7) RETURNING id INTO sid;
  INSERT INTO tb_players(series_id, side, slot, profile_id, display_name)
   SELECT sid, i/2, i%2, p[i+1], '选手' || i FROM generate_series(0,3) i;
  PERFORM tb_start_game(sid, 1, 7);
  -- Game 1 issued: 4 players each have question 0 with 4 options containing the answer.
  IF (SELECT count(*) FROM tb_questions WHERE series_id=sid AND game_no=1 AND idx=0) <> 4 THEN RAISE EXCEPTION 'Game 1 not issued'; END IF;
  IF (SELECT count(*) FROM tb_questions WHERE series_id=sid AND game_no=1 AND idx=0 AND jsonb_array_length(options)=4 AND options ? answer) <> 4 THEN RAISE EXCEPTION 'Bad options'; END IF;
  -- Side A answers 50/50, side B answers 40/50; everyone done -> game ends.
  UPDATE tb_player_games SET answered=50, correct=50, total_ms=300000 WHERE series_id=sid AND game_no=1 AND side=0;
  UPDATE tb_player_games SET answered=50, correct=40, total_ms=300000 WHERE series_id=sid AND game_no=1 AND side=1;
  PERFORM tb_tick(sid);
  SELECT * INTO g FROM tb_games WHERE series_id=sid AND game_no=1;
  IF g.status<>'finished' OR g.winner_side<>0 OR g.score_a<>100 OR g.score_b<>80 THEN RAISE EXCEPTION 'Game 1 settle wrong: %', g; END IF;
  SELECT * INTO s FROM tb_series WHERE id=sid;
  IF s.wins_a<>1 OR s.wins_b<>0 OR s.current_game<>2 OR s.status<>'active' THEN RAISE EXCEPTION 'Series not advanced: %', s; END IF;
  IF (SELECT count(*) FROM tb_questions WHERE series_id=sid AND game_no=2 AND idx=0) <> 4 THEN RAISE EXCEPTION 'Game 2 not issued'; END IF;
  -- Game 2: side A wins again -> series finished 2-0.
  UPDATE tb_player_games SET answered=50, correct=45, total_ms=300000 WHERE series_id=sid AND game_no=2 AND side=0;
  UPDATE tb_player_games SET answered=50, correct=45, total_ms=400000 WHERE series_id=sid AND game_no=2 AND side=1;
  PERFORM tb_tick(sid);
  SELECT * INTO s FROM tb_series WHERE id=sid;
  IF s.status<>'finished' OR s.wins_a<>2 OR s.winner_side<>0 THEN RAISE EXCEPTION 'Series not finished: %', s; END IF;
  -- Tick again must be a no-op (idempotent, no double wins).
  PERFORM tb_tick(sid);
  SELECT * INTO s FROM tb_series WHERE id=sid;
  IF s.wins_a<>2 OR s.wins_b<>0 THEN RAISE EXCEPTION 'Tick double counted'; END IF;

  -- Series 2: time tiebreak, then a draw game, then game 3 decider.
  INSERT INTO tb_series(kind, name_a, name_b, grade_key) VALUES('casual','丙队','丁队',7) RETURNING id INTO sid2;
  INSERT INTO tb_players(series_id, side, slot, profile_id, display_name)
   SELECT sid2, i/2, i%2, p[i+1], '选手' || i FROM generate_series(0,3) i;
  PERFORM tb_start_game(sid2, 1, 7);
  -- Equal correct, side B faster -> side B wins game 1.
  UPDATE tb_player_games SET answered=50, correct=45, total_ms=300000 WHERE series_id=sid2 AND game_no=1 AND side=0;
  UPDATE tb_player_games SET answered=50, correct=45, total_ms=200000 WHERE series_id=sid2 AND game_no=1 AND side=1;
  PERFORM tb_tick(sid2);
  SELECT * INTO g FROM tb_games WHERE series_id=sid2 AND game_no=1;
  IF g.winner_side<>1 THEN RAISE EXCEPTION 'Time tiebreak wrong'; END IF;
  -- Game 2: exact draw -> no win awarded, series continues.
  UPDATE tb_player_games SET answered=50, correct=45, total_ms=300000 WHERE series_id=sid2 AND game_no=2;
  PERFORM tb_tick(sid2);
  SELECT * INTO g FROM tb_games WHERE series_id=sid2 AND game_no=2;
  IF g.winner_side IS NOT NULL THEN RAISE EXCEPTION 'Draw misjudged'; END IF;
  SELECT * INTO s FROM tb_series WHERE id=sid2;
  IF s.wins_a<>0 OR s.wins_b<>1 OR s.current_game<>3 OR s.status<>'active' THEN RAISE EXCEPTION 'Draw mishandled: %', s; END IF;
  -- Game 3: side A wins -> 1-1 with one draw -> series draw (winner NULL).
  UPDATE tb_player_games SET answered=50, correct=50, total_ms=300000 WHERE series_id=sid2 AND game_no=3 AND side=0;
  UPDATE tb_player_games SET answered=50, correct=40, total_ms=300000 WHERE series_id=sid2 AND game_no=3 AND side=1;
  PERFORM tb_tick(sid2);
  SELECT * INTO s FROM tb_series WHERE id=sid2;
  IF s.status<>'finished' OR s.winner_side IS NOT NULL OR s.wins_a<>1 OR s.wins_b<>1 THEN RAISE EXCEPTION 'Decider wrong: %', s; END IF;

  -- Timeout path: nobody finishes but time runs out -> game settles by current score.
  INSERT INTO tb_series(kind, name_a, name_b, grade_key) VALUES('casual','戊队','己队',7) RETURNING id INTO sid;
  INSERT INTO tb_players(series_id, side, slot, profile_id, display_name)
   SELECT sid, i/2, i%2, p[i+1], '选手' || i FROM generate_series(0,3) i;
  PERFORM tb_start_game(sid, 1, 7);
  UPDATE tb_games SET ends_at=now()-interval '1 second' WHERE series_id=sid AND game_no=1;
  UPDATE tb_player_games SET answered=10, correct=9, total_ms=60000 WHERE series_id=sid AND game_no=1 AND side=0;
  UPDATE tb_player_games SET answered=20, correct=8, total_ms=120000 WHERE series_id=sid AND game_no=1 AND side=1;
  PERFORM tb_tick(sid);
  SELECT * INTO g FROM tb_games WHERE series_id=sid AND game_no=1;
  IF g.status<>'finished' OR g.winner_side<>0 THEN RAISE EXCEPTION 'Timeout settle wrong'; END IF;

  -- 50 questions per player stay distinct within the game.
  PERFORM tb_issue(sid, 1, 0, 0, i, 7) FROM generate_series(1,49) i;
  SELECT count(DISTINCT prompt) INTO n FROM tb_questions WHERE series_id=sid AND game_no=1 AND side=0 AND slot=0;
  IF n < 45 THEN RAISE EXCEPTION 'Too many repeated prompts: %', n; END IF;

  RAISE EXCEPTION 'ROLLBACK_TEAM_BATTLE_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_TEAM_BATTLE_OK' THEN RAISE; END IF;
 END;
END $$;
