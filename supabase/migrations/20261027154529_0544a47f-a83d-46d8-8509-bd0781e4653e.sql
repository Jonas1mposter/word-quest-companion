DO $$
DECLARE outfit jsonb; b jsonb; cat text;
BEGIN
 FOR i IN 1..500 LOOP
  outfit=public.random_bot_cosmetics();
  IF outfit->'name_card' IS NULL OR outfit->'name_card'='null'::jsonb THEN RAISE EXCEPTION 'Missing bot name card'; END IF;
  SELECT category INTO cat FROM public.name_cards WHERE id=(outfit->'name_card'->>'id')::uuid;
  IF cat NOT IN ('achievement','battle','learning','rank_tier','ranked') THEN RAISE EXCEPTION 'Excluded bot name card'; END IF;
  IF jsonb_array_length(outfit->'badges')<>3 OR (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(outfit->'badges') item)<>3 THEN RAISE EXCEPTION 'Bad bot title slots'; END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(outfit->'badges') LOOP
   SELECT category INTO cat FROM public.badges WHERE id=(b->>'id')::uuid;
   IF cat NOT IN ('common','rank_tier','tier_bot','tier_coins','tier_leaderboard','tier_login_total','tier_peak','tier_perfect','tier_rank','tier_streak','tier_words','tier_xp') THEN RAISE EXCEPTION 'Excluded special title'; END IF;
  END LOOP;
 END LOOP;
END $$;