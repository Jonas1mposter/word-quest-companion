ALTER FUNCTION public.glory_crown_draw(uuid) SET SCHEMA lottery_private;
REVOKE ALL ON FUNCTION lottery_private.glory_crown_draw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lottery_private.glory_crown_draw(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.glory_crown_draw(p_item_id uuid)
RETURNS jsonb LANGUAGE sql SET search_path TO 'public' AS $$ SELECT lottery_private.glory_crown_draw(p_item_id) $$;
REVOKE ALL ON FUNCTION public.glory_crown_draw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.glory_crown_draw(uuid) TO authenticated, service_role;