DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '514a75a6-842b-4a67-8c48-2fd04152b1db' AND username = '004444') THEN
    RAISE EXCEPTION 'Target account mismatch';
  END IF;
  INSERT INTO public.user_badges (profile_id, badge_id)
  SELECT '514a75a6-842b-4a67-8c48-2fd04152b1db'::uuid, '5cab7fd2-0a1f-4bde-9fbb-c9c94ae8e736'::uuid
  WHERE NOT EXISTS (SELECT 1 FROM public.user_badges WHERE profile_id = '514a75a6-842b-4a67-8c48-2fd04152b1db' AND badge_id = '5cab7fd2-0a1f-4bde-9fbb-c9c94ae8e736');
  INSERT INTO public.user_name_cards (profile_id, name_card_id)
  SELECT '514a75a6-842b-4a67-8c48-2fd04152b1db'::uuid, '2ac3a3e3-90ef-405d-b315-1e63101d5db1'::uuid
  WHERE NOT EXISTS (SELECT 1 FROM public.user_name_cards WHERE profile_id = '514a75a6-842b-4a67-8c48-2fd04152b1db' AND name_card_id = '2ac3a3e3-90ef-405d-b315-1e63101d5db1');
END $$;