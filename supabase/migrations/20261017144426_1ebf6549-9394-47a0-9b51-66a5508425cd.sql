DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.award_badges_for_profile'::regproc);
  d := replace(d,
    'SELECT count(*) INTO learn_cnt FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1;',
    'SELECT (SELECT count(*) FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1)
         + (SELECT count(*) FROM hs_learning_progress WHERE profile_id = p_id AND mastery_level >= 1)
         + (SELECT count(*) FROM math_learning_progress WHERE profile_id = p_id AND mastery_level >= 1)
         + (SELECT count(*) FROM science_learning_progress WHERE profile_id = p_id AND mastery_level >= 1)
       INTO learn_cnt;');
  EXECUTE d;
END $mig$;