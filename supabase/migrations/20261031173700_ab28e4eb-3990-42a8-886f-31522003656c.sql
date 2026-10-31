ALTER TABLE public.ranked_matches ADD COLUMN rank_voided boolean NOT NULL DEFAULT false;
REVOKE UPDATE(rank_voided) ON public.ranked_matches FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.void_dac_match_rank(p_match_id uuid,p_profile_id uuid,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 IF p_reason NOT IN ('synthetic_input','synthetic_click','fixed_answer_timing','tab_switch_limit','background_away') THEN RAISE EXCEPTION 'Not a DAC kick'; END IF;
 SELECT * INTO m FROM ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF NOT (p_profile_id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL))) THEN RAISE EXCEPTION 'Not in match'; END IF;
 IF m.match_type<>'ranked' THEN RETURN false; END IF;
 IF m.status='completed' THEN RETURN m.rank_voided; END IF;
 UPDATE ranked_matches SET rank_voided=true WHERE id=m.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.void_dac_match_rank(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.void_dac_match_rank(uuid,uuid,text) TO service_role;
DO $$ DECLARE d text; old text; replacement text; BEGIN
 SELECT pg_get_functiondef('public.settle_fallback_rank(uuid,integer,uuid)'::regprocedure) INTO d;
 old='IF m.match_type<>''ranked'' THEN RETURN results; END IF;';
 replacement=old||E'\n IF m.rank_voided THEN\n  FOR p IN SELECT * FROM profiles WHERE id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL)) LOOP\n   results=results||jsonb_build_object(p.id::text,jsonb_build_object(''eloDelta'',0,''rankVoided'',true,''shielded'',false,''coinsEarned'',0,''xpEarned'',0));\n  END LOOP;\n  UPDATE match_bot_state SET rank_results=results WHERE match_id=p_match;\n  RETURN results;\n END IF;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Fallback patch target missing'; END IF;
 EXECUTE replace(d,old,replacement);
 SELECT pg_get_functiondef('public.complete_empty_match(uuid,uuid)'::regprocedure) INTO d;
 old='IF p_forfeiter_id IS NOT NULL THEN';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Empty patch target missing'; END IF;
 EXECUTE replace(d,old,'IF p_forfeiter_id IS NOT NULL AND NOT m.rank_voided THEN');
END $$;