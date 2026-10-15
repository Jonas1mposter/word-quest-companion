CREATE OR REPLACE FUNCTION public.admin_grant_collectible(p_profile_id uuid, p_kind text, p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF p_kind = 'name_card' THEN
    IF NOT EXISTS (SELECT 1 FROM name_cards WHERE id = p_item_id) THEN RAISE EXCEPTION 'item not found'; END IF;
    IF EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id = p_profile_id AND name_card_id = p_item_id) THEN
      RETURN jsonb_build_object('ok', true, 'already', true); END IF;
    INSERT INTO user_name_cards (profile_id, name_card_id) VALUES (p_profile_id, p_item_id);
  ELSIF p_kind = 'badge' THEN
    IF NOT EXISTS (SELECT 1 FROM badges WHERE id = p_item_id) THEN RAISE EXCEPTION 'item not found'; END IF;
    IF EXISTS (SELECT 1 FROM user_badges WHERE profile_id = p_profile_id AND badge_id = p_item_id) THEN
      RETURN jsonb_build_object('ok', true, 'already', true); END IF;
    INSERT INTO user_badges (profile_id, badge_id) VALUES (p_profile_id, p_item_id);
  ELSE RAISE EXCEPTION 'invalid kind'; END IF;
  RETURN jsonb_build_object('ok', true, 'already', false);
END $$;
REVOKE ALL ON FUNCTION public.admin_grant_collectible(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_collectible(uuid, text, uuid) TO authenticated;