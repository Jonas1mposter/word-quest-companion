
ALTER TABLE public.kill_sound_packs ADD COLUMN IF NOT EXISTS icon_urls jsonb;

UPDATE public.kill_sound_packs SET icon_urls = '[
  "/__l5e/assets-v1/fa74a057-4b8d-4d46-bbdd-90ef8ae07370/classic_1.png",
  "/__l5e/assets-v1/6233f1e3-462e-4ee3-8ea1-89aacc4ae6c9/classic_2.png",
  "/__l5e/assets-v1/730ef1d5-4c63-457b-835f-b1a040e5d120/classic_3.png",
  "/__l5e/assets-v1/e735c6ff-45a7-41dc-9b5b-c3d4c4b8999b/classic_4.png",
  "/__l5e/assets-v1/e3df8190-81da-48f2-a1ba-ca61a1ba261b/classic_5.png"
]'::jsonb WHERE code='classic';

UPDATE public.kill_sound_packs SET icon_urls = '[
  "/__l5e/assets-v1/a1ca57ad-5df8-41e3-bab5-8004e0a8b02d/gaia_1.png",
  "/__l5e/assets-v1/cff19651-c6d4-4d70-9cf7-05ca846510fe/gaia_2.png",
  "/__l5e/assets-v1/80505993-1c7d-4d76-8f7b-df9a6a43e552/gaia_3.png",
  "/__l5e/assets-v1/39548dad-17b3-4502-9a17-d48376f3c5fc/gaia_4.png",
  "/__l5e/assets-v1/9b166fac-b8ee-4716-8ca1-4d03a5263552/gaia_5.png"
]'::jsonb WHERE code='gaia_vengeance';

UPDATE public.kill_sound_packs SET icon_urls = '[
  "/__l5e/assets-v1/ccb039ef-cf00-480f-9e46-2fe488dd4677/prime_1.png",
  "/__l5e/assets-v1/5a56b49c-40c1-4b51-8c00-2ece48a17b96/prime_2.png",
  "/__l5e/assets-v1/d4150a02-5f42-491f-9493-7d043f59b80c/prime_3.png",
  "/__l5e/assets-v1/817f0e03-5dba-46a7-9271-41f93793945a/prime_4.png",
  "/__l5e/assets-v1/494e6bde-76c0-41bd-9c3a-8b331515ae7d/prime_5.png"
]'::jsonb WHERE code='prime';

UPDATE public.kill_sound_packs SET icon_urls = '[
  "/__l5e/assets-v1/9fd65cb7-b46d-4d67-bd7a-5d5a086caaaa/evori_1.png",
  "/__l5e/assets-v1/0b8aeea0-a854-4f5a-a8ae-521fb241743b/evori_2.png",
  "/__l5e/assets-v1/3559e56d-7292-4cdc-b691-d7542a12df53/evori_3.png",
  "/__l5e/assets-v1/02677215-b7cb-4c7a-bc9c-00df424eadc6/evori_4.png",
  "/__l5e/assets-v1/c9391777-d252-40f3-b61d-941e532e7250/evori_5.png"
]'::jsonb WHERE code='evori';

UPDATE public.kill_sound_packs SET icon_urls = '[
  "/__l5e/assets-v1/b944d0b3-0e59-4a76-bf27-b5df1753564e/forsaken_1.png",
  "/__l5e/assets-v1/395405e4-c188-4845-9ad0-fbf0a02364d4/forsaken_2.png",
  "/__l5e/assets-v1/a61080f2-2fc5-4506-8adc-4b44a4372ebe/forsaken_3.png",
  "/__l5e/assets-v1/0e426849-c94d-4b9a-bab5-4fefa27b1594/forsaken_4.png",
  "/__l5e/assets-v1/fbbd871b-e049-42fd-8932-d96362e3627c/forsaken_5.png"
]'::jsonb WHERE code='forsaken';
