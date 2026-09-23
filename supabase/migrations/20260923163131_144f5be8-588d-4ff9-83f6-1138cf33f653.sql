ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ace_reach_count integer NOT NULL DEFAULT 0;

INSERT INTO public.badges (name, description, icon, category, rarity) VALUES
('铂金之证','首次登上铂金段位','Shield','rank_tier','rare'),
('钻石之证','首次登上钻石段位','Gem','rank_tier','epic'),
('星耀之证','首次登上星耀段位','Sparkles','rank_tier','epic'),
('王牌之证','首次登上王牌段位','Flame','rank_tier','legendary'),
('巅峰之证','首次登上狄邦巅峰','Crown','rank_tier','legendary'),
('至高巅峰 I','累计 1 次登上王牌及以上段位','Mountain','tier_peak','common'),
('至高巅峰 II','累计 2 次登上王牌及以上段位','Mountain','tier_peak','rare'),
('至高巅峰 III','累计 5 次登上王牌及以上段位','Mountain','tier_peak','epic'),
('至高巅峰 IV','累计 10 次登上王牌及以上段位','Mountain','tier_peak','legendary');

INSERT INTO public.name_cards (name, description, background_gradient, icon, category, rarity, in_gacha_pool) VALUES
('铂金铭牌','登上铂金段位专属','linear-gradient(135deg, #5f9ea0 0%, #b2f0e8 100%)','Shield','rank_tier','rare',false),
('钻石铭牌','登上钻石段位专属','linear-gradient(135deg, #1e3c72 0%, #7fd3ff 100%)','Gem','rank_tier','epic',false),
('星耀铭牌','登上星耀段位专属','linear-gradient(135deg, #4b1d8f 0%, #c084fc 100%)','Sparkles','rank_tier','epic',false),
('王牌铭牌','登上王牌段位专属','linear-gradient(135deg, #b91c1c 0%, #f97316 100%)','Flame','rank_tier','legendary',false),
('狄邦巅峰铭牌','登上狄邦巅峰专属','linear-gradient(135deg, #1a0000 0%, #d4af37 55%, #fff4c2 100%)','Crown','rank_tier','legendary',false);

CREATE OR REPLACE FUNCTION public.grant_rank_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord text[] := ARRAY['bronze','silver','gold','platinum','diamond','star','ace','champion'];
  cn text[] := ARRAY[NULL,NULL,NULL,'铂金','钻石','星耀','王牌','巅峰'];
  cardn text[] := ARRAY[NULL,NULL,NULL,'铂金铭牌','钻石铭牌','星耀铭牌','王牌铭牌','狄邦巅峰铭牌'];
  oi int; ni int; i int; cid uuid;
BEGIN
  oi := COALESCE(array_position(ord, OLD.rank_tier), 1);
  ni := COALESCE(array_position(ord, NEW.rank_tier), 1);
  IF ni <= oi THEN RETURN NEW; END IF;
  FOR i IN GREATEST(oi+1,4)..ni LOOP
    PERFORM grant_special_badge(NEW.id, cn[i] || '之证');
    SELECT id INTO cid FROM name_cards WHERE name = cardn[i] LIMIT 1;
    IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id=NEW.id AND name_card_id=cid) THEN
      INSERT INTO user_name_cards (profile_id, name_card_id, is_equipped) VALUES (NEW.id, cid, false);
    END IF;
  END LOOP;
  IF oi < 7 AND ni >= 7 THEN
    NEW.ace_reach_count := NEW.ace_reach_count + 1;
    IF NEW.ace_reach_count >= 1 THEN PERFORM grant_special_badge(NEW.id,'至高巅峰 I'); END IF;
    IF NEW.ace_reach_count >= 2 THEN PERFORM grant_special_badge(NEW.id,'至高巅峰 II'); END IF;
    IF NEW.ace_reach_count >= 5 THEN PERFORM grant_special_badge(NEW.id,'至高巅峰 III'); END IF;
    IF NEW.ace_reach_count >= 10 THEN PERFORM grant_special_badge(NEW.id,'至高巅峰 IV'); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grant_rank_rewards ON public.profiles;
CREATE TRIGGER trg_grant_rank_rewards BEFORE UPDATE OF rank_tier ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_rank_rewards();

-- 补发已达段位玩家
DO $$
DECLARE r record; ord text[] := ARRAY['bronze','silver','gold','platinum','diamond','star','ace','champion'];
 cn text[] := ARRAY[NULL,NULL,NULL,'铂金','钻石','星耀','王牌','巅峰'];
 cardn text[] := ARRAY[NULL,NULL,NULL,'铂金铭牌','钻石铭牌','星耀铭牌','王牌铭牌','狄邦巅峰铭牌'];
 ni int; i int; cid uuid;
BEGIN
 FOR r IN SELECT id, rank_tier FROM profiles WHERE rank_tier IN ('platinum','diamond','star','ace','champion') LOOP
  ni := array_position(ord, r.rank_tier);
  FOR i IN 4..ni LOOP
   PERFORM grant_special_badge(r.id, cn[i] || '之证');
   SELECT id INTO cid FROM name_cards WHERE name=cardn[i];
   IF NOT EXISTS (SELECT 1 FROM user_name_cards WHERE profile_id=r.id AND name_card_id=cid) THEN
     INSERT INTO user_name_cards (profile_id, name_card_id, is_equipped) VALUES (r.id, cid, false);
   END IF;
  END LOOP;
  IF ni >= 7 THEN
   UPDATE profiles SET ace_reach_count = GREATEST(ace_reach_count,1) WHERE id=r.id;
   PERFORM grant_special_badge(r.id,'至高巅峰 I');
  END IF;
 END LOOP;
END $$;