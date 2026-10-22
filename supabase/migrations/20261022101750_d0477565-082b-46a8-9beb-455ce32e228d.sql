REVOKE ALL ON FUNCTION public.guard_single_active_match() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_single_active_match() TO service_role;
CREATE POLICY "Private search records" ON public.match_search_requests FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY "Private bot control" ON public.match_bot_state FOR ALL TO authenticated USING(false) WITH CHECK(false);