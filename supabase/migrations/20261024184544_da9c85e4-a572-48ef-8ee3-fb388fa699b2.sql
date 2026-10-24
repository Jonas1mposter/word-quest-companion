DO $$ DECLARE src text; BEGIN
 src := pg_get_functiondef('public.orax_beats_draw(uuid)'::regprocedure);
 src := replace(src, 'IF COALESCE(it.lottery_pool_id,''glory-crown'') <> ''orax-beats''', 'IF it.lottery_pool_id IS NOT NULL AND it.lottery_pool_id <> ''orax-beats''');
 EXECUTE src;
END $$;