CREATE OR REPLACE FUNCTION public.claim_match_completion(p_match_id uuid,p_winner_id uuid,p_winner_team integer,p_score1 integer,p_score2 integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 SELECT * INTO m FROM ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('claimed',false,'rankVoided',m.rank_voided); END IF;
 IF m.status<>'in_progress' THEN RAISE EXCEPTION 'Match not active'; END IF;
 UPDATE ranked_matches SET status='completed',ended_at=now(),winner_id=p_winner_id,winner_team=p_winner_team,
 player1_score=CASE WHEN mode='2v2' THEN player1_score ELSE p_score1 END,
 player2_score=CASE WHEN mode='2v2' THEN player2_score ELSE p_score2 END,
 team1_score=CASE WHEN mode='2v2' THEN p_score1 ELSE team1_score END,
 team2_score=CASE WHEN mode='2v2' THEN p_score2 ELSE team2_score END WHERE id=m.id;
 RETURN jsonb_build_object('claimed',true,'rankVoided',m.rank_voided);
END $$;
REVOKE ALL ON FUNCTION public.claim_match_completion(uuid,uuid,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_completion(uuid,uuid,integer,integer,integer) TO service_role;