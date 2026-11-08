-- Transactional regression: every fixture mutation is rolled back.
DO $$
DECLARE pid uuid; uid uuid; admin_uid uuid; mid uuid; cid uuid; result jsonb; old_elo integer;
BEGIN
 BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
  IF admin_uid IS NULL THEN RAISE EXCEPTION 'Admin fixture required'; END IF;
  SELECT p.id,p.user_id,p.elo_rating INTO pid,uid,old_elo FROM public.profiles p WHERE NOT public.has_role(p.user_id,'admin') AND NOT EXISTS(SELECT 1 FROM public.ranked_matches m WHERE m.status='in_progress' AND p.id=ANY(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id])) AND NOT EXISTS(SELECT 1 FROM public.dac_review_cases c WHERE c.profile_id=p.id AND c.status IN ('pending','upheld')) ORDER BY p.id LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Idle player fixture required'; END IF;
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  INSERT INTO public.ranked_matches(player1_id,grade,status,mode,match_type,question_count,words,started_at) VALUES(pid,7,'in_progress','1v1','ranked',4,'[{"word":"apple","meaning":"苹果"}]',now()) RETURNING id INTO mid;
  PERFORM public.void_dac_match_rank(mid,pid,'synthetic_input');
  PERFORM public.void_dac_match_rank(mid,pid,'synthetic_input');
  SELECT id INTO cid FROM public.dac_review_cases WHERE profile_id=pid AND match_id=mid;
  IF cid IS NULL OR (SELECT count(*) FROM public.dac_review_cases WHERE match_id=mid)<>1 THEN RAISE EXCEPTION 'Case missing or duplicated'; END IF;
  UPDATE public.ranked_matches SET status='completed' WHERE id=mid;
  BEGIN
   INSERT INTO public.ranked_matches(player1_id,grade,status,mode,match_type) VALUES(pid,7,'waiting','1v1','ranked');
   RAISE EXCEPTION 'Pending player admitted to ranked';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'DAC_REVIEW_REQUIRED:%' THEN RAISE; END IF; END;
  INSERT INTO public.ranked_matches(player1_id,grade,status,mode,match_type) VALUES(pid,7,'waiting','1v1','free');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  BEGIN PERFORM public.admin_dac_review_detail(cid); RAISE EXCEPTION 'Player read admin evidence';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Admin only' THEN RAISE; END IF; END;
  BEGIN PERFORM public.admin_dac_review_decide(cid,'released','forged'); RAISE EXCEPTION 'Player released self';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Admin only' THEN RAISE; END IF; END;
  IF has_table_privilege('authenticated','public.dac_review_cases','UPDATE') OR has_table_privilege('authenticated','public.dac_review_decisions','INSERT') THEN RAISE EXCEPTION 'Client write privileges'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_uid,'role','authenticated')::text,true);
  BEGIN PERFORM public.admin_dac_review_decide(cid,'released',' '); RAISE EXCEPTION 'Blank reason accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Decision and review reason required' THEN RAISE; END IF; END;
  result=public.admin_dac_review_detail(cid);
  IF result->'case'->>'id'<>cid::text OR result->'match' ? 'words' THEN RAISE EXCEPTION 'Wrong detail or future answers leaked'; END IF;
  PERFORM public.admin_dac_review_decide(cid,'upheld','需进一步核查');
  PERFORM public.admin_dac_review_decide(cid,'released','人工核查通过');
  PERFORM public.admin_dac_review_decide(cid,'released','重复请求不覆盖');
  IF (SELECT count(*) FROM public.dac_review_decisions WHERE case_id=cid)<>2 THEN RAISE EXCEPTION 'Decision audit overwritten or duplicate'; END IF;
  IF (SELECT review_note FROM public.dac_review_cases WHERE id=cid)<>'人工核查通过' THEN RAISE EXCEPTION 'Retry overwrote decision'; END IF;
  IF NOT (SELECT rank_voided FROM public.ranked_matches WHERE id=mid) OR (SELECT elo_rating FROM public.profiles WHERE id=pid)<>old_elo THEN RAISE EXCEPTION 'Release restored old rank'; END IF;
  INSERT INTO public.ranked_matches(player1_id,grade,status,mode,match_type) VALUES(pid,7,'waiting','1v1','ranked');
  RAISE EXCEPTION 'ROLLBACK_DAC_REVIEW_OK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_DAC_REVIEW_OK' THEN RAISE; END IF; END;
END $$;