-- 1) 赛季手册经验：同步到用户拥有的所有进行中赛季手册
CREATE OR REPLACE FUNCTION public.add_season_pass_xp(p_profile_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grade int;
  v_season_id uuid;
  v_pass user_season_pass%ROWTYPE;
  v_max_level int;
  v_xp int;
  v_lv int;
  v_next int;
BEGIN
  IF p_xp IS NULL OR p_xp <= 0 THEN RETURN; END IF;

  SELECT grade INTO v_grade FROM profiles WHERE id = p_profile_id;

  -- 目标赛季：所有进行中且用户已有手册的赛季 + 用户年级的进行中赛季
  FOR v_season_id IN
    SELECT DISTINCT s.id FROM seasons s
    LEFT JOIN user_season_pass usp ON usp.season_id = s.id AND usp.profile_id = p_profile_id
    WHERE s.is_active = true AND (usp.id IS NOT NULL OR s.grade = COALESCE(v_grade, 7))
  LOOP
    SELECT * INTO v_pass FROM user_season_pass
      WHERE profile_id = p_profile_id AND season_id = v_season_id;
    IF NOT FOUND THEN
      INSERT INTO user_season_pass (profile_id, season_id)
        VALUES (p_profile_id, v_season_id)
        RETURNING * INTO v_pass;
    END IF;

    SELECT COALESCE(MAX(level), 50) INTO v_max_level FROM season_pass_items WHERE season_id = v_season_id;

    v_xp := COALESCE(v_pass.current_xp, 0) + p_xp;
    v_lv := COALESCE(v_pass.current_level, 1);
    v_next := COALESCE(v_pass.xp_to_next_level, 100);

    WHILE v_xp >= v_next AND v_lv < v_max_level LOOP
      v_xp := v_xp - v_next;
      v_lv := v_lv + 1;
      v_next := 100 + (v_lv - 1) * 20;
    END LOOP;

    IF v_lv >= v_max_level THEN
      v_lv := v_max_level;
      v_xp := 0;
    END IF;

    UPDATE user_season_pass
      SET current_xp = v_xp, current_level = v_lv, xp_to_next_level = v_next
      WHERE id = v_pass.id;
  END LOOP;
END;
$$;

-- 2) DAC (Dipont Anti-Cheat) 反作弊标记表
CREATE TABLE public.dac_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  source text NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dac_flags TO authenticated;
GRANT ALL ON public.dac_flags TO service_role;
ALTER TABLE public.dac_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read dac flags" ON public.dac_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.dac_flag(
  p_profile_id uuid,
  p_source text,
  p_reason text,
  p_severity text DEFAULT 'medium',
  p_meta jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.dac_flags (profile_id, source, reason, severity, meta)
  VALUES (p_profile_id, p_source, p_reason, COALESCE(p_severity, 'medium'), COALESCE(p_meta, '{}'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.dac_flag(uuid, text, text, text, jsonb) TO service_role;