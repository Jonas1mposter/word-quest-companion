REVOKE ALL ON public.match_bot_state,public.match_search_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.match_bot_state,public.match_search_requests TO service_role;