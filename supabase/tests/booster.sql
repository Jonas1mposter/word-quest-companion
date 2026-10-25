-- 增益卡：购买定价、重复购买拦截、不掉分卡免扣 ELO 与次数消耗。全部回滚，不留数据。
BEGIN;
DO $$
DECLARE pid uuid; uid uuid; opp uuid; mid uuid; r jsonb; before_elo int; shield_uses int;
BEGIN
 SET LOCAL ROLE service_role;
 SELECT id,user_id INTO pid,uid FROM public.profiles WHERE banned_until IS NULL ORDER BY id LIMIT 1;
 IF pid IS NULL THEN RAISE EXCEPTION 'Fixture missing'; END IF;
 SELECT id INTO opp FROM public.profiles WHERE id<>pid ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);
 -- 普通登录用户不能直接写增益卡表
 IF has_table_privilege('authenticated','public.profile_boosts','INSERT')
   OR has_table_privilege('authenticated','public.profile_boosts','UPDATE') THEN
   RAISE EXCEPTION 'Boost table writable by clients'; END IF;
 -- 豆不足：拒绝购买
 UPDATE public.profiles SET coins=99 WHERE id=pid;
 r=public.purchase_booster('rank_shield');
 IF r->>'error'<>'not_enough_coins' THEN RAISE EXCEPTION 'Should reject poor buyer: %',r; END IF;
 -- 非法类型：拒绝
 r=public.purchase_booster('hack');
 IF r->>'error'<>'bad_type' THEN RAISE EXCEPTION 'Should reject bad type: %',r; END IF;
 -- 豆够：扣 150 豆，发 3 次不掉分卡
 UPDATE public.profiles SET coins=1000 WHERE id=pid;
 r=public.purchase_booster('rank_shield');
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'Purchase failed: %',r; END IF;
 IF (SELECT coins FROM public.profiles WHERE id=pid)<>850 THEN RAISE EXCEPTION 'Price wrong'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profile_boosts WHERE profile_id=pid AND boost_type='rank_shield' AND uses_remaining=3) THEN
   RAISE EXCEPTION 'Shield not granted'; END IF;
 -- 同类卡生效中：拒绝重复购买
 r=public.purchase_booster('rank_shield');
 IF r->>'error'<>'already_active' THEN RAISE EXCEPTION 'Should reject duplicate: %',r; END IF;
 -- 双倍经验卡：100 豆，24 小时有效
 r=public.purchase_booster('double_xp');
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'XP purchase failed: %',r; END IF;
 IF (SELECT coins FROM public.profiles WHERE id=pid)<>750 THEN RAISE EXCEPTION 'XP price wrong'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profile_boosts WHERE profile_id=pid AND boost_type='double_xp' AND expires_at>now()) THEN
   RAISE EXCEPTION 'XP boost not granted'; END IF;
 -- 空局退赛：有不掉分卡不扣 ELO、不掉星，消耗一次，负场仍记录
 UPDATE public.profiles SET elo_rating=1000, rank_tier='silver', rank_stars=10 WHERE id=pid;
 INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,mode,match_type,words)
   VALUES(pid,opp,1,'in_progress','1v1','ranked','[]') RETURNING id INTO mid;
 r=public.complete_empty_match(mid,pid);
 IF r->>'handled'<>'true' THEN RAISE EXCEPTION 'Empty match not handled'; END IF;
 IF (SELECT elo_rating FROM public.profiles WHERE id=pid)<>1000
   OR (SELECT rank_stars FROM public.profiles WHERE id=pid)<>10 THEN
   RAISE EXCEPTION 'Shield did not protect rank'; END IF;
 SELECT uses_remaining INTO shield_uses FROM public.profile_boosts WHERE profile_id=pid AND boost_type='rank_shield';
 IF shield_uses<>2 THEN RAISE EXCEPTION 'Shield use not consumed: %',shield_uses; END IF;
 -- 卡用完：退赛正常扣分掉星
 UPDATE public.profile_boosts SET uses_remaining=0 WHERE profile_id=pid;
 INSERT INTO public.ranked_matches(player1_id,player2_id,grade,status,mode,match_type,words)
   VALUES(pid,opp,1,'in_progress','1v1','ranked','[]') RETURNING id INTO mid;
 r=public.complete_empty_match(mid,pid);
 IF (SELECT elo_rating FROM public.profiles WHERE id=pid)>=1000
   OR (SELECT rank_stars FROM public.profiles WHERE id=pid)<>9 THEN
   RAISE EXCEPTION 'Rank should drop without shield'; END IF;
END $$;
ROLLBACK;
