
-- 1. 清理历史重复 matched 行，每个 profile 仅保留最新一条 matched
DELETE FROM public.match_queue mq
USING (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY profile_id, status ORDER BY created_at DESC) AS rn
  FROM public.match_queue
  WHERE status = 'matched'
) dup
WHERE mq.id = dup.id AND dup.rn > 1;

-- 2. 删除所有遗留的 searching 行（重新匹配会重建）
DELETE FROM public.match_queue WHERE status = 'searching';

-- 3. 唯一索引：每个 profile 只能有一条 searching 记录
CREATE UNIQUE INDEX IF NOT EXISTS match_queue_one_searching_per_profile
  ON public.match_queue (profile_id) WHERE status = 'searching';

-- 4. 重写 find_match：入队前先清理该用户的旧 searching/老 matched 残留
CREATE OR REPLACE FUNCTION public.find_match(
  _profile_id uuid,
  _grade integer,
  _match_type text,
  _elo_rating integer,
  _subject text DEFAULT 'mixed'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _opponent record;
  _match_id uuid;
  _words jsonb;
  _caller uuid;
  _subj text := COALESCE(_subject, 'mixed');
BEGIN
  SELECT user_id INTO _caller FROM profiles WHERE id = _profile_id;
  IF _caller IS NULL OR _caller <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 始终先清掉调用者自己 1 小时前残留的 matched 行，避免前端 maybeSingle 多行报错
  DELETE FROM match_queue
  WHERE profile_id = _profile_id
    AND status = 'matched'
    AND created_at < now() - interval '1 hour';

  SELECT * INTO _opponent
  FROM match_queue
  WHERE status = 'searching'
    AND grade = _grade
    AND match_type = _match_type
    AND profile_id != _profile_id
    AND COALESCE(subject, 'mixed') = _subj
    AND ABS(elo_rating - _elo_rating) <= 300
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _opponent IS NULL THEN
    -- 入队前先清掉自己已有的 searching 行，避免唯一约束冲突
    DELETE FROM match_queue WHERE profile_id = _profile_id AND status = 'searching';
    INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject)
    VALUES (_profile_id, _grade, _match_type, _elo_rating, _subj);
    RETURN NULL;
  END IF;

  IF _subj = 'math' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'science' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 10) w;
  ELSIF _subj = 'mixed' THEN
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (
      (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 4)
      UNION ALL
      (SELECT id, word, meaning, phonetic, example FROM math_words ORDER BY random() LIMIT 3)
      UNION ALL
      (SELECT id, word, meaning, phonetic, example FROM science_words ORDER BY random() LIMIT 3)
    ) w;
  ELSE
    SELECT jsonb_agg(row_to_json(w)) INTO _words
    FROM (SELECT id, word, meaning, phonetic, example FROM words WHERE grade = _grade ORDER BY random() LIMIT 10) w;
  END IF;

  INSERT INTO ranked_matches (player1_id, player2_id, grade, match_type, subject, status, words, started_at)
  VALUES (_opponent.profile_id, _profile_id, _grade, _match_type, _subj, 'in_progress', _words, now())
  RETURNING id INTO _match_id;

  UPDATE match_queue SET status = 'matched', match_id = _match_id WHERE id = _opponent.id;
  -- 删除调用者所有 searching/历史 matched 残留
  DELETE FROM match_queue WHERE profile_id = _profile_id;
  -- 重新插入一条 matched 记录，便于 Realtime/轮询识别
  INSERT INTO match_queue (profile_id, grade, match_type, elo_rating, subject, status, match_id)
  VALUES (_profile_id, _grade, _match_type, _elo_rating, _subj, 'matched', _match_id);

  RETURN _match_id;
END;
$function$;
