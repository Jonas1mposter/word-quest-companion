-- Each administrator-designated account must remain excluded even after renaming.
SELECT '000871 excluded' AS rule,
       EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
               WHERE id = 'dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid) AS passed;
SELECT '002330 excluded' AS rule,
       EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
               WHERE id = 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid) AS passed;
SELECT '000243 excluded' AS rule,
       EXISTS (SELECT 1 FROM public.leaderboard_excluded_ids() AS excluded(id)
               WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid) AS passed;
SELECT '000243 ban lasts exactly 30 days from administrator action' AS rule,
       banned_until = updated_at + interval '30 days' AS passed
FROM public.profiles WHERE id = '15a5b0fc-a058-4de1-b3d3-421d99055802'::uuid;