# 徽章系统全面升级方案

按上传表格重建徽章体系，覆盖 **8 个分阶成就（白/蓝/紫/金）+ 1 个普通成就 + 5 个特殊红色成就**，共 38 枚徽章。

## 1. 数据层（Supabase Migration + Seed）

### 1.1 清理 & 重建 `badges` 表数据
- 清空旧 `badges`、`user_badges`（保留表结构）。
- 插入 38 枚新徽章，字段：`name / description / icon / category / rarity / criteria`。
- 稀有度映射：白→common，蓝→rare，紫→epic，金→legendary，红→mythology。

### 1.2 八大分阶徽章（每个 4 枚）

| 系列 | 描述 | 阶段条件 |
|---|---|---|
| 排位大师 | 传闻一战百神愁 | 排位胜场 10/50/100/500 |
| 词汇学者 | 学富五车，词海无涯 | 掌握英文单词 10/100/500/1000 |
| 淘金客 | 真正的强者实力与机遇并存 | 累计获得狄邦豆 500/1000/5000/10000 |
| 完美主义者 | 我以前有错题恐惧症，现在治好了 | 100% 准确率完成关卡/排位 1/10/50/100 次 |
| 日积月累 | 不积硅步，无以至千里 | 累计登录 10/50/100/365 天 |
| 坚持不懈 | 天选最强打工人 | 连续登录 3/10/50/100 天 |
| 勇攀高峰 | 勇敢的人先享受世界 | 累计获得经验值 100/500/1000/5000 |
| 声名远扬 | 大明星也会有烦恼 | 登上排行榜 1/5/10/20 次 |

### 1.3 普通 & 特殊徽章

- **Bonjour!**（white）—— "Hello, World!" 注册账号即得。
- **双子星**（red）—— 2v2 完赛时累计领先对方 20 分。
- **降维打击**（red）—— 排位赛 10:0 零封对手。
- **GOAT**（red）—— 同一周内三个排行榜均前三。
- **百万英镑**（red）—— 商城内所有可购买音效与名片全部拥有。
- **无限进步**（red）—— 战队内每位队员一周内获得 10 次排位胜利。

### 1.4 新增/扩展字段
- `profiles` 增加 `total_login_days int default 0`、`current_login_streak int default 0`、`last_login_date date`，用于"日积月累/坚持不懈"统计。
- `profiles` 增加 `perfect_clears int default 0` 计数 100% 准确率次数。
- `profiles` 增加 `leaderboard_appearances int default 0`，由 `distribute-leaderboard-cards` 周更累加。

### 1.5 核心判定函数升级 `award_badges_for_profile(p_id uuid)`
SECURITY DEFINER，单次调用扫描以下数据源并写入 `user_badges`（已有则跳过）：
- 排位胜场：`ranked_matches` 中 `winner_id = p_id` 计数。
- 词汇量：`learning_progress` 中 `mastery_level >= 3`（已有口径）。
- 狄邦豆累计：`profiles.lifetime_coins_earned`（新增列，由 process-match/quest 等累加）。
- 100% 准确率次数：`profiles.perfect_clears`。
- 登录天数：`profiles.total_login_days / current_login_streak`。
- 经验：`profiles.xp`。
- 排行榜：`profiles.leaderboard_appearances`。
- 注册：profile 存在即给 Bonjour!。

### 1.6 触发徽章发放的位点
- 现有 `BadgeDisplay` mount 时调用 ✅ 已在
- 关卡完成 / 排位结束 / 商城购买 / 战队挑战完成 后，前端调用 `rpc('award_badges_for_profile')`。

### 1.7 特殊红色成就发放
独立 Edge Function `grant-special-badge`：
- `process-match` 完赛时判定"降维打击"（10-0）→ 调用。
- `Battle2v2Arena` 完赛时判定"双子星"（领先 20）→ 调用。
- `distribute-leaderboard-cards` 周更时判定"GOAT"。
- 商城购买成功后判定"百万英镑"（owned == purchasable）。
- 战队挑战结算时判定"无限进步"。

### 1.8 登录连续性
新增 Edge Function `record-daily-login`，前端 Dashboard 挂载时调用一次，更新 `total_login_days / current_login_streak / last_login_date`，并触发 `award_badges_for_profile`。

## 2. 前端

### 2.1 `src/lib/badgeCriteria.ts`
- 重写 `BADGE_CRITERIA` 与 `BADGE_CRITERIA_FUN`，按新 38 枚徽章名称完整覆盖。

### 2.2 `BadgeDisplay.tsx`
- 按系列分组展示（8 个系列 + 普通 + 特殊），系列内按阶段排序。
- 未获得徽章显示为灰色剪影 + 获取条件文案。
- 红色（mythology）特殊徽章用更显眼的边框/光效。

### 2.3 图标
- 复用 lucide-react，按系列分配（如：排位大师→Swords、词汇学者→BookOpen、淘金客→Coins、完美主义者→Target、日积月累→CalendarDays、坚持不懈→Flame、勇攀高峰→Mountain、声名远扬→Megaphone、双子星→Users、降维打击→Zap、GOAT→Crown、百万英镑→Banknote、无限进步→Infinity、Bonjour!→Sparkles）。

### 2.4 Dashboard
- 在 mount 时调用 `record-daily-login` Edge Function。

## 3. 兼容性
- 旧 `user_badges` 清空：保留功能性数据（profile xp/coins 不动），仅重置成就。会在首次访问时按当前数据回溯发放所有应得的新徽章（`award_badges_for_profile` 会自动补发）。
- `name_cards` / 段位排行榜 / 商城均不受影响。

## 4. 验证
- Vitest 对 `badgeCriteria` 的所有 38 个 key 做存在性快照。
- Deno 测试 `award_badges_for_profile`：构造一个满足"排位大师 I + 词汇学者 II + 日积月累 III"的 profile，断言三个徽章被发放。

—

如批准就开始执行，先 migration，再 Edge Functions，再前端。