DO $$ BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET banned_until = NULL, ban_reason = NULL
  WHERE id IN ('dbf5877b-d07e-4def-87b5-9b76eaf0f5d1','c457ac22-0540-473b-94b9-bb5f2713e106','15a5b0fc-a058-4de1-b3d3-421d99055802');
END $$;