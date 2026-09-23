GRANT SELECT ON public.daily_quests TO anon, authenticated;
GRANT ALL ON public.daily_quests TO service_role;
INSERT INTO public.daily_quests (title, description, quest_type, target, reward_type, reward_amount, is_active)
SELECT * FROM (VALUES
 ('勤学苦练','今天完成 2 个学习关卡','learn',2,'coins',30,true),
 ('词汇达人','今天在闯关中答对 30 道题','words',30,'xp',50,true)
) v(title,description,quest_type,target,reward_type,reward_amount,is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.daily_quests WHERE is_active);