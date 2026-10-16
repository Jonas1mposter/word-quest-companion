CREATE FUNCTION public.accept_battle_invite(p_invite_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.friend_battle_invites; p public.profiles; ws jsonb; mid uuid;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE user_id=auth.uid();
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
REVOKE ALL ON FUNCTION public.accept_battle_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_battle_invite(uuid) TO authenticated,service_role;
REVOKE INSERT ON public.ranked_matches FROM authenticated,anon;
CREATE FUNCTION public.release_completed_match_words() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='completed' THEN SELECT words INTO NEW.words FROM public.match_question_secrets WHERE match_id=NEW.id; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.release_completed_match_words() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER release_completed_match_words BEFORE UPDATE OF status ON public.ranked_matches FOR EACH ROW EXECUTE FUNCTION public.release_completed_match_words();
CREATE OR REPLACE FUNCTION public.protect_match_questions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF jsonb_typeof(NEW.words)='array' AND jsonb_array_length(NEW.words)>0 THEN
 INSERT INTO public.match_question_secrets(match_id,words) VALUES(NEW.id,NEW.words) ON CONFLICT(match_id) DO UPDATE SET words=excluded.words;
 NEW.question_count=jsonb_array_length(NEW.words);
 IF NEW.status<>'completed' THEN NEW.words='[]'::jsonb; END IF;
 END IF; RETURN NEW; END $$;
UPDATE public.ranked_matches m SET words=s.words FROM public.match_question_secrets s WHERE m.id=s.match_id AND m.status='completed';