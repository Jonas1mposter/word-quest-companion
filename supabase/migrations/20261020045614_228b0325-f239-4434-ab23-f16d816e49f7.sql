DO $block$
DECLARE v_start timestamptz := statement_timestamp(); v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles
  SET banned_until = v_start + interval '30 days',
      ban_reason = '管理员决定：异常重复对战刷胜，封禁30天（000871 / 002330）',
      updated_at = v_start
  WHERE id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Expected exactly two accounts'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1'::uuid, 'c457ac22-0540-473b-94b9-bb5f2713e106'::uuid) AND banned_until = v_start + interval '30 days') <> 2 THEN
    RAISE EXCEPTION '30-day ban verification failed';
  END IF;
END $block$;