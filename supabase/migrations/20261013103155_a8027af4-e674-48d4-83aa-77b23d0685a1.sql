CREATE OR REPLACE FUNCTION public.admin_grant_coins(p_profile_id uuid, p_amount integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE old_claims text; v_new int;
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET coins = coins + p_amount WHERE id = p_profile_id RETURNING coins INTO v_new;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  IF v_new IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  PERFORM bump_lifetime_coins(p_profile_id, p_amount);
  RETURN jsonb_build_object('ok', true, 'coins', v_new);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_coins(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(uuid, integer) TO authenticated;