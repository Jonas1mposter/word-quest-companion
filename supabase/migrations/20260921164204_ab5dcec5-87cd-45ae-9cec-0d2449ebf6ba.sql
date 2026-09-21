CREATE OR REPLACE FUNCTION public.use_hs_words_for_hs_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _subj text := COALESCE(NEW.subject, 'mixed');
  _grade int := COALESCE(NEW.grade, 7);
  _target text;
  _words jsonb;
BEGIN
  IF _grade BETWEEN 7 AND 8 THEN
    RETURN NEW;
  END IF;

  IF _grade >= 9 THEN
    _grade := 9;
    _target := CASE
      WHEN _subj IN ('economics','physics','chemistry','biology') THEN _subj
      WHEN _subj = 'hsmath' THEN 'math'
      ELSE NULL
    END;
  ELSE
    _target := CASE WHEN _subj IN ('science','math') THEN _subj ELSE NULL END;
  END IF;

  SELECT jsonb_agg(row_to_json(w)) INTO _words
  FROM (
    SELECT id, word, meaning, phonetic, example
    FROM hs_words
    WHERE grade = _grade
      AND (_target IS NULL OR subject = _target)
    ORDER BY random()
    LIMIT 10
  ) w;

  IF _words IS NOT NULL AND jsonb_array_length(_words) > 0 THEN
    NEW.words := _words;
  END IF;

  RETURN NEW;
END;
$function$;