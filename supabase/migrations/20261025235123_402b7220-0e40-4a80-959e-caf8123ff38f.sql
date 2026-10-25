CREATE TABLE public.profile_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  boost_type text NOT NULL,
  uses_remaining integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_boosts TO authenticated;
GRANT ALL ON public.profile_boosts TO service_role;
ALTER TABLE public.profile_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own boosts readable" ON public.profile_boosts FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.purchase_booster(p_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prof profiles%ROWTYPE; price int; uses int; hrs int; old_claims text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_type NOT IN ('rank_shield','double_xp','double_coins','double_elo') THEN
    RETURN jsonb_build_object('error','bad_type'); END IF;
  price := CASE p_type WHEN 'rank_shield' THEN 150 WHEN 'double_xp' THEN 100 WHEN 'double_coins' THEN 120 ELSE 180 END;
  uses := CASE WHEN p_type='rank_shield' THEN 3 ELSE NULL END;
  hrs := CASE WHEN p_type='rank_shield' THEN NULL ELSE 24 END;
  SELECT * INTO prof FROM profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF EXISTS (SELECT 1 FROM profile_boosts WHERE profile_id=prof.id AND boost_type=p_type
    AND (expires_at IS NULL OR expires_at > now()) AND (uses_remaining IS NULL OR uses_remaining > 0)) THEN
    RETURN jsonb_build_object('error','already_active'); END IF;
  IF prof.coins < price THEN RETURN jsonb_build_object('error','not_enough_coins','have',prof.coins); END IF;
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  UPDATE profiles SET coins = coins - price WHERE id = prof.id;
  PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
  INSERT INTO profile_boosts (profile_id, boost_type, uses_remaining, expires_at)
  VALUES (prof.id, p_type, uses, CASE WHEN hrs IS NULL THEN NULL ELSE now() + (hrs || ' hours')::interval END);
  RETURN jsonb_build_object('ok',true,'price',price);
END $$;
REVOKE EXECUTE ON FUNCTION public.purchase_booster(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.purchase_booster(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_empty_match(p_match_id uuid, p_forfeiter_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.ranked_matches; p public.profiles; opp numeric; delta integer; tier text; stars integer; pts integer; tiers text[]=ARRAY['bronze','silver','gold','platinum','diamond','star','ace','champion']; caps integer[]=ARRAY[30,40,50,50,60,70,80,999]; pos integer; free boolean; shield_id uuid;
BEGIN
 SELECT * INTO m FROM public.ranked_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.match_answers WHERE match_id=m.id) THEN RETURN jsonb_build_object('handled',false); END IF;
 IF m.status='completed' THEN RETURN jsonb_build_object('handled',true,'noAnswers',true,'coinsEarned',0,'xpEarned',0); END IF;
 IF p_forfeiter_id IS NOT NULL AND p_forfeiter_id IS DISTINCT FROM m.player1_id AND p_forfeiter_id IS DISTINCT FROM m.player2_id AND p_forfeiter_id IS DISTINCT FROM m.player3_id AND p_forfeiter_id IS DISTINCT FROM m.player4_id THEN RAISE EXCEPTION 'Not in match'; END IF;
 free=m.match_type='free' AND m.mode<>'2v2';
 IF p_forfeiter_id IS NOT NULL THEN
  SELECT * INTO p FROM public.profiles WHERE id=p_forfeiter_id FOR UPDATE;
  IF m.mode='2v2' THEN
   SELECT avg(elo_rating) INTO opp FROM public.profiles WHERE id=ANY(CASE WHEN p.id=ANY(ARRAY[m.player1_id,m.player3_id]) THEN ARRAY[m.player2_id,m.player4_id] ELSE ARRAY[m.player1_id,m.player3_id] END);
   SELECT -round(32/(1+power(10,((coalesce(opp,1000)-avg(elo_rating))/400))))::integer INTO delta FROM public.profiles WHERE id=ANY(CASE WHEN p.id=ANY(ARRAY[m.player1_id,m.player3_id]) THEN ARRAY[m.player1_id,m.player3_id] ELSE ARRAY[m.player2_id,m.player4_id] END);
  ELSE
   SELECT CASE WHEN free THEN elo_free ELSE elo_rating END INTO opp FROM public.profiles WHERE id=CASE WHEN m.player1_id=p.id THEN m.player2_id ELSE m.player1_id END;
   delta=-round(32/(1+power(10,((coalesce(opp,1000)-CASE WHEN free THEN p.elo_free ELSE p.elo_rating END)/400.0))))::integer;
  END IF;
  tier=p.rank_tier; stars=p.rank_stars; pts=p.rank_points;
  IF NOT free THEN
   IF tier<>'bronze' THEN
    stars=stars-1;
    IF stars<0 THEN pos=array_position(tiers,tier); IF pos>1 THEN tier=tiers[pos-1]; stars=greatest(0,caps[pos-1]-3); ELSE stars=0; END IF; END IF;
   END IF;
   IF tier='champion' THEN pts=greatest(0,pts+delta); END IF;
   -- 不掉分卡：消耗一次，免除本次退赛的段位与 ELO 损失（负场仍记录）
   SELECT b.id INTO shield_id FROM public.profile_boosts b
    WHERE b.profile_id=p.id AND b.boost_type='rank_shield' AND b.uses_remaining>0
      AND (b.expires_at IS NULL OR b.expires_at>now()) ORDER BY b.created_at LIMIT 1;
   IF shield_id IS NOT NULL THEN
    UPDATE public.profile_boosts SET uses_remaining=uses_remaining-1 WHERE id=shield_id;
    delta=0; tier=p.rank_tier; stars=p.rank_stars; pts=p.rank_points;
   END IF;
  END IF;
  UPDATE public.profiles SET
   elo_free=CASE WHEN free THEN greatest(100,elo_free+delta) ELSE elo_free END,
   elo_rating=CASE WHEN NOT free THEN greatest(100,elo_rating+delta) ELSE elo_rating END,
   free_match_losses=free_match_losses+CASE WHEN free THEN 1 ELSE 0 END,
   losses=losses+CASE WHEN NOT free THEN 1 ELSE 0 END,
   rank_tier=tier,rank_stars=stars,rank_points=pts WHERE id=p.id;
 END IF;
 UPDATE public.ranked_matches SET status='completed',ended_at=now(),winner_id=NULL,winner_team=NULL,player1_score=0,player2_score=0,team1_score=0,team2_score=0 WHERE id=m.id;
 DELETE FROM public.match_queue WHERE profile_id=ANY(ARRAY[m.player1_id,m.player2_id,m.player3_id,m.player4_id]);
 RETURN jsonb_build_object('handled',true,'noAnswers',true,'coinsEarned',0,'xpEarned',0);
END $$;
REVOKE ALL ON FUNCTION public.complete_empty_match(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_empty_match(uuid,uuid) TO service_role;