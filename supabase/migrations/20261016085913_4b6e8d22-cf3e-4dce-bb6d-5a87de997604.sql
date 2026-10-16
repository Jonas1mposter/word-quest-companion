CREATE OR REPLACE FUNCTION public.accept_battle_invite(p_invite_id uuid,p_profile_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.friend_battle_invites; p public.profiles; ws jsonb; mid uuid;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id;
 IF NOT FOUND OR (p.banned_until IS NOT NULL AND p.banned_until>now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT * INTO i FROM public.friend_battle_invites WHERE id=p_invite_id FOR UPDATE;
 IF NOT FOUND OR i.receiver_id<>p.id THEN RAISE EXCEPTION 'Invalid invite'; END IF;
 IF i.status='accepted' AND i.match_id IS NOT NULL THEN RETURN i.match_id; END IF;
 IF i.status<>'pending' OR i.expires_at<=now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
 SELECT jsonb_agg(row_to_json(w)) INTO ws FROM (SELECT id,word,meaning,phonetic,example FROM public.words WHERE grade=CASE WHEN p.grade>=9 THEN 9 ELSE p.grade END ORDER BY random() LIMIT 10) w;
 INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,words,started_at) VALUES(p.id,i.sender_id,p.grade,'in_progress',coalesce(ws,'[]'::jsonb),now()) RETURNING id INTO mid;
 UPDATE public.friend_battle_invites SET status='accepted',match_id=mid WHERE id=i.id;
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.accept_battle_invite(uuid),public.accept_battle_invite(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_battle_invite(uuid,uuid) TO service_role;