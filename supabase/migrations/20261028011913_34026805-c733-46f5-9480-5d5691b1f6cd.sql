CREATE OR REPLACE FUNCTION public.tb_issue(p_series uuid, p_game int, p_side int, p_slot int, p_idx int, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_meaning text; v_opts text[];
BEGIN
  IF p_idx >= 50 THEN RETURN; END IF;
  IF p_grade >= 9 THEN
    SELECT word, meaning INTO v_word, v_meaning FROM hs_words
     WHERE grade BETWEEN 9 AND 12 AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM tb_questions WHERE series_id=p_series AND game_no=p_game AND side=p_side AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    SELECT array_agg(m) INTO v_opts FROM (SELECT m FROM (SELECT DISTINCT meaning m FROM hs_words WHERE grade BETWEEN 9 AND 12 AND meaning <> v_meaning AND coalesce(meaning,'')<>'') d ORDER BY random() LIMIT 3) s;
  ELSE
    SELECT word, meaning INTO v_word, v_meaning FROM words
     WHERE grade = p_grade AND coalesce(meaning,'') <> ''
       AND word NOT IN (SELECT prompt FROM tb_questions WHERE series_id=p_series AND game_no=p_game AND side=p_side AND slot=p_slot)
     ORDER BY random() LIMIT 1;
    IF v_word IS NULL THEN
      SELECT word, meaning INTO v_word, v_meaning FROM words WHERE coalesce(meaning,'')<>'' ORDER BY random() LIMIT 1;
    END IF;
    SELECT array_agg(m) INTO v_opts FROM (SELECT m FROM (SELECT DISTINCT meaning m FROM words WHERE grade = p_grade AND meaning <> v_meaning AND coalesce(meaning,'')<>'') d ORDER BY random() LIMIT 3) s;
  END IF;
  IF v_word IS NULL THEN RETURN; END IF;
  v_opts := coalesce(v_opts,'{}') || v_meaning;
  SELECT array_agg(o ORDER BY random()) INTO v_opts FROM unnest(v_opts) o;
  INSERT INTO tb_questions(series_id, game_no, side, slot, idx, prompt, options, answer)
  VALUES (p_series, p_game, p_side, p_slot, p_idx, v_word, to_jsonb(v_opts), v_meaning) ON CONFLICT DO NOTHING;
END $$;