ALTER TABLE public.hs_words ADD COLUMN IF NOT EXISTS grade smallint NOT NULL DEFAULT 9;
CREATE INDEX IF NOT EXISTS hs_words_grade_subject_idx ON public.hs_words (grade, subject, unit, order_index);