CREATE TABLE public.leaderboard_reward_reversal_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch text NOT NULL UNIQUE, snapshot jsonb NOT NULL, result jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.leaderboard_reward_reversal_audit TO service_role;
ALTER TABLE public.leaderboard_reward_reversal_audit ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE batch_key text := 'early-monthly-2026-10-18'; r record; p record; new_xp integer; new_level integer; new_next integer; n_profiles integer:=0; n_items integer:=0; n_messages integer:=0; n_rewards integer:=0; total_coins bigint:=0; total_xp bigint:=0;
BEGIN
 IF EXISTS(SELECT 1 FROM public.leaderboard_reward_reversal_audit WHERE batch=batch_key) THEN RETURN; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 PERFORM 1 FROM public.profiles WHERE id IN(SELECT profile_id FROM public.weekly_leaderboard_rewards WHERE week_start='2026-10-01' AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00') ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.backpack_items WHERE source IN('leaderboard:leaderboard_wins:2026-10-01','leaderboard:leaderboard_rank:2026-10-01','leaderboard:leaderboard_xp:2026-10-01') AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00' FOR UPDATE;
 INSERT INTO public.leaderboard_reward_reversal_audit(batch,snapshot)
 SELECT batch_key,jsonb_build_object(
 'rewards',(SELECT coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM public.weekly_leaderboard_rewards w WHERE week_start='2026-10-01' AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00'),
 'profiles',(SELECT coalesce(jsonb_agg(to_jsonb(pr)),'[]'::jsonb) FROM public.profiles pr WHERE id IN(SELECT profile_id FROM public.weekly_leaderboard_rewards WHERE week_start='2026-10-01' AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00')),
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) FROM public.backpack_items b WHERE source IN('leaderboard:leaderboard_wins:2026-10-01','leaderboard:leaderboard_rank:2026-10-01','leaderboard:leaderboard_xp:2026-10-01') AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00'),
 'messages',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) FROM public.messages m WHERE EXISTS(SELECT 1 FROM public.backpack_items b WHERE b.source IN('leaderboard:leaderboard_wins:2026-10-01','leaderboard:leaderboard_rank:2026-10-01','leaderboard:leaderboard_xp:2026-10-01') AND b.created_at>='2026-10-18 00:00:00+00' AND b.created_at<'2026-10-19 00:00:00+00' AND b.status='pending' AND m.sender_id=b.profile_id AND m.content LIKE '%券号：'||left(b.id::text,8) AND m.created_at>=b.created_at)));
 FOR r IN SELECT profile_id,sum(coins)::integer AS coins,sum(xp)::integer AS xp FROM public.weekly_leaderboard_rewards WHERE week_start='2026-10-01' AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00' GROUP BY profile_id LOOP
  SELECT * INTO p FROM public.profiles WHERE id=r.profile_id;
  new_xp:=p.xp-r.xp; new_level:=p.level; new_next:=p.xp_to_next_level;
  WHILE new_xp<0 AND new_level>1 LOOP
   new_level:=new_level-1; new_next:=100*new_level; new_xp:=new_xp+new_next;
  END LOOP;
  UPDATE public.profiles AS pr SET coins=pr.coins-r.coins,xp=greatest(0,new_xp),level=new_level,xp_to_next_level=new_next,total_xp=greatest(0,pr.total_xp-r.xp),lifetime_coins_earned=greatest(0,pr.lifetime_coins_earned-r.coins) WHERE pr.id=r.profile_id;
  n_profiles:=n_profiles+1; total_coins:=total_coins+r.coins; total_xp:=total_xp+r.xp;
 END LOOP;
 DELETE FROM public.messages m WHERE EXISTS(SELECT 1 FROM public.backpack_items b WHERE b.source IN('leaderboard:leaderboard_wins:2026-10-01','leaderboard:leaderboard_rank:2026-10-01','leaderboard:leaderboard_xp:2026-10-01') AND b.created_at>='2026-10-18 00:00:00+00' AND b.created_at<'2026-10-19 00:00:00+00' AND b.status='pending' AND m.sender_id=b.profile_id AND m.content LIKE '%券号：'||left(b.id::text,8) AND m.created_at>=b.created_at);
 GET DIAGNOSTICS n_messages=ROW_COUNT;
 DELETE FROM public.backpack_items WHERE source IN('leaderboard:leaderboard_wins:2026-10-01','leaderboard:leaderboard_rank:2026-10-01','leaderboard:leaderboard_xp:2026-10-01') AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00';
 GET DIAGNOSTICS n_items=ROW_COUNT;
 DELETE FROM public.weekly_leaderboard_rewards WHERE week_start='2026-10-01' AND created_at>='2026-10-18 00:00:00+00' AND created_at<'2026-10-19 00:00:00+00';
 GET DIAGNOSTICS n_rewards=ROW_COUNT;
 PERFORM cron.alter_job(2, active := false);
 UPDATE public.leaderboard_reward_reversal_audit SET result=jsonb_build_object('profiles',n_profiles,'coins',total_coins,'xp',total_xp,'items',n_items,'messages',n_messages,'reward_rows',n_rewards) WHERE batch=batch_key;
END $$;