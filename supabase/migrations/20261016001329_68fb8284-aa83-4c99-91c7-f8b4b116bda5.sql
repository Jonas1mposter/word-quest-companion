ALTER FUNCTION public.get_lottery_state(text) SECURITY INVOKER;
CREATE SCHEMA IF NOT EXISTS lottery_private;
REVOKE ALL ON SCHEMA lottery_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA lottery_private TO authenticated,service_role;
ALTER FUNCTION public.purchase_lottery_ticket(text,boolean) SET SCHEMA lottery_private;
CREATE FUNCTION public.purchase_lottery_ticket(p_pool_id text,p_discounted boolean) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lottery_private.purchase_lottery_ticket(p_pool_id,p_discounted) $$;
REVOKE ALL ON FUNCTION public.purchase_lottery_ticket(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_lottery_ticket(text,boolean) TO authenticated,service_role;