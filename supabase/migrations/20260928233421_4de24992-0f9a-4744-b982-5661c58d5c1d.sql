-- 1. redeem_code 改为接收 user_id，仅 service_role 可执行（前端经 Edge Function 调用）
CREATE OR REPLACE FUNCTION public.redeem_code(p_user_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $redeem$
DECLARE
  v_profile profiles%ROWTYPE;
  v_code redemption_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_code FROM redemption_codes WHERE upper(code) = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_disabled');
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired');
  END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_used_up');
  END IF;
  IF EXISTS (SELECT 1 FROM code_redemptions WHERE code_id = v_code.id AND profile_id = v_profile.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO code_redemptions (code_id, profile_id) VALUES (v_code.id, v_profile.id);
  UPDATE redemption_codes SET uses_count = uses_count + 1 WHERE id = v_code.id;

  IF v_code.reward_type = 'coins' THEN
    UPDATE profiles SET coins = coins + v_code.reward_value WHERE id = v_profile.id;
    PERFORM bump_lifetime_coins(v_profile.id, v_code.reward_value);
  END IF;

  RETURN jsonb_build_object('ok', true, 'reward_type', v_code.reward_type, 'reward_value', v_code.reward_value);
END;
$redeem$;
REVOKE ALL ON FUNCTION public.redeem_code(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_code(uuid, text) TO service_role;

-- 清理旧签名（若存在）
DROP FUNCTION IF EXISTS public.redeem_code(text);

-- 2. RLS 策略：兑换记录玩家只能看自己的；兑换码表不开放直接读取
CREATE POLICY "Users can view own redemptions"
ON public.code_redemptions FOR SELECT TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "No direct code reads"
ON public.redemption_codes FOR SELECT TO authenticated
USING (false);