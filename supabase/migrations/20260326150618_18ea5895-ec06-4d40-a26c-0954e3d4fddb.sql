
-- class_assignments needs assignment-specific columns
ALTER TABLE public.class_assignments
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'levels',
  ADD COLUMN IF NOT EXISTS target_data JSONB,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- class_competitions needs additional columns
ALTER TABLE public.class_competitions
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS grade INTEGER,
  ADD COLUMN IF NOT EXISTS reward_coins INTEGER NOT NULL DEFAULT 0;
