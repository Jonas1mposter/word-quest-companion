DO $$
DECLARE d text;
BEGIN
SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='team_boss_action';
d:=replace(d,'ELSE UPDATE public.team_boss_players SET ready=NOT ready WHERE run_id=p_run AND profile_id=me.id; END IF;','ELSE IF p_choice IS NULL OR p_choice NOT IN (''true'',''false'') THEN RAISE EXCEPTION ''准备状态无效''; END IF; UPDATE public.team_boss_players SET ready=(p_choice=''true'') WHERE run_id=p_run AND profile_id=me.id; END IF;');
d:=replace(d,'IF p_action IN (''resume'',''create'',''join'') THEN','IF p_action IN (''create'',''join'') AND EXISTS(SELECT 1 FROM public.team_boss_players p JOIN public.team_boss_runs b ON b.id=p.run_id WHERE p.profile_id=me.id AND b.team_id<>tid AND b.phase IN (''lobby'',''combat'')) THEN RAISE EXCEPTION ''请先结束其他战队挑战''; END IF; IF p_action IN (''resume'',''create'',''join'') THEN');
EXECUTE d;
END $$;