CREATE TABLE public.level_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id text NOT NULL,
  total_words integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT ALL ON public.level_sessions TO service_role;
ALTER TABLE public.level_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX level_sessions_profile_idx ON public.level_sessions(profile_id, started_at DESC);