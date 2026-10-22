REVOKE EXECUTE ON FUNCTION public.team_boss_action(text,uuid,integer,text,uuid) FROM authenticated;
CREATE OR REPLACE FUNCTION public.team_boss_dispatch(p_profile uuid,p_action text DEFAULT 'resume',p_run uuid DEFAULT NULL,p_round integer DEFAULT NULL,p_choice text DEFAULT NULL,p_target uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; claims text; result jsonb;
BEGIN
IF coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
SELECT user_id INTO STRICT uid FROM public.profiles WHERE id=p_profile;
claims:=current_setting('request.jwt.claims',true);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
result:=public.team_boss_action(p_action,p_run,p_round,p_choice,p_target);
PERFORM set_config('request.jwt.claims',claims,true);
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.team_boss_dispatch(uuid,text,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.team_boss_dispatch(uuid,text,uuid,integer,text,uuid) TO service_role;