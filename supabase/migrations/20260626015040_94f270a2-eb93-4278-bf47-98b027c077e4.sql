
-- 表: 音效包定义
CREATE TABLE IF NOT EXISTS public.kill_sound_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sound_urls jsonb NOT NULL,
  preview_icon text,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kill_sound_packs TO anon, authenticated;
GRANT ALL ON public.kill_sound_packs TO service_role;
ALTER TABLE public.kill_sound_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sound packs visible to everyone" ON public.kill_sound_packs FOR SELECT USING (true);

-- 表: 玩家拥有的音效包
CREATE TABLE IF NOT EXISTS public.user_kill_sound_packs (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.kill_sound_packs(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, pack_id)
);
GRANT SELECT ON public.user_kill_sound_packs TO authenticated;
GRANT ALL ON public.user_kill_sound_packs TO service_role;
ALTER TABLE public.user_kill_sound_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own sound packs" ON public.user_kill_sound_packs FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- profiles 添加装备列
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_kill_sound_pack_id uuid REFERENCES public.kill_sound_packs(id) ON DELETE SET NULL;

-- 种子数据
INSERT INTO public.kill_sound_packs (code, name, description, price, is_default, preview_icon, rarity, sound_urls) VALUES
('classic', '经典 · 无畏', '默认连击音效，致敬竞技射击经典。', 0, true, '🎯', 'common', jsonb_build_array(
  '/__l5e/assets-v1/6fad0736-76f6-4123-a31a-b4a760cfdf18/kill_1.mp3',
  '/__l5e/assets-v1/1d252243-8153-407b-8fdf-820a5fcc8727/kill_2.mp3',
  '/__l5e/assets-v1/450ae78c-19fe-48c8-9115-5bab0eb64699/kill_3.mp3',
  '/__l5e/assets-v1/753d872a-6703-41eb-89e4-4885d6dfe4c9/kill_4.mp3',
  '/__l5e/assets-v1/4455823c-5146-428d-ae62-1455ca183df1/kill_5.mp3'
)),
('gaia_vengeance', '盖亚的复仇', '大地觉醒的咆哮，让连击如同自然之力降临。', 2000, false, '🌋', 'epic', jsonb_build_array(
  '/__l5e/assets-v1/565a4172-c313-4d75-acde-01463aa96ea4/gaia_1.mp3',
  '/__l5e/assets-v1/692ad0f2-974b-458e-855a-845fdb2519b1/gaia_2.mp3',
  '/__l5e/assets-v1/01933740-bfd3-45dc-aa0e-4eb5744204bd/gaia_3.mp3',
  '/__l5e/assets-v1/0880431f-1b49-4ace-899b-bb5de42e87d2/gaia_4.mp3',
  '/__l5e/assets-v1/b99761b5-413c-4e99-b934-deb469e113ca/gaia_5.mp3'
))
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  preview_icon = EXCLUDED.preview_icon,
  rarity = EXCLUDED.rarity,
  sound_urls = EXCLUDED.sound_urls;

-- 自动给所有玩家发放默认音效包
INSERT INTO public.user_kill_sound_packs (profile_id, pack_id)
SELECT p.id, sp.id
FROM public.profiles p
CROSS JOIN public.kill_sound_packs sp
WHERE sp.code = 'classic'
ON CONFLICT DO NOTHING;

-- 触发器：新建 profile 自动获得 classic 包
CREATE OR REPLACE FUNCTION public.grant_default_sound_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_kill_sound_packs (profile_id, pack_id)
  SELECT NEW.id, id FROM public.kill_sound_packs WHERE code = 'classic'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_grant_default_sound_pack ON public.profiles;
CREATE TRIGGER profiles_grant_default_sound_pack
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_sound_pack();

-- 购买函数
CREATE OR REPLACE FUNCTION public.purchase_sound_pack(p_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  pack kill_sound_packs%ROWTYPE;
  old_claims text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;
  SELECT * INTO pack FROM kill_sound_packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack not found'; END IF;

  IF EXISTS (SELECT 1 FROM user_kill_sound_packs WHERE profile_id = prof.id AND pack_id = pack.id) THEN
    UPDATE profiles SET active_kill_sound_pack_id = pack.id WHERE id = prof.id;
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'equipped', true);
  END IF;

  IF prof.coins < pack.price THEN
    RETURN jsonb_build_object('error', 'not_enough_coins', 'required', pack.price, 'have', prof.coins);
  END IF;

  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE profiles SET coins = coins - pack.price, active_kill_sound_pack_id = pack.id
    WHERE id = prof.id AND coins >= pack.price;
  IF NOT FOUND THEN
    PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);
    RAISE EXCEPTION 'concurrent update';
  END IF;

  INSERT INTO user_kill_sound_packs (profile_id, pack_id) VALUES (prof.id, pack.id)
    ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);
  RETURN jsonb_build_object('ok', true, 'equipped', true, 'cost', pack.price);
END;
$$;

-- 装备函数
CREATE OR REPLACE FUNCTION public.equip_sound_pack(p_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  prof profiles%ROWTYPE;
  old_claims text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO prof FROM profiles WHERE user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_kill_sound_packs WHERE profile_id = prof.id AND pack_id = p_pack_id) THEN
    RAISE EXCEPTION 'pack not owned';
  END IF;
  old_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE profiles SET active_kill_sound_pack_id = p_pack_id WHERE id = prof.id;
  PERFORM set_config('request.jwt.claims', COALESCE(old_claims,''), true);
  RETURN jsonb_build_object('ok', true);
END;
$$;
