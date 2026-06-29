
-- Team Challenge Seasons
CREATE TABLE IF NOT EXISTS public.team_challenge_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | ended
  reward_tiers integer[] NOT NULL DEFAULT ARRAY[2000,1000,500,400,300,250,200,150,100,100],
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_challenge_seasons TO anon, authenticated;
GRANT ALL ON public.team_challenge_seasons TO service_role;
ALTER TABLE public.team_challenge_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_seasons" ON public.team_challenge_seasons
  FOR SELECT USING (true);
CREATE POLICY "admins_manage_seasons" ON public.team_challenge_seasons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.team_challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.team_challenge_seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, team_id)
);
GRANT SELECT ON public.team_challenge_scores TO anon, authenticated;
GRANT ALL ON public.team_challenge_scores TO service_role;
ALTER TABLE public.team_challenge_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_view_scores" ON public.team_challenge_scores
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_tcs_season_points
  ON public.team_challenge_scores(season_id, points DESC);

-- Award rewards distribution log (so members see history)
CREATE TABLE IF NOT EXISTS public.team_challenge_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.team_challenge_seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  coins integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_challenge_rewards TO authenticated;
GRANT ALL ON public.team_challenge_rewards TO service_role;
ALTER TABLE public.team_challenge_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_view_rewards" ON public.team_challenge_rewards
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

-- RPC: increment a team's score by 1 for the current active season based on a winning profile
CREATE OR REPLACE FUNCTION public.increment_team_challenge_score_for_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team uuid;
  v_season uuid;
BEGIN
  SELECT team_id INTO v_team FROM team_members WHERE profile_id = p_profile_id LIMIT 1;
  IF v_team IS NULL THEN RETURN; END IF;
  SELECT id INTO v_season
    FROM team_challenge_seasons
    WHERE status = 'active' AND now() BETWEEN starts_at AND ends_at
    ORDER BY starts_at DESC LIMIT 1;
  IF v_season IS NULL THEN RETURN; END IF;

  INSERT INTO team_challenge_scores (season_id, team_id, points, last_updated)
  VALUES (v_season, v_team, 1, now())
  ON CONFLICT (season_id, team_id)
  DO UPDATE SET points = team_challenge_scores.points + 1, last_updated = now();
END;
$$;
REVOKE ALL ON FUNCTION public.increment_team_challenge_score_for_profile(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_team_challenge_score_for_profile(uuid) TO service_role;
