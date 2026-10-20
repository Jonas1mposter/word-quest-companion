-- All fixture changes roll back; no rewards or real matches remain.
DO $$
DECLARE ids uuid[]; pid uuid; uid uuid; mid uuid;
BEGIN
 BEGIN
  SELECT array_agg(id) INTO ids FROM (SELECT p.id FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.ranked_matches m WHERE m.status='in_progress' AND p.id=ANY(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id])) ORDER BY p.id LIMIT 3) q;
  IF cardinality(ids)<>3 THEN RAISE EXCEPTION 'Three inactive fixture profiles required'; END IF;
  DELETE FROM public.match_queue WHERE profile_id=ANY(ids);
  SELECT user_id INTO uid FROM profiles WHERE id=ids[1];
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  mid=public.find_match_2v2(ids[1],997,1000,'math',NULL);
  IF mid IS NOT NULL THEN RAISE EXCEPTION 'Unexpected fixture opponent'; END IF;
  SELECT user_id INTO uid FROM profiles WHERE id=ids[2];
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  mid=public.find_match(ids[2],997,'ranked',1000,'math');
  IF mid IS NOT NULL THEN RAISE EXCEPTION '1v1 consumed 2v2 player'; END IF;
  IF NOT EXISTS(SELECT 1 FROM match_queue WHERE profile_id=ids[1] AND mode='2v2' AND status='searching') THEN RAISE EXCEPTION '2v2 queue lost'; END IF;
  SELECT user_id INTO uid FROM profiles WHERE id=ids[3];
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  mid=public.find_match(ids[3],997,'ranked',1000,'math');
  IF mid IS NULL OR NOT EXISTS(SELECT 1 FROM ranked_matches WHERE id=mid AND mode='1v1' AND player1_id=ids[2] AND player2_id=ids[3]) THEN RAISE EXCEPTION 'Valid 1v1 failed'; END IF;
  RAISE EXCEPTION 'ROLLBACK_MODE_ISOLATION_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_MODE_ISOLATION_OK' THEN RAISE; END IF;
 END;
END $$;