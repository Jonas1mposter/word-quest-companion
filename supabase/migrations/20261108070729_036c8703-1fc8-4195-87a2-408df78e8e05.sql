REVOKE ALL ON FUNCTION public.dac_ranked_review_gate(),public.dac_queue_review_gate(),public.dac_review_touch() FROM PUBLIC,anon,authenticated;
CREATE TABLE public.dac_review_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.dac_review_cases(id) ON DELETE CASCADE,
 reviewer_id uuid NOT NULL,decision text NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dac_review_decisions TO authenticated;
GRANT ALL ON public.dac_review_decisions TO service_role;
REVOKE ALL ON public.dac_review_decisions FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.dac_review_decisions FROM authenticated;
ALTER TABLE public.dac_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dac_decisions_admin_read ON public.dac_review_decisions FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.dac_review_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.dac_review_decisions(case_id,reviewer_id,decision,note) VALUES(NEW.id,NEW.reviewer_id,NEW.status,NEW.review_note); END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.dac_review_audit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dac_review_audit_decision AFTER UPDATE ON public.dac_review_cases FOR EACH ROW EXECUTE FUNCTION public.dac_review_audit();
CREATE TRIGGER dac_review_decision_updated BEFORE UPDATE ON public.dac_review_decisions FOR EACH ROW EXECUTE FUNCTION public.dac_review_touch();
COMMENT ON FUNCTION public.admin_dac_review_list(text,text,integer) IS 'Intentional authenticated SECURITY DEFINER entry point: checks has_role(auth.uid(), admin) before accessing review data.';
COMMENT ON FUNCTION public.admin_dac_review_detail(uuid) IS 'Intentional authenticated SECURITY DEFINER entry point: checks has_role(auth.uid(), admin); returns submitted answers only and sanitized flag metrics.';
COMMENT ON FUNCTION public.admin_dac_review_decide(uuid,text,text) IS 'Intentional authenticated SECURITY DEFINER entry point: checks has_role(auth.uid(), admin), row locks, preserves separate decision audit; never writes profiles or match rewards.';