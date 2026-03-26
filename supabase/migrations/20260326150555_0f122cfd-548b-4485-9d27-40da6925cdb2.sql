
-- Add missing columns to existing tables

-- class_challenges needs more columns
ALTER TABLE public.class_challenges
  ADD COLUMN IF NOT EXISTS total_correct INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_answered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_levels_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS composite_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_position INTEGER,
  ADD COLUMN IF NOT EXISTS grade INTEGER NOT NULL DEFAULT 7;

-- grade_challenges needs more columns
ALTER TABLE public.grade_challenges
  ADD COLUMN IF NOT EXISTS grade INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS total_xp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_correct INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_answered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_levels_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS composite_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_position INTEGER;

-- challenge_rewards needs more columns
ALTER TABLE public.challenge_rewards
  ADD COLUMN IF NOT EXISTS challenge_type TEXT NOT NULL DEFAULT 'class',
  ADD COLUMN IF NOT EXISTS rank_achieved INTEGER;

-- ranked_matches needs words column
ALTER TABLE public.ranked_matches
  ADD COLUMN IF NOT EXISTS words JSONB;

-- user_badges needs equipped_slot
ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS equipped_slot INTEGER;

-- user_name_cards needs rank_position
ALTER TABLE public.user_name_cards
  ADD COLUMN IF NOT EXISTS rank_position INTEGER;

-- seasons needs more columns
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS bonus_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT;

-- class_assignments: add columns Teacher.tsx expects (teacher_id, class_name, grade)
ALTER TABLE public.class_assignments
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS grade INTEGER;

-- class_competitions: add columns Teacher.tsx expects  
ALTER TABLE public.class_competitions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS competition_type TEXT,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_data JSONB,
  ADD COLUMN IF NOT EXISTS reward_data JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- teacher_classes needs teacher_id and class_name to also be queryable from class_assignments
-- (Teacher.tsx queries class_assignments with teacher_id filter)
