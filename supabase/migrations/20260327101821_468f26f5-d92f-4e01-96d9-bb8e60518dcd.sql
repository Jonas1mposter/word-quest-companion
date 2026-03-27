-- 1. Match queue table for matchmaking
CREATE TABLE IF NOT EXISTS public.match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  grade integer NOT NULL DEFAULT 7,
  match_type text NOT NULL DEFAULT 'ranked',
  elo_rating integer NOT NULL DEFAULT 1000,
  subject text DEFAULT 'mixed',
  status text NOT NULL DEFAULT 'searching',
  match_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_queue_one_searching 
  ON public.match_queue (profile_id) WHERE status = 'searching';

-- 2. Match answers table
CREATE TABLE IF NOT EXISTS public.match_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  question_index integer NOT NULL,
  answer text,
  is_correct boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  captain_id uuid NOT NULL,
  avatar_url text,
  max_members integer NOT NULL DEFAULT 10,
  total_xp bigint NOT NULL DEFAULT 0,
  total_wins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Team members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, profile_id)
);

-- 5. Team join requests
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Add expires_at to friend_battle_invites
ALTER TABLE public.friend_battle_invites 
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '60 seconds');

-- RLS
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- Match queue policies
CREATE POLICY "Anyone can view queue" ON public.match_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own queue" ON public.match_queue FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own queue" ON public.match_queue FOR UPDATE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can delete own queue" ON public.match_queue FOR DELETE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Match answers policies
CREATE POLICY "Match answers are viewable" ON public.match_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own answers" ON public.match_answers FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = player_id));

-- Teams policies
CREATE POLICY "Teams are readable" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create teams" ON public.teams FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = captain_id));
CREATE POLICY "Captain can update team" ON public.teams FOR UPDATE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = captain_id));
CREATE POLICY "Captain can delete team" ON public.teams FOR DELETE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = captain_id));

-- Team members policies
CREATE POLICY "Team members are viewable" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join teams" ON public.team_members FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can leave teams" ON public.team_members FOR DELETE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Team join requests policies
CREATE POLICY "Team requests viewable" ON public.team_join_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create requests" ON public.team_join_requests FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Captain or requester can update" ON public.team_join_requests FOR UPDATE TO authenticated 
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Matchmaking Function
CREATE OR REPLACE FUNCTION public.find_match(
  _profile_id uuid,
  _grade integer,
  _match_type text,
  _elo_rating integer,
  _subject text DEFAULT 'mixed'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _opponent record;
  _match_id uuid;
  _words jsonb;
BEGIN
  SELECT * INTO _opponent
  FROM match_queue
  WHERE status = 'searching'
    AND grade = _grade
    AND match_type = _match_type
    AND profile_id != _profile_id
    AND ABS(elo_rating - _elo_rating) <= 300
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _opponent IS NULL THEN
    INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject)
    VALUES (_profile_id, _grade, _match_type, _elo_rating, _subject)
    ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(row_to_json(w))
  INTO _words
  FROM (
    SELECT id, word, meaning, phonetic, example
    FROM words
    WHERE grade = _grade
    ORDER BY random()
    LIMIT 10
  ) w;

  INSERT INTO ranked_matches (player1_id, player2_id, grade, match_type, subject, status, words, started_at)
  VALUES (_opponent.profile_id, _profile_id, _grade, _match_type, COALESCE(_subject, 'mixed'), 'in_progress', _words, now())
  RETURNING id INTO _match_id;

  UPDATE match_queue SET status = 'matched', match_id = _match_id WHERE id = _opponent.id;
  DELETE FROM match_queue WHERE profile_id = _profile_id AND status = 'searching';

  RETURN _match_id;
END;
$$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE match_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE match_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;