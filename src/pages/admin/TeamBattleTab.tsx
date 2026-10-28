import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Swords, Search, User, Users, Play, FastForward, RefreshCw } from "lucide-react";
import { UserProfile } from "./types";

interface Props {
  users: UserProfile[];
}

interface TeamRow { id: string; name: string }
interface MemberRow { profile_id: string; username: string; grade: number | null }
interface OpenSeries {
  id: string; kind: string; nameA: string; nameB: string;
  winsA: number; winsB: number; currentGame: number; status: string;
  players: { side: number; slot: number; name: string; answered: number; correct: number }[];
}

const PlayerPicker = ({ users, label, picked, onPick, exclude }: {
  users: UserProfile[]; label: string; picked: UserProfile[]; onPick: (u: UserProfile[]) => void; exclude: string[];
}) => {
  const [term, setTerm] = useState("");
  const filtered = users.filter(u => u.username.toLowerCase().includes(term.toLowerCase()) && !exclude.includes(u.id));
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="text-sm font-medium">{label}（{picked.length}/2）</label>
      <div className="flex flex-wrap gap-2">
        {picked.map(u => (
          <span key={u.id} className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs">
            {u.username}
            <button className="text-destructive" onClick={() => onPick(picked.filter(p => p.id !== u.id))}>×</button>
          </span>
        ))}
      </div>
      {picked.length < 2 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索用户名..." value={term} onChange={e => setTerm(e.target.value)} className="pl-10" />
          </div>
          {term && (
            <div className="max-h-40 overflow-y-auto space-y-1 rounded border border-border p-1">
              {filtered.slice(0, 8).map(u => (
                <button key={u.id} onClick={() => { onPick([...picked, u]); setTerm(""); }}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-secondary text-left text-sm">
                  <User className="w-4 h-4 text-primary" />{u.username}
                  <span className="text-xs text-muted-foreground">Lv.{u.level} · {u.grade}年级</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const TeamBattleTab = ({ users }: Props) => {
  const [kind, setKind] = useState<"team" | "casual">("team");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [membersA, setMembersA] = useState<MemberRow[]>([]);
  const [membersB, setMembersB] = useState<MemberRow[]>([]);
  const [pickedA, setPickedA] = useState<string[]>([]);
  const [pickedB, setPickedB] = useState<string[]>([]);
  const [casualA, setCasualA] = useState<UserProfile[]>([]);
  const [casualB, setCasualB] = useState<UserProfile[]>([]);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [grade, setGrade] = useState<string>("auto");
  const [creating, setCreating] = useState(false);
  const [openSeries, setOpenSeries] = useState<OpenSeries[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const loadOpen = () => {
    supabase.rpc("tb_open_series" as any).then(({ data }) => setOpenSeries((data as OpenSeries[]) ?? []));
  };

  useEffect(() => {
    supabase.from("teams").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setTeams((data as TeamRow[]) ?? []));
    loadOpen();
    const t = setInterval(loadOpen, 5000);
    return () => clearInterval(t);
  }, []);

  const act = async (fn: "tb_start_series" | "tb_resume", id: string) => {
    setActing(id);
    try {
      const { data, error } = await supabase.rpc(fn as any, { p_series: id });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) { toast.error(r?.error ?? "操作失败"); return; }
      toast.success(fn === "tb_start_series" ? "已开赛！" : "下一局已开始");
      loadOpen();
    } catch (e: any) { toast.error("操作失败：" + (e?.message || "")); }
    finally { setActing(null); }
  };

  const loadMembers = async (teamId: string, set: (m: MemberRow[]) => void) => {
    if (!teamId) { set([]); return; }
    const { data: ms } = await supabase.from("team_members").select("profile_id").eq("team_id", teamId);
    const ids = (ms ?? []).map((m: any) => m.profile_id);
    if (ids.length === 0) { set([]); return; }
    const { data: ps } = await supabase.from("profiles").select("id, username, grade").in("id", ids);
    set(((ps as any[]) ?? []).map(p => ({ profile_id: p.id, username: p.username, grade: p.grade })));
  };

  useEffect(() => { setPickedA([]); loadMembers(teamA, setMembersA); }, [teamA]);
  useEffect(() => { setPickedB([]); loadMembers(teamB, setMembersB); }, [teamB]);

  const create = async () => {
    const a = kind === "team" ? pickedA : casualA.map(u => u.id);
    const b = kind === "team" ? pickedB : casualB.map(u => u.id);
    if (a.length !== 2 || b.length !== 2) { toast.error("每边需要 2 名选手"); return; }
    if (kind === "casual" && (!nameA.trim() || !nameB.trim())) { toast.error("请填写双方队名"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("tb_create_series" as any, {
        p_kind: kind,
        p_name_a: kind === "team" ? "" : nameA.trim(),
        p_name_b: kind === "team" ? "" : nameB.trim(),
        p_a: a, p_b: b,
        p_grade: grade === "auto" ? null : parseInt(grade),
        p_team_a: kind === "team" ? teamA : null,
        p_team_b: kind === "team" ? teamB : null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) { toast.error(r?.error ?? "创建失败"); return; }
      toast.success("房间已创建！选手打开 /#/team-battle 进房间，人齐后点「开赛」");
      setPickedA([]); setPickedB([]); setCasualA([]); setCasualB([]); setNameA(""); setNameB("");
      loadOpen();
    } catch (e: any) { toast.error("创建失败：" + (e?.message || "")); }
    finally { setCreating(false); }
  };

  const memberBtn = (m: MemberRow, picked: string[], setPicked: (v: string[]) => void, otherPicked: string[]) => {
    const on = picked.includes(m.profile_id);
    const disabled = !on && (picked.length >= 2 || otherPicked.includes(m.profile_id));
    return (
      <button key={m.profile_id} disabled={disabled}
        onClick={() => setPicked(on ? picked.filter(x => x !== m.profile_id) : [...picked, m.profile_id])}
        className={`rounded border px-2 py-1 text-xs ${on ? "border-primary bg-primary/20" : "border-border"} ${disabled ? "opacity-40" : ""}`}>
        {m.username}
      </button>
    );
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Swords className="w-5 h-5 text-accent" />创建 2v2 战队赛（BO3）</CardTitle>
        <CardDescription>每人每局 50 题，三局两胜；全队答对总数高者赢本局，打平比总用时。纯比赛模式，不影响段位、不发豆子。创建后把 /#/team-battle 发给选手。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button variant={kind === "team" ? "default" : "outline"} onClick={() => setKind("team")}><Users className="mr-2 h-4 w-4" />战队对阵</Button>
          <Button variant={kind === "casual" ? "default" : "outline"} onClick={() => setKind("casual")}><User className="mr-2 h-4 w-4" />自由组队</Button>
        </div>

        {kind === "team" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {([["A", teamA, setTeamA, membersA, pickedA, setPickedA, pickedB], ["B", teamB, setTeamB, membersB, pickedB, setPickedB, pickedA]] as const).map(([sd, tid, setTid, members, picked, setPicked, other]) => (
              <div key={sd} className="space-y-2 rounded-lg border border-border p-3">
                <label className="text-sm font-medium">{sd} 方战队</label>
                <select value={tid} onChange={e => setTid(e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
                  <option value="">选择战队…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {tid && (
                  <div className="flex flex-wrap gap-2">
                    {members.length === 0 && <span className="text-xs text-muted-foreground">该战队没有成员</span>}
                    {members.map(m => memberBtn(m, picked, setPicked, other))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">已选 {picked.length}/2 人</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Input placeholder="A 方队名" value={nameA} onChange={e => setNameA(e.target.value)} />
              <PlayerPicker users={users} label="A 方选手" picked={casualA} onPick={setCasualA} exclude={casualB.map(u => u.id)} />
            </div>
            <div className="space-y-2">
              <Input placeholder="B 方队名" value={nameB} onChange={e => setNameB(e.target.value)} />
              <PlayerPicker users={users} label="B 方选手" picked={casualB} onPick={setCasualB} exclude={casualA.map(u => u.id)} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">词库范围</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
            <option value="auto">自动（取四人最高年级）</option>
            <option value="7">7 年级</option>
            <option value="8">8 年级</option>
            <option value="9">高中（9–12 词库）</option>
          </select>
        </div>

        <Button onClick={create} disabled={creating} className="w-full" size="lg">
          <Swords className={`w-4 h-4 mr-2 ${creating ? "animate-spin" : ""}`} />
          {creating ? "创建中..." : "创建比赛"}
        </Button>
      </CardContent>
    </Card>
  );
};
