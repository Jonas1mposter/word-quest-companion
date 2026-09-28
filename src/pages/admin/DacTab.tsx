import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, RefreshCw, Loader2, Swords, Search, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface DacFlag {
  id: string;
  profile_id: string;
  source: string;
  reason: string;
  severity: string;
  meta: Record<string, any>;
  created_at: string;
  profiles?: { username: string } | null;
}

interface MatchRow {
  id: string;
  grade: number;
  mode: string;
  match_type: string;
  status: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  player1_score: number;
  player2_score: number;
  team1_score: number;
  team2_score: number;
  winner_id: string | null;
  winner_team: number | null;
  created_at: string;
  ended_at: string | null;
}

interface MatchAnswer {
  id: string;
  player_id: string;
  question_index: number;
  answer: string | null;
  is_correct: boolean;
  answered_at: string;
}

const REASON_LABELS: Record<string, string> = {
  impossible_answer_speed: "答题速度异常（对局）",
  impossible_level_speed: "过关速度异常（闯关）",
};

const SOURCE_LABELS: Record<string, string> = {
  "submit-answer": "对战答题",
  "complete-level": "闯关结算",
};

const MODE_LABELS: Record<string, string> = {
  ranked: "排位赛",
  free: "自由服",
  "2v2": "2v2",
  bot: "人机",
};

const STATUS_LABELS: Record<string, string> = {
  finished: "已结束",
  in_progress: "进行中",
  waiting: "等待中",
  cancelled: "已取消",
};

export function DacTab() {
  const [flags, setFlags] = useState<DacFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<MatchAnswer[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);

  const fetchFlags = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dac_flags")
      .select("*, profiles(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("DAC flags fetch failed", error);
    setFlags((data as any) ?? []);
    setLoading(false);
  };

  const fetchMatches = async () => {
    setMatchesLoading(true);
    const { data, error } = await supabase
      .from("ranked_matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("Matches fetch failed", error);
      setMatchesLoading(false);
      return;
    }
    const rows = (data as MatchRow[]) ?? [];
    setMatches(rows);

    const ids = Array.from(
      new Set(
        rows.flatMap((m) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id]).filter(Boolean) as string[]
      )
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.username; });
      setNameMap(map);
    }
    setMatchesLoading(false);
  };

  const toggleAnswers = async (matchId: string) => {
    if (expandedId === matchId) {
      setExpandedId(null);
      setAnswers([]);
      return;
    }
    setExpandedId(matchId);
    setAnswersLoading(true);
    const { data, error } = await supabase
      .from("match_answers")
      .select("*")
      .eq("match_id", matchId)
      .order("question_index", { ascending: true });
    if (error) console.error("Match answers fetch failed", error);
    setAnswers((data as MatchAnswer[]) ?? []);
    setAnswersLoading(false);
  };

  useEffect(() => {
    fetchFlags();
    fetchMatches();
  }, []);

  const severityVariant = (s: string) =>
    s === "high" ? "destructive" : s === "medium" ? "default" : "outline";

  const playerName = (id: string | null) => (id ? nameMap[id] ?? id.slice(0, 8) : "—");

  const filteredMatches = matches.filter((m) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const names = [m.player1_id, m.player2_id, m.player3_id, m.player4_id]
      .map((id) => (id ? nameMap[id] ?? "" : ""));
    return names.some((n) => n.toLowerCase().includes(q)) || m.id.toLowerCase().includes(q);
  });

  const matchDuration = (m: MatchRow) => {
    if (!m.ended_at) return null;
    const secs = Math.round((new Date(m.ended_at).getTime() - new Date(m.created_at).getTime()) / 1000);
    return secs >= 0 ? `${secs}秒` : null;
  };

  return (
    <Card variant="gaming">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            DAC 反作弊监控
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { fetchFlags(); fetchMatches(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Dipont Anti-Cheat 自动检测答题/闯关速度异常。标记仅作记录，不影响玩家正常结算。
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="flags" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="flags" className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              可疑标记
              <Badge variant="outline" className="ml-1">{flags.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-2">
              <Swords className="w-4 h-4" />
              对局记录
              <Badge variant="outline" className="ml-1">{matches.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flags">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : flags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无可疑记录，一切正常 🛡️
              </div>
            ) : (
              <div className="space-y-2">
                {flags.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50"
                  >
                    <Badge variant={severityVariant(f.severity) as any} className="shrink-0">
                      {f.severity === "high" ? "高危" : f.severity === "medium" ? "可疑" : "提示"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{f.profiles?.username ?? "未知玩家"}</span>
                        <span className="text-sm text-muted-foreground">
                          {REASON_LABELS[f.reason] ?? f.reason}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        来源：{SOURCE_LABELS[f.source] ?? f.source}
                        {typeof f.meta?.elapsedMs === "number" && ` · 用时 ${f.meta.elapsedMs}ms`}
                        {typeof f.meta?.perWordMs === "number" && ` · 每题 ${f.meta.perWordMs}ms`}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: zhCN })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="按玩家名或对局ID搜索…"
                className="pl-9"
              />
            </div>
            {matchesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">没有匹配的对局记录</div>
            ) : (
              <div className="space-y-2">
                {filteredMatches.map((m) => {
                  const is2v2 = m.mode === "2v2" || m.player3_id || m.player4_id;
                  const dur = matchDuration(m);
                  const expanded = expandedId === m.id;
                  return (
                    <div key={m.id} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                      <button
                        onClick={() => toggleAnswers(m.id)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {MODE_LABELS[m.mode] ?? m.mode}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            {is2v2 ? (
                              <span className="font-medium">
                                {playerName(m.player1_id)} & {playerName(m.player3_id)}
                                <span className="text-muted-foreground mx-1">vs</span>
                                {playerName(m.player2_id)} & {playerName(m.player4_id)}
                              </span>
                            ) : (
                              <span className="font-medium">
                                {playerName(m.player1_id)}
                                <span className="text-muted-foreground mx-1">vs</span>
                                {playerName(m.player2_id)}
                              </span>
                            )}
                            <span className="text-primary font-bold">
                              {is2v2 ? `${m.team1_score} : ${m.team2_score}` : `${m.player1_score} : ${m.player2_score}`}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            G{m.grade} · {STATUS_LABELS[m.status] ?? m.status}
                            {dur && ` · 用时 ${dur}`}
                            {m.winner_id && ` · 胜者：${playerName(m.winner_id)}`}
                            {m.winner_team != null && ` · 胜方：队伍${m.winner_team}`}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: zhCN })}
                        </span>
                        {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                      </button>
                      {expanded && (
                        <div className="border-t border-border/50 p-3 bg-background/40">
                          {answersLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          ) : answers.length === 0 ? (
                            <div className="text-center py-3 text-sm text-muted-foreground">本局无答题明细</div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground mb-2">
                                答题明细（共 {answers.length} 条）· 对局ID：{m.id}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {answers.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-secondary/30"
                                  >
                                    <span className="text-muted-foreground w-8">Q{a.question_index + 1}</span>
                                    <span className="font-medium truncate flex-1">{playerName(a.player_id)}</span>
                                    <span className="truncate max-w-[120px]">{a.answer ?? "（未作答）"}</span>
                                    <Badge
                                      variant={a.is_correct ? "default" : "destructive"}
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      {a.is_correct ? "对" : "错"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
