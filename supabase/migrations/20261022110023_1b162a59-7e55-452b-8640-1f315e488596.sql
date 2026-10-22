CREATE OR REPLACE FUNCTION public.hw_issue(p_match uuid, p_slot int, p_idx int, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_meaning text; v_opts text[]; v_flags text[] := '{}'; v_eff text[];
BEGIN
  IF p_idx >= 30 THEN RETURN; END IF;
  IF p_grade >= 9 THEN
    SELECT word, meaning INTO v_word, v_meaning FROM hs_words
     WHERE grade BETWEEN 9 AND 12 AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM halloween_questions WHERE match_id=p_match AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    SELECT array_agg(m) INTO v_opts FROM (SELECT m FROM (SELECT DISTINCT meaning m FROM hs_words WHERE grade BETWEEN 9 AND 12 AND meaning <> v_meaning AND coalesce(meaning,'')<>'') d ORDER BY random() LIMIT 3) s;
  ELSE
    SELECT word, meaning INTO v_word, v_meaning FROM words
     WHERE grade = p_grade AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM halloween_questions WHERE match_id=p_match AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    IF v_word IS NULL THEN
      SELECT word, meaning INTO v_word, v_meaning FROM words WHERE coalesce(meaning,'')<>'' ORDER BY random() LIMIT 1;
    END IF;
    SELECT array_agg(m) INTO v_opts FROM (SELECT m FROM (SELECT DISTINCT meaning m FROM words WHERE grade = p_grade AND meaning <> v_meaning AND coalesce(meaning,'')<>'') d ORDER BY random() LIMIT 3) s;
  END IF;
  v_opts := coalesce(v_opts,'{}') || v_meaning;
  SELECT array_agg(o ORDER BY random()) INTO v_opts FROM unnest(v_opts) o;
  SELECT effects INTO v_eff FROM halloween_players WHERE match_id=p_match AND slot=p_slot FOR UPDATE;
  IF 'pumpkin' = ANY(v_eff) THEN v_flags := v_flags || 'pumpkin'::text; v_eff := array_remove(v_eff,'pumpkin'); END IF;
  IF 'ghost' = ANY(v_eff) THEN v_flags := v_flags || 'ghost'::text; v_eff := array_remove(v_eff,'ghost'); END IF;
  UPDATE halloween_players SET effects = v_eff WHERE match_id=p_match AND slot=p_slot;
  INSERT INTO halloween_questions(match_id, slot, idx, prompt, options, answer, flags)
  VALUES (p_match, p_slot, p_idx, v_word, to_jsonb(v_opts), v_meaning, v_flags) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.hw_issue(uuid,int,int,int) FROM PUBLIC, anon, authenticated;