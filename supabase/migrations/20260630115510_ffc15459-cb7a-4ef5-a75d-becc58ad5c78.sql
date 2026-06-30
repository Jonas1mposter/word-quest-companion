
-- ============================================================
-- 1. Extend ranked_matches for 2v2
-- ============================================================
ALTER TABLE public.ranked_matches
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT '1v1',
  ADD COLUMN IF NOT EXISTS player3_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player4_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS team1_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS team2_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winner_team int;

CREATE INDEX IF NOT EXISTS idx_ranked_matches_player3 ON public.ranked_matches(player3_id);
CREATE INDEX IF NOT EXISTS idx_ranked_matches_player4 ON public.ranked_matches(player4_id);

-- Allow players in slot3/slot4 to read their own matches
DROP POLICY IF EXISTS "Players can read matches they are in (2v2)" ON public.ranked_matches;
CREATE POLICY "Players can read matches they are in (2v2)" ON public.ranked_matches
  FOR SELECT TO authenticated
  USING (
    player3_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR player4_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ============================================================
-- 2. Extend match_queue for parties
-- ============================================================
ALTER TABLE public.match_queue
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT '1v1',
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS party_size int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_match_queue_mode_grade ON public.match_queue(mode, grade, status);

-- ============================================================
-- 3. match_parties (2v2 duo invitations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | ready | queued | matched | closed
  grade int NOT NULL,
  subject text NOT NULL DEFAULT 'mixed',
  match_id uuid REFERENCES public.ranked_matches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_parties TO authenticated;
GRANT ALL ON public.match_parties TO service_role;

ALTER TABLE public.match_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Party members can read their parties" ON public.match_parties;
CREATE POLICY "Party members can read their parties" ON public.match_parties
  FOR SELECT TO authenticated
  USING (
    leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR invited_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Leader can create party" ON public.match_parties;
CREATE POLICY "Leader can create party" ON public.match_parties
  FOR INSERT TO authenticated
  WITH CHECK (
    leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update party" ON public.match_parties;
CREATE POLICY "Members can update party" ON public.match_parties
  FOR UPDATE TO authenticated
  USING (
    leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR invited_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR invited_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Leader can delete party" ON public.match_parties;
CREATE POLICY "Leader can delete party" ON public.match_parties
  FOR DELETE TO authenticated
  USING (
    leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_parties;
ALTER TABLE public.match_parties REPLICA IDENTITY FULL;

-- ============================================================
-- 4. find_match_2v2 RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_match_2v2(
  _profile_id uuid,
  _grade int,
  _elo_rating int,
  _subject text DEFAULT 'mixed',
  _party_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Cleanup stale queue rows
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

  -- Insert caller (or both party members) into queue
  IF _party_id IS NOT NULL THEN
    -- Insert leader+member rows tagged with the same party_id
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

  -- ===== Try to assemble 4 players =====

  -- Strategy 1: two duos (different party_ids)
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

  -- Strategy 2: one duo + two solos
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

  -- Strategy 3: four solos
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
    RETURN NULL; -- still waiting
  END IF;

  -- Generate words (same logic as 1v1)
  IF _subj = 'math' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'science' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'mixed' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words FROM (
      (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 4)
      UNION ALL (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 3)
      UNION ALL (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 3)
    ) w;
  ELSE
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 10) w;
  END IF;

  -- Create the match. Slot layout: player1+player3 = team1, player2+player4 = team2
  INSERT INTO ranked_matches (
    player1_id, player2_id, player3_id, player4_id,
    grade, match_type, subject, status, words, started_at, mode
  )
  VALUES (
    _team1[1], _team2[1], _team1[2], _team2[2],
    _grade, 'ranked', _subj, 'in_progress', _words, now(), '2v2'
  )
  RETURNING id INTO _match_id;

  -- Mark all 4 queue rows as matched
  UPDATE match_queue
  SET status = 'matched', match_id = _match_id
  WHERE mode = '2v2' AND profile_id = ANY(_team1 || _team2)
    AND status = 'searching';

  -- Mark party rows as matched
  UPDATE match_parties
  SET status = 'matched', match_id = _match_id
  WHERE id IN (
    SELECT party_id FROM match_queue
    WHERE match_id = _match_id AND party_id IS NOT NULL
  );

  RETURN _match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_match_2v2(uuid, int, int, text, uuid) TO authenticated;
