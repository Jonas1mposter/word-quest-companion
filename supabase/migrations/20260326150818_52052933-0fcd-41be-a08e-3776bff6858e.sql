
-- Fix permissive RLS policies on ranked_matches
DROP POLICY IF EXISTS "Users can insert matches" ON public.ranked_matches;
CREATE POLICY "Users can insert matches" ON public.ranked_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = player1_id)
  );
