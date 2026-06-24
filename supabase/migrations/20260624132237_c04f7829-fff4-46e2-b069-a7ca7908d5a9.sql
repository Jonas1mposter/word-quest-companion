CREATE OR REPLACE FUNCTION public.award_badges_for_profile(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof profiles%ROWTYPE;
  learn_cnt int;
  math_cnt int;
  sci_cnt int;
  math_total int;
  sci_total int;
  perfect_cnt int;
  three_star_cnt int;
  inserted int := 0;
  awarded_names text[];
BEGIN
  SELECT * INTO prof FROM profiles WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT count(*) INTO learn_cnt FROM learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO math_cnt FROM math_learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO sci_cnt FROM science_learning_progress WHERE profile_id = p_id AND mastery_level >= 1;
  SELECT count(*) INTO math_total FROM math_words;
  SELECT count(*) INTO sci_total FROM science_words;
  SELECT count(*) INTO perfect_cnt FROM level_progress WHERE profile_id = p_id AND best_score = 100;
  SELECT count(*) INTO three_star_cnt FROM level_progress WHERE profile_id = p_id AND stars >= 3;

  awarded_names := ARRAY[]::text[];

  IF learn_cnt >= 1 OR prof.wins + prof.losses >= 0 THEN
    awarded_names := awarded_names || ARRAY['初出茅庐','初入江湖','初来乍到','新手上路','起步之星'];
  END IF;
  IF learn_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['词汇新秀','词汇学徒','学海无涯']; END IF;
  IF learn_cnt >= 500 THEN awarded_names := awarded_names || ARRAY['词海探险家','词汇达人']; END IF;
  IF learn_cnt >= 1000 THEN awarded_names := awarded_names || ARRAY['单词大师','词汇大师']; END IF;
  IF learn_cnt >= 2000 THEN awarded_names := awarded_names || ARRAY['博学多才','词汇宗师']; END IF;

  IF prof.wins >= 1 THEN awarded_names := awarded_names || ARRAY['首战告捷','初战告捷']; END IF;
  IF prof.wins >= 50 THEN awarded_names := awarded_names || ARRAY['常胜将军']; END IF;
  IF prof.wins + prof.losses >= 100 THEN awarded_names := awarded_names || ARRAY['百战勇士']; END IF;
  IF prof.wins >= 1000 THEN awarded_names := awarded_names || ARRAY['千胜传说']; END IF;
  IF prof.wins >= 100 AND prof.losses * 10 <= prof.wins THEN awarded_names := awarded_names || ARRAY['不败战神']; END IF;

  IF prof.max_combo >= 3 THEN awarded_names := awarded_names || ARRAY['连胜新星']; END IF;
  IF prof.max_combo >= 10 THEN awarded_names := awarded_names || ARRAY['闪电侠']; END IF;
  IF prof.max_combo >= 20 THEN awarded_names := awarded_names || ARRAY['Combo之王']; END IF;

  IF perfect_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['满分学霸','完美主义','完美主义者']; END IF;
  IF three_star_cnt >= 10 THEN awarded_names := awarded_names || ARRAY['三星收割机']; END IF;
  IF perfect_cnt >= 5 THEN awarded_names := awarded_names || ARRAY['完美碾压']; END IF;

  -- 段位 (兼容 master/champion 两种命名)
  IF prof.rank_tier IN ('silver','gold','platinum','diamond','master','champion') THEN awarded_names := awarded_names || ARRAY['白银新秀']; END IF;
  IF prof.rank_tier IN ('gold','platinum','diamond','master','champion') THEN awarded_names := awarded_names || ARRAY['黄金战士']; END IF;
  IF prof.rank_tier IN ('platinum','diamond','master','champion') THEN awarded_names := awarded_names || ARRAY['铂金精英']; END IF;
  IF prof.rank_tier IN ('diamond','master','champion') THEN awarded_names := awarded_names || ARRAY['钻石传说','王者荣耀']; END IF;
  IF prof.rank_tier IN ('master','champion') THEN awarded_names := awarded_names || ARRAY['最强王者','巅峰王者','传奇玩家','狄邦巅峰']; END IF;

  IF prof.coins >= 100 THEN awarded_names := awarded_names || ARRAY['小有积蓄']; END IF;
  IF prof.coins >= 1000 THEN awarded_names := awarded_names || ARRAY['财富新贵','富甲一方']; END IF;
  IF prof.coins >= 5000 THEN awarded_names := awarded_names || ARRAY['金库守护']; END IF;
  IF prof.coins >= 10000 THEN awarded_names := awarded_names || ARRAY['财富传奇']; END IF;

  IF prof.streak >= 3 THEN awarded_names := awarded_names || ARRAY['三日打卡']; END IF;
  IF prof.streak >= 7 THEN awarded_names := awarded_names || ARRAY['坚持不懈']; END IF;
  IF prof.streak >= 30 THEN awarded_names := awarded_names || ARRAY['月度达人','学霸之路']; END IF;
  IF prof.streak >= 100 THEN awarded_names := awarded_names || ARRAY['百日坚持']; END IF;
  IF prof.streak >= 365 THEN awarded_names := awarded_names || ARRAY['全年无休']; END IF;

  IF prof.level >= 10 THEN awarded_names := awarded_names || ARRAY['经验丰富']; END IF;
  IF prof.level >= 20 THEN awarded_names := awarded_names || ARRAY['升级达人']; END IF;
  IF prof.level >= 50 THEN awarded_names := awarded_names || ARRAY['高手之路']; END IF;

  IF math_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['数学启蒙']; END IF;
  IF math_cnt >= 50 THEN awarded_names := awarded_names || ARRAY['数学新手']; END IF;
  IF math_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['数学达人']; END IF;
  IF math_total > 0 AND math_cnt >= math_total THEN awarded_names := awarded_names || ARRAY['数学大师']; END IF;

  IF sci_cnt >= 1 THEN awarded_names := awarded_names || ARRAY['科学启蒙']; END IF;
  IF sci_cnt >= 100 THEN awarded_names := awarded_names || ARRAY['科学新手']; END IF;
  IF sci_cnt >= 300 THEN awarded_names := awarded_names || ARRAY['科学探索者']; END IF;
  IF sci_cnt >= 500 THEN awarded_names := awarded_names || ARRAY['科学先锋']; END IF;
  IF sci_total > 0 AND sci_cnt >= sci_total THEN awarded_names := awarded_names || ARRAY['科学大师']; END IF;

  WITH ins AS (
    INSERT INTO public.user_badges (profile_id, badge_id)
    SELECT p_id, b.id
    FROM public.badges b
    WHERE b.name = ANY(awarded_names)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_badges ub
        WHERE ub.profile_id = p_id AND ub.badge_id = b.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$function$;