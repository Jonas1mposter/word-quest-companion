-- Both accounts remain excluded after the original November 1 expiry.
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
    WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid
  ) THEN
    RAISE EXCEPTION '000243 must remain excluded from all personal leaderboards';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
    WHERE id = 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid
  ) THEN
    RAISE EXCEPTION '002330 must remain excluded from all personal leaderboards';
  END IF;
END;
$test$;