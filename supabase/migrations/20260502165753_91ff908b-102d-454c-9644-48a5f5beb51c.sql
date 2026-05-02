
-- Phase 1 RLS hardening: prevent client-side writes to sensitive tables/columns.
-- Edge Functions use the service_role key and bypass RLS entirely.

-- 1) ranked_matches: clients can no longer UPDATE (settlement is server-side now)
DROP POLICY IF EXISTS "Users can update own matches" ON public.ranked_matches;

-- 2) match_answers: clients can no longer INSERT (submit-answer edge function does it)
DROP POLICY IF EXISTS "Users can insert own answers" ON public.match_answers;

-- 3) level_progress: clients can no longer INSERT/UPDATE (complete-level edge function does it)
DROP POLICY IF EXISTS "Users can insert own progress" ON public.level_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.level_progress;

-- 4) profiles: keep UPDATE policy but block changes to sensitive numeric fields via trigger.
-- service_role bypasses RLS AND triggers run with definer rights, so we detect role from JWT claim.
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Service role calls (Edge Functions) have role='service_role' in JWT claims
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular authenticated users: revert sensitive columns to OLD values
  NEW.xp := OLD.xp;
  NEW.total_xp := OLD.total_xp;
  NEW.level := OLD.level;
  NEW.xp_to_next_level := OLD.xp_to_next_level;
  NEW.coins := OLD.coins;
  NEW.energy := OLD.energy;
  NEW.max_energy := OLD.max_energy;
  NEW.last_energy_restore := OLD.last_energy_restore;
  NEW.elo_rating := OLD.elo_rating;
  NEW.elo_free := OLD.elo_free;
  NEW.rank_tier := OLD.rank_tier;
  NEW.rank_stars := OLD.rank_stars;
  NEW.rank_points := OLD.rank_points;
  NEW.wins := OLD.wins;
  NEW.losses := OLD.losses;
  NEW.free_match_wins := OLD.free_match_wins;
  NEW.free_match_losses := OLD.free_match_losses;
  NEW.streak := OLD.streak;
  NEW.max_combo := OLD.max_combo;
  -- grade/class are managed by sync flows; allow self-update only via dedicated flow if needed
  -- username, avatar_url, background_type, background_value remain editable by user

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_sensitive_columns_trg ON public.profiles;
CREATE TRIGGER guard_profile_sensitive_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_sensitive_columns();
