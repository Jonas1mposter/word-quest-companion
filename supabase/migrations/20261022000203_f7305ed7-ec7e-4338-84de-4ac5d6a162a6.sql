CREATE OR REPLACE FUNCTION public.leaderboard_xp_excluded_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT 'bcfb301e-e3e6-48cd-9ef6-6b42dcee8326'::uuid
$$;