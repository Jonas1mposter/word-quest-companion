
DO $$
DECLARE pid uuid;
BEGIN
  SELECT id INTO pid FROM public.profiles WHERE username ILIKE 'Jonas1mposter%' LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  DELETE FROM public.user_badges WHERE profile_id = pid;
  DELETE FROM public.user_name_cards WHERE profile_id = pid;
  UPDATE public.profiles SET
    coins=100, xp=0, total_xp=0, level=1, xp_to_next_level=100,
    energy=max_energy, elo_rating=1000, elo_free=1000,
    rank_tier='bronze', rank_stars=0, rank_points=0,
    wins=0, losses=0, free_match_wins=0, free_match_losses=0,
    streak=0, max_combo=0
  WHERE id = pid;
END $$;
