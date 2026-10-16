REVOKE ALL ON public.match_question_secrets,public.match_question_issues FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.match_question_secrets,public.match_question_issues TO service_role;