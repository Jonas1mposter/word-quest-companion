CREATE TABLE public.word_syllables (
  word text PRIMARY KEY,
  syllables text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.word_syllables TO anon, authenticated;
GRANT ALL ON public.word_syllables TO service_role;
ALTER TABLE public.word_syllables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read syllables" ON public.word_syllables FOR SELECT USING (true);