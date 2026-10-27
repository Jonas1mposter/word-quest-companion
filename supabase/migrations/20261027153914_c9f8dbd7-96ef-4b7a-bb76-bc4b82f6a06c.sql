ALTER TABLE public.match_bot_state ADD COLUMN identities jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN rank_results jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.prepare_fallback_bots() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches; names text[] := ARRAY['EDG·nobody','EDG·CHICHOO','EDG·ZmjjKK','EDG·Smoggy','EDG·Jieni7','EDG·cb','TE·FengF','TE·Kai','TE·LuoK1ng','TE·Viva','TE·deLb','BLG·nephh','BLG·whzy','BLG·Knight','BLG·rushia','BLG·bud','DRG·Nicc','DRG·vo0kashu','DRG·SpiritZ1','DRG·Flex1n','DRG·Akeman','FPX·BerLIN','FPX·AAYY','FPX·Life','FPX·sScary','FPX·Setrod','XLG·Rarga','XLG·happywei','XLG·NoMan','XLG·Lysoar','XLG·WsLeo','NOVA·HeiB','NOVA·OBONE','NOVA·GuanG','NOVA·Ezeir','NOVA·Green','JDG·jkuro','JDG·stew','JDG·Yuicaw','JDG·zhe','JDG·coconut','JDG·kklin','WOL·SiuFatBB','WOL·Spring','WOL·jowa','WOL·yosemite','WOL·qiutian','WOL·Satoshi','TYL·slowly','TYL·Scales','TYL·sword9','TYL·Splash','TYL·Erv','TYL·Yoyo','TEC·Haodong','TEC·Abo','TEC·CoCo','TEC·lucas','TEC·dynamite','AG·K1ra','AG·Shr1mp','AG·iamgrq','AG·Au1','AG·f4ngeer','AG·Spitfires']; chosen text[]; slot int; count_correct int; lower_count int; upper_count int; events jsonb;
BEGIN
 SELECT * INTO m FROM ranked_matches WHERE id=NEW.match_id;
 SELECT array_agg(v) INTO chosen FROM (SELECT v FROM unnest(names) v ORDER BY random() LIMIT cardinality(NEW.bot_slots)) x;
 FOR i IN 1..cardinality(NEW.bot_slots) LOOP
  slot=NEW.bot_slots[i]; NEW.identities=NEW.identities||jsonb_build_object(slot::text,chosen[i]);
  IF m.match_type='ranked' THEN
   lower_count=ceil(m.question_count*.60); upper_count=floor(m.question_count*.75);
   IF upper_count<lower_count THEN RAISE EXCEPTION 'Insufficient questions for bot accuracy range'; END IF;
   count_correct=lower_count+floor(random()*(upper_count-lower_count+1))::int;
   SELECT jsonb_agg(jsonb_build_object('slot',slot,'at',idx*8+random()*4,'delta',CASE WHEN position<=count_correct THEN 1 ELSE -1 END) ORDER BY idx) INTO events FROM (SELECT idx,row_number() OVER(ORDER BY random()) position FROM generate_series(1,m.question_count) idx) x;
   IF i=1 THEN NEW.schedule='[]'::jsonb; END IF;
   NEW.schedule=NEW.schedule||events;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prepare_fallback_bots() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prepare_fallback_bots BEFORE INSERT ON public.match_bot_state FOR EACH ROW EXECUTE FUNCTION public.prepare_fallback_bots();

CREATE OR REPLACE FUNCTION public.settle_fallback_rank(p_match uuid,p_winner integer,p_forfeiter uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m ranked_matches; p profiles; results jsonb='{}'; outcome numeric; delta int; shield uuid; doubled boolean; tier text; stars int; pts int; pos int; tiers text[]=ARRAY['bronze','silver','gold','platinum','diamond','star','ace','champion']; caps int[]=ARRAY[30,40,50,50,60,70,80,999]; old_claims text;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 SELECT * INTO m FROM ranked_matches WHERE id=p_match FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM match_bot_state WHERE match_id=p_match) THEN RAISE EXCEPTION 'Not a fallback match'; END IF;
 IF m.status='completed' THEN SELECT rank_results INTO results FROM match_bot_state WHERE match_id=p_match; RETURN results; END IF;
 IF m.match_type<>'ranked' THEN RETURN results; END IF;
 IF NOT EXISTS(SELECT 1 FROM match_answers WHERE match_id=p_match) THEN
  IF p_forfeiter IS NOT NULL THEN PERFORM complete_empty_match(p_match,p_forfeiter); END IF;
  RETURN results;
 END IF;
 old_claims=current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 FOR p IN SELECT * FROM profiles WHERE id=ANY(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL)) ORDER BY id FOR UPDATE LOOP
  outcome=CASE WHEN p_winner IS NULL THEN .5 WHEN p_winner=CASE WHEN p.id IN (m.player1_id,m.player3_id) THEN 1 ELSE 2 END THEN 1 ELSE 0 END;
  delta=CASE WHEN outcome=1 THEN 16 WHEN outcome=0 THEN -16 ELSE 0 END;
  SELECT EXISTS(SELECT 1 FROM profile_boosts WHERE profile_id=p.id AND boost_type='double_rank' AND expires_at>now()) INTO doubled;
  IF outcome=1 AND doubled THEN delta=delta*2; END IF;
  shield=NULL;
  IF outcome=0 THEN SELECT id INTO shield FROM profile_boosts WHERE profile_id=p.id AND boost_type='rank_shield' AND uses_remaining>0 AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at LIMIT 1 FOR UPDATE; END IF;
  tier=p.rank_tier; stars=p.rank_stars; pts=p.rank_points;
  IF shield IS NOT NULL THEN UPDATE profile_boosts SET uses_remaining=uses_remaining-1 WHERE id=shield; delta=0;
  ELSIF outcome=1 THEN
   stars=stars+1;
   IF tier='champion' THEN pts=pts+delta;
   ELSIF stars>=caps[array_position(tiers,tier)] THEN tier=tiers[array_position(tiers,tier)+1]; stars=0; END IF;
  ELSIF outcome=0 THEN
   IF tier<>'bronze' THEN stars=stars-1; IF stars<0 THEN pos=array_position(tiers,tier); tier=tiers[greatest(1,pos-1)]; stars=greatest(0,caps[greatest(1,pos-1)]-3); END IF; END IF;
   IF tier='champion' THEN pts=greatest(0,pts+delta); END IF;
  END IF;
  UPDATE profiles SET elo_rating=greatest(100,elo_rating+delta),rank_tier=tier,rank_stars=stars,rank_points=pts,wins=wins+CASE WHEN outcome=1 THEN 1 ELSE 0 END,losses=losses+CASE WHEN outcome=0 THEN 1 ELSE 0 END,ranked_wins=ranked_wins+CASE WHEN outcome=1 THEN 1 ELSE 0 END WHERE id=p.id;
  results=results||jsonb_build_object(p.id::text,jsonb_build_object('eloDelta',delta,'shieldUsed',shield IS NOT NULL,'boosts',jsonb_build_object('rank',CASE WHEN doubled THEN 2 ELSE 1 END),'coinsEarned',0,'xpEarned',0));
 END LOOP;
 UPDATE match_bot_state SET rank_results=results WHERE match_id=p_match;
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RETURN results;
END $$;
REVOKE ALL ON FUNCTION public.settle_fallback_rank(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_fallback_rank(uuid,integer,uuid) TO service_role;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.tick_match_bots(uuid,uuid,boolean,boolean)'::regprocedure) INTO d;
 d=replace(d,'done boolean;','done boolean; results jsonb;');
 d=replace(d,E'BEGIN\n SELECT * INTO m', E'BEGIN\n IF coalesce(auth.role(),\'\')<>\'service_role\' THEN RAISE EXCEPTION \'Server only\'; END IF;\n SELECT * INTO m');
 d=replace(d,$old$'xpEarned',0); END IF;$old$,$new$'xpEarned',0)||coalesce(b.rank_results->p_profile_id::text,'{}'::jsonb); END IF;$new$);
 d=replace(d,$old$WHERE (v->>'at')::numeric<=extract(epoch FROM now()-m.started_at)$old$,$new$WHERE (v->>'at')::numeric<=extract(epoch FROM now()-m.started_at) OR (p_finish AND NOT p_forfeit AND NOT EXISTS(SELECT 1 FROM unnest(array_remove(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id],NULL)) pid WHERE (SELECT count(*) FROM match_answers WHERE match_id=p_match_id AND player_id=pid)<m.question_count))$new$);
 d=replace(d,' UPDATE ranked_matches SET',E' IF done THEN results=settle_fallback_rank(p_match_id,wt,CASE WHEN p_forfeit THEN p_profile_id END); END IF;\n UPDATE ranked_matches SET');
 d=replace(d,'winner_id=NULL WHERE id=p_match_id',$new$winner_id=CASE WHEN done AND mode='1v1' AND wt=1 THEN player1_id ELSE NULL END WHERE id=p_match_id$new$);
 d=replace(d,E'\'xpEarned\',0);\nEND',E'\'xpEarned\',0)||coalesce(results->p_profile_id::text,\'{}\'::jsonb);\nEND');
 EXECUTE d;
END $$;