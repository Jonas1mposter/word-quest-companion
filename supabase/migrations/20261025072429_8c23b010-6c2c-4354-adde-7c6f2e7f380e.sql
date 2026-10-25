REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON public.profiles FROM PUBLIC, anon, authenticated',cols,cols);
END $$;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (username, avatar_url, grade, class, grade_selected_at, background_type, background_value, lobby_card_image) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
ALTER POLICY "Users can update own profile" ON public.profiles TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE jwt_role text;
BEGIN
 jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
 IF jwt_role = 'service_role' OR (jwt_role = '' AND session_user IN ('postgres','supabase_admin')) THEN RETURN NEW; END IF;
 -- Only explicitly reviewed display/preferences fields are mutable. New columns default to protected.
 IF (to_jsonb(NEW) - ARRAY['username','avatar_url','grade','class','grade_selected_at','background_type','background_value','lobby_card_image'])
 IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['username','avatar_url','grade','class','grade_selected_at','background_type','background_value','lobby_card_image']) THEN
   RAISE EXCEPTION 'Server-managed profile fields cannot be edited directly' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.bump_lifetime_coins(uuid,integer), public.bump_ranked_win(uuid), public.bump_perfect_clear(uuid), public.bump_bot_win(uuid), public.grant_special_badge(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_lifetime_coins(uuid,integer), public.bump_ranked_win(uuid), public.bump_perfect_clear(uuid), public.bump_bot_win(uuid), public.grant_special_badge(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.restore_daily_energy()
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prof public.profiles%ROWTYPE; today text := (now() AT TIME ZONE 'UTC')::date::text; old_claims text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'Account banned' USING ERRCODE='42501'; END IF;
 IF prof.last_energy_restore IS NULL OR prof.last_energy_restore < today THEN
   old_claims := current_setting('request.jwt.claims',true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',auth.uid())::text,true);
   UPDATE public.profiles SET energy=max_energy,last_energy_restore=today WHERE id=prof.id RETURNING * INTO prof;
   PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
 END IF;
 RETURN prof;
END $$;
REVOKE EXECUTE ON FUNCTION public.restore_daily_energy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_daily_energy() TO authenticated, service_role;