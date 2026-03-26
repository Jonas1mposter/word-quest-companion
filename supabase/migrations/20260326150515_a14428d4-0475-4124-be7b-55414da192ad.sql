
-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 7,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  coins INTEGER NOT NULL DEFAULT 100,
  energy INTEGER NOT NULL DEFAULT 10,
  max_energy INTEGER NOT NULL DEFAULT 10,
  streak INTEGER NOT NULL DEFAULT 0,
  rank_tier TEXT NOT NULL DEFAULT 'bronze',
  rank_stars INTEGER NOT NULL DEFAULT 0,
  rank_points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  class TEXT,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  elo_free INTEGER NOT NULL DEFAULT 1000,
  free_match_wins INTEGER NOT NULL DEFAULT 0,
  free_match_losses INTEGER NOT NULL DEFAULT 0,
  last_energy_restore TEXT,
  total_xp INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  background_type TEXT,
  background_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(split_part(NEW.email, '@', 1), 'user_' || substr(NEW.id::text, 1, 8)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- USER ROLES
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'teacher', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- WORDS & VOCABULARY
-- ============================================
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  phonetic TEXT,
  example TEXT,
  grade INTEGER NOT NULL DEFAULT 7,
  unit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Words are publicly readable" ON public.words FOR SELECT USING (true);

CREATE TABLE public.math_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  topic INTEGER NOT NULL DEFAULT 1,
  topic_name TEXT NOT NULL DEFAULT '',
  phonetic TEXT,
  example TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.math_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Math words are publicly readable" ON public.math_words FOR SELECT USING (true);

CREATE TABLE public.science_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  definition TEXT,
  phonetic TEXT,
  example TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.science_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Science words are publicly readable" ON public.science_words FOR SELECT USING (true);

-- ============================================
-- LEVELS & PROGRESS
-- ============================================
CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit INTEGER NOT NULL,
  grade INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Levels are publicly readable" ON public.levels FOR SELECT USING (true);

CREATE TABLE public.level_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  level_id UUID REFERENCES public.levels(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  stars INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, level_id)
);

ALTER TABLE public.level_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON public.level_progress FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own progress" ON public.level_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own progress" ON public.level_progress FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- LEARNING PROGRESS
-- ============================================
CREATE TABLE public.learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.words(id) ON DELETE CASCADE NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, word_id)
);

ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own learning" ON public.learning_progress FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own learning" ON public.learning_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own learning" ON public.learning_progress FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

CREATE TABLE public.math_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.math_words(id) ON DELETE CASCADE NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, word_id)
);

ALTER TABLE public.math_learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own math learning" ON public.math_learning_progress FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own math learning" ON public.math_learning_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own math learning" ON public.math_learning_progress FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

CREATE TABLE public.science_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.science_words(id) ON DELETE CASCADE NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, word_id)
);

ALTER TABLE public.science_learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own science learning" ON public.science_learning_progress FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own science learning" ON public.science_learning_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own science learning" ON public.science_learning_progress FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- BADGES
-- ============================================
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Award',
  category TEXT NOT NULL DEFAULT 'achievement',
  rarity TEXT NOT NULL DEFAULT 'common',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all user badges" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- NAME CARDS
-- ============================================
CREATE TABLE public.name_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  background_gradient TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Star',
  category TEXT NOT NULL DEFAULT 'achievement',
  rarity TEXT NOT NULL DEFAULT 'common',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.name_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Name cards are publicly readable" ON public.name_cards FOR SELECT USING (true);

CREATE TABLE public.user_name_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name_card_id UUID REFERENCES public.name_cards(id) ON DELETE CASCADE NOT NULL,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, name_card_id)
);

ALTER TABLE public.user_name_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all name cards" ON public.user_name_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own name cards" ON public.user_name_cards FOR ALL TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- COMBO RECORDS
-- ============================================
CREATE TABLE public.combo_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  combo_count INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'learning',
  level_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.combo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Combo records are publicly readable" ON public.combo_records FOR SELECT USING (true);
CREATE POLICY "Users can insert own combos" ON public.combo_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- SEASONS
-- ============================================
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons are publicly readable" ON public.seasons FOR SELECT USING (true);

-- ============================================
-- DAILY QUESTS
-- ============================================
CREATE TABLE public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_amount INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily quests are publicly readable" ON public.daily_quests FOR SELECT USING (true);

CREATE TABLE public.user_quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  quest_id UUID REFERENCES public.daily_quests(id) ON DELETE CASCADE NOT NULL,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, quest_id, quest_date)
);

ALTER TABLE public.user_quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quest progress" ON public.user_quest_progress FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own quest progress" ON public.user_quest_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own quest progress" ON public.user_quest_progress FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- CHALLENGES
-- ============================================
CREATE TABLE public.class_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  class_name TEXT NOT NULL,
  total_xp BIGINT NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class challenges are publicly readable" ON public.class_challenges FOR SELECT USING (true);

CREATE TABLE public.grade_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  challenge_name TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 0,
  current_value INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Grade challenges are publicly readable" ON public.grade_challenges FOR SELECT USING (true);

CREATE TABLE public.challenge_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 0,
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rewards" ON public.challenge_rewards FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own rewards" ON public.challenge_rewards FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- SEASON PASS
-- ============================================
CREATE TABLE public.season_pass_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 10,
  icon TEXT NOT NULL DEFAULT 'Gift',
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.season_pass_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season pass items are publicly readable" ON public.season_pass_items FOR SELECT USING (true);

CREATE TABLE public.user_season_pass (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, season_id)
);

ALTER TABLE public.user_season_pass ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pass" ON public.user_season_pass FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own pass" ON public.user_season_pass FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own pass" ON public.user_season_pass FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

CREATE TABLE public.user_pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_pass_item_id UUID REFERENCES public.season_pass_items(id) ON DELETE CASCADE NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, season_pass_item_id)
);

ALTER TABLE public.user_pass_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pass rewards" ON public.user_pass_rewards FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own pass rewards" ON public.user_pass_rewards FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- SEASON MILESTONES
-- ============================================
CREATE TABLE public.season_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Target',
  target_type TEXT NOT NULL DEFAULT 'xp',
  target_value INTEGER NOT NULL DEFAULT 100,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 10,
  is_global BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.season_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones are publicly readable" ON public.season_milestones FOR SELECT USING (true);

CREATE TABLE public.user_season_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.season_milestones(id) ON DELETE CASCADE NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, milestone_id)
);

ALTER TABLE public.user_season_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own milestones" ON public.user_season_milestones FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can insert own milestones" ON public.user_season_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));
CREATE POLICY "Users can update own milestones" ON public.user_season_milestones FOR UPDATE TO authenticated USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- ============================================
-- SEASON EVENTS
-- ============================================
CREATE TABLE public.season_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Zap',
  event_type TEXT NOT NULL DEFAULT 'xp_boost',
  bonus_value NUMERIC NOT NULL DEFAULT 1.5,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.season_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season events are publicly readable" ON public.season_events FOR SELECT USING (true);

-- ============================================
-- FRIENDS & SOCIAL
-- ============================================
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user1_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user2_id)
);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user1_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user2_id)
);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user1_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = user2_id)
);

CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friend requests" ON public.friend_requests FOR SELECT TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);
CREATE POLICY "Users can insert friend requests" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id)
);
CREATE POLICY "Users can update friend requests" ON public.friend_requests FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);
CREATE POLICY "Users can delete friend requests" ON public.friend_requests FOR DELETE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);

CREATE TABLE public.friend_battle_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  match_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_battle_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invites" ON public.friend_battle_invites FOR SELECT TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);
CREATE POLICY "Users can insert invites" ON public.friend_battle_invites FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id)
);
CREATE POLICY "Users can update invites" ON public.friend_battle_invites FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = sender_id)
);
CREATE POLICY "Users can update messages" ON public.messages FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = receiver_id)
);

-- ============================================
-- BLOCKED USERS
-- ============================================
CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own blocks" ON public.blocked_users FOR ALL TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = blocker_id)
);

-- ============================================
-- REPORTS
-- ============================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'user',
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = reporter_id)
);
CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RANKED MATCHES
-- ============================================
CREATE TABLE public.ranked_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  grade INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'waiting',
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player1_score INTEGER NOT NULL DEFAULT 0,
  player2_score INTEGER NOT NULL DEFAULT 0,
  match_type TEXT NOT NULL DEFAULT 'ranked',
  subject TEXT DEFAULT 'mixed',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ranked_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are publicly readable" ON public.ranked_matches FOR SELECT USING (true);
CREATE POLICY "Users can insert matches" ON public.ranked_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own matches" ON public.ranked_matches FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = player1_id) OR
  auth.uid() = (SELECT user_id FROM profiles WHERE id = player2_id)
);

-- ============================================
-- TEACHER / CLASS MANAGEMENT
-- ============================================
CREATE TABLE public.teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  class_name TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own classes" ON public.teacher_classes FOR SELECT TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = teacher_id)
);
CREATE POLICY "Teachers can manage own classes" ON public.teacher_classes FOR ALL TO authenticated USING (
  auth.uid() = (SELECT user_id FROM profiles WHERE id = teacher_id)
);

CREATE TABLE public.class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.teacher_classes(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, profile_id)
);

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class assignments are viewable by members" ON public.class_assignments FOR SELECT TO authenticated USING (true);

CREATE TABLE public.class_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.teacher_classes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competitions are publicly readable" ON public.class_competitions FOR SELECT USING (true);

-- ============================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- ============================================
-- Enable realtime for key tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_battle_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranked_matches;
