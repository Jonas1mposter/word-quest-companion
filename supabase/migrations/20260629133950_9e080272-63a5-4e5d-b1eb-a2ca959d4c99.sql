
-- 1) Insert protocol 781-a sound pack (legendary, 2000)
INSERT INTO public.kill_sound_packs (code, name, description, rarity, price, is_default, preview_icon, icon_url, icon_urls, sound_urls)
VALUES (
  'protocol781', '781协议', '机密档案 · 协议启动，靶标即沉默。', 'legendary', 2000, false, '🛰️',
  '/__l5e/assets-v1/a6c90d22-12ea-4882-9c69-f9ca004406f8/protocol781_1.png',
  to_jsonb(ARRAY[
    '/__l5e/assets-v1/a6c90d22-12ea-4882-9c69-f9ca004406f8/protocol781_1.png',
    '/__l5e/assets-v1/efc01405-f2a4-48b3-a03f-ccb3dac6f7e9/protocol781_2.png',
    '/__l5e/assets-v1/d3e36339-70c6-49f0-87b5-68af962102e8/protocol781_3.png',
    '/__l5e/assets-v1/857d01f3-1548-47a1-883e-a1c3a5f9830c/protocol781_4.png',
    '/__l5e/assets-v1/7e966276-0503-4722-bec5-ffe8d689380e/protocol781_5.png'
  ]),
  to_jsonb(ARRAY[
    '/__l5e/assets-v1/685c6940-82c8-449b-89d2-5bb322767fcb/protocol781_1.mp3',
    '/__l5e/assets-v1/d2f0e50d-1459-4dd8-b141-973f61f041d6/protocol781_2.mp3',
    '/__l5e/assets-v1/4c3a6b1e-2b0e-41e6-9ffe-a5238d5f0a91/protocol781_3.mp3',
    '/__l5e/assets-v1/aead77e7-c5b4-4e9c-a0b5-70eb756d11be/protocol781_4.mp3',
    '/__l5e/assets-v1/3dd50bd9-83dd-4ec0-9e14-7229ea8a4eae/protocol781_5.mp3'
  ])
) ON CONFLICT (code) DO NOTHING;

INSERT INTO public.kill_sound_packs (code, name, description, rarity, price, is_default, preview_icon, icon_url, icon_urls, sound_urls)
VALUES (
  'origin', '起源', 'S1「起源」赛季手册 50 级高级专属 · 万物伊始之音。', 'mythology', 0, false, '🌌',
  '/__l5e/assets-v1/573dc87a-8361-4fd0-91d5-d0e9b5935548/origin_1.png',
  to_jsonb(ARRAY[
    '/__l5e/assets-v1/573dc87a-8361-4fd0-91d5-d0e9b5935548/origin_1.png',
    '/__l5e/assets-v1/4e2b840e-4749-4b5e-b30a-d76ea952b1ab/origin_2.png',
    '/__l5e/assets-v1/e5f8d01d-376c-4778-8088-5e4d3d69155e/origin_3.png',
    '/__l5e/assets-v1/602ef757-c86a-4fd5-896d-be96794deafd/origin_4.png',
    '/__l5e/assets-v1/ac9d4d73-de53-4dd3-93b4-75b6cb601f0b/origin_5.png'
  ]),
  to_jsonb(ARRAY[
    '/__l5e/assets-v1/e95f69e2-82e4-4fde-9fd3-a1778b254d48/origin_1.mp3',
    '/__l5e/assets-v1/97618f00-8667-4468-b47b-a9aacfe2f4d4/origin_2.mp3',
    '/__l5e/assets-v1/44a723f8-41d9-4b9d-a0ac-09a56c854bf1/origin_3.mp3',
    '/__l5e/assets-v1/61d14618-984f-4f13-ac07-61fd03e0c8ef/origin_4.mp3',
    '/__l5e/assets-v1/8819fe52-7393-4b04-ad2a-c2fbe85199df/origin_5.mp3'
  ])
) ON CONFLICT (code) DO NOTHING;

-- 2) Add reward_meta to season_pass_items
ALTER TABLE public.season_pass_items ADD COLUMN IF NOT EXISTS reward_meta jsonb;

-- 3) Extend active S1 seasons from 30 → 50 levels
DO $$
DECLARE
  s_id uuid;
  lv int;
  origin_pack_id uuid;
BEGIN
  SELECT id INTO origin_pack_id FROM public.kill_sound_packs WHERE code='origin' LIMIT 1;

  FOR s_id IN SELECT id FROM public.seasons WHERE is_active = true LOOP
    FOR lv IN 31..49 LOOP
      IF NOT EXISTS (SELECT 1 FROM public.season_pass_items WHERE season_id=s_id AND level=lv AND is_premium=false) THEN
        INSERT INTO public.season_pass_items (season_id, level, is_premium, reward_type, reward_value, name, description, icon)
        VALUES (
          s_id, lv, false,
          CASE WHEN lv % 3 = 0 THEN 'energy' WHEN lv % 2 = 0 THEN 'xp' ELSE 'coins' END,
          CASE WHEN lv % 3 = 0 THEN 5 WHEN lv % 2 = 0 THEN 80 + lv*3 ELSE 60 + lv*4 END,
          CASE WHEN lv % 3 = 0 THEN '能量 ×5' WHEN lv % 2 = 0 THEN (80 + lv*3)::text || ' 经验' ELSE (60 + lv*4)::text || ' 狄邦豆' END,
          '免费等级奖励',
          CASE WHEN lv % 3 = 0 THEN 'Zap' WHEN lv % 2 = 0 THEN 'Star' ELSE 'Coins' END
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.season_pass_items WHERE season_id=s_id AND level=lv AND is_premium=true) THEN
        INSERT INTO public.season_pass_items (season_id, level, is_premium, reward_type, reward_value, name, description, icon)
        VALUES (
          s_id, lv, true,
          CASE WHEN lv % 3 = 0 THEN 'energy' WHEN lv % 2 = 0 THEN 'xp' ELSE 'coins' END,
          CASE WHEN lv % 3 = 0 THEN 12 WHEN lv % 2 = 0 THEN 180 + lv*6 ELSE 150 + lv*8 END,
          CASE WHEN lv % 3 = 0 THEN '高级能量 ×12' WHEN lv % 2 = 0 THEN '高级 ' || (180 + lv*6)::text || ' 经验' ELSE '高级 ' || (150 + lv*8)::text || ' 狄邦豆' END,
          '高级版专属奖励',
          CASE WHEN lv % 3 = 0 THEN 'Zap' WHEN lv % 2 = 0 THEN 'Star' ELSE 'Coins' END
        );
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.season_pass_items WHERE season_id=s_id AND level=50 AND is_premium=false) THEN
      INSERT INTO public.season_pass_items (season_id, level, is_premium, reward_type, reward_value, name, description, icon)
      VALUES (s_id, 50, false, 'coins', 3000, '完赛奖励 3000 狄邦豆', 'S1 50 级完赛纪念', 'Coins');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.season_pass_items WHERE season_id=s_id AND level=50 AND is_premium=true) THEN
      INSERT INTO public.season_pass_items (season_id, level, is_premium, reward_type, reward_value, name, description, icon, reward_meta)
      VALUES (
        s_id, 50, true, 'kill_sound_pack', 1,
        '神话连杀音效「起源」',
        'S1 高级手册 50 级专属：解锁神话级连杀音效包「起源」',
        'Sparkles',
        jsonb_build_object('pack_id', origin_pack_id)
      );
    END IF;
  END LOOP;
END $$;
