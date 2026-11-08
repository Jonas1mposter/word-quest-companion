INSERT INTO public.dac_review_cases(profile_id,match_id,reason,created_at)
SELECT DISTINCT ON(f.profile_id,m.id) f.profile_id,m.id,f.meta->>'reason',f.created_at
FROM public.dac_flags f JOIN public.ranked_matches m ON m.id::text=coalesce(f.meta->>'match_id',f.meta->>'matchId')
WHERE m.rank_voided AND m.match_type='ranked' AND f.source='bot_input'
AND f.meta->>'reason' IN ('synthetic_input','synthetic_click','fixed_answer_timing','tab_switch_limit','background_away')
AND f.profile_id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL))
ORDER BY f.profile_id,m.id,f.created_at
ON CONFLICT(profile_id,match_id) DO NOTHING;