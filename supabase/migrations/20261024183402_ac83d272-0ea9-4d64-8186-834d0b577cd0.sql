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
      AND (profile_id=p_pid OR created_at > now() - interval '3 minutes')
    ORDER BY (profile_id=p_pid) DESC, created_at LIMIT v_need) s;
  IF v_humans IS NULL OR NOT p_pid = ANY(v_humans) THEN v_humans := ARRAY[p_pid]; END IF;
  IF array_length(v_humans,1) >= v_need OR q.created_at <= now() - interval '60 seconds' THEN
    RETURN hw_create_match(q.mode, q.grade_key, v_humans);
  END IF;
  RETURN NULL;
END $$;

DELETE FROM halloween_queue WHERE created_at <= now() - interval '10 minutes';

DELETE FROM halloween_questions WHERE match_id IN (SELECT m.id FROM halloween_matches m WHERE m.status='active' AND NOT EXISTS(SELECT 1 FROM halloween_players hp WHERE hp.match_id=m.id AND NOT hp.is_bot));
DELETE FROM halloween_players WHERE match_id IN (SELECT m.id FROM halloween_matches m WHERE m.status='active' AND NOT EXISTS(SELECT 1 FROM halloween_players hp WHERE hp.match_id=m.id AND NOT hp.is_bot));
DELETE FROM halloween_matches WHERE status='active' AND NOT EXISTS(SELECT 1 FROM halloween_players hp WHERE hp.match_id=halloween_matches.id AND NOT hp.is_bot);