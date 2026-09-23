// Lightweight UI language switch (中文 / English).
// English mode translates rendered text at runtime using a phrase dictionary,
// so existing components don't need rewriting. Vocabulary meanings (Chinese
// definitions of words) are intentionally left as-is.

export type Lang = "zh" | "en";
const KEY = "ui-lang";

export const getLang = (): Lang => {
  try { return localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch { return "zh"; }
};

export const setLang = (lang: Lang) => {
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  window.location.reload();
};

// Exact phrases (whole text node, trimmed)
const EXACT: Record<string, string> = {
  "狄邦单词通": "Dipont WordMaster",
  "主页": "Home", "闯关": "Levels", "错题本": "Mistakes", "排位赛": "Ranked",
  "2v2 排位": "2v2 Ranked", "2v2 练习": "2v2 Practice", "自由服": "Free Play",
  "人机": "vs Bot", "挑战赛": "Challenges", "手册": "Season Pass", "好友": "Friends",
  "战队": "Team", "战绩": "History", "排行榜": "Leaderboard", "个人": "Profile",
  "登录": "Log in", "商城": "Shop", "后台": "Admin", "返回": "Back",
  "登录 / 注册": "Log in / Sign up", "点击切换分区": "Tap to switch zone",
  "请使用学校微软账号登录": "Sign in with your school Microsoft account",
  "使用微软账号登录": "Sign in with Microsoft", "正在跳转...": "Redirecting...",
  "微软登录失败": "Microsoft sign-in failed",
  "高中": "High School", "高中分区": "High School Zone", "分区": "Zone", "年级": "Grade",
  "七年级专区": "Grade 7 Zone", "八年级专区": "Grade 8 Zone",
  "确认选择": "Confirm", "保存中...": "Saving...", "保存": "Save", "取消": "Cancel",
  "确认": "Confirm", "删除": "Delete", "刷新": "Refresh", "加载中...": "Loading...",
  "设置年级失败，请重试": "Failed to set grade, please retry",
  "学习关卡": "Levels", "开始学习": "Start", "继续学习": "Continue", "重玩本单元": "Replay unit",
  "直接练习题": "Practice now", "单元": "Unit",
  "化学": "Chemistry", "数学": "Math", "物理": "Physics", "生物": "Biology",
  "科学": "Science", "经济": "Economics", "英语": "English",
  "化学词汇": "Chemistry words", "数学词汇": "Math words", "物理词汇": "Physics words",
  "生物词汇": "Biology words", "科学词汇": "Science words", "经济词汇": "Economics words",
  "英语词汇": "English words", "综合词汇": "Mixed words", "综合": "Mixed",
  "推荐": "Recommended", "新": "New",
  "选择你想要PK的词汇类型": "Choose the word set to battle with",
  "仅英语课本词汇": "English textbook words only",
  "英语、数学、科学混合出题": "Mixed English, Math & Science",
  "科学、数学混合出题": "Mixed Science & Math",
  "高中五大学科混合出题": "Mixed five high-school subjects",
  "本年级课本单元词汇": "This grade's unit words", "本年级数学术语词汇": "This grade's math terms",
  "与同年级玩家实时对战！": "Battle players in your grade live!",
  "跨年级自由匹配对战！": "Open matchmaking across grades!",
  "选择难度，和 AI 切磋词汇！": "Pick a difficulty and battle the AI!",
  "组队 4 人切磋词汇！": "Team up — 4 players battle!",
  "和 Bot 队友一起对战 2 个 Bot！": "Team with a Bot vs 2 Bots!",
  "登录后参与排位赛": "Log in to play Ranked", "登录后参与自由服": "Log in to play Free Play",
  "登录后参与人机对抗": "Log in to play vs Bot", "登录后参与 2v2 排位赛": "Log in to play 2v2 Ranked",
  "登录后体验 2v2 练习": "Log in to try 2v2 Practice",
  "已退出登录": "Logged out", "已放弃比赛": "Match forfeited", "游客": "Guest",
  "选择正确的中文释义": "Choose the correct meaning", "选择正确的英文单词": "Choose the correct English word",
  "根据中文释义拼写单词": "Spell the word from its meaning", "听音拼写单词": "Listen and spell",
  "点击播放发音": "Tap to play", "根据句子填写单词": "Fill in the blank",
  "显示提示": "Show hint", "隐藏提示": "Hide hint", "显示释义": "Show meaning", "隐藏释义": "Hide meaning",
  "答案解析": "Explanation", "输入英文单词...": "Type the English word...",
  "输入你听到的单词...": "Type what you hear...", "填写缺失的单词...": "Type the missing word...",
  "下一个": "Next", "再战一局": "Play again", "关卡完成！": "Level complete!",
  "✓ 认识": "✓ I know it", "✗ 不认识": "✗ Don't know", "? 模糊": "? Unsure",
  "匹配中...": "Matching...", "2v2 匹配中...": "2v2 matching...", "准备战斗...": "Get ready...",
  "开始匹配": "Find match", "取消匹配": "Cancel", "胜利": "Victory", "失败": "Defeat", "平局": "Draw",
  "剩余时间": "Time left", "简单": "Easy", "中等": "Medium", "困难": "Hard",
  "设置": "Settings", "音效音量": "SFX volume", "音乐音量": "Music volume", "测试音效": "Test sound",
  "测试中...": "Testing...", "班级设置": "Class", "选择班级": "Choose class", "版本": "Version",
  "开发者": "Developer", "用户": "User", "关于": "About", "退出登录": "Log out",
  "语言": "Language", "朗读速度": "Speech speed", "音效包": "Sound pack",
  "个人资料": "Profile", "佩戴的徽章": "Equipped badges", "徽章": "Badges", "称号": "Titles",
  "名片": "Name cards", "历史最佳": "Personal best", "段位": "Rank", "积分": "Points",
  "胜场": "Wins", "胜率": "Win rate", "连胜": "Win streak", "最高连击": "Max combo",
  "等级": "Level", "经验": "XP", "狄邦豆": "Dipont Beans", "能量": "Energy",
  "每日任务": "Daily Quests", "领取": "Claim", "已领取": "Claimed", "未完成": "Incomplete",
  "高级版": "Premium", "免费版": "Free", "赛季手册": "Season Pass", "赛季经验": "Season XP",
  "单次召唤": "Single pull", "十连召唤": "10x pull", "抽卡": "Draw",
  "添加好友": "Add friend", "好友申请": "Friend requests", "删除好友": "Remove friend",
  "在线": "Online", "离线": "Offline", "对战中": "In match", "观战": "Spectate", "邀请对战": "Invite",
  "发送": "Send", "举报": "Report", "屏蔽": "Block", "聊天": "Chat",
  "创建战队": "Create team", "加入战队": "Join team", "退出战队": "Leave team", "队长": "Captain",
  "成员": "Members", "申请加入": "Request to join",
  "对战记录": "Match history", "暂无记录": "No records yet", "全部复习": "Review all",
  "周榜": "Weekly", "总榜": "All-time", "我的排名": "My rank",
  "青铜": "Bronze", "白银": "Silver", "黄金": "Gold", "铂金": "Platinum", "钻石": "Diamond",
  "大师": "Master", "宗师": "Grandmaster", "王者": "Champion", "冠军": "Champion",
  "普通": "Common", "稀有": "Rare", "史诗": "Epic", "传说": "Legendary", "神话": "Mythic",
  "已解锁": "Unlocked", "未解锁": "Locked", "已装备": "Equipped", "装备": "Equip", "卸下": "Unequip",
  "勋章已装备": "Badge equipped", "勋章已卸下": "Badge unequipped",
  "单挑": "1v1", "三杀": "Triple kill", "双杀": "Double kill", "四杀": "Quadra kill", "五杀": "Penta kill",
};

// Substring replacements for phrases embedded in longer text (applied in order)
const PARTS: [RegExp, string][] = [
  [/狄邦单词通/g, "Dipont WordMaster"],
  [/狄邦豆/g, " Dipont Beans "],
  [/赛季经验/g, " Season XP "],
  [/能量/g, " Energy "],
  [/第\s*(\d+)\s*关/g, "Level $1"],
  [/第\s*(\d+)\s*单元/g, "Unit $1"],
  [/(\d+)\s*年级/g, "Grade $1"],
  [/([一二三四五六七八])年级/g, (_m: string, c: string) => `Grade ${"一二三四五六七八".indexOf(c) + 1}`] as any,
  [/高中/g, "High School "],
  [/经验/g, " XP"],
  [/单元/g, " Unit "],
  [/个词/g, " words"],
  [/关卡/g, " levels"],
  [/分钟/g, " min"],
];

const HAN = /[\u4e00-\u9fff]/;

export const translate = (s: string): string => {
  if (!s || !HAN.test(s)) return s;
  const trimmed = s.trim();
  const exact = EXACT[trimmed];
  if (exact) return s.replace(trimmed, exact);
  // Subject labels like "🧪 科学词汇"
  const m = trimmed.match(/^(\W*?)\s*([\u4e00-\u9fff].*)$/u);
  if (m && EXACT[m[2]]) return s.replace(m[2], EXACT[m[2]]);
  let out = s;
  for (const [re, rep] of PARTS) out = out.replace(re, rep as any);
  return out.replace(/ {2,}/g, " ");
};

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];

const processNode = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const p = node.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest("[data-no-translate]")) return;
    const v = node.nodeValue || "";
    const t = translate(v);
    if (t !== v) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (SKIP.has(el.tagName) && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
  if (el.closest("[data-no-translate]")) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && HAN.test(v)) {
      const t = translate(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
  if (SKIP.has(el.tagName)) return;
  el.childNodes.forEach(processNode);
};

export const startTranslator = () => {
  if (getLang() !== "en" || typeof MutationObserver === "undefined") return;
  document.documentElement.lang = "en";
  document.title = "Dipont WordMaster";
  processNode(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") processNode(m.target);
      else if (m.type === "attributes") processNode(m.target);
      else m.addedNodes.forEach(processNode);
    }
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  });
};
