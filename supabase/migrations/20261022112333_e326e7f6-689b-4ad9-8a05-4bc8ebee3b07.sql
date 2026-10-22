REVOKE ALL ON public.roguelike_runs,public.roguelike_questions,public.roguelike_rewards FROM anon,authenticated;
CREATE POLICY "Server manages rogue runs" ON public.roguelike_runs FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "Server manages rogue questions" ON public.roguelike_questions FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "Server manages rogue rewards" ON public.roguelike_rewards FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION public.rogue_issue(p_run uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.roguelike_runs; w record; choices jsonb; k text;
BEGIN
 SELECT * INTO STRICT r FROM public.roguelike_runs WHERE id=p_run;
 IF EXISTS(SELECT 1 FROM public.roguelike_questions WHERE run_id=p_run AND idx=r.answered) THEN RETURN; END IF;
 IF r.grade>=9 THEN
  SELECT word,meaning INTO w FROM public.hs_words h WHERE grade BETWEEN 9 AND 12 AND subject='sat' AND length(meaning)>0 AND NOT EXISTS(SELECT 1 FROM public.roguelike_questions q WHERE q.run_id=p_run AND q.target=h.word) ORDER BY random() LIMIT 1;
 ELSE
  SELECT word,meaning INTO w FROM public.words h WHERE grade=r.grade AND length(meaning)>0 AND NOT EXISTS(SELECT 1 FROM public.roguelike_questions q WHERE q.run_id=p_run AND q.target=h.word) ORDER BY random() LIMIT 1;
 END IF;
 IF w.word IS NULL THEN RAISE EXCEPTION '该年级词库不足，请联系管理员'; END IF;
 SELECT jsonb_agg(meaning ORDER BY random()) INTO choices FROM (
  SELECT w.meaning AS meaning UNION ALL
  SELECT meaning FROM (SELECT meaning FROM (
   SELECT DISTINCT meaning FROM public.words WHERE meaning<>w.meaning AND length(meaning)>0
   UNION SELECT DISTINCT meaning FROM public.hs_words WHERE subject='sat' AND meaning<>w.meaning AND length(meaning)>0
  ) d ORDER BY random() LIMIT 3) distractors
 ) options;
 k:=CASE WHEN r.answered%3=2 THEN 'listening' ELSE 'choice' END;
 INSERT INTO public.roguelike_questions(run_id,idx,kind,prompt,options,target,answer)
 VALUES(p_run,r.answered,k,CASE WHEN k='listening' THEN '' ELSE w.word END,choices,w.word,w.meaning);
END $$;