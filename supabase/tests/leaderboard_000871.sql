-- 000871 must stay excluded after the original November 1 expiry.
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
    WHERE id = 'dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid
  ) THEN
    RAISE EXCEPTION '000871 must remain excluded from all personal leaderboards';
  END IF;
END;
$test$;