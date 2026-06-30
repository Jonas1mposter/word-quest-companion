## 2v2 排位赛 完整实现方案

### 一、数据库 schema 调整

**1. 复用 `ranked_matches`，扩展支持 4 人对局**
```sql
ALTER TABLE ranked_matches
  ADD COLUMN mode text DEFAULT '1v1',          -- '1v1' | '2v2'
  ADD COLUMN player3_id uuid REFERENCES profiles(id),
  ADD COLUMN player4_id uuid REFERENCES profiles(id),
  ADD COLUMN team1_score int DEFAULT 0,        -- player1 + player3
  ADD COLUMN team2_score int DEFAULT 0,        -- player2 + player4
  ADD COLUMN winner_team int;                  -- 1 | 2 | null(平局)
```
约定：team1 = {player1, player3}，team2 = {player2, player4}。

**2. 扩展 `match_queue` 支持组队**
```sql
ALTER TABLE match_queue
  ADD COLUMN mode text DEFAULT '1v1',
  ADD COLUMN party_id uuid,                    -- 同 party 的两人一起匹配
  ADD COLUMN party_size int DEFAULT 1;         -- 1=单排, 2=双排
```

**3. 新表 `match_parties`（双排组队邀请）**
```sql
CREATE TABLE match_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES profiles(id),
  member_id uuid REFERENCES profiles(id),      -- 接受邀请后填入
  status text DEFAULT 'pending',               -- pending | ready | queued | closed
  grade int NOT NULL,
  subject text DEFAULT 'mixed',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '5 minutes'
);
-- + GRANT + RLS：参与者可读写
```

### 二、Supabase RPC 与 Edge Function

**1. `find_match_2v2` RPC**
- 入参：`_profile_id`, `_grade`, `_elo`, `_subject`, `_party_id`(可空)
- 流程：
  1. 清理调用者旧 queue 记录
  2. 写入自己（如果 party 已 ready，则一次写两条 `party_size=2` 记录）
  3. 从 queue 中拼凑 4 人（同 grade + subject + mode=2v2，ELO ±400）：
     - 优先：两个 party（duo+duo）
     - 其次：一个 party + 两个 solo
     - 最后：四个 solo
  4. 组队规则：duo 的两人必须同队；solo 拼对手队
  5. 创建 `ranked_matches`（mode='2v2'），10 道题，更新 4 条 queue 为 matched
  6. 返回 match_id

**2. `submit-answer` Edge Function 改造**
- 读到 `mode='2v2'` 时不按 player1/player2 二分，按 team 累加：
  - team1_total = sum(match_answers where player_id in {player1, player3})
  - team2_total = sum(match_answers where player_id in {player2, player4})
- 错题排位扣 1 分逻辑保留
- 结束条件改为：双方各自 10 题答完，或一方 team 总分锁定胜局后立即结算

**3. `process-match` Edge Function 改造**
- `mode==='2v2'` 分支：
  - 计算 team1_score / team2_score / winner_team
  - 每位玩家：ELO = K *(s - expected(self_elo, avg_opponent_elo))
  - 奖励：胜 25 豆 / 20 XP，平 12 豆 / 10 XP，负 8 豆 / 5 XP（沿用 1v1）
  - 段位结算：胜方两人各 +1 星（共享 1v1 段位），负方两人扣星（青铜免扣）
  - 4 人都跑 `award_badges_for_profile`

### 三、前端实现

**1. 新组件 `src/components/Battle2v2Arena.tsx`**
- 基于现有 `BattleArena` 模式，但渲染 4 张 PlayerBattleCard（左 2 右 2）
- 顶部显示 team1 vs team2 实时总分
- 题目仍是个人答（不影响队友显示）
- 复用 `KillStreakBanner`、`useMatchSounds`

**2. 新组件 `src/components/Ranked2v2Battle.tsx`**
- 简包装器，类似 `RankedBattle.tsx` → `BattleArena.tsx`
- 接受 `partyId` 参数

**3. 新组件 `src/components/party/PartyInviteDialog.tsx`**
- 在线好友列表 → 发起组队邀请（写入 `match_parties`）
- Realtime 订阅 `match_parties`，被邀请者收到弹窗 → 接受/拒绝
- ready 后 leader 点"开始匹配"

**4. `DashboardNav` 新增入口 "⚔️ 2v2 排位"**
- 选项：单排（直接进队列）/ 双排（弹 PartyInviteDialog）
- 选完后跳 `Battle2v2Arena`

**5. 子学科选择沿用 `SubjectBattleSelector`**

### 四、技术约定（中文文档）

```
匹配队列状态机:
  solo_queued ──┐
  party_ready ──┼─→ 拼凑4人 ─→ match_created ─→ in_progress ─→ completed
  duo_queued  ──┘
                  ↓ 60s 超时未拼齐
                  fallback: 放宽 ELO 至 ±800

战队队伍编排:
  team1 = [player1, player3]   ← 左侧UI
  team2 = [player2, player4]   ← 右侧UI
  party 双排成员保证同队
```

### 五、迭代验证步骤

1. migration: schema + RLS + GRANT
2. RPC `find_match_2v2`
3. Edge functions 改造 + 单元测试（mocked match）
4. 前端组件 + 路由
5. Playwright 端到端：开 4 个 headless 浏览器验证完整对局
6. 段位/奖励数据库验证

预计改动：3 个 migration、2 个 edge function、5 个新前端文件、3 个改动文件。