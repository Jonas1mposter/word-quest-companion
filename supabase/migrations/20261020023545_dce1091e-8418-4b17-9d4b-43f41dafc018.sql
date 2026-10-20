DO $$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef('public.find_match_2v2(uuid,integer,integer,text,uuid)'::regprocedure) INTO fn;
 IF position('LIMIT 30' in fn)=0 THEN RAISE EXCEPTION 'Unexpected 2v2 definition'; END IF;
 fn=replace(fn,'LIMIT 30','LIMIT 15');
 fn=replace(fn,'LIMIT 12','LIMIT 5');
 fn=replace(fn,'LIMIT 9','LIMIT 5');
 fn=replace(fn,'2v2 题量：30 题','2v2 每名玩家15题，独立作答进度');
 EXECUTE fn;
END $$;
UPDATE public.badges SET description='排位赛领先对手8分及以上' WHERE name='降维打击';
UPDATE public.badges SET description='2v2完赛时己方队伍领先对手队伍15分及以上' WHERE name='双子星';