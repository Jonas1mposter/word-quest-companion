DO $$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef('public.use_hs_words_for_hs_matches()'::regprocedure) INTO fn;
 IF position('LIMIT 10' in fn)=0 THEN RAISE EXCEPTION 'Unexpected high-school selector'; END IF;
 fn=replace(fn,'LIMIT 10','LIMIT (CASE WHEN NEW.mode = ''2v2'' THEN 15 ELSE 10 END)');
 EXECUTE fn;
END $$;