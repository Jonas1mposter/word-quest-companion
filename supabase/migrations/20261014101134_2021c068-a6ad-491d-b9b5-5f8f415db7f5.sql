CREATE OR REPLACE FUNCTION public.admin_grant_lottery_ticket(p_profile_id uuid, p_count integer DEFAULT 1)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN RAISE EXCEPTION 'invalid count'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
  INSERT INTO backpack_items (profile_id, item_type, amount, label, source)
  SELECT p_profile_id, 'lottery_ticket', 1, '抽奖券', 'admin' FROM generate_series(1, p_count);
  RETURN jsonb_build_object('ok', true, 'count', p_count);
END $$;
REVOKE ALL ON FUNCTION public.admin_grant_lottery_ticket(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_lottery_ticket(uuid,integer) TO authenticated;