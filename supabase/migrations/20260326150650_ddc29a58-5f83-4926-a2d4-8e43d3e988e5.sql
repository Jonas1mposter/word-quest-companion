
-- Make class_id and profile_id nullable in class_assignments since Teacher.tsx uses teacher_id/class_name/grade instead
ALTER TABLE public.class_assignments ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.class_assignments ALTER COLUMN profile_id DROP NOT NULL;

-- class_competitions.class_id and name should also be nullable
ALTER TABLE public.class_competitions ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.class_competitions ALTER COLUMN name DROP NOT NULL;
