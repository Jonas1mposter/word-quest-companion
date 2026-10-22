CREATE TABLE public.roguelike_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL, grade integer NOT NULL,
 phase text NOT NULL DEFAULT 'route', floor integer NOT NULL DEFAULT 1, hp integer NOT NULL DEFAULT 80,
 max_hp integer NOT NULL DEFAULT 80, enemy_hp integer NOT NULL DEFAULT 0, enemy_max integer NOT NULL DEFAULT 0,
 node text NOT NULL DEFAULT '', routes jsonb NOT NULL DEFAULT '["battle","elite","rest"]',
 skills jsonb NOT NULL DEFAULT '{}', offers jsonb NOT NULL DEFAULT '[]', streak integer NOT NULL DEFAULT 0,
 answered integer NOT NULL DEFAULT 0, correct integer NOT NULL DEFAULT 0, elite_wins integer NOT NULL DEFAULT 0,
 encounter_answered integer NOT NULL DEFAULT 0, ward_used boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 0, coins integer NOT NULL DEFAULT 0, event text,
 started_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL DEFAULT (now()+interval '8 minutes'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.roguelike_runs TO service_role;
ALTER TABLE public.roguelike_runs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX rogue_one_active ON public.roguelike_runs(profile_id) WHERE phase IN ('route','combat','skill');
CREATE TABLE public.roguelike_questions (
 run_id uuid NOT NULL REFERENCES public.roguelike_runs(id) ON DELETE CASCADE, idx integer NOT NULL,
 kind text NOT NULL, prompt text NOT NULL, options jsonb NOT NULL, target text NOT NULL, answer text NOT NULL,
 response text, is_correct boolean, damage integer, healing integer, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,idx)
);
GRANT ALL ON public.roguelike_questions TO service_role;
ALTER TABLE public.roguelike_questions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.roguelike_rewards (
 run_id uuid PRIMARY KEY REFERENCES public.roguelike_runs(id), profile_id uuid NOT NULL,
 coins integer NOT NULL, day date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.roguelike_rewards TO service_role;
ALTER TABLE public.roguelike_rewards ENABLE ROW LEVEL SECURITY;
CREATE INDEX rogue_daily_reward ON public.roguelike_rewards(profile_id,day);
CREATE FUNCTION public.rogue_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER rogue_runs_touch BEFORE UPDATE ON public.roguelike_runs FOR EACH ROW EXECUTE FUNCTION public.rogue_touch();
CREATE TRIGGER rogue_questions_touch BEFORE UPDATE ON public.roguelike_questions FOR EACH ROW EXECUTE FUNCTION public.rogue_touch();
CREATE TRIGGER rogue_rewards_touch BEFORE UPDATE ON public.roguelike_rewards FOR EACH ROW EXECUTE FUNCTION public.rogue_touch();
CREATE FUNCTION public.rogue_issue(p_run uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.roguelike_runs; w record; choices jsonb; k text;
BEGIN
 SELECT * INTO STRICT r FROM public.roguelike_runs WHERE id=p_run;
 IF EXISTS(SELECT 1 FROM public.roguelike_questions WHERE run_id=p_run AND idx=r.answered) THEN RETURN; END IF;
 IF r.grade>=9 THEN
  SELECT word,meaning INTO w FROM public.hs_words WHERE grade BETWEEN 9 AND 12 AND subject='english' AND length(meaning)>0 AND NOT EXISTS(SELECT 1 FROM public.roguelike_questions q WHERE q.run_id=p_run AND q.target=word) ORDER BY random() LIMIT 1;
 ELSE
  SELECT word,meaning INTO w FROM public.words WHERE grade=r.grade AND length(meaning)>0 AND NOT EXISTS(SELECT 1 FROM public.roguelike_questions q WHERE q.run_id=p_run AND q.target=word) ORDER BY random() LIMIT 1;
 END IF;
 IF w.word IS NULL THEN RAISE EXCEPTION '该年级词库不足，请联系管理员'; END IF;
 SELECT jsonb_agg(meaning ORDER BY random()) INTO choices FROM (
  SELECT w.meaning AS meaning UNION ALL SELECT meaning FROM (
   SELECT DISTINCT meaning FROM public.words WHERE length(meaning)>0 AND meaning<>w.meaning
   UNION SELECT DISTINCT meaning FROM public.hs_words WHERE length(meaning)>0 AND meaning<>w.meaning
  ) z ORDER BY random() LIMIT 4
 ) o;
 -- Include the correct option explicitly; distractors are sampled separately.
 SELECT jsonb_agg(meaning ORDER BY random()) INTO choices FROM (
  SELECT w.meaning AS meaning UNION ALL
  SELECT meaning FROM (SELECT DISTINCT meaning FROM public.words WHERE meaning<>w.meaning AND length(meaning)>0 UNION SELECT DISTINCT meaning FROM public.hs_words WHERE meaning<>w.meaning AND length(meaning)>0) d ORDER BY meaning
 ) all_choices WHERE meaning=w.meaning OR meaning IN (
  SELECT meaning FROM (SELECT DISTINCT meaning FROM public.words WHERE meaning<>w.meaning AND length(meaning)>0 UNION SELECT DISTINCT meaning FROM public.hs_words WHERE meaning<>w.meaning AND length(meaning)>0) d ORDER BY random() LIMIT 3
 );
 k:=CASE WHEN r.answered%3=2 THEN 'listening' ELSE 'choice' END;
 INSERT INTO public.roguelike_questions(run_id,idx,kind,prompt,options,target,answer)
 VALUES(p_run,r.answered,k,CASE WHEN k='listening' THEN '' ELSE w.word END,choices,w.word,w.meaning);
END $$;
CREATE FUNCTION public.rogue_settle(p_run uuid,p_phase text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.roguelike_runs; used integer; award integer; inserted integer; claims text;
BEGIN
 SELECT * INTO STRICT r FROM public.roguelike_runs WHERE id=p_run FOR UPDATE;
 IF r.phase NOT IN ('route','combat','skill') THEN RETURN; END IF;
 PERFORM 1 FROM public.profiles WHERE id=r.profile_id FOR UPDATE;
 award:=CASE WHEN r.answered>=10 AND now()-r.started_at>=interval '30 seconds' THEN CASE WHEN p_phase='won' THEN 30+5*r.elite_wins WHEN p_phase='lost' THEN 5 ELSE 0 END ELSE 0 END;
 SELECT COALESCE(sum(coins),0) INTO used FROM public.roguelike_rewards WHERE profile_id=r.profile_id AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 award:=least(award,greatest(0,120-used));
 INSERT INTO public.roguelike_rewards(run_id,profile_id,coins,day) VALUES(r.id,r.profile_id,award,(now() AT TIME ZONE 'Asia/Shanghai')::date) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=1 AND award>0 THEN
  claims:=current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE public.profiles SET coins=coins+award WHERE id=r.profile_id;
  PERFORM public.bump_lifetime_coins(r.profile_id,award);
  PERFORM set_config('request.jwt.claims',coalesce(claims,''),true);
 END IF;
 UPDATE public.roguelike_runs SET phase=p_phase,coins=award,version=version+1 WHERE id=p_run;
END $$;
CREATE FUNCTION public.rogue_view(p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.roguelike_runs; q public.roguelike_questions; daily integer;
BEGIN
 SELECT * INTO STRICT r FROM public.roguelike_runs WHERE id=p_run;
 IF r.phase='combat' THEN SELECT * INTO q FROM public.roguelike_questions WHERE run_id=p_run AND idx=r.answered; END IF;
 SELECT COALESCE(sum(coins),0) INTO daily FROM public.roguelike_rewards WHERE profile_id=r.profile_id AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 RETURN jsonb_build_object('id',r.id,'phase',r.phase,'floor',r.floor,'hp',r.hp,'maxHp',r.max_hp,'enemyHp',r.enemy_hp,'enemyMax',r.enemy_max,'node',r.node,'routes',r.routes,'skills',r.skills,'offers',r.offers,'streak',r.streak,'answered',r.answered,'correct',r.correct,'version',r.version,'coins',r.coins,'dailyCoins',daily,'dailyCap',120,'endsAt',r.ends_at,'serverNow',now(),'event',r.event,'question',CASE WHEN q.run_id IS NOT NULL THEN jsonb_build_object('index',q.idx,'kind',q.kind,'prompt',q.prompt,'options',q.options) ELSE NULL END);
END $$;
CREATE FUNCTION public.rogue_action(p_action text,p_run uuid DEFAULT NULL,p_version integer DEFAULT NULL,p_choice text DEFAULT NULL,p_index integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; g integer; r public.roguelike_runs; q public.roguelike_questions; good boolean; dmg integer; heal integer:=0; hit integer; result jsonb; rankup integer; n text;
BEGIN
 SELECT id,grade INTO pid,g FROM public.profiles WHERE user_id=auth.uid() AND (banned_until IS NULL OR banned_until<=now());
 IF pid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rogue:'||pid::text,0));
 IF p_action IN ('resume','start') THEN
  SELECT * INTO r FROM public.roguelike_runs WHERE profile_id=pid AND phase IN ('route','combat','skill') FOR UPDATE;
  IF r.id IS NOT NULL AND r.ends_at<=now() THEN PERFORM public.rogue_settle(r.id,'lost'); r.id:=NULL; END IF;
  IF r.id IS NULL AND p_action='start' THEN
   INSERT INTO public.roguelike_runs(profile_id,grade,routes) VALUES(pid,g,(SELECT jsonb_agg(v) FROM (SELECT v FROM unnest(ARRAY['battle','elite','rest','event']) v ORDER BY random() LIMIT 3)t)) RETURNING * INTO r;
  END IF;
  IF r.id IS NULL THEN RETURN 'null'::jsonb; END IF;
  RETURN public.rogue_view(r.id);
 END IF;
 SELECT * INTO r FROM public.roguelike_runs WHERE id=p_run AND profile_id=pid FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION '冒险不存在'; END IF;
 IF r.phase IN ('route','combat','skill') AND r.ends_at<=now() THEN PERFORM public.rogue_settle(r.id,'lost'); RETURN public.rogue_view(r.id); END IF;
 IF p_action='state' THEN RETURN public.rogue_view(r.id); END IF;
 IF p_action='answer' THEN
  SELECT * INTO q FROM public.roguelike_questions WHERE run_id=r.id AND idx=p_index FOR UPDATE;
  IF q.run_id IS NULL THEN RAISE EXCEPTION '题目未发出'; END IF;
  IF q.response IS NOT NULL THEN
   IF q.response IS DISTINCT FROM p_choice THEN RAISE EXCEPTION '仅能重试原答案'; END IF;
   RETURN jsonb_build_object('state',public.rogue_view(r.id),'feedback',jsonb_build_object('correct',q.is_correct,'answer',q.answer,'word',q.target,'damage',q.damage,'healing',q.healing));
  END IF;
 END IF;
 IF r.phase NOT IN ('route','combat','skill') THEN RETURN public.rogue_view(r.id); END IF;
 IF r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION '进度已变化，请重试'; END IF;
 IF p_action='abandon' THEN PERFORM public.rogue_settle(r.id,'abandoned'); RETURN public.rogue_view(r.id); END IF;
 IF p_action='route' AND r.phase='route' AND r.routes ? p_choice THEN
  n:=p_choice;
  IF n='rest' THEN
   UPDATE public.roguelike_runs SET hp=least(max_hp,hp+22),routes='["battle","elite"]',event='rest',version=version+1 WHERE id=r.id;
  ELSIF n='event' THEN
   IF random()<0.5 THEN UPDATE public.roguelike_runs SET hp=least(max_hp,hp+16),event='spring',routes='["battle","elite"]',version=version+1 WHERE id=r.id;
   ELSE UPDATE public.roguelike_runs SET max_hp=max_hp+12,hp=hp+6,event='relic',routes='["battle","elite"]',version=version+1 WHERE id=r.id; END IF;
  ELSE
   hit:=CASE n WHEN 'boss' THEN 80 WHEN 'elite' THEN 40 ELSE 24 END;
   UPDATE public.roguelike_runs SET phase='combat',node=n,enemy_hp=hit,enemy_max=hit,encounter_answered=0,ward_used=false,event=NULL,streak=0,version=version+1 WHERE id=r.id;
   PERFORM public.rogue_issue(r.id);
  END IF;
 ELSIF p_action='skill' AND r.phase='skill' AND r.offers ? p_choice THEN
  rankup:=CASE WHEN r.node='elite' THEN 2 ELSE 1 END;
  UPDATE public.roguelike_runs SET skills=jsonb_set(skills,ARRAY[p_choice],to_jsonb(coalesce((skills->>p_choice)::integer,0)+rankup)),floor=floor+1,phase='route',routes=CASE WHEN floor=4 THEN '["boss"]'::jsonb ELSE (SELECT jsonb_agg(v) FROM (SELECT v FROM unnest(ARRAY['battle','elite','rest','event']) v ORDER BY random() LIMIT 3)t) END,offers='[]',version=version+1,event=NULL WHERE id=r.id;
 ELSIF p_action='answer' AND r.phase='combat' AND p_index=r.answered AND q.options ? p_choice AND length(p_choice)<=2000 THEN
  IF now()-q.created_at<interval '1200 milliseconds' THEN RAISE EXCEPTION '请稍作思考再作答'; END IF;
  good:=p_choice=q.answer;
  dmg:=CASE WHEN good THEN 8+2*coalesce((r.skills->>'power')::integer,0)+least(r.streak,5)*coalesce((r.skills->>'combo')::integer,0)+CASE WHEN q.kind='listening' THEN 3*coalesce((r.skills->>'echo')::integer,0) ELSE 0 END ELSE 0 END;
  hit:=CASE r.node WHEN 'boss' THEN CASE WHEN r.enemy_hp<=r.enemy_max/2 THEN 18 ELSE 14 END WHEN 'elite' THEN 14 ELSE 10 END;
  IF NOT good THEN
   hit:=greatest(2,hit-2*coalesce((r.skills->>'armor')::integer,0));
   IF coalesce((r.skills->>'ward')::integer,0)>0 AND NOT r.ward_used THEN hit:=0; r.ward_used:=true; END IF;
   r.hp:=greatest(0,r.hp-hit); r.streak:=0;
  ELSE
   heal:=CASE WHEN q.kind='listening' THEN 4*coalesce((r.skills->>'healing')::integer,0) ELSE 0 END;
   r.hp:=least(r.max_hp,r.hp+heal); r.streak:=r.streak+1;
  END IF;
  UPDATE public.roguelike_questions SET response=p_choice,is_correct=good,damage=dmg,healing=heal WHERE run_id=r.id AND idx=p_index;
  UPDATE public.roguelike_runs SET hp=r.hp,enemy_hp=greatest(0,enemy_hp-dmg),streak=r.streak,ward_used=r.ward_used,answered=answered+1,correct=correct+CASE WHEN good THEN 1 ELSE 0 END,encounter_answered=encounter_answered+1,version=version+1 WHERE id=r.id RETURNING * INTO r;
  IF r.hp<=0 THEN PERFORM public.rogue_settle(r.id,'lost');
  ELSIF r.enemy_hp<=0 THEN
   IF r.node='boss' THEN PERFORM public.rogue_settle(r.id,'won');
   ELSE UPDATE public.roguelike_runs SET phase='skill',elite_wins=elite_wins+CASE WHEN node='elite' THEN 1 ELSE 0 END,offers=(SELECT jsonb_agg(v) FROM (SELECT v FROM unnest(ARRAY['combo','ward','healing','power','armor','echo']) v ORDER BY random() LIMIT 3)t) WHERE id=r.id; END IF;
  ELSE PERFORM public.rogue_issue(r.id); END IF;
  RETURN jsonb_build_object('state',public.rogue_view(r.id),'feedback',jsonb_build_object('correct',good,'answer',q.answer,'word',q.target,'damage',dmg,'healing',heal));
 ELSE RAISE EXCEPTION '无法执行此操作'; END IF;
 RETURN public.rogue_view(r.id);
END $$;
CREATE FUNCTION public.rogue_audio_target(p_profile uuid,p_run uuid,p_index integer) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_word text;
BEGIN
 SELECT q.target INTO target_word FROM public.roguelike_questions q JOIN public.roguelike_runs r ON r.id=q.run_id JOIN public.profiles p ON p.id=r.profile_id WHERE r.id=p_run AND r.profile_id=p_profile AND r.phase='combat' AND r.ends_at>now() AND r.answered=p_index AND q.idx=p_index AND q.kind='listening' AND q.response IS NULL AND (p.banned_until IS NULL OR p.banned_until<=now());
 IF target_word IS NULL THEN RAISE EXCEPTION '听力题不可用'; END IF; RETURN target_word;
END $$;
REVOKE ALL ON FUNCTION public.rogue_touch(),public.rogue_issue(uuid),public.rogue_settle(uuid,text),public.rogue_view(uuid),public.rogue_audio_target(uuid,uuid,integer),public.rogue_action(text,uuid,integer,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rogue_action(text,uuid,integer,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rogue_audio_target(uuid,uuid,integer) TO service_role;