CREATE OR REPLACE FUNCTION public.champions_lottery_tier(p_roll double precision, p_draws integer, p_owned boolean, p_at timestamp with time zone DEFAULT now())
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT public.champions_lottery_tier(p_roll::numeric, p_draws, p_owned, p_at) $$;
GRANT EXECUTE ON FUNCTION public.champions_lottery_tier(double precision, integer, boolean, timestamp with time zone) TO anon, authenticated, service_role;