REVOKE EXECUTE ON FUNCTION public.dac_flag(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dac_flag(uuid, text, text, text, jsonb) TO service_role;