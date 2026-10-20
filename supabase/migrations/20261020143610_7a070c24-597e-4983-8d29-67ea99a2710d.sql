CREATE OR REPLACE FUNCTION public.checkin_coin_reward(p_streak integer, p_at timestamptz DEFAULT now()) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT (ARRAY[40,50,60,70,80,100,200])[least(greatest(coalesce(p_streak,1),1),7)] * CASE WHEN extract(isodow FROM p_at AT TIME ZONE 'Asia/Shanghai') IN (6,7) THEN 2 ELSE 1 END $$;
GRANT EXECUTE ON FUNCTION public.checkin_coin_reward(integer,timestamptz) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.bot_coin_reward(p_difficulty text,p_outcome text,p_perfect boolean,p_first_win boolean,p_at timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE base integer; first_bonus integer; perfect_bonus integer; factor integer;
BEGIN
 IF p_difficulty IS NULL OR p_difficulty NOT IN ('easy','medium','hard') OR p_outcome IS NULL OR p_outcome NOT IN ('win','draw','loss') OR p_perfect IS NULL OR p_first_win IS NULL OR p_at IS NULL THEN RAISE EXCEPTION 'Invalid reward input'; END IF;
 base=CASE p_difficulty WHEN 'easy' THEN CASE p_outcome WHEN 'win' THEN 10 WHEN 'draw' THEN 5 ELSE 2 END WHEN 'medium' THEN CASE p_outcome WHEN 'win' THEN 20 WHEN 'draw' THEN 10 ELSE 4 END ELSE CASE p_outcome WHEN 'win' THEN 30 WHEN 'draw' THEN 15 ELSE 6 END END;
 first_bonus=CASE WHEN p_first_win AND p_outcome='win' THEN 50 ELSE 0 END;
 perfect_bonus=CASE WHEN p_perfect THEN 20 ELSE 0 END;
 factor=CASE WHEN extract(isodow FROM p_at AT TIME ZONE 'Asia/Shanghai') IN (6,7) THEN 2 ELSE 1 END;
 RETURN jsonb_build_object('baseCoins',base*factor,'firstWinCoins',first_bonus*factor,'perfectCoins',perfect_bonus*factor,'weekend',factor=2,'coinsEarned',(base+first_bonus+perfect_bonus)*factor);
END $$;
GRANT EXECUTE ON FUNCTION public.bot_coin_reward(text,text,boolean,boolean,timestamptz) TO authenticated,service_role;

DO $migration$
DECLARE def text; old_part text;
BEGIN
 SELECT pg_get_functiondef('public.record_daily_login()'::regprocedure) INTO def;
 IF position('SELECT * INTO prof FROM profiles WHERE user_id = caller;' IN def)=0 OR position('v_coins := (ARRAY[20, 25, 30, 35, 40, 50, 100])[LEAST(v_streak, 7)];' IN def)=0 THEN RAISE EXCEPTION 'Check-in source changed'; END IF;
 def=replace(def,'SELECT * INTO prof FROM profiles WHERE user_id = caller;','SELECT * INTO prof FROM profiles WHERE user_id = caller FOR UPDATE;');
 def=replace(def,'IF NOT FOUND THEN RETURN jsonb_build_object(''ok'', false); END IF;','IF NOT FOUND OR prof.banned_until>now() THEN RETURN jsonb_build_object(''ok'', false); END IF;');
 def=replace(def,'v_coins := (ARRAY[20, 25, 30, 35, 40, 50, 100])[LEAST(v_streak, 7)];','v_coins := public.checkin_coin_reward(v_streak, now());');
 def=replace(def,'IF dow IN (0, 6) THEN v_coins := v_coins * 2; END IF;','');
 def=replace(def,'20/25/30/35/40/50/100','40/50/60/70/80/100/200');
 EXECUTE def;
 SELECT pg_get_functiondef('public.bot_battle_action(uuid,uuid,text,text,integer,text,text,jsonb)'::regprocedure) INTO def;
 old_part=$old$coins_gain=CASE s.difficulty WHEN 'easy' THEN CASE outcome WHEN 'win' THEN 4 WHEN 'draw' THEN 2 ELSE 0 END WHEN 'medium' THEN CASE outcome WHEN 'win' THEN 7 WHEN 'draw' THEN 3 ELSE 1 END ELSE CASE outcome WHEN 'win' THEN 11 WHEN 'draw' THEN 4 ELSE 1 END END;
  IF extract(isodow from now() AT TIME ZONE 'Asia/Shanghai') IN (6,7) THEN coins_gain=coins_gain*2; END IF;$old$;
 IF position(old_part IN def)=0 OR position('std_gap numeric;' IN def)=0 THEN RAISE EXCEPTION 'Bot reward source changed'; END IF;
 def=replace(def,'std_gap numeric;','std_gap numeric; reward jsonb; first_win boolean; perfect boolean;');
 def=replace(def,old_part,$new$first_win=outcome='win' AND jsonb_array_length(s.words)>=10 AND NOT EXISTS(SELECT 1 FROM public.bot_battle_sessions b WHERE b.profile_id=p_profile_id AND b.id<>s.id AND b.status='completed' AND b.result->>'result'='win' AND (b.updated_at AT TIME ZONE 'Asia/Shanghai')::date=(now() AT TIME ZONE 'Asia/Shanghai')::date);
  perfect=jsonb_array_length(s.words)>=10 AND s.player_score=jsonb_array_length(s.words);
  reward=public.bot_coin_reward(s.difficulty,outcome,perfect,first_win,now());
  IF s.player_score<=0 THEN reward=jsonb_build_object('baseCoins',0,'firstWinCoins',0,'perfectCoins',0,'coinsEarned',0,'weekend',extract(isodow from now() AT TIME ZONE 'Asia/Shanghai') IN (6,7)); END IF;
  coins_gain=(reward->>'coinsEarned')::integer;$new$);
 old_part=$old$response=jsonb_build_object('ok',true,'result',outcome,'playerScore',s.player_score,'botScore',s.bot_score,'xpEarned',xp_gain,'coinsEarned',coins_gain);$old$;
 IF position(old_part IN def)=0 THEN RAISE EXCEPTION 'Bot response source changed'; END IF;
 def=replace(def,old_part,old_part||' response=response||reward;');
 EXECUTE def;
END $migration$;