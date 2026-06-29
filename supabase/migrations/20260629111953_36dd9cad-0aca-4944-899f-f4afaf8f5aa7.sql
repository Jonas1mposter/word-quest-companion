
INSERT INTO public.kill_sound_packs (code, name, description, price, is_default, preview_icon, rarity, sound_urls, icon_urls, icon_url) VALUES
('kuronami', '塑水宗', '黑波涌动，以水之名收割连击。', 2000, false, '🌊', 'epic',
 jsonb_build_array(
   '/__l5e/assets-v1/cd6fd5f6-b0f6-4bf2-a15c-aaed5bf5d2df/kuronami_1.mp3',
   '/__l5e/assets-v1/198b60bd-3be2-4d18-86dc-ce36f536060e/kuronami_2.mp3',
   '/__l5e/assets-v1/44dd1a8e-2d28-4d5a-b7d4-95dc765eade5/kuronami_3.mp3',
   '/__l5e/assets-v1/c92e9ea7-0d1b-4c8a-a859-b5e8975f27ce/kuronami_4.mp3',
   '/__l5e/assets-v1/481e8b5e-7d47-4f09-8521-68274ff25116/kuronami_5.mp3'
 ),
 jsonb_build_array(
   '/__l5e/assets-v1/17138da3-e844-4f1c-88c4-73d5edbdf28e/kuronami_1.png',
   '/__l5e/assets-v1/aec889a6-92c1-485f-8bd3-d00a7a8e20f8/kuronami_2.png',
   '/__l5e/assets-v1/a5f4f89e-cb7d-4c58-b8bb-918b8ca485dd/kuronami_3.png',
   '/__l5e/assets-v1/dc020777-18d8-4c23-b6c4-b7d16a788760/kuronami_4.png',
   '/__l5e/assets-v1/d446aa1a-cfe2-4103-b6ce-7273a02e7595/kuronami_5.png'
 ),
 '/__l5e/assets-v1/17138da3-e844-4f1c-88c4-73d5edbdf28e/kuronami_1.png'
),
('prelude_to_chaos', '混沌序曲', '混沌降临前的最后乐章，每一击都是宿命的预兆。', 2500, false, '🎼', 'legendary',
 jsonb_build_array(
   '/__l5e/assets-v1/4df3fda6-52d4-4725-b9cf-cad020adf078/prelude_1.mp3',
   '/__l5e/assets-v1/d872ad6d-65d4-410f-86bf-070d368e43a1/prelude_2.mp3',
   '/__l5e/assets-v1/e8a46bd2-992a-4ad8-8e87-fb27fb90b1a7/prelude_3.mp3',
   '/__l5e/assets-v1/dac963a7-4269-43a8-b550-c095ca3ee918/prelude_4.mp3',
   '/__l5e/assets-v1/f3aad6ed-3f0b-459b-b383-cf15b0879747/prelude_5.mp3'
 ),
 jsonb_build_array(
   '/__l5e/assets-v1/37afbb95-999b-4f4d-b67e-cae1cd48f454/prelude_1.png',
   '/__l5e/assets-v1/496cb360-68a8-4595-a265-29bd4ce96ee4/prelude_2.png',
   '/__l5e/assets-v1/73af5c25-4da1-41ee-b23d-0741b0aa614c/prelude_3.png',
   '/__l5e/assets-v1/5a8ac238-64b5-4317-8264-5ef15ef60fcf/prelude_4.png',
   '/__l5e/assets-v1/073e6b82-022f-4f4b-9b16-05d2573a591e/prelude_5.png'
 ),
 '/__l5e/assets-v1/37afbb95-999b-4f4d-b67e-cae1cd48f454/prelude_1.png'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  preview_icon = EXCLUDED.preview_icon,
  rarity = EXCLUDED.rarity,
  sound_urls = EXCLUDED.sound_urls,
  icon_urls = EXCLUDED.icon_urls,
  icon_url = EXCLUDED.icon_url;
