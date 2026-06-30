CREATE OR REPLACE FUNCTION public.find_match_2v2(_profile_id uuid, _grade integer, _elo_rating integer, _subject text DEFAULT 'mixed'::text, _party_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _subj text := COALESCE(_subject, 'mixed');
  _match_id uuid;
  _words jsonb;
  _party_a record;
  _party_b record;
  _solo_a record;
  _solo_b record;
  _solo_c record;
  _team1 uuid[];
  _team2 uuid[];
  _all_ids uuid[];
  _avg_elo int;
BEGIN
  SELECT user_id INTO _caller FROM profiles WHERE id = _profile_id;
  IF _caller IS NULL OR _caller <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM match_queue mq
  WHERE mq.profile_id = _profile_id
    AND mq.mode = '2v2'
    AND (
      mq.status = 'searching'
      OR (mq.status = 'matched' AND (
        mq.created_at < now() - interval '2 minutes'
        OR EXISTS (SELECT 1 FROM ranked_matches rm WHERE rm.id = mq.match_id AND rm.status = 'completed')
      ))
    );

  IF _party_id IS NOT NULL THEN
    INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject, mode, party_id, party_size)
    SELECT p.id, _grade, 'ranked', COALESCE(p.elo_rating, 1000), _subj, '2v2', _party_id, 2
    FROM match_parties mp
    JOIN profiles p ON p.id IN (mp.leader_id, mp.member_id)
    WHERE mp.id = _party_id
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject, mode, party_size)
    VALUES (_profile_id, _grade, 'ranked', _elo_rating, _subj, '2v2', 1);
  END IF;

  SELECT DISTINCT ON (party_id) party_id, array_agg(profile_id) OVER (PARTITION BY party_id) AS members
  INTO _party_a
  FROM match_queue
  WHERE status = 'searching' AND mode = '2v2' AND grade = _grade
    AND COALESCE(subject, 'mixed') = _subj AND party_size = 2
    AND party_id IS NOT NULL
  ORDER BY party_id, created_at
  LIMIT 1;

  IF _party_a.party_id IS NOT NULL THEN
    SELECT DISTINCT ON (party_id) party_id, array_agg(profile_id) OVER (PARTITION BY party_id) AS members
    INTO _party_b
    FROM match_queue
    WHERE status = 'searching' AND mode = '2v2' AND grade = _grade
      AND COALESCE(subject, 'mixed') = _subj AND party_size = 2
      AND party_id IS NOT NULL AND party_id <> _party_a.party_id
    ORDER BY party_id, created_at
    LIMIT 1;

    IF _party_b.party_id IS NOT NULL THEN
      _team1 := _party_a.members;
      _team2 := _party_b.members;
    END IF;
  END IF;

  IF _team1 IS NULL AND _party_a.party_id IS NOT NULL THEN
    SELECT profile_id INTO _solo_a FROM match_queue
    WHERE status = 'searching' AND mode = '2v2' AND grade = _grade
      AND COALESCE(subject, 'mixed') = _subj AND party_size = 1
    ORDER BY created_at LIMIT 1;
    IF _solo_a IS NOT NULL THEN
      SELECT profile_id INTO _solo_b FROM match_queue
      WHERE status = 'searching' AND mode = '2v2' AND grade = _grade
        AND COALESCE(subject, 'mixed') = _subj AND party_size = 1
        AND profile_id <> (_solo_a).profile_id
      ORDER BY created_at LIMIT 1;
      IF _solo_b IS NOT NULL THEN
        _team1 := _party_a.members;
        _team2 := ARRAY[(_solo_a).profile_id, (_solo_b).profile_id];
      END IF;
    END IF;
  END IF;

  IF _team1 IS NULL THEN
    WITH solos AS (
      SELECT profile_id FROM match_queue
      WHERE status = 'searching' AND mode = '2v2' AND grade = _grade
        AND COALESCE(subject, 'mixed') = _subj AND party_size = 1
      ORDER BY created_at LIMIT 4
    )
    SELECT array_agg(profile_id) INTO _all_ids FROM solos;
    IF _all_ids IS NOT NULL AND array_length(_all_ids, 1) = 4 THEN
      _team1 := ARRAY[_all_ids[1], _all_ids[2]];
      _team2 := ARRAY[_all_ids[3], _all_ids[4]];
    END IF;
  END IF;

  IF _team1 IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2v2 题量：30 题
  IF _subj = 'math' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 30) w;
  ELSIF _subj = 'science' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 30) w;
  ELSIF _subj = 'mixed' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words FROM (
      (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 12)
      UNION ALL (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 9)
      UNION ALL (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 9)
    ) w;
  ELSE
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 30) w;
  END IF;

  INSERT INTO ranked_matches (
    player1_id, player2_id, player3_id, player4_id,
    grade, match_type, subject, status, words, started_at, mode
  )
  VALUES (
    _team1[1], _team2[1], _team1[2], _team2[2],
    _grade, 'ranked', _subj, 'in_progress', _words, now(), '2v2'
  )
  RETURNING id INTO _match_id;

  UPDATE match_queue
  SET status = 'matched', match_id = _match_id
  WHERE mode = '2v2' AND profile_id = ANY(_team1 || _team2)
    AND status = 'searching';

  UPDATE match_parties
  SET status = 'matched', match_id = _match_id
  WHERE id IN (
    SELECT party_id FROM match_queue
    WHERE match_id = _match_id AND party_id IS NOT NULL
  );

  RETURN _match_id;
END;
$function$;