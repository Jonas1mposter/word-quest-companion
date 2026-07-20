CREATE OR REPLACE FUNCTION public.find_match(_profile_id uuid, _grade integer, _match_type text, _elo_rating integer, _subject text DEFAULT 'mixed'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _opponent record;
  _match_id uuid;
  _words jsonb;
  _caller uuid;
  _subj text := COALESCE(_subject, 'mixed');
  _recent uuid[];
  _existing uuid;
BEGIN
  SELECT user_id INTO _caller FROM profiles WHERE id = _profile_id;
  IF _caller IS NULL OR _caller <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Only clear stale matched entries; keep existing searching entries so opponents can find us
  DELETE FROM match_queue mq
  WHERE mq.profile_id = _profile_id
    AND mq.status = 'matched'
    AND (
      mq.created_at < now() - interval '2 minutes'
      OR EXISTS (
        SELECT 1 FROM ranked_matches rm
        WHERE rm.id = mq.match_id AND rm.status = 'completed'
      )
    );

  SELECT COALESCE(array_agg(DISTINCT CASE
            WHEN player1_id = _profile_id THEN player2_id
            ELSE player1_id END), ARRAY[]::uuid[])
    INTO _recent
  FROM ranked_matches
  WHERE (player1_id = _profile_id OR player2_id = _profile_id)
    AND COALESCE(ended_at, started_at, created_at) > now() - interval '800 milliseconds';

  SELECT mq.* INTO _opponent
  FROM match_queue mq
  WHERE mq.status = 'searching'
    AND mq.grade = _grade
    AND mq.match_type = _match_type
    AND mq.profile_id != _profile_id
    AND NOT (mq.profile_id = ANY(_recent))
    AND COALESCE(mq.subject, 'mixed') = _subj
    AND ABS(mq.elo_rating - _elo_rating) <= 300
  ORDER BY mq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _opponent IS NULL THEN
    -- No opponent — ensure we have a searching entry, but don't create duplicates
    SELECT id INTO _existing FROM match_queue
      WHERE profile_id = _profile_id
        AND status = 'searching'
        AND match_type = _match_type
        AND COALESCE(subject,'mixed') = _subj
      LIMIT 1;
    IF _existing IS NULL THEN
      INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject)
      VALUES (_profile_id, _grade, _match_type, _elo_rating, _subj);
    ELSE
      UPDATE match_queue SET elo_rating = _elo_rating, created_at = created_at
        WHERE id = _existing;
    END IF;
    RETURN NULL;
  END IF;

  IF _subj = 'math' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'science' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'mixed' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (
      (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 4)
      UNION ALL
      (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 3)
      UNION ALL
      (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 3)
    ) w;
  ELSE
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 10) w;
  END IF;

  INSERT INTO ranked_matches (player1_id, player2_id, grade, match_type, subject, status, words, started_at)
  VALUES (_opponent.profile_id, _profile_id, _grade, _match_type, _subj, 'in_progress', _words, now())
  RETURNING id INTO _match_id;

  UPDATE match_queue SET status = 'matched', match_id = _match_id WHERE id = _opponent.id;

  -- Update our own searching row to matched (or insert if missing)
  UPDATE match_queue SET status = 'matched', match_id = _match_id
    WHERE profile_id = _profile_id AND status = 'searching'
      AND match_type = _match_type AND COALESCE(subject,'mixed') = _subj;
  IF NOT FOUND THEN
    INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject, status, match_id)
    VALUES (_profile_id, _grade, _match_type, _elo_rating, _subj, 'matched', _match_id);
  END IF;

  RETURN _match_id;
END;
$function$;