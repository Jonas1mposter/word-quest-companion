DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM profiles LOOP
    PERFORM public.award_badges_for_profile(r.id);
  END LOOP;
END $$;