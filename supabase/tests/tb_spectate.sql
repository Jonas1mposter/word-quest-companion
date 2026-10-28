-- Spectator RPCs for 2v2 team battle: read-only, no answer leakage. All fixtures roll back.
DO $$
DECLARE sid uuid; p uuid[]; spec jsonb; lst jsonb;
BEGIN
  SELECT array_agg(id) INTO p FROM (SELECT id FROM profiles ORDER BY id LIMIT 4) x;
  IF coalesce(array_length(p,1),0) < 4 THEN RAISE EXCEPTION 'Need 4 fixture profiles'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',p[1])::text, true);

  INSERT INTO tb_series(kind, name_a, name_b, grade_key) VALUES('casual','甲队','乙队',7) RETURNING id INTO sid;
  INSERT INTO tb_players(series_id, side, slot, profile_id, display_name)
   SELECT sid, i/2, i%2, p[i+1], '选手' || i FROM generate_series(0,3) i;
  PERFORM tb_start_game(sid, 1, 7);

  -- Spectate slot 0: prompt + options present, no answer field.
  spec := tb_spectate(sid, 0);
  IF (spec->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'spectate not ok: %', spec; END IF;
  IF spec->'watch'->>'name' <> '选手0' THEN RAISE EXCEPTION 'watch name wrong: %', spec->'watch'; END IF;
  IF spec->'watch'->'question'->>'prompt' IS NULL THEN RAISE EXCEPTION 'no prompt'; END IF;
  IF jsonb_array_length(spec->'watch'->'question'->'options') <> 4 THEN RAISE EXCEPTION 'options not 4'; END IF;
  IF spec->'watch'->'question' ? 'answer' THEN RAISE EXCEPTION 'answer leaked'; END IF;
  IF jsonb_array_length(spec->'players') <> 4 THEN RAISE EXCEPTION 'players not 4'; END IF;

  -- Invalid slot rejected.
  spec := tb_spectate(sid, 9);
  IF (spec->>'ok')::boolean THEN RAISE EXCEPTION 'bad slot accepted'; END IF;

  -- Open-series list includes players but never questions.
  lst := tb_open_series();
  IF jsonb_array_length(lst) < 1 THEN RAISE EXCEPTION 'list empty'; END IF;
  IF NOT (lst->0 ? 'players') THEN RAISE EXCEPTION 'list missing players'; END IF;
  IF (lst->0->'players'->0 ? 'question') THEN RAISE EXCEPTION 'list leaked question'; END IF;

  -- After game 1 settles, spectate follows the series into game 2.
  UPDATE tb_player_games SET answered=50, correct=50, total_ms=300000 WHERE series_id=sid AND game_no=1 AND side=0;
  UPDATE tb_player_games SET answered=50, correct=40, total_ms=300000 WHERE series_id=sid AND game_no=1 AND side=1;
  PERFORM tb_tick(sid);
  spec := tb_spectate(sid, 1);
  IF (spec->>'currentGame')::int <> 2 THEN RAISE EXCEPTION 'game not advanced: %', spec->>'currentGame'; END IF;
  IF (spec->>'winsA')::int <> 1 THEN RAISE EXCEPTION 'wins wrong'; END IF;
  IF spec->'watch'->'question'->>'prompt' IS NULL THEN RAISE EXCEPTION 'game 2 prompt missing'; END IF;

  RAISE NOTICE 'tb spectate tests passed';
  RAISE EXCEPTION 'ROLLBACK_FOR_TEST';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'ROLLBACK_FOR_TEST' THEN RAISE NOTICE 'rolled back OK'; ELSE RAISE; END IF;
END $$;
