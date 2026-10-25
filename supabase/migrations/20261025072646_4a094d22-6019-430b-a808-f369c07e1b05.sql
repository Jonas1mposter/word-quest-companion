-- Runs as migration owner. All fixture edits are reverted by the outer subtransaction.
DO $test$
DECLARE
  pid uuid; uid uuid; other_pid uuid; col text; n integer; prof public.profiles%ROWTYPE;
  first_restore public.profiles%ROWTYPE; second_restore public.profiles%ROWTYPE;
  editable text[] := ARRAY['username','avatar_url','grade','class','grade_selected_at','background_type','background_value','lobby_card_image'];
BEGIN
  BEGIN
    SELECT id,user_id INTO pid,uid FROM public.profiles WHERE banned_until IS NULL ORDER BY id LIMIT 1;
    SELECT id INTO other_pid FROM public.profiles WHERE id <> pid ORDER BY id LIMIT 1;
    IF pid IS NULL OR other_pid IS NULL THEN RAISE EXCEPTION 'Missing profile fixtures'; END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',uid)::text,true);
    UPDATE public.profiles SET energy=0,last_energy_restore=((now() AT TIME ZONE 'UTC')::date-1)::text WHERE id=pid;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);
    PERFORM set_config('role','authenticated',true);

    -- Each current protected column must reject even a no-op PATCH, not silently report success.
    FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped AND NOT (attname=ANY(editable)) LOOP
      BEGIN
        EXECUTE format('UPDATE public.profiles SET %1$I=%1$I WHERE id=$1',col) USING pid;
        RAISE EXCEPTION 'Authenticated update unexpectedly allowed: %',col;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END LOOP;
    BEGIN
      UPDATE public.profiles SET background_value='forged',is_priority=true WHERE id=pid;
      RAISE EXCEPTION 'Mixed sensitive/preferences PATCH allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      INSERT INTO public.profiles(user_id,username,is_priority,ranked_wins) VALUES(uid,'forged',true,999);
      RAISE EXCEPTION 'Forged profile creation allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      DELETE FROM public.profiles WHERE id=pid;
      RAISE EXCEPTION 'Profile deletion allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    UPDATE public.profiles SET background_type='gradient',background_value='default' WHERE id=pid;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'Own background update blocked'; END IF;
    SELECT * INTO prof FROM public.profiles WHERE id=pid;
    IF prof.background_type<>'gradient' OR prof.background_value<>'default' THEN RAISE EXCEPTION 'Background readback failed'; END IF;
    UPDATE public.profiles SET background_value='forged' WHERE id=other_pid;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'Other player background changed'; END IF;

    SELECT * INTO first_restore FROM public.restore_daily_energy();
    SELECT * INTO second_restore FROM public.restore_daily_energy();
    IF first_restore.id<>pid OR first_restore.energy<>first_restore.max_energy OR first_restore.last_energy_restore<>(now() AT TIME ZONE 'UTC')::date::text THEN RAISE EXCEPTION 'Server daily restore failed'; END IF;
    IF to_jsonb(first_restore) IS DISTINCT FROM to_jsonb(second_restore) THEN RAISE EXCEPTION 'Daily restore not idempotent'; END IF;
    FOREACH col IN ARRAY ARRAY['bump_lifetime_coins(uuid,integer)','bump_ranked_win(uuid)','bump_perfect_clear(uuid)','bump_bot_win(uuid)','grant_special_badge(uuid,text)'] LOOP
      IF has_function_privilege('authenticated','public.'||col,'EXECUTE') OR has_function_privilege('anon','public.'||col,'EXECUTE') THEN RAISE EXCEPTION 'Reward helper exposed: %',col; END IF;
    END LOOP;

    PERFORM set_config('role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',uid)::text,true);
    -- Trusted server updates still persist, including counters and bans.
    UPDATE public.profiles SET ranked_wins=123,free_match_losses=124,perfect_clears=125,bot_wins=126,lifetime_coins_earned=127,total_login_days=128,leaderboard_appearances=129,ace_reach_count=130,is_priority=true,banned_until=now()+interval '1 day',ban_reason='permission test' WHERE id=pid;
    SELECT * INTO prof FROM public.profiles WHERE id=pid;
    IF prof.ranked_wins<>123 OR prof.free_match_losses<>124 OR prof.perfect_clears<>125 OR prof.bot_wins<>126 OR prof.lifetime_coins_earned<>127 OR prof.total_login_days<>128 OR prof.leaderboard_appearances<>129 OR prof.ace_reach_count<>130 OR NOT prof.is_priority OR prof.ban_reason<>'permission test' OR prof.banned_until<=now() THEN RAISE EXCEPTION 'Server profile update blocked'; END IF;
    PERFORM public.bump_ranked_win(pid);
    IF (SELECT ranked_wins FROM public.profiles WHERE id=pid)<>124 THEN RAISE EXCEPTION 'Trusted reward helper blocked'; END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);
    PERFORM set_config('role','authenticated',true);
    BEGIN
      PERFORM public.restore_daily_energy();
      RAISE EXCEPTION 'Banned caller restored energy';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='Rollback passing permission-test fixtures';
  EXCEPTION WHEN SQLSTATE 'PT001' THEN
    RAISE NOTICE 'PASS: every protected column denied; own backgrounds retained; other profiles isolated; daily restore idempotent; bans respected; trusted writes retained. Fixture changes rolled back.';
  END;
END;
$test$;