
-- user_badges: drop client INSERT, add narrow UPDATE for equip/unequip only
DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;

CREATE POLICY "Users can equip own badges"
ON public.user_badges
FOR UPDATE
TO authenticated
USING (auth.uid() = (SELECT profiles.user_id FROM public.profiles WHERE profiles.id = user_badges.profile_id))
WITH CHECK (auth.uid() = (SELECT profiles.user_id FROM public.profiles WHERE profiles.id = user_badges.profile_id));

-- Trigger to prevent users from changing badge_id or profile_id (only equipped_slot can change)
CREATE OR REPLACE FUNCTION public.guard_user_badges_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF jwt_role = 'service_role' THEN RETURN NEW; END IF;
  NEW.badge_id := OLD.badge_id;
  NEW.profile_id := OLD.profile_id;
  NEW.earned_at := OLD.earned_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_badges_columns_trg ON public.user_badges;
CREATE TRIGGER guard_user_badges_columns_trg
BEFORE UPDATE ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.guard_user_badges_columns();

-- user_name_cards: replace permissive ALL policy with narrow UPDATE only
DROP POLICY IF EXISTS "Users can manage own name cards" ON public.user_name_cards;

CREATE POLICY "Users can equip own name cards"
ON public.user_name_cards
FOR UPDATE
TO authenticated
USING (auth.uid() = (SELECT profiles.user_id FROM public.profiles WHERE profiles.id = user_name_cards.profile_id))
WITH CHECK (auth.uid() = (SELECT profiles.user_id FROM public.profiles WHERE profiles.id = user_name_cards.profile_id));

CREATE OR REPLACE FUNCTION public.guard_user_name_cards_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF jwt_role = 'service_role' THEN RETURN NEW; END IF;
  NEW.name_card_id := OLD.name_card_id;
  NEW.profile_id := OLD.profile_id;
  NEW.earned_at := OLD.earned_at;
  NEW.rank_position := OLD.rank_position;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_name_cards_columns_trg ON public.user_name_cards;
CREATE TRIGGER guard_user_name_cards_columns_trg
BEFORE UPDATE ON public.user_name_cards
FOR EACH ROW EXECUTE FUNCTION public.guard_user_name_cards_columns();

-- combo_records: drop client INSERT (server writes via complete-level)
DROP POLICY IF EXISTS "Users can insert own combos" ON public.combo_records;
