-- 回归测试：普通登录用户抽各奖池不能被资料保护触发器挡住（bump_lifetime_coins 曾在权限绕行窗口外调用）。
-- 全部回滚，不消耗真实抽奖券。
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE pid uuid; uid uuid; tid uuid; r jsonb;
BEGIN
 SELECT id, user_id INTO pid, uid FROM public.profiles WHERE banned_until IS NULL ORDER BY id LIMIT 1;
 IF pid IS NULL THEN RAISE EXCEPTION 'Fixture missing'; END IF;
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source)
   VALUES(pid,'lottery_ticket',1,'测试券','test') RETURNING id INTO tid;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);
 SET LOCAL ROLE authenticated;
 r=public.orax_beats_draw(tid);
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'orax draw blocked: %',r; END IF;
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source)
   VALUES(pid,'lottery_ticket',1,'测试券','test') RETURNING id INTO tid;
 r=public.glory_crown_draw(tid);
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'glory draw blocked: %',r; END IF;
 -- 背包豆兑换也走同一内部函数
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source)
   VALUES(pid,'coins',50,'测试豆','test') RETURNING id INTO tid;
 r=public.use_backpack_item(tid);
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'backpack coins blocked: %',r; END IF;
END $$;
ROLLBACK;
