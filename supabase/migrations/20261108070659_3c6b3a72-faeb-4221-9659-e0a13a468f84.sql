CREATE TABLE public.dac_review_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 match_id uuid NOT NULL REFERENCES public.ranked_matches(id) ON DELETE CASCADE,
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 reviewer_id uuid,
 review_note text,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(profile_id,match_id)
);
GRANT SELECT ON public.dac_review_cases TO authenticated;
GRANT ALL ON public.dac_review_cases TO service_role;
REVOKE ALL ON public.dac_review_cases FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.dac_review_cases FROM authenticated;
ALTER TABLE public.dac_review_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY dac_review_read ON public.dac_review_cases FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));
CREATE INDEX dac_review_open_profile ON public.dac_review_cases(profile_id,status);
CREATE INDEX dac_review_created ON public.dac_review_cases(created_at DESC);
CREATE FUNCTION public.dac_review_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER dac_review_updated BEFORE UPDATE ON public.dac_review_cases FOR EACH ROW EXECUTE FUNCTION public.dac_review_touch();

CREATE OR REPLACE FUNCTION public.void_dac_match_rank(p_match_id uuid,p_profile_id uuid,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 IF p_reason NOT IN ('synthetic_input','synthetic_click','fixed_answer_timing','tab_switch_limit','background_away') THEN RAISE EXCEPTION 'Not a DAC kick'; END IF;
 SELECT * INTO m FROM ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF NOT (p_profile_id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL))) THEN RAISE EXCEPTION 'Not in match'; END IF;
 IF m.match_type<>'ranked' THEN RETURN false; END IF;
 IF m.status='completed' THEN RETURN m.rank_voided; END IF;
 INSERT INTO public.dac_review_cases(profile_id,match_id,reason) VALUES(p_profile_id,m.id,p_reason) ON CONFLICT(profile_id,match_id) DO NOTHING;
 UPDATE ranked_matches SET rank_voided=true WHERE id=m.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.void_dac_match_rank(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.void_dac_match_rank(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.dac_ranked_review_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.match_type='ranked' AND EXISTS(SELECT 1 FROM public.dac_review_cases c WHERE c.profile_id=ANY(array_remove(ARRAY[NEW.player1_id,NEW.player2_id,NEW.player3_id,NEW.player4_id],NULL)) AND c.status IN ('pending','upheld')) THEN
  RAISE EXCEPTION 'DAC_REVIEW_REQUIRED: 排位资格待管理员复核';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dac_review_match_gate BEFORE INSERT OR UPDATE OF player1_id,player2_id,player3_id,player4_id,match_type ON public.ranked_matches FOR EACH ROW EXECUTE FUNCTION public.dac_ranked_review_gate();
CREATE FUNCTION public.dac_queue_review_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.match_type='ranked' AND EXISTS(SELECT 1 FROM public.dac_review_cases WHERE profile_id=NEW.profile_id AND status IN ('pending','upheld')) THEN RAISE EXCEPTION 'DAC_REVIEW_REQUIRED: 排位资格待管理员复核'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dac_review_queue_gate BEFORE INSERT OR UPDATE OF profile_id,match_type ON public.match_queue FOR EACH ROW EXECUTE FUNCTION public.dac_queue_review_gate();

CREATE FUNCTION public.admin_dac_review_list(p_status text DEFAULT 'pending',p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_status NOT IN ('all','pending','upheld','released') OR p_offset<0 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
 SELECT jsonb_build_object('total',count(*)) INTO result FROM dac_review_cases c JOIN profiles p ON p.id=c.profile_id WHERE (p_status='all' OR c.status=p_status) AND (p.username ILIKE '%'||left(p_search,100)||'%' OR c.profile_id::text ILIKE '%'||left(p_search,100)||'%');
 RETURN result || jsonb_build_object('cases',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT c.*,p.username,p.grade FROM dac_review_cases c JOIN profiles p ON p.id=c.profile_id WHERE (p_status='all' OR c.status=p_status) AND (p.username ILIKE '%'||left(p_search,100)||'%' OR c.profile_id::text ILIKE '%'||left(p_search,100)||'%') ORDER BY c.created_at DESC,c.id LIMIT 30 OFFSET p_offset) x),'[]'::jsonb));
END $$;

CREATE FUNCTION public.admin_dac_review_detail(p_case_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c dac_review_cases; result jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
 SELECT * INTO c FROM dac_review_cases WHERE id=p_case_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
 SELECT jsonb_build_object('case',to_jsonb(c)||jsonb_build_object('username',p.username,'grade',p.grade,'banned_until',p.banned_until),'reviewer',rp.username,'match',jsonb_build_object('mode',m.mode,'status',m.status,'started_at',m.started_at,'ended_at',m.ended_at,'rank_voided',m.rank_voided)) INTO result FROM profiles p JOIN ranked_matches m ON m.id=c.match_id LEFT JOIN profiles rp ON rp.user_id=c.reviewer_id WHERE p.id=c.profile_id;
 RETURN result || jsonb_build_object(
 'answers',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT a.question_index,a.answer,a.is_correct,a.answered_at,i.issued_at,i.question_type,CASE WHEN i.issued_at IS NOT NULL THEN greatest(0,round(extract(epoch FROM (a.answered_at-i.issued_at))*1000)) END elapsed_ms FROM match_answers a LEFT JOIN match_question_issues i ON i.match_id=a.match_id AND i.profile_id=a.player_id AND i.question_index=a.question_index WHERE a.match_id=c.match_id AND a.player_id=c.profile_id ORDER BY a.question_index LIMIT 1000) x),'[]'::jsonb),
 'flags',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT f.id,f.source,f.reason,f.severity,f.created_at,(f.meta->>'matchId'=c.match_id::text OR f.meta->>'match_id'=c.match_id::text) AS linked_to_match, (SELECT coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) FROM jsonb_each(f.meta) e WHERE e.key IN ('elapsedMs','perWordMs','questionIndex','count','awayMs','samples','meanMs','stdMs','mode','match_type','reviewOnly','clientReported','reason')) AS metrics FROM dac_flags f WHERE f.profile_id=c.profile_id AND (f.meta->>'matchId'=c.match_id::text OR f.meta->>'match_id'=c.match_id::text OR f.created_at BETWEEN c.created_at-interval '15 minutes' AND c.created_at+interval '1 minute') ORDER BY f.created_at DESC LIMIT 100) x),'[]'::jsonb));
END $$;

CREATE FUNCTION public.admin_dac_review_decide(p_case_id uuid,p_decision text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c dac_review_cases;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_decision NOT IN ('released','upheld') OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Decision and review reason required'; END IF;
 SELECT * INTO c FROM dac_review_cases WHERE id=p_case_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
 IF c.status=p_decision THEN RETURN to_jsonb(c); END IF;
 IF c.status='released' OR (c.status='upheld' AND p_decision<>'released') THEN RAISE EXCEPTION 'Case already reviewed'; END IF;
 UPDATE dac_review_cases SET status=p_decision,reviewer_id=auth.uid(),review_note=btrim(p_note),reviewed_at=now() WHERE id=c.id RETURNING * INTO c;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.admin_dac_review_list(text,text,integer),public.admin_dac_review_detail(uuid),public.admin_dac_review_decide(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_dac_review_list(text,text,integer),public.admin_dac_review_detail(uuid),public.admin_dac_review_decide(uuid,text,text) TO authenticated;
