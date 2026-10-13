import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BanInfo {
  profileId: string;
  username?: string;
  bannedUntil: string;
  reason?: string | null;
}

const KEY = "dac-ban-info";

export const showBanScreen = (info: BanInfo) => {
  sessionStorage.setItem(KEY, JSON.stringify(info));
  window.dispatchEvent(new Event("dac-ban"));
};

// 稳定编号：同一账号同一次封禁始终相同
export const banCaseId = (profileId: string, until: string) => {
  let h = 2166136261;
  const s = profileId + "|" + until;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const d = new Date(until);
  return `DAC-${profileId.slice(0, 4).toUpperCase()}-${hex}`;
};

export const BanScreen = () => {
  const [info, setInfo] = useState<BanInfo | null>(null);
  useEffect(() => {
    const load = () => {
      const raw = sessionStorage.getItem(KEY);
      setInfo(raw ? JSON.parse(raw) : null);
    };
    load();
    window.addEventListener("dac-ban", load);
    return () => window.removeEventListener("dac-ban", load);
  }, []);
  if (!info) return null;

  const until = new Date(info.bannedUntil);
  const permanent = until.getFullYear() > 2100;
  const msLeft = until.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const hoursLeft = Math.max(0, Math.ceil(msLeft / 3600000));
  const duration = permanent ? "永久" : daysLeft >= 1 && hoursLeft > 24 ? `剩余 ${daysLeft} 天` : `剩余 ${hoursLeft} 小时`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur p-4">
      <div className="w-full max-w-md border-2 border-destructive bg-card shadow-2xl">
        <div className="flex flex-col items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-6 py-6">
          <ShieldAlert className="h-14 w-14 text-destructive" />
          <div className="text-2xl font-black tracking-widest text-destructive">DAC</div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dipont Anti-Cheat</div>
        </div>
        <div className="space-y-5 px-6 py-6">
          <h2 className="text-center text-xl font-bold text-foreground">
            你的账号已被{permanent ? "永久封禁" : "封禁"}
          </h2>
          {info.username && <p className="text-center text-sm text-muted-foreground">{info.username}</p>}
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">封禁理由</div>
              <div className="mt-1 border border-border bg-muted/40 p-3 text-foreground">{info.reason || "违反狄邦单词通使用规则"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">封禁时长</div>
                <div className="mt-1 font-bold text-destructive">{duration}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">解封时间</div>
                <div className="mt-1 font-semibold text-foreground">{permanent ? "—" : until.toLocaleString()}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">封禁编号</div>
              <div className="mt-1 font-mono text-base tracking-wider text-foreground">{banCaseId(info.profileId, info.bannedUntil)}</div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">如有异议，请携带封禁编号联系管理员申诉。</p>
          <Button className="w-full" variant="outline" onClick={() => { sessionStorage.removeItem(KEY); setInfo(null); }}>
            我知道了
          </Button>
        </div>
      </div>
    </div>
  );
};
