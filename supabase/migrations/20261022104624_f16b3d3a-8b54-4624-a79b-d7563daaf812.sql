INSERT INTO public.kill_sound_packs (code,name,description,price,is_default,rarity,preview_icon,sound_urls,icon_url,icon_urls)
VALUES ('reaver','掠影','活动限定 · 6 段专属连杀语音',0,false,'legendary','🗡️',
'["/__l5e/assets-v1/95303d78-346d-49a8-9a00-7712e06a66d7/reaver_1.mp3","/__l5e/assets-v1/6392f5ba-f28e-480a-9f58-275a8882d823/reaver_2.mp3","/__l5e/assets-v1/662df563-3845-4be0-8ec4-32ae400f07e3/reaver_3.mp3","/__l5e/assets-v1/fa245081-d405-4de6-b749-027a84d1a5ad/reaver_4.mp3","/__l5e/assets-v1/58f0c851-e5ef-4a83-b39c-d599bdfc603e/reaver_5.mp3","/__l5e/assets-v1/67f2353a-811a-437c-8a95-e1b3ec1205f1/reaver_6.mp3"]'::jsonb,
'/__l5e/assets-v1/cdd0590c-c640-4190-8b89-8b7e42c9b771/reaver_6.png',
'["/__l5e/assets-v1/9092ad0f-d2c4-46eb-960c-38fc3ef68609/reaver_1.png","/__l5e/assets-v1/c951be8e-d540-4e8c-92be-134a2725dd96/reaver_2.png","/__l5e/assets-v1/9a04b97f-57ea-4b9d-b4e4-578a24637ce3/reaver_3.png","/__l5e/assets-v1/b12ac9e0-4270-4453-9384-5d5ee7f45242/reaver_4.png","/__l5e/assets-v1/0fb0a1c4-cecb-4209-a8a8-69332eae59e0/reaver_5.png","/__l5e/assets-v1/cdd0590c-c640-4190-8b89-8b7e42c9b771/reaver_6.png"]'::jsonb)
ON CONFLICT DO NOTHING;

CREATE TABLE public.event_claims (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, event_code)
);
GRANT SELECT ON public.event_claims TO authenticated;
GRANT ALL ON public.event_claims TO service_role;
ALTER TABLE public.event_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own event claims" ON public.event_claims FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- 活动「掠影首发」：北京时间 10.22–11.22 内完成一场真人排位赛（有本人答题、非人机补位）
CREATE OR REPLACE FUNCTION public.reaver_event_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_done boolean; v_claimed boolean;
BEGIN
  SELECT id INTO v_pid FROM profiles WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN RETURN jsonb_build_object('error','not_logged_in'); END IF;
  SELECT EXISTS (
    SELECT 1 FROM ranked_matches m
    WHERE m.match_type = 'ranked' AND m.status = 'completed'
      AND m.created_at >= '2026-10-22 00:00:00+08'
      AND v_pid IN (m.player1_id, m.player2_id, m.player3_id, m.player4_id)
      AND NOT EXISTS (SELECT 1 FROM match_bot_state b WHERE b.match_id = m.id)
      AND EXISTS (SELECT 1 FROM match_answers a WHERE a.match_id = m.id AND a.player_id = v_pid)
  ) INTO v_done;
  SELECT EXISTS (SELECT 1 FROM event_claims WHERE profile_id = v_pid AND event_code = 'reaver_launch') INTO v_claimed;
  RETURN jsonb_build_object('completed', v_done, 'claimed', v_claimed,
    'active', now() >= '2026-10-22 00:00:00+08' AND now() < '2026-11-23 00:00:00+08');
END $$;

CREATE OR REPLACE FUNCTION public.claim_reaver_event()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_status jsonb; v_pack uuid;
BEGIN
  SELECT id INTO v_pid FROM profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','请先登录'); END IF;
  v_status := reaver_event_status();
  IF NOT (v_status->>'active')::boolean THEN RETURN jsonb_build_object('ok',false,'error','活动不在进行中'); END IF;
  IF (v_status->>'claimed')::boolean THEN RETURN jsonb_build_object('ok',false,'error','已领取'); END IF;
  IF NOT (v_status->>'completed')::boolean THEN RETURN jsonb_build_object('ok',false,'error','需先完成一场排位赛'); END IF;
  INSERT INTO event_claims(profile_id, event_code) VALUES (v_pid,'reaver_launch');
  SELECT id INTO v_pack FROM kill_sound_packs WHERE code = 'reaver';
  INSERT INTO user_kill_sound_packs(profile_id, pack_id) VALUES (v_pid, v_pack) ON CONFLICT DO NOTHING;
  INSERT INTO backpack_items(profile_id, item_type, amount, label, status, source)
  SELECT v_pid, 'lottery_ticket', 1, '抽奖券', 'unused', 'event_reaver_launch' FROM generate_series(1,10);
  RETURN jsonb_build_object('ok',true,'tickets',10);
END $$;

REVOKE ALL ON FUNCTION public.reaver_event_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_reaver_event() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reaver_event_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reaver_event() TO authenticated;