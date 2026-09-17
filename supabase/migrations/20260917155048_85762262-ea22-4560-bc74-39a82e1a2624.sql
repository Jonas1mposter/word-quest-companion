CREATE OR REPLACE FUNCTION public.use_hs_words_for_hs_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subj text := COALESCE(NEW.subject, 'mixed');
  _target text;
  _words jsonb;
BEGIN
  IF COALESCE(NEW.grade, 7) < 9 THEN
    RETURN NEW;
  END IF;

  _target := CASE
    WHEN _subj IN ('economics','physics','chemistry','biology') THEN _subj
    WHEN _subj = 'hsmath' THEN 'math'
    ELSE NULL
  END;

  SELECT jsonb_agg(row_to_json(w)) INTO _words
  FROM (
    SELECT id, word, meaning, phonetic, example
    FROM hs_words
    WHERE (_target IS NULL OR subject = _target)
    ORDER BY random()
    LIMIT 10
  ) w;

  IF _words IS NOT NULL AND jsonb_array_length(_words) > 0 THEN
    NEW.words := _words;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_use_hs_words_for_hs_matches ON public.ranked_matches;
CREATE TRIGGER trg_use_hs_words_for_hs_matches
BEFORE INSERT ON public.ranked_matches
FOR EACH ROW EXECUTE FUNCTION public.use_hs_words_for_hs_matches();