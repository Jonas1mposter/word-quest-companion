DO $migration$
DECLARE def text;
BEGIN
 def := pg_get_functiondef('public.find_match(uuid,integer,text,integer,text)'::regprocedure);
 IF position('AND mq.mode = ''1v1''' in def) > 0 THEN RETURN; END IF;
 def := replace(def, 'WHERE mq.profile_id = _profile_id', 'WHERE mq.profile_id = _profile_id AND mq.mode = ''1v1''');
 def := replace(def, 'WHERE rm.status = ''in_progress''', 'WHERE rm.status = ''in_progress'' AND rm.mode = ''1v1''');
 def := replace(def, 'DELETE FROM match_queue WHERE profile_id = _profile_id AND status = ''searching''', 'DELETE FROM match_queue WHERE profile_id = _profile_id AND mode = ''1v1'' AND status = ''searching''');
 def := replace(def, 'WHERE profile_id = _profile_id AND status = ''matched''', 'WHERE profile_id = _profile_id AND mode = ''1v1'' AND status = ''matched''');
 def := replace(def, 'WHERE profile_id = _profile_id AND match_id = _active_match', 'WHERE profile_id = _profile_id AND mode = ''1v1'' AND match_id = _active_match');
 def := replace(def, 'WHERE mq.status = ''searching''', 'WHERE mq.status = ''searching'' AND mq.mode = ''1v1''');
 def := replace(def, 'WHERE profile_id = _profile_id' || chr(10) || '        AND status = ''searching''', 'WHERE profile_id = _profile_id' || chr(10) || '        AND mode = ''1v1'' AND status = ''searching''');
 def := replace(def, 'WHERE profile_id = _profile_id AND status = ''searching''', 'WHERE profile_id = _profile_id AND mode = ''1v1'' AND status = ''searching''');
 IF position('AND mq.mode = ''1v1''' in def)=0 THEN RAISE EXCEPTION 'Expected queue selector not found'; END IF;
 EXECUTE def;
END $migration$;