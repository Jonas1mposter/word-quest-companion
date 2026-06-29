
UPDATE public.badges SET description = CASE name
  -- mythology
  WHEN '内测先驱' THEN '参与狄邦单词通内测的元老'
  WHEN '富可敌国' THEN '累计拥有 1,000,000 狄邦豆'
  WHEN '战神降临' THEN '单局对战达成 50 连击'
  WHEN '无敌战将' THEN '排位赛达到最高段位（不败之巅）'
  WHEN '学习狂人' THEN '连续学习 100 天'
  WHEN '传奇人物' THEN '同时拥有 50 个徽章，成为传奇'
  -- legendary
  WHEN '百战百胜' THEN '排位赛累计获胜 100 场'
  WHEN '化学家' THEN '掌握全部科学（化学）单词'
  WHEN '精准射手' THEN '单局答题正确率达到 100%'
  WHEN '知识渊博' THEN '累计掌握 1000 个单词'
  WHEN '年级之星' THEN '在年级排行榜登顶第一'
  WHEN '生物学家' THEN '掌握全部科学（生物）单词'
  WHEN '金币大亨' THEN '累计拥有 100,000 狄邦豆'
  WHEN '逆风翻盘' THEN '在落后情况下完成对战逆转获胜'
  WHEN '完美主义者' THEN '任意关卡获得 100 分满分'
  WHEN '数学大师' THEN '掌握全部数学单词'
  WHEN '坚持就是胜利' THEN '连续登录学习 30 天'
  -- epic
  WHEN '人气之星' THEN '拥有 20 位以上好友'
  WHEN '勤学苦练' THEN '累计学习 500 个单词'
  WHEN '年级先锋' THEN '在年级排行榜进入前 10 名'
  WHEN '速战速决' THEN '60 秒内完成一局对战并获胜'
  WHEN '连胜王者' THEN '排位赛达成 10 连胜'
  -- rare
  WHEN '小富即安' THEN '累计拥有 10,000 狄邦豆'
  WHEN '社交达人' THEN '添加 5 位好友'
  WHEN '习惯养成' THEN '连续登录学习 7 天'
  -- common
  WHEN '排位先锋' THEN '完成首场排位赛'
  WHEN '银光闪闪' THEN '排位赛达到白银段位'
  WHEN '初露锋芒' THEN '完成首个学习关卡'
  ELSE description
END
WHERE name IN (
  '内测先驱','富可敌国','战神降临','无敌战将','学习狂人','传奇人物',
  '百战百胜','化学家','精准射手','知识渊博','年级之星','生物学家','金币大亨','逆风翻盘','完美主义者','数学大师','坚持就是胜利',
  '人气之星','勤学苦练','年级先锋','速战速决','连胜王者',
  '小富即安','社交达人','习惯养成',
  '排位先锋','银光闪闪','初露锋芒'
);
