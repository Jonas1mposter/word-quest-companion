ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until timestamptz, ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF jwt_role = 'service_role' THEN RETURN NEW; END IF;
  NEW.xp := OLD.xp; NEW.total_xp := OLD.total_xp; NEW.level := OLD.level;
  NEW.xp_to_next_level := OLD.xp_to_next_level; NEW.coins := OLD.coins;
  NEW.energy := OLD.energy; NEW.max_energy := OLD.max_energy;
  NEW.last_energy_restore := OLD.last_energy_restore; NEW.elo_rating := OLD.elo_rating;
  NEW.elo_free := OLD.elo_free; NEW.rank_tier := OLD.rank_tier; NEW.rank_stars := OLD.rank_stars;
  NEW.rank_points := OLD.rank_points; NEW.wins := OLD.wins; NEW.losses := OLD.losses;
  NEW.free_match_wins := OLD.free_match_wins; NEW.free_match_losses := OLD.free_match_losses;
  NEW.streak := OLD.streak; NEW.max_combo := OLD.max_combo;
  NEW.is_priority := OLD.is_priority; NEW.priority_since := OLD.priority_since;
  NEW.priority_last_claim := OLD.priority_last_claim;
  NEW.banned_until := OLD.banned_until; NEW.ban_reason := OLD.ban_reason;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_grant_water_coupon(p_profile_id uuid, p_count integer DEFAULT 1)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN RAISE EXCEPTION 'invalid count'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
  INSERT INTO backpack_items (profile_id, item_type, amount, label, source)
  SELECT p_profile_id, 'water_coupon', 1, '水吧券', 'admin' FROM generate_series(1, p_count);
  RETURN jsonb_build_object('ok', true, 'count', p_count);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_water_coupon(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_grant_water_coupon(uuid, integer) TO authenticated;