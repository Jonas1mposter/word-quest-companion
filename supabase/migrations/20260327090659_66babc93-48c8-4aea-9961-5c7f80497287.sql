
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _grade integer := 7;
  _email text;
BEGIN
  _email := LOWER(COALESCE(NEW.email, ''));
  
  -- Auto-detect grade from email pattern like STUDENTS_Grade_7_...@domain or STUDENTS_Grade_8_...@domain
  IF _email LIKE '%grade_8%' THEN
    _grade := 8;
  ELSIF _email LIKE '%grade_7%' THEN
    _grade := 7;
  END IF;

  INSERT INTO public.profiles (user_id, username, grade)
  VALUES (
    NEW.id,
    COALESCE(split_part(NEW.email, '@', 1), 'user_' || substr(NEW.id::text, 1, 8)),
    _grade
  );
  RETURN NEW;
END;
$function$;
