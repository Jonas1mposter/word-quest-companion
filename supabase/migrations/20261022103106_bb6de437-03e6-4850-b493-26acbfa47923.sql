ALTER TABLE public.match_queue ADD COLUMN search_request_id uuid;
DO $$ DECLARE d text; BEGIN
SELECT pg_get_functiondef('public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean)'::regprocedure) INTO d;
d=replace(d,'DELETE FROM match_queue WHERE NOT newer AND status=''searching'' AND mode=p_mode','DELETE FROM match_queue WHERE search_request_id=p_request_id AND status=''searching'' AND mode=p_mode');
d=replace(d,'SELECT min(created_at) INTO qtime','UPDATE match_queue SET search_request_id=p_request_id WHERE status=''searching'' AND mode=p_mode AND (profile_id=p_profile_id OR (p_party_id IS NOT NULL AND party_id=p_party_id)); SELECT min(created_at) INTO qtime');
EXECUTE d;
END $$;