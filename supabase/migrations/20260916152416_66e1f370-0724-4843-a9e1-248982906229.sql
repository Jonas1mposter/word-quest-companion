CREATE TABLE public.hs_words (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word text NOT NULL,
  meaning text NOT NULL,
  phonetic text,
  definition text,
  example text,
  subject text NOT NULL,
  unit integer NOT NULL DEFAULT 1,
  unit_name text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hs_words TO anon;
GRANT SELECT ON public.hs_words TO authenticated;
GRANT ALL ON public.hs_words TO service_role;

ALTER TABLE public.hs_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HS words are publicly readable" ON public.hs_words
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage hs words" ON public.hs_words
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX hs_words_subject_unit_idx ON public.hs_words (subject, unit, order_index);

CREATE TABLE public.hs_learning_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  word_id uuid NOT NULL REFERENCES public.hs_words(id),
  correct_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  mastery_level integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (profile_id, word_id)
);

GRANT SELECT, INSERT, UPDATE ON public.hs_learning_progress TO authenticated;
GRANT ALL ON public.hs_learning_progress TO service_role;

ALTER TABLE public.hs_learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hs learning" ON public.hs_learning_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE profiles.id = hs_learning_progress.profile_id));

CREATE POLICY "Users can insert own hs learning" ON public.hs_learning_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE profiles.id = hs_learning_progress.profile_id));

CREATE POLICY "Users can update own hs learning" ON public.hs_learning_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT user_id FROM profiles WHERE profiles.id = hs_learning_progress.profile_id));