# 任务清单

- [~] 1. SAT/ACT 词汇导入初中+高中专区 —— OCR 后台识别中（14 进程），提取脚本 /tmp/sat_ocr/extract.py 已就绪；识别完成后运行提取→校验→入库（Level 1→words 初中，Level 2/3+分类词→hs_words subject 'sat'），并同步 HSLevelProgress.tsx / SubjectBattleSelector.tsx 加 'sat' 科目
- [x] 2. 排行榜前十奖励加码 —— weekly_leaderboard_rewards 表已建（幂等），distribute-leaderboard-cards 已加每周奖励（第1名500豆+200XP / 第2名300+150 / 第3名200+100 / 4-10名100+50）并已部署；LeaderboardTabs 加了奖励说明条
- [x] 3. 个人页红色成就扩充 —— 新增 12 枚（6 神话：富甲一方/登峰造极/人机噩梦/无懈可击/经验之神/大满贯；6 传说：学贯中西/千胜传说/全勤传奇/收藏大亨/连击之神/双冠王），award_badges_for_profile 函数已更新，badgeCriteria.ts 文案已同步
