CREATE OR REPLACE FUNCTION public.handle_team_join_request(_request_id uuid, _accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_profile uuid;
  req record;
  team_rec record;
  member_count int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT id INTO caller_profile FROM profiles WHERE user_id = caller;
  IF caller_profile IS NULL THEN RAISE EXCEPTION 'profile missing'; END IF;

  SELECT * INTO req FROM team_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request already handled'; END IF;

  SELECT * INTO team_rec FROM teams WHERE id = req.team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'team not found'; END IF;

  IF team_rec.captain_id <> caller_profile THEN
    RAISE EXCEPTION 'only captain can handle requests';
  END IF;

  IF _accept THEN
    SELECT count(*) INTO member_count FROM team_members WHERE team_id = team_rec.id;
    IF member_count >= COALESCE(team_rec.max_members, 10) THEN
      RAISE EXCEPTION 'team is full';
    END IF;

    INSERT INTO team_members (team_id, profile_id, role)
    VALUES (team_rec.id, req.profile_id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE team_join_requests
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END
    WHERE id = _request_id;

  RETURN jsonb_build_object('ok', true, 'accepted', _accept);
END;
$function$;