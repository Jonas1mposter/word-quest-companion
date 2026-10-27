ALTER TABLE public.match_bot_state ADD COLUMN cosmetics jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.random_bot_cosmetics() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('name_card', (SELECT jsonb_build_object('id',id,'name',name,'background_gradient',background_gradient,'icon',icon,'rarity',rarity,'rank_position',NULL) FROM public.name_cards WHERE category IN ('achievement','battle','learning','rank_tier','ranked') ORDER BY random() LIMIT 1), 'badges', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'icon',icon,'rarity',rarity,'slot',slot)) FROM (SELECT c.*, (row_number() OVER ()-1)::int slot FROM (SELECT id,name,icon,rarity FROM public.badges WHERE category IN ('common','rank_tier','tier_bot','tier_coins','tier_leaderboard','tier_login_total','tier_peak','tier_perfect','tier_rank','tier_streak','tier_words','tier_xp') ORDER BY random() LIMIT 3) c) b),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.random_bot_cosmetics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.random_bot_cosmetics() TO service_role;
CREATE OR REPLACE FUNCTION public.assign_bot_cosmetics() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE slot integer;
BEGIN
 FOR slot IN SELECT unnest(NEW.bot_slots) LOOP
  NEW.cosmetics=NEW.cosmetics || jsonb_build_object(slot::text, public.random_bot_cosmetics());
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_bot_cosmetics() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assign_bot_cosmetics BEFORE INSERT ON public.match_bot_state FOR EACH ROW EXECUTE FUNCTION public.assign_bot_cosmetics();