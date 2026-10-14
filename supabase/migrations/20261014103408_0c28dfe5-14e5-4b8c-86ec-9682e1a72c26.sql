CREATE TABLE public.username_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_username text NOT NULL,
  new_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.username_requests TO authenticated;
GRANT ALL ON public.username_requests TO service_role;
ALTER TABLE public.username_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.username_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE UNIQUE INDEX username_requests_one_pending ON public.username_requests(profile_id) WHERE status='pending';

CREATE OR REPLACE FUNCTION public.guard_username_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username
     AND COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role','') <> 'service_role'
     AND COALESCE(current_setting('app.allow_username', true),'') <> '1'
     AND NOT (OLD.username = split_part(OLD.user_id::text,'-',1) OR OLD.username LIKE 'user\_%')
  THEN NEW.username := OLD.username; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_username_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_username_change();

CREATE OR REPLACE FUNCTION public.request_username_change(p_new text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p profiles;
BEGIN
  SELECT * INTO p FROM profiles WHERE user_id = auth.uid();
  IF p.id IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  p_new := btrim(p_new);
  IF p_new = '' OR char_length(p_new) > 20 THEN RAISE EXCEPTION 'invalid name'; END IF;
  IF p_new = p.username THEN RAISE EXCEPTION 'same name'; END IF;
  DELETE FROM username_requests WHERE profile_id = p.id AND status = 'pending';
  INSERT INTO username_requests(profile_id, old_username, new_username) VALUES (p.id, p.username, p_new);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.review_username_request(p_request_id uuid, p_approve boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r username_requests;
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM username_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_approve THEN
    PERFORM set_config('app.allow_username','1',true);
    UPDATE profiles SET username = r.new_username WHERE id = r.profile_id;
  END IF;
  UPDATE username_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = now() WHERE id = r.id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.request_username_change(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_username_request(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_username_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_username_change(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_username_request(uuid,boolean) TO authenticated;