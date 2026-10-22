CREATE TABLE public.team_boss_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,host_id uuid NOT NULL REFERENCES public.profiles(id),phase text NOT NULL DEFAULT 'lobby',round integer NOT NULL DEFAULT 0,boss_hp integer NOT NULL DEFAULT 0,boss_max integer NOT NULL DEFAULT 0,party_size integer NOT NULL DEFAULT 0,deadline timestamptz NOT NULL DEFAULT now()+interval '15 minutes',started_at timestamptz,ends_at timestamptz,log jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.team_boss_runs TO service_role;
ALTER TABLE public.team_boss_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY boss_runs_private ON public.team_boss_runs FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE UNIQUE INDEX team_boss_one_active ON public.team_boss_runs(team_id) WHERE phase IN ('lobby','combat');
CREATE TABLE public.team_boss_players(run_id uuid NOT NULL REFERENCES public.team_boss_runs(id) ON DELETE CASCADE,profile_id uuid NOT NULL REFERENCES public.profiles(id),grade integer NOT NULL,role text NOT NULL DEFAULT 'damage',ready boolean NOT NULL DEFAULT false,hp integer NOT NULL DEFAULT 100,answered integer NOT NULL DEFAULT 0,correct integer NOT NULL DEFAULT 0,coins integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,profile_id));
GRANT ALL ON public.team_boss_players TO service_role;
ALTER TABLE public.team_boss_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY boss_players_private ON public.team_boss_players FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TABLE public.team_boss_questions(run_id uuid NOT NULL REFERENCES public.team_boss_runs(id) ON DELETE CASCADE,profile_id uuid NOT NULL REFERENCES public.profiles(id),round integer NOT NULL,kind text NOT NULL,word text NOT NULL,meaning text NOT NULL,options jsonb NOT NULL DEFAULT '[]',answer text,is_correct boolean,action text,target_id uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,profile_id,round));
GRANT ALL ON public.team_boss_questions TO service_role;
ALTER TABLE public.team_boss_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY boss_questions_private ON public.team_boss_questions FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TABLE public.team_boss_rewards(run_id uuid NOT NULL REFERENCES public.team_boss_runs(id) ON DELETE CASCADE,profile_id uuid NOT NULL REFERENCES public.profiles(id),coins integer NOT NULL,day date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,profile_id));
GRANT ALL ON public.team_boss_rewards TO service_role;
ALTER TABLE public.team_boss_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY boss_rewards_private ON public.team_boss_rewards FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE INDEX team_boss_rewards_day ON public.team_boss_rewards(profile_id,day);
CREATE OR REPLACE FUNCTION public.team_boss_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER team_boss_runs_touch BEFORE UPDATE ON public.team_boss_runs FOR EACH ROW EXECUTE FUNCTION public.team_boss_touch();
CREATE TRIGGER team_boss_players_touch BEFORE UPDATE ON public.team_boss_players FOR EACH ROW EXECUTE FUNCTION public.team_boss_touch();
CREATE TRIGGER team_boss_questions_touch BEFORE UPDATE ON public.team_boss_questions FOR EACH ROW EXECUTE FUNCTION public.team_boss_touch();
CREATE TRIGGER team_boss_rewards_touch BEFORE UPDATE ON public.team_boss_rewards FOR EACH ROW EXECUTE FUNCTION public.team_boss_touch();
CREATE OR REPLACE FUNCTION public.team_boss_issue(p_run uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.team_boss_runs; p public.team_boss_players; w record; choices jsonb;
BEGIN
SELECT * INTO STRICT r FROM public.team_boss_runs WHERE id=p_run;
FOR p IN SELECT * FROM public.team_boss_players WHERE run_id=p_run AND hp>0 LOOP
 IF EXISTS(SELECT 1 FROM public.team_boss_questions WHERE run_id=p_run AND profile_id=p.profile_id AND round=r.round) THEN CONTINUE; END IF;
 IF p.grade>=9 THEN SELECT word,meaning INTO w FROM public.hs_words h WHERE grade BETWEEN 9 AND 12 AND subject='sat' AND length(meaning)>0 ORDER BY random() LIMIT 1;
 ELSE SELECT word,meaning INTO w FROM public.words h WHERE grade=p.grade AND length(meaning)>0 ORDER BY random() LIMIT 1; END IF;
 IF w.word IS NULL THEN RAISE EXCEPTION '该年级词库不足'; END IF;
 SELECT jsonb_agg(meaning ORDER BY random()) INTO choices FROM (SELECT w.meaning meaning UNION ALL SELECT meaning FROM (SELECT meaning FROM (SELECT DISTINCT meaning FROM public.words WHERE meaning<>w.meaning AND length(meaning)>0 UNION SELECT DISTINCT meaning FROM public.hs_words WHERE subject='sat' AND meaning<>w.meaning AND length(meaning)>0) d ORDER BY random() LIMIT 3) c) o;
 INSERT INTO public.team_boss_questions(run_id,profile_id,round,kind,word,meaning,options) VALUES(p_run,p.profile_id,r.round,CASE WHEN r.round%3=0 THEN 'spelling' ELSE 'choice' END,w.word,w.meaning,CASE WHEN r.round%3=0 THEN '[]'::jsonb ELSE choices END);
END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.team_boss_settle(p_run uuid,p_phase text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.team_boss_runs; p public.team_boss_players; used integer; award integer; inserted integer; claims text;
BEGIN
SELECT * INTO STRICT r FROM public.team_boss_runs WHERE id=p_run FOR UPDATE;
IF r.phase NOT IN ('lobby','combat') THEN RETURN; END IF;
FOR p IN SELECT * FROM public.team_boss_players WHERE run_id=p_run ORDER BY profile_id LOOP
 PERFORM 1 FROM public.profiles WHERE id=p.profile_id FOR UPDATE;
 award:=CASE WHEN p.answered>=5 AND p.correct>=3 AND now()-r.started_at>=interval '60 seconds' THEN CASE WHEN p_phase='won' THEN 60 WHEN p_phase='lost' THEN 10 ELSE 0 END ELSE 0 END;
 SELECT coalesce(sum(coins),0) INTO used FROM public.team_boss_rewards WHERE profile_id=p.profile_id AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 award:=least(award,greatest(0,180-used));
 INSERT INTO public.team_boss_rewards(run_id,profile_id,coins,day) VALUES(p_run,p.profile_id,award,(now() AT TIME ZONE 'Asia/Shanghai')::date) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=1 AND award>0 THEN
  claims:=current_setting('request.jwt.claims',true); PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE public.profiles SET coins=coins+award WHERE id=p.profile_id;
  PERFORM public.bump_lifetime_coins(p.profile_id,award);
  PERFORM set_config('request.jwt.claims',coalesce(claims,''),true);
 END IF;
 UPDATE public.team_boss_players SET coins=award WHERE run_id=p_run AND profile_id=p.profile_id;
END LOOP;
UPDATE public.team_boss_runs SET phase=p_phase WHERE id=p_run;
END $$;
CREATE OR REPLACE FUNCTION public.team_boss_tick(p_run uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.team_boss_runs; q record; dmg integer:=0; hits integer:=0; required integer; interrupted boolean; hit integer; guarded boolean; tgt uuid; alive integer;
BEGIN
SELECT * INTO STRICT r FROM public.team_boss_runs WHERE id=p_run FOR UPDATE;
IF r.phase='lobby' THEN IF now()>=r.deadline THEN PERFORM public.team_boss_settle(p_run,'cancelled'); END IF; RETURN; END IF;
IF r.phase<>'combat' THEN RETURN; END IF;
IF now()>=r.ends_at THEN PERFORM public.team_boss_settle(p_run,'lost'); RETURN; END IF;
IF now()<r.deadline AND EXISTS(SELECT 1 FROM public.team_boss_questions WHERE run_id=p_run AND round=r.round AND action IS NULL) THEN RETURN; END IF;
FOR q IN SELECT z.*,p.role FROM public.team_boss_questions z JOIN public.team_boss_players p USING(run_id,profile_id) WHERE z.run_id=p_run AND z.round=r.round LOOP
 IF q.is_correct THEN
  hits:=hits+1;
  IF q.action='attack' THEN dmg:=dmg+CASE WHEN q.role='damage' THEN 18 ELSE 10 END;
  ELSIF q.action='heal' THEN UPDATE public.team_boss_players SET hp=least(100,hp+CASE WHEN q.role='healer' THEN 32 ELSE 18 END) WHERE run_id=p_run AND profile_id=q.target_id;
  END IF;
 END IF;
END LOOP;
required:=ceil(r.party_size*0.67); interrupted:=r.round%3=0 AND hits>=required;
UPDATE public.team_boss_runs SET boss_hp=greatest(0,boss_hp-dmg) WHERE id=p_run;
IF r.boss_hp-dmg<=0 THEN
 UPDATE public.team_boss_runs SET log=jsonb_build_object('round',r.round,'damage',dmg,'correct',hits,'interrupted',interrupted,'incoming',0) WHERE id=p_run;
 PERFORM public.team_boss_settle(p_run,'won'); RETURN;
END IF;
hit:=CASE WHEN r.round%3=0 THEN CASE WHEN interrupted THEN 0 ELSE 28 END ELSE 10 END + CASE WHEN NOT interrupted AND r.boss_hp-dmg<=r.boss_max*0.3 THEN 6 ELSE 0 END;
FOR q IN SELECT profile_id FROM public.team_boss_players WHERE run_id=p_run AND hp>0 LOOP
 SELECT EXISTS(SELECT 1 FROM public.team_boss_questions z JOIN public.team_boss_players p USING(run_id,profile_id) WHERE z.run_id=p_run AND z.round=r.round AND z.is_correct AND z.action='guard' AND z.target_id=q.profile_id) INTO guarded;
 UPDATE public.team_boss_players SET hp=greatest(0,hp-CASE WHEN guarded THEN floor(hit*0.35)::integer ELSE hit END) WHERE run_id=p_run AND profile_id=q.profile_id;
END LOOP;
UPDATE public.team_boss_runs SET log=jsonb_build_object('round',r.round,'damage',dmg,'correct',hits,'interrupted',interrupted,'incoming',hit) WHERE id=p_run;
SELECT count(*) INTO alive FROM public.team_boss_players WHERE run_id=p_run AND hp>0;
IF alive=0 OR r.round>=25 THEN PERFORM public.team_boss_settle(p_run,'lost'); RETURN; END IF;
UPDATE public.team_boss_runs SET round=round+1,deadline=now()+interval '75 seconds' WHERE id=p_run;
PERFORM public.team_boss_issue(p_run);
END $$;
CREATE OR REPLACE FUNCTION public.team_boss_view(p_run uuid,p_profile uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.team_boss_runs; roster jsonb; question jsonb; used integer;
BEGIN
SELECT * INTO STRICT r FROM public.team_boss_runs WHERE id=p_run;
SELECT jsonb_agg(jsonb_build_object('id',p.profile_id,'name',u.username,'avatar',u.avatar_url,'role',p.role,'ready',p.ready,'hp',p.hp,'answered',p.answered,'correct',p.correct,'coins',p.coins,'submitted',q.answer IS NOT NULL,'acted',q.action IS NOT NULL,'action',q.action,'target',q.target_id) ORDER BY p.created_at,p.profile_id) INTO roster FROM public.team_boss_players p JOIN public.profiles u ON u.id=p.profile_id LEFT JOIN public.team_boss_questions q ON q.run_id=p.run_id AND q.profile_id=p.profile_id AND q.round=r.round WHERE p.run_id=p_run;
SELECT jsonb_build_object('round',q.round,'kind',q.kind,'prompt',CASE WHEN q.kind='spelling' THEN q.meaning ELSE q.word END,'options',q.options,'submitted',q.answer IS NOT NULL,'correct',q.is_correct,'acted',q.action IS NOT NULL,'feedback',CASE WHEN q.answer IS NOT NULL THEN jsonb_build_object('word',q.word,'meaning',q.meaning) ELSE NULL END) INTO question FROM public.team_boss_questions q WHERE q.run_id=p_run AND q.profile_id=p_profile AND q.round=r.round AND r.phase='combat';
SELECT coalesce(sum(coins),0) INTO used FROM public.team_boss_rewards WHERE profile_id=p_profile AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date;
RETURN jsonb_build_object('id',r.id,'host',r.host_id,'phase',r.phase,'round',r.round,'bossHp',r.boss_hp,'bossMax',r.boss_max,'partySize',r.party_size,'deadline',r.deadline,'endsAt',r.ends_at,'serverNow',now(),'charging',r.round>0 AND r.round%3=0,'required',ceil(r.party_size*0.67),'players',coalesce(roster,'[]'::jsonb),'question',question,'log',r.log,'dailyCoins',used,'dailyCap',180);
END $$;
CREATE OR REPLACE FUNCTION public.team_boss_action(p_action text DEFAULT 'resume',p_run uuid DEFAULT NULL,p_round integer DEFAULT NULL,p_choice text DEFAULT NULL,p_target uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me public.profiles; tid uuid; tname text; r public.team_boss_runs; rid uuid; q public.team_boss_questions; n integer; ok boolean; own public.team_boss_players;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
SELECT * INTO STRICT me FROM public.profiles WHERE user_id=auth.uid();
IF me.banned_until>now() THEN RAISE EXCEPTION '账号暂不可参与'; END IF;
SELECT tm.team_id,t.name INTO tid,tname FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id WHERE tm.profile_id=me.id LIMIT 1;
IF tid IS NULL THEN RETURN jsonb_build_object('state',NULL,'team',NULL); END IF;
PERFORM pg_advisory_xact_lock(84223117);
SELECT * INTO r FROM public.team_boss_runs WHERE team_id=tid AND phase IN ('lobby','combat') ORDER BY created_at DESC LIMIT 1;
IF r.id IS NOT NULL THEN PERFORM public.team_boss_tick(r.id); END IF;
IF p_action IN ('resume','create','join') THEN
 SELECT * INTO r FROM public.team_boss_runs WHERE team_id=tid AND phase IN ('lobby','combat') ORDER BY created_at DESC LIMIT 1;
 IF p_action='create' AND r.id IS NULL THEN
  INSERT INTO public.team_boss_runs(team_id,host_id) VALUES(tid,me.id) RETURNING * INTO r;
  INSERT INTO public.team_boss_players(run_id,profile_id,grade) VALUES(r.id,me.id,coalesce(me.grade,7));
 ELSIF p_action='join' THEN
  IF r.id IS NULL OR r.phase<>'lobby' THEN RAISE EXCEPTION '房间已开始或已关闭'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_boss_players WHERE run_id=r.id AND profile_id=me.id) THEN
   IF (SELECT count(*) FROM public.team_boss_players WHERE run_id=r.id)>=5 THEN RAISE EXCEPTION '房间已满'; END IF;
   INSERT INTO public.team_boss_players(run_id,profile_id,grade) VALUES(r.id,me.id,coalesce(me.grade,7));
  END IF;
 END IF;
 IF r.id IS NOT NULL AND r.phase='combat' AND NOT EXISTS(SELECT 1 FROM public.team_boss_players WHERE run_id=r.id AND profile_id=me.id) THEN r:=NULL; END IF;
 RETURN jsonb_build_object('state',CASE WHEN r.id IS NULL THEN NULL ELSE public.team_boss_view(r.id,me.id) END,'team',jsonb_build_object('id',tid,'name',tname));
END IF;
SELECT * INTO r FROM public.team_boss_runs WHERE id=p_run AND team_id=tid FOR UPDATE;
IF r.id IS NULL THEN RAISE EXCEPTION '挑战不存在'; END IF;
SELECT * INTO own FROM public.team_boss_players WHERE run_id=p_run AND profile_id=me.id;
IF own.profile_id IS NULL THEN RAISE EXCEPTION '请先加入房间'; END IF;
IF p_action='state' THEN PERFORM public.team_boss_tick(p_run);
ELSIF p_action='leave' AND r.phase='lobby' THEN
 IF r.host_id=me.id THEN PERFORM public.team_boss_settle(p_run,'cancelled'); ELSE DELETE FROM public.team_boss_players WHERE run_id=p_run AND profile_id=me.id; END IF;
 RETURN jsonb_build_object('state',NULL,'team',jsonb_build_object('id',tid,'name',tname));
ELSIF p_action IN ('role','ready') AND r.phase='lobby' THEN
 IF p_action='role' THEN
  IF p_choice IS NULL OR p_choice NOT IN ('damage','guardian','healer') THEN RAISE EXCEPTION '职责无效'; END IF;
  UPDATE public.team_boss_players SET role=p_choice,ready=false WHERE run_id=p_run AND profile_id=me.id;
 ELSE UPDATE public.team_boss_players SET ready=NOT ready WHERE run_id=p_run AND profile_id=me.id; END IF;
ELSIF p_action='start' AND r.phase='lobby' THEN
 IF r.host_id<>me.id THEN RAISE EXCEPTION '只有房主可开始'; END IF;
 SELECT count(*) INTO n FROM public.team_boss_players WHERE run_id=p_run;
 IF n<3 OR n>5 THEN RAISE EXCEPTION '需要3—5人'; END IF;
 IF EXISTS(SELECT 1 FROM public.team_boss_players p JOIN public.profiles u ON u.id=p.profile_id WHERE p.run_id=p_run AND (NOT p.ready OR u.banned_until>now() OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=tid AND profile_id=p.profile_id))) THEN RAISE EXCEPTION '所有成员须准备且仍在战队'; END IF;
 UPDATE public.team_boss_runs SET phase='combat',round=1,party_size=n,boss_hp=n*120,boss_max=n*120,started_at=now(),ends_at=now()+interval '10 minutes',deadline=now()+interval '75 seconds' WHERE id=p_run;
 PERFORM public.team_boss_issue(p_run);
ELSIF p_action IN ('answer','act') THEN
 SELECT * INTO q FROM public.team_boss_questions WHERE run_id=p_run AND profile_id=me.id AND round=p_round FOR UPDATE;
 IF q.run_id IS NULL THEN RAISE EXCEPTION '题目不存在'; END IF;
 IF p_action='answer' AND q.answer IS NOT NULL THEN
  IF q.answer IS DISTINCT FROM p_choice THEN RAISE EXCEPTION '只能重试原答案'; END IF;
 ELSIF p_action='act' AND q.action IS NOT NULL THEN
  IF q.action IS DISTINCT FROM p_choice OR q.target_id IS DISTINCT FROM p_target THEN RAISE EXCEPTION '行动已确认'; END IF;
 ELSE
  IF r.phase<>'combat' OR r.round IS DISTINCT FROM p_round OR now()>=r.deadline OR own.hp<=0 THEN RAISE EXCEPTION '回合已结束'; END IF;
  IF p_action='answer' THEN
   IF p_choice IS NULL OR length(p_choice)>500 OR now()-q.created_at<interval '1 second' THEN RAISE EXCEPTION '请认真作答'; END IF;
   IF q.kind='choice' AND NOT(q.options ? p_choice) THEN RAISE EXCEPTION '选项无效'; END IF;
   ok:=CASE WHEN q.kind='spelling' THEN public.battle_spelling_correct(p_choice,q.word) ELSE p_choice=q.meaning END;
   UPDATE public.team_boss_questions SET answer=p_choice,is_correct=ok,action=CASE WHEN ok THEN NULL ELSE 'miss' END WHERE run_id=p_run AND profile_id=me.id AND round=p_round;
   UPDATE public.team_boss_players SET answered=answered+1,correct=correct+CASE WHEN ok THEN 1 ELSE 0 END WHERE run_id=p_run AND profile_id=me.id;
  ELSE
   IF q.is_correct IS DISTINCT FROM true THEN RAISE EXCEPTION '先答对再行动'; END IF;
   IF p_choice IS NULL OR p_choice NOT IN ('attack','guard','heal') THEN RAISE EXCEPTION '行动无效'; END IF;
   IF p_choice IN ('guard','heal') AND NOT EXISTS(SELECT 1 FROM public.team_boss_players WHERE run_id=p_run AND profile_id=p_target) THEN RAISE EXCEPTION '请选择队友'; END IF;
   IF p_choice='attack' AND p_target IS NOT NULL THEN RAISE EXCEPTION '攻击目标无效'; END IF;
   UPDATE public.team_boss_questions SET action=p_choice,target_id=p_target WHERE run_id=p_run AND profile_id=me.id AND round=p_round;
  END IF;
  PERFORM public.team_boss_tick(p_run);
 END IF;
ELSE RAISE EXCEPTION '操作已过期，请刷新挑战'; END IF;
RETURN jsonb_build_object('state',public.team_boss_view(p_run,me.id),'team',jsonb_build_object('id',tid,'name',tname));
END $$;
REVOKE ALL ON FUNCTION public.team_boss_touch(),public.team_boss_issue(uuid),public.team_boss_tick(uuid),public.team_boss_settle(uuid,text),public.team_boss_view(uuid,uuid),public.team_boss_action(text,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.team_boss_action(text,uuid,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_boss_touch(),public.team_boss_issue(uuid),public.team_boss_tick(uuid),public.team_boss_settle(uuid,text),public.team_boss_view(uuid,uuid),public.team_boss_action(text,uuid,integer,text,uuid) TO service_role;