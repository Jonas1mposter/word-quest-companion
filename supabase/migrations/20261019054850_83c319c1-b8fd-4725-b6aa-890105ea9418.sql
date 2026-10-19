REVOKE ALL ON public.bot_battle_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.bot_battle_sessions TO service_role;
REVOKE ALL ON FUNCTION public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb) TO service_role;