CREATE OR REPLACE FUNCTION public.bump_lifetime_coins(p_id uuid, p_amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE old_claims text;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE profiles SET lifetime_coins_earned = lifetime_coins_earned + p_amount WHERE id = p_id;
  PERFORM set_config('request.jwt.claims', COALESCE(old_claims, ''), true);
END $$;
REVOKE ALL ON FUNCTION public.bump_lifetime_coins(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_lifetime_coins(uuid,integer) TO service_role;