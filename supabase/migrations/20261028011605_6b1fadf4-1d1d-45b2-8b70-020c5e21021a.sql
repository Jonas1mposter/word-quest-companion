CREATE TABLE public.tb_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('team','casual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  team_a uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name_a text NOT NULL,
  name_b text NOT NULL,
  grade_key int NOT NULL DEFAULT 9,
  wins_a int NOT NULL DEFAULT 0,
  wins_b int NOT NULL DEFAULT 0,
  current_game int NOT NULL DEFAULT 1,
  winner_side smallint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tb_players (
  series_id uuid NOT NULL REFERENCES public.tb_series(id) ON DELETE CASCADE,
  side smallint NOT NULL,
  slot smallint NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  PRIMARY KEY (series_id, side, slot)
);
CREATE INDEX ON public.tb_players(profile_id);
CREATE TABLE public.tb_games (
  series_id uuid NOT NULL REFERENCES public.tb_series(id) ON DELETE CASCADE,
  game_no int NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '20 minutes',
  score_a int,
  score_b int,
  time_a bigint,
  time_b bigint,
  winner_side smallint,
  PRIMARY KEY (series_id, game_no)
);
CREATE TABLE public.tb_player_games (
  series_id uuid NOT NULL,
  game_no int NOT NULL,
  side smallint NOT NULL,
  slot smallint NOT NULL,
  answered int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  total_ms bigint NOT NULL DEFAULT 0,
  finished_at timestamptz,
  PRIMARY KEY (series_id, game_no, side, slot),
  FOREIGN KEY (series_id, game_no) REFERENCES public.tb_games(series_id, game_no) ON DELETE CASCADE
);
CREATE TABLE public.tb_questions (
  series_id uuid NOT NULL,
  game_no int NOT NULL,
  side smallint NOT NULL,
  slot smallint NOT NULL,
  idx int NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  answer text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series_id, game_no, side, slot, idx),
  FOREIGN KEY (series_id, game_no) REFERENCES public.tb_games(series_id, game_no) ON DELETE CASCADE
);
GRANT ALL ON public.tb_series, public.tb_players, public.tb_games, public.tb_player_games, public.tb_questions TO service_role;
ALTER TABLE public.tb_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_player_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_questions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tb_me() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() AND (banned_until IS NULL OR banned_until < now()) $$;

CREATE OR REPLACE FUNCTION public.tb_issue(p_series uuid, p_game int, p_side int, p_slot int, p_idx int, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_meaning text; v_opts text[];
BEGIN
  IF p_idx >= 50 THEN RETURN; END IF;
  IF p_grade >= 9 THEN
    SELECT word, meaning INTO v_word, v_meaning FROM hs_words
     WHERE grade BETWEEN 9 AND 12 AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM tb_questions WHERE series_id=p_series AND game_no=p_game AND side=p_side AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    SELECT array_agg(m) INTO v_opts FROM (SELECT DISTINCT meaning m FROM hs_words WHERE grade BETWEEN 9 AND 12 AND meaning <> v_meaning AND coalesce(meaning,'')<>'' ORDER BY random() LIMIT 3) s;
  ELSE
    SELECT word, meaning INTO v_word, v_meaning FROM words
     WHERE grade = p_grade AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM tb_questions WHERE series_id=p_series AND game_no=p_game AND side=p_side AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    IF v_word IS NULL THEN
      SELECT word, meaning INTO v_word, v_meaning FROM words WHERE coalesce(meaning,'')<>'' ORDER BY random() LIMIT 1;
    END IF;
    SELECT array_agg(m) INTO v_opts FROM (SELECT DISTINCT meaning m FROM words WHERE grade = p_grade AND meaning <> v_meaning AND coalesce(meaning,'')<>'' ORDER BY random() LIMIT 3) s;
  END IF;
  IF v_word IS NULL THEN RETURN; END IF;
  v_opts := coalesce(v_opts,'{}') || v_meaning;
  SELECT array_agg(o ORDER BY random()) INTO v_opts FROM unnest(v_opts) o;
  INSERT INTO tb_questions(series_id, game_no, side, slot, idx, prompt, options, answer)
  VALUES (p_series, p_game, p_side, p_slot, p_idx, v_word, to_jsonb(v_opts), v_meaning) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.tb_start_game(p_series uuid, p_game int, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  INSERT INTO tb_games(series_id, game_no) VALUES (p_series, p_game) ON CONFLICT DO NOTHING;
  FOR p IN SELECT * FROM tb_players WHERE series_id=p_series LOOP
    INSERT INTO tb_player_games(series_id, game_no, side, slot) VALUES (p_series, p_game, p.side, p.slot) ON CONFLICT DO NOTHING;
    PERFORM tb_issue(p_series, p_game, p.side, p.slot, 0, p_grade);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tb_create_series(p_kind text, p_name_a text, p_name_b text, p_a uuid[], p_b uuid[], p_grade int DEFAULT NULL, p_team_a uuid DEFAULT NULL, p_team_b uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := tb_me(); v_id uuid; v_grade int; i int; v_pid uuid; v_name text; v_av text;
BEGIN
  IF v_admin IS NULL OR NOT has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','只有管理员可以创建比赛');
  END IF;
  IF p_kind NOT IN ('team','casual') THEN RETURN jsonb_build_object('ok',false,'error','类型错误'); END IF;
  IF coalesce(array_length(p_a,1),0) <> 2 OR coalesce(array_length(p_b,1),0) <> 2 THEN
    RETURN jsonb_build_object('ok',false,'error','每边需要 2 名选手');
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_a || p_b) x) <> 4 THEN
    RETURN jsonb_build_object('ok',false,'error','四名选手必须互不相同');
  END IF;
  IF p_kind = 'team' THEN
    IF p_team_a IS NULL OR p_team_b IS NULL OR p_team_a = p_team_b THEN
      RETURN jsonb_build_object('ok',false,'error','战队模式需要选择两支不同的战队');
    END IF;
    IF (SELECT count(*) FROM team_members WHERE team_id=p_team_a AND profile_id = ANY(p_a)) <> 2
       OR (SELECT count(*) FROM team_members WHERE team_id=p_team_b AND profile_id = ANY(p_b)) <> 2 THEN
      RETURN jsonb_build_object('ok',false,'error','选手必须是对应战队的成员');
    END IF;
    SELECT name INTO p_name_a FROM teams WHERE id=p_team_a;
    SELECT name INTO p_name_b FROM teams WHERE id=p_team_b;
  END IF;
  IF coalesce(trim(p_name_a),'') = '' OR coalesce(trim(p_name_b),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'error','需要双方队名');
  END IF;
  IF EXISTS (SELECT 1 FROM tb_series s JOIN tb_players pl ON pl.series_id=s.id
             WHERE s.status='active' AND pl.profile_id = ANY(p_a || p_b)) THEN
    RETURN jsonb_build_object('ok',false,'error','有选手还在进行中的比赛里');
  END IF;
  v_grade := coalesce(p_grade, (SELECT greatest(max(coalesce(grade,7)),7) FROM profiles WHERE id = ANY(p_a || p_b)), 7);
  INSERT INTO tb_series(kind, team_a, team_b, name_a, name_b, grade_key, created_by)
  VALUES (p_kind, p_team_a, p_team_b, trim(p_name_a), trim(p_name_b), v_grade, v_admin) RETURNING id INTO v_id;
  FOR i IN 0..1 LOOP
    v_pid := p_a[i+1];
    SELECT username, avatar_url INTO v_name, v_av FROM profiles WHERE id=v_pid;
    INSERT INTO tb_players(series_id, side, slot, profile_id, display_name, avatar_url)
    VALUES (v_id, 0, i, v_pid, coalesce(v_name,'玩家'), v_av);
    v_pid := p_b[i+1];
    SELECT username, avatar_url INTO v_name, v_av FROM profiles WHERE id=v_pid;
    INSERT INTO tb_players(series_id, side, slot, profile_id, display_name, avatar_url)
    VALUES (v_id, 1, i, v_pid, coalesce(v_name,'玩家'), v_av);
  END LOOP;
  PERFORM tb_start_game(v_id, 1, v_grade);
  RETURN jsonb_build_object('ok',true,'seriesId',v_id);
END $$;

CREATE OR REPLACE FUNCTION public.tb_my_series() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM tb_series s JOIN tb_players p ON p.series_id=s.id
  WHERE p.profile_id = tb_me() AND s.status='active' ORDER BY s.created_at DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.tb_tick(p_series uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; g record; v_done boolean; v_sa int; v_sb int; v_ta bigint; v_tb bigint; v_win smallint;
BEGIN
  SELECT * INTO s FROM tb_series WHERE id=p_series FOR UPDATE;
  IF s IS NULL OR s.status <> 'active' THEN RETURN; END IF;
  SELECT * INTO g FROM tb_games WHERE series_id=p_series AND game_no=s.current_game FOR UPDATE;
  IF g IS NULL OR g.status <> 'active' THEN RETURN; END IF;
  SELECT bool_and(answered >= 50) INTO v_done FROM tb_player_games WHERE series_id=p_series AND game_no=g.game_no;
  IF NOT (coalesce(v_done,false) OR now() >= g.ends_at) THEN RETURN; END IF;
  SELECT coalesce(sum(correct) FILTER (WHERE side=0),0), coalesce(sum(correct) FILTER (WHERE side=1),0),
         coalesce(sum(total_ms) FILTER (WHERE side=0),0), coalesce(sum(total_ms) FILTER (WHERE side=1),0)
    INTO v_sa, v_sb, v_ta, v_tb FROM tb_player_games WHERE series_id=p_series AND game_no=g.game_no;
  v_win := CASE WHEN v_sa > v_sb THEN 0 WHEN v_sb > v_sa THEN 1
                WHEN v_ta < v_tb THEN 0 WHEN v_tb < v_ta THEN 1 END;
  UPDATE tb_games SET status='finished', score_a=v_sa, score_b=v_sb, time_a=v_ta, time_b=v_tb, winner_side=v_win,
    ends_at=least(ends_at, now()) WHERE series_id=p_series AND game_no=g.game_no;
  UPDATE tb_series SET wins_a = wins_a + CASE WHEN v_win=0 THEN 1 ELSE 0 END,
    wins_b = wins_b + CASE WHEN v_win=1 THEN 1 ELSE 0 END, updated_at=now() WHERE id=p_series;
  SELECT * INTO s FROM tb_series WHERE id=p_series;
  IF s.wins_a >= 2 OR s.wins_b >= 2 OR s.current_game >= 3 THEN
    UPDATE tb_series SET status='finished', updated_at=now(),
      winner_side = CASE WHEN wins_a > wins_b THEN 0 WHEN wins_b > wins_a THEN 1 END WHERE id=p_series;
  ELSE
    UPDATE tb_series SET current_game = current_game + 1, updated_at=now() WHERE id=p_series;
    PERFORM tb_start_game(p_series, s.current_game + 1, s.grade_key);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tb_state(p_series uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := tb_me(); me record; s record; g record; q record; pg record; v_players jsonb; v_games jsonb;
BEGIN
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','请先登录'); END IF;
  SELECT * INTO me FROM tb_players WHERE series_id=p_series AND profile_id=v_pid;
  IF me IS NULL THEN RETURN jsonb_build_object('ok',false,'error','你不在这场比赛里'); END IF;
  PERFORM tb_tick(p_series);
  SELECT * INTO s FROM tb_series WHERE id=p_series;
  SELECT * INTO g FROM tb_games WHERE series_id=p_series AND game_no=s.current_game;
  SELECT * INTO pg FROM tb_player_games WHERE series_id=p_series AND game_no=s.current_game AND side=me.side AND slot=me.slot;
  SELECT jsonb_agg(jsonb_build_object('side',p.side,'slot',p.slot,'name',p.display_name,'avatar',p.avatar_url,
    'answered',coalesce(pg2.answered,0),'correct',coalesce(pg2.correct,0)) ORDER BY p.side, p.slot)
    INTO v_players FROM tb_players p
    LEFT JOIN tb_player_games pg2 ON pg2.series_id=p.series_id AND pg2.game_no=s.current_game AND pg2.side=p.side AND pg2.slot=p.slot
    WHERE p.series_id=p_series;
  SELECT jsonb_agg(jsonb_build_object('gameNo',game_no,'status',status,'scoreA',score_a,'scoreB',score_b,
    'timeA',time_a,'timeB',time_b,'winnerSide',winner_side) ORDER BY game_no)
    INTO v_games FROM tb_games WHERE series_id=p_series;
  SELECT idx, prompt, options INTO q FROM tb_questions
   WHERE series_id=p_series AND game_no=s.current_game AND side=me.side AND slot=me.slot AND idx=pg.answered;
  RETURN jsonb_build_object('ok',true,'kind',s.kind,'status',s.status,'nameA',s.name_a,'nameB',s.name_b,
    'winsA',s.wins_a,'winsB',s.wins_b,'currentGame',s.current_game,'winnerSide',s.winner_side,
    'mySide',me.side,'mySlot',me.slot,'players',v_players,'games',v_games,
    'gameStatus',g.status,'endsAt',g.ends_at,'serverNow',now(),
    'myAnswered',pg.answered,'myCorrect',pg.correct,
    'question', CASE WHEN q.idx IS NULL OR s.status<>'active' OR g.status<>'active' THEN NULL
      ELSE jsonb_build_object('index',q.idx,'total',50,'prompt',q.prompt,'options',q.options) END);
END $$;

CREATE OR REPLACE FUNCTION public.tb_answer(p_series uuid, p_index int, p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := tb_me(); me record; s record; g record; q record; pg record; v_ok boolean; v_ms bigint;
BEGIN
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','请先登录'); END IF;
  SELECT * INTO s FROM tb_series WHERE id=p_series FOR UPDATE;
  SELECT * INTO me FROM tb_players WHERE series_id=p_series AND profile_id=v_pid;
  IF me IS NULL THEN RETURN jsonb_build_object('ok',false,'error','你不在这场比赛里'); END IF;
  IF s.status <> 'active' THEN RETURN jsonb_build_object('ok',false,'error','比赛已结束'); END IF;
  SELECT * INTO g FROM tb_games WHERE series_id=p_series AND game_no=s.current_game;
  IF g.status <> 'active' OR now() >= g.ends_at THEN PERFORM tb_tick(p_series); RETURN jsonb_build_object('ok',false,'error','本局已结束'); END IF;
  SELECT * INTO pg FROM tb_player_games WHERE series_id=p_series AND game_no=g.game_no AND side=me.side AND slot=me.slot FOR UPDATE;
  SELECT * INTO q FROM tb_questions WHERE series_id=p_series AND game_no=g.game_no AND side=me.side AND slot=me.slot AND idx=p_index;
  IF q IS NULL THEN RETURN jsonb_build_object('ok',false,'error','题目不存在'); END IF;
  IF p_index < pg.answered THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'correct',NULL,'answer',q.answer); END IF;
  IF p_index <> pg.answered THEN RETURN jsonb_build_object('ok',false,'error','题号不对'); END IF;
  v_ok := p_answer = q.answer;
  v_ms := greatest(0, (extract(epoch FROM now() - q.issued_at) * 1000)::bigint);
  UPDATE tb_player_games SET answered=answered+1, correct=correct + CASE WHEN v_ok THEN 1 ELSE 0 END,
    total_ms = total_ms + v_ms,
    finished_at = CASE WHEN answered+1 >= 50 THEN now() END
   WHERE series_id=p_series AND game_no=g.game_no AND side=me.side AND slot=me.slot;
  PERFORM tb_issue(p_series, g.game_no, me.side, me.slot, p_index+1, s.grade_key);
  PERFORM tb_tick(p_series);
  RETURN jsonb_build_object('ok',true,'correct',v_ok,'answer',q.answer);
END $$;

REVOKE ALL ON FUNCTION public.tb_issue(uuid,int,int,int,int,int), public.tb_start_game(uuid,int,int),
  public.tb_tick(uuid), public.tb_me() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tb_create_series(text,text,text,uuid[],uuid[],int,uuid,uuid),
  public.tb_my_series(), public.tb_state(uuid), public.tb_answer(uuid,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tb_create_series(text,text,text,uuid[],uuid[],int,uuid,uuid),
  public.tb_my_series(), public.tb_state(uuid), public.tb_answer(uuid,int,text) TO authenticated;