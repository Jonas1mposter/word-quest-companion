CREATE OR REPLACE FUNCTION public.get_hs_grade_challenge()
RETURNS TABLE(grade integer, member_count integer, total_xp bigint, total_levels_completed integer, total_correct integer, total_answered integer, composite_score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH g AS (SELECT generate_series(9,12) AS grade),
  p AS (
    SELECT pr.id, pr.grade, pr.total_xp FROM profiles pr
    WHERE pr.grade BETWEEN 9 AND 12
      AND pr.id NOT IN (SELECT public.leaderboard_excluded_ids())
      AND (pr.banned_until IS NULL OR pr.banned_until < now())
  ),
  lv AS (SELECT lp.profile_id, count(*)::int c FROM level_progress lp WHERE lp.status='completed' GROUP BY 1),
  ac AS (SELECT h.profile_id, sum(h.correct_count)::int c, sum(h.correct_count+h.incorrect_count)::int t FROM hs_learning_progress h GROUP BY 1),
  agg AS (
    SELECT p.grade, count(*)::int m, coalesce(sum(p.total_xp),0)::bigint xp,
      coalesce(sum(lv.c),0)::int lvls, coalesce(sum(ac.c),0)::int cor, coalesce(sum(ac.t),0)::int tot
    FROM p LEFT JOIN lv ON lv.profile_id=p.id LEFT JOIN ac ON ac.profile_id=p.id GROUP BY p.grade
  )
  SELECT g.grade, coalesce(a.m,0), coalesce(a.xp,0), coalesce(a.lvls,0), coalesce(a.cor,0), coalesce(a.tot,0),
    CASE WHEN coalesce(a.m,0)=0 THEN 0
      ELSE round((a.xp::numeric/a.m) + 20*(a.lvls::numeric/a.m)
        + 200*CASE WHEN a.tot>0 THEN a.cor::numeric/a.tot ELSE 0 END, 1) END
  FROM g LEFT JOIN agg a ON a.grade=g.grade
  ORDER BY 7 DESC, 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_hs_grade_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hs_grade_challenge() TO authenticated;