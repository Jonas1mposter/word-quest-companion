CREATE TABLE public.halloween_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('1v1','2v2')),
  grade_key int NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '8 minutes',
  winner_team smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.halloween_players (
  match_id uuid NOT NULL REFERENCES public.halloween_matches(id) ON DELETE CASCADE,
  slot smallint NOT NULL,
  team smallint NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  avatar_url text,
  is_bot boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0,
  answered int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  items text[] NOT NULL DEFAULT '{}',
  shield boolean NOT NULL DEFAULT false,
  effects text[] NOT NULL DEFAULT '{}',
  boosts text[] NOT NULL DEFAULT '{}',
  reward int,
  PRIMARY KEY (match_id, slot)
);
CREATE INDEX ON public.halloween_players(profile_id);
CREATE TABLE public.halloween_questions (
  match_id uuid NOT NULL REFERENCES public.halloween_matches(id) ON DELETE CASCADE,
  slot smallint NOT NULL,
  idx int NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  answer text NOT NULL,
  removed jsonb NOT NULL DEFAULT '[]',
  flags text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (match_id, slot, idx)
);
CREATE TABLE public.halloween_queue (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL,
  grade_key int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.halloween_rewards (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.halloween_matches(id) ON DELETE CASCADE,
  coins int NOT NULL,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, match_id)
);
GRANT ALL ON public.halloween_matches, public.halloween_players, public.halloween_questions, public.halloween_queue, public.halloween_rewards TO service_role;
ALTER TABLE public.halloween_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halloween_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halloween_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halloween_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halloween_rewards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hw_active() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT now() >= '2026-10-22 00:00:00+08'::timestamptz AND now() < '2026-11-23 00:00:00+08'::timestamptz $$;

CREATE OR REPLACE FUNCTION public.hw_items() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['curse','steal','shield','amulet','fifty','double','pumpkin','ghost'] $$;

CREATE OR REPLACE FUNCTION public.hw_issue(p_match uuid, p_slot int, p_idx int, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_meaning text; v_opts text[]; v_flags text[] := '{}'; v_eff text[];
BEGIN
  IF p_idx >= 30 THEN RETURN; END IF;
  IF p_grade >= 9 THEN
    SELECT word, meaning INTO v_word, v_meaning FROM hs_words
     WHERE grade BETWEEN 9 AND 12 AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM halloween_questions WHERE match_id=p_match AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    SELECT array_agg(m) INTO v_opts FROM (SELECT DISTINCT meaning m FROM hs_words WHERE grade BETWEEN 9 AND 12 AND meaning <> v_meaning AND coalesce(meaning,'')<>'' ORDER BY random() LIMIT 3) s;
  ELSE
    SELECT word, meaning INTO v_word, v_meaning FROM words
     WHERE grade = p_grade AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM halloween_questions WHERE match_id=p_match AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    IF v_word IS NULL THEN
      SELECT word, meaning INTO v_word, v_meaning FROM words WHERE coalesce(meaning,'')<>'' ORDER BY random() LIMIT 1;
    END IF;
    SELECT array_agg(m) INTO v_opts FROM (SELECT DISTINCT meaning m FROM words WHERE grade = p_grade AND meaning <> v_meaning AND coalesce(meaning,'')<>'' ORDER BY random() LIMIT 3) s;
  END IF;
  v_opts := coalesce(v_opts,'{}') || v_meaning;
  SELECT array_agg(o ORDER BY random()) INTO v_opts FROM unnest(v_opts) o;
  SELECT effects INTO v_eff FROM halloween_players WHERE match_id=p_match AND slot=p_slot FOR UPDATE;
  IF 'pumpkin' = ANY(v_eff) THEN v_flags := v_flags || 'pumpkin'; v_eff := array_remove(v_eff,'pumpkin'); END IF;
  IF 'ghost' = ANY(v_eff) THEN v_flags := v_flags || 'ghost'; v_eff := array_remove(v_eff,'ghost'); END IF;
  UPDATE halloween_players SET effects = v_eff WHERE match_id=p_match AND slot=p_slot;
  INSERT INTO halloween_questions(match_id, slot, idx, prompt, options, answer, flags)
  VALUES (p_match, p_slot, p_idx, v_word, to_jsonb(v_opts), v_meaning, v_flags) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.hw_create_match(p_mode text, p_grade int, p_humans uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_need int := CASE WHEN p_mode='2v2' THEN 4 ELSE 2 END; i int; v_pid uuid; v_name text; v_av text;
  v_bots text[] := ARRAY['南瓜骑士','幽灵小丑','吸血鬼伯爵','黑猫女巫'];
BEGIN
  INSERT INTO halloween_matches(mode, grade_key) VALUES (p_mode, p_grade) RETURNING id INTO v_id;
  FOR i IN 0..v_need-1 LOOP
    v_pid := CASE WHEN i < coalesce(array_length(p_humans,1),0) THEN p_humans[i+1] END;
    IF v_pid IS NOT NULL THEN
      SELECT username, avatar_url INTO v_name, v_av FROM profiles WHERE id=v_pid;
      INSERT INTO halloween_players(match_id, slot, team, profile_id, display_name, avatar_url, items)
      VALUES (v_id, i, CASE WHEN p_mode='2v2' THEN i/2 ELSE i END, v_pid, coalesce(v_name,'玩家'), v_av,
        ARRAY[(hw_items())[1+floor(random()*8)::int]]);
      PERFORM hw_issue(v_id, i, 0, p_grade);
    ELSE
      INSERT INTO halloween_players(match_id, slot, team, display_name, is_bot)
      VALUES (v_id, i, CASE WHEN p_mode='2v2' THEN i/2 ELSE i END, v_bots[1+i] || '（人机）', true);
    END IF;
  END LOOP;
  DELETE FROM halloween_queue WHERE profile_id = ANY(p_humans);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.hw_my_match(p_pid uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM halloween_matches m JOIN halloween_players p ON p.match_id=m.id
  WHERE p.profile_id=p_pid AND m.status='active' ORDER BY m.created_at DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.hw_try_match(p_pid uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; v_need int; v_humans uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('halloween_matchmaking'));
  IF hw_my_match(p_pid) IS NOT NULL THEN RETURN hw_my_match(p_pid); END IF;
  SELECT * INTO q FROM halloween_queue WHERE profile_id=p_pid;
  IF q IS NULL THEN RETURN NULL; END IF;
  v_need := CASE WHEN q.mode='2v2' THEN 4 ELSE 2 END;
  SELECT array_agg(profile_id) INTO v_humans FROM (
    SELECT profile_id FROM halloween_queue WHERE mode=q.mode AND grade_key=q.grade_key
      AND created_at > now() - interval '3 minutes'
    ORDER BY (profile_id=p_pid) DESC, created_at LIMIT v_need) s;
  IF array_length(v_humans,1) >= v_need OR q.created_at <= now() - interval '60 seconds' THEN
    RETURN hw_create_match(q.mode, q.grade_key, v_humans);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.hw_me() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() AND (banned_until IS NULL OR banned_until < now()) $$;

CREATE OR REPLACE FUNCTION public.hw_join(p_mode text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me(); v_grade int; v_m uuid;
BEGIN
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','请先登录'); END IF;
  IF NOT hw_active() THEN RETURN jsonb_build_object('ok',false,'error','活动不在进行中'); END IF;
  IF p_mode NOT IN ('1v1','2v2') THEN RETURN jsonb_build_object('ok',false,'error','模式错误'); END IF;
  v_m := hw_my_match(v_pid);
  IF v_m IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'matchId',v_m); END IF;
  SELECT CASE WHEN coalesce(grade,7) >= 9 THEN 9 ELSE coalesce(grade,7) END INTO v_grade FROM profiles WHERE id=v_pid;
  INSERT INTO halloween_queue(profile_id, mode, grade_key) VALUES (v_pid, p_mode, v_grade)
  ON CONFLICT (profile_id) DO UPDATE SET mode=EXCLUDED.mode, grade_key=EXCLUDED.grade_key, created_at=now();
  RETURN jsonb_build_object('ok',true,'matchId',hw_try_match(v_pid));
END $$;

CREATE OR REPLACE FUNCTION public.hw_poll() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me(); v_q timestamptz;
BEGIN
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','请先登录'); END IF;
  SELECT created_at INTO v_q FROM halloween_queue WHERE profile_id=v_pid;
  RETURN jsonb_build_object('ok',true,'matchId',hw_try_match(v_pid),
    'waited', CASE WHEN v_q IS NULL THEN NULL ELSE extract(epoch FROM now()-v_q)::int END);
END $$;

CREATE OR REPLACE FUNCTION public.hw_cancel() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('halloween_matchmaking'));
  DELETE FROM halloween_queue WHERE profile_id=v_pid;
  RETURN jsonb_build_object('ok',true,'matchId',hw_my_match(v_pid));
END $$;

CREATE OR REPLACE FUNCTION public.hw_tick(p_match uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; b record; v_target int; v_gain int; v_done boolean; s0 int; s1 int; v_team int;
  pl record; v_base int; v_today int; v_coins int; v_day date := (now() AT TIME ZONE 'Asia/Shanghai')::date; v_rc int;
BEGIN
  SELECT * INTO m FROM halloween_matches WHERE id=p_match FOR UPDATE;
  IF m IS NULL OR m.status <> 'active' THEN RETURN; END IF;
  FOR b IN SELECT * FROM halloween_players WHERE match_id=p_match AND is_bot FOR UPDATE LOOP
    v_target := least(30, floor(extract(epoch FROM least(now(), m.ends_at) - m.started_at) / 6)::int);
    WHILE b.answered < v_target LOOP
      b.answered := b.answered + 1;
      IF random() < 0.68 THEN
        v_gain := 10;
        IF 'curse' = ANY(b.effects) THEN v_gain := 5; b.effects := array_remove(b.effects,'curse'); END IF;
        b.score := b.score + v_gain; b.correct := b.correct + 1;
      END IF;
    END LOOP;
    UPDATE halloween_players SET answered=b.answered, score=b.score, correct=b.correct, effects=b.effects
     WHERE match_id=p_match AND slot=b.slot;
  END LOOP;
  SELECT bool_and(answered >= 30) INTO v_done FROM halloween_players WHERE match_id=p_match AND NOT is_bot;
  IF NOT (coalesce(v_done,true) OR now() >= m.ends_at) THEN RETURN; END IF;
  SELECT coalesce(sum(score) FILTER (WHERE team=0),0), coalesce(sum(score) FILTER (WHERE team=1),0) INTO s0, s1
    FROM halloween_players WHERE match_id=p_match;
  v_team := CASE WHEN s0 > s1 THEN 0 WHEN s1 > s0 THEN 1 END;
  UPDATE halloween_matches SET status='completed', winner_team=v_team, ends_at=least(ends_at, now()) WHERE id=p_match;
  FOR pl IN SELECT * FROM halloween_players WHERE match_id=p_match AND NOT is_bot AND profile_id IS NOT NULL LOOP
    v_coins := 0;
    IF pl.answered >= 1 THEN
      v_base := CASE WHEN v_team IS NULL THEN 25 WHEN v_team = pl.team THEN 50 ELSE 15 END;
      PERFORM 1 FROM profiles WHERE id=pl.profile_id FOR UPDATE;
      SELECT coalesce(sum(coins),0) INTO v_today FROM halloween_rewards WHERE profile_id=pl.profile_id AND day=v_day;
      v_coins := greatest(0, least(v_base, 250 - v_today));
      INSERT INTO halloween_rewards(profile_id, match_id, coins, day) VALUES (pl.profile_id, p_match, v_coins, v_day)
        ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_rc = ROW_COUNT;
      IF v_rc = 1 AND v_coins > 0 THEN
        UPDATE profiles SET coins = coalesce(coins,0) + v_coins WHERE id=pl.profile_id;
        PERFORM bump_lifetime_coins(pl.profile_id, v_coins);
      ELSIF v_rc = 0 THEN v_coins := NULL; END IF;
    END IF;
    IF v_coins IS NOT NULL THEN
      UPDATE halloween_players SET reward=v_coins WHERE match_id=p_match AND slot=pl.slot;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.hw_state(p_match uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me(); me record; m record; q record; v_players jsonb; v_today int;
BEGIN
  SELECT * INTO me FROM halloween_players WHERE match_id=p_match AND profile_id=v_pid;
  IF me IS NULL THEN RETURN jsonb_build_object('ok',false,'error','不在这场对局中'); END IF;
  PERFORM hw_tick(p_match);
  SELECT * INTO me FROM halloween_players WHERE match_id=p_match AND profile_id=v_pid;
  SELECT * INTO m FROM halloween_matches WHERE id=p_match;
  SELECT jsonb_agg(jsonb_build_object('slot',slot,'team',team,'name',display_name,'avatar',avatar_url,'isBot',is_bot,
    'score',score,'answered',answered,'correct',correct,'streak',streak,'shield',shield,'itemCount',cardinality(items)) ORDER BY slot)
    INTO v_players FROM halloween_players WHERE match_id=p_match;
  SELECT idx, prompt, options, removed, flags INTO q FROM halloween_questions
   WHERE match_id=p_match AND slot=me.slot AND idx=me.answered;
  SELECT coalesce(sum(coins),0) INTO v_today FROM halloween_rewards WHERE profile_id=v_pid AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
  RETURN jsonb_build_object('ok',true,'mode',m.mode,'status',m.status,'endsAt',m.ends_at,'serverNow',now(),
    'winnerTeam',m.winner_team,'mySlot',me.slot,'myTeam',me.team,'items',to_jsonb(me.items),'boosts',to_jsonb(me.boosts),
    'effects',to_jsonb(me.effects),'reward',me.reward,'todayCoins',v_today,'players',v_players,
    'question', CASE WHEN q.idx IS NULL OR m.status<>'active' THEN NULL ELSE jsonb_build_object('index',q.idx,'total',30,
      'prompt',q.prompt,'options',q.options,'removed',q.removed,'flags',to_jsonb(q.flags)) END);
END $$;

CREATE OR REPLACE FUNCTION public.hw_answer(p_match uuid, p_index int, p_answer text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me(); me record; m record; q record; v_ok boolean; v_gain int := 0; v_drop text;
BEGIN
  SELECT * INTO m FROM halloween_matches WHERE id=p_match FOR UPDATE;
  SELECT * INTO me FROM halloween_players WHERE match_id=p_match AND profile_id=v_pid FOR UPDATE;
  IF me IS NULL THEN RETURN jsonb_build_object('ok',false,'error','不在这场对局中'); END IF;
  IF m.status <> 'active' OR now() >= m.ends_at THEN PERFORM hw_tick(p_match); RETURN jsonb_build_object('ok',false,'error','对局已结束'); END IF;
  SELECT * INTO q FROM halloween_questions WHERE match_id=p_match AND slot=me.slot AND idx=p_index;
  IF q IS NULL THEN RETURN jsonb_build_object('ok',false,'error','题目不存在'); END IF;
  IF p_index < me.answered THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'answer',q.answer); END IF;
  IF p_index <> me.answered THEN RETURN jsonb_build_object('ok',false,'error','题号不对'); END IF;
  v_ok := p_answer = q.answer;
  IF v_ok THEN
    v_gain := 10;
    IF 'double' = ANY(me.boosts) THEN v_gain := v_gain*2; me.boosts := array_remove(me.boosts,'double'); END IF;
    IF 'curse' = ANY(me.effects) THEN v_gain := v_gain/2; me.effects := array_remove(me.effects,'curse'); END IF;
    me.streak := me.streak + 1; me.correct := me.correct + 1;
    IF me.streak % 3 = 0 AND cardinality(me.items) < 3 THEN
      v_drop := (hw_items())[1+floor(random()*8)::int]; me.items := me.items || v_drop;
    END IF;
  ELSE
    me.streak := 0;
    IF 'amulet' = ANY(me.boosts) THEN me.boosts := array_remove(me.boosts,'amulet');
    ELSE v_gain := CASE WHEN me.score > 0 THEN -2 ELSE 0 END; END IF;
  END IF;
  UPDATE halloween_players SET score=greatest(0,score+v_gain), answered=answered+1, correct=me.correct, streak=me.streak,
    items=me.items, boosts=me.boosts, effects=me.effects WHERE match_id=p_match AND slot=me.slot;
  PERFORM hw_issue(p_match, me.slot, p_index+1, m.grade_key);
  PERFORM hw_tick(p_match);
  RETURN jsonb_build_object('ok',true,'correct',v_ok,'answer',q.answer,'gained',v_gain,'drop',v_drop);
END $$;

CREATE OR REPLACE FUNCTION public.hw_use_item(p_match uuid, p_item text, p_target int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid := hw_me(); me record; m record; t record; q record; v_rem jsonb; v_steal int; v_msg text;
BEGIN
  SELECT * INTO m FROM halloween_matches WHERE id=p_match FOR UPDATE;
  SELECT * INTO me FROM halloween_players WHERE match_id=p_match AND profile_id=v_pid FOR UPDATE;
  IF me IS NULL OR m.status<>'active' OR now() >= m.ends_at THEN RETURN jsonb_build_object('ok',false,'error','现在不能使用道具'); END IF;
  IF NOT (p_item = ANY(me.items)) THEN RETURN jsonb_build_object('ok',false,'error','没有这个道具'); END IF;
  IF p_item IN ('curse','steal','pumpkin','ghost') THEN
    SELECT * INTO t FROM halloween_players WHERE match_id=p_match AND team<>me.team
      ORDER BY (slot = p_target) DESC, score DESC LIMIT 1 FOR UPDATE;
    IF t.shield THEN
      UPDATE halloween_players SET shield=false WHERE match_id=p_match AND slot=t.slot; v_msg := t.display_name || ' 的护盾挡住了';
    ELSIF p_item = 'steal' THEN
      v_steal := least(5, t.score);
      UPDATE halloween_players SET score=score-v_steal WHERE match_id=p_match AND slot=t.slot;
      UPDATE halloween_players SET score=score+v_steal WHERE match_id=p_match AND slot=me.slot;
      v_msg := '从 ' || t.display_name || ' 偷走 ' || v_steal || ' 分';
    ELSE
      UPDATE halloween_players SET effects = array_append(array_remove(effects,p_item),p_item) WHERE match_id=p_match AND slot=t.slot;
      v_msg := '已对 ' || t.display_name || ' 使用';
    END IF;
  ELSIF p_item = 'shield' THEN UPDATE halloween_players SET shield=true WHERE match_id=p_match AND slot=me.slot; v_msg := '护盾已开启';
  ELSIF p_item IN ('amulet','double') THEN
    UPDATE halloween_players SET boosts=array_append(array_remove(boosts,p_item),p_item) WHERE match_id=p_match AND slot=me.slot; v_msg := '已生效';
  ELSIF p_item = 'fifty' THEN
    SELECT * INTO q FROM halloween_questions WHERE match_id=p_match AND slot=me.slot AND idx=me.answered FOR UPDATE;
    IF q IS NULL THEN RETURN jsonb_build_object('ok',false,'error','当前没有题目'); END IF;
    SELECT jsonb_agg(o) INTO v_rem FROM (SELECT o FROM jsonb_array_elements_text(q.options) o WHERE o <> q.answer ORDER BY random() LIMIT 2) s;
    UPDATE halloween_questions SET removed=coalesce(v_rem,'[]') WHERE match_id=p_match AND slot=me.slot AND idx=me.answered;
    v_msg := '去掉了两个错误选项';
  ELSE RETURN jsonb_build_object('ok',false,'error','未知道具'); END IF;
  UPDATE halloween_players SET items = items[1:array_position(items,p_item)-1] || items[array_position(items,p_item)+1:]
   WHERE match_id=p_match AND slot=me.slot;
  RETURN jsonb_build_object('ok',true,'message',v_msg);
END $$;

REVOKE ALL ON FUNCTION public.hw_issue(uuid,int,int,int), public.hw_create_match(text,int,uuid[]), public.hw_my_match(uuid),
  public.hw_try_match(uuid), public.hw_tick(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hw_join(text), public.hw_poll(), public.hw_cancel(), public.hw_state(uuid),
  public.hw_answer(uuid,int,text), public.hw_use_item(uuid,text,int), public.hw_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hw_join(text), public.hw_poll(), public.hw_cancel(), public.hw_state(uuid),
  public.hw_answer(uuid,int,text), public.hw_use_item(uuid,text,int) TO authenticated;