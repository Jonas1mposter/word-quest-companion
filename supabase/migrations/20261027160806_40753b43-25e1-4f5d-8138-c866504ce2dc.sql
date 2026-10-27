DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.matchmaking_action(uuid,uuid,text,text,text,uuid,boolean)'::regprocedure) INTO definition;
 IF position('interval ''60 seconds''' IN definition)=0 THEN RAISE EXCEPTION 'Expected existing 60 second fallback rule'; END IF;
 EXECUTE replace(definition, 'interval ''60 seconds''', 'interval ''30 seconds''');
END;
$migration$;