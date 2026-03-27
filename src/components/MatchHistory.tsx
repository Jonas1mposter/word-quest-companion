import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, History, Trophy, XCircle, Minus, Swords, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface MatchRecord {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  match_type: string;
  grade: number;
  subject: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  opponent?: {
    username: string;
    avatar_url: string | null;
    level: number;
  };
}

const MatchHistory = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 });

  useEffect(() => {
    if (!profile) return;
    fetchMatches();
  }, [profile]);

  const fetchMatches = async () => {
    if (!profile) return;
    setLoading(true);

    const { data } = await supabase
      .from('ranked_matches')
      .select('*')
      .eq('status', 'completed')
      .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
      .order('ended_at', { ascending: false })
      .limit(50);

    if (data) {
      // Fetch opponent profiles
      const opponentIds = data.map(m => m.player1_id === profile.id ? m.player2_id : m.player1_id).filter(Boolean);
      const uniqueIds = [...new Set(opponentIds)];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, level')
        .in('id', uniqueIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enriched = data.map(m => {
        const opponentId = m.player1_id === profile.id ? m.player2_id : m.player1_id;
        return { ...m, opponent: profileMap.get(opponentId!) };
      });

      setMatches(enriched as MatchRecord[]);

      // Calc stats
      const wins = data.filter(m => m.winner_id === profile.id).length;
      const losses = data.filter(m => m.winner_id && m.winner_id !== profile.id).length;
      const draws = data.filter(m => !m.winner_id).length;
      setStats({
        total: data.length,
        wins,
        losses,
        draws,
        winRate: data.length > 0 ? Math.round((wins / data.length) * 100) : 0,
      });
    }

    setLoading(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <History className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-gaming">对战记录</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Card className="text-center p-3">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">总场次</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
            <p className="text-xs text-muted-foreground">胜利</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-destructive">{stats.losses}</p>
            <p className="text-xs text-muted-foreground">失败</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-primary">{stats.winRate}%</p>
            <p className="text-xs text-muted-foreground">胜率</p>
          </Card>
        </div>

        {/* Match list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : matches.length === 0 ? (
          <Card className="text-center py-12">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">暂无对战记录</p>
            <p className="text-sm text-muted-foreground">去排位赛或自由服开始你的第一场对战吧！</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {matches.map(match => {
              const isWinner = match.winner_id === profile?.id;
              const isDraw = !match.winner_id;
              const isP1 = match.player1_id === profile?.id;
              const myScore = isP1 ? match.player1_score : match.player2_score;
              const oppScore = isP1 ? match.player2_score : match.player1_score;

              return (
                <Card
                  key={match.id}
                  className={cn(
                    "p-4 border-l-4",
                    isWinner && "border-l-green-500",
                    !isWinner && !isDraw && "border-l-destructive",
                    isDraw && "border-l-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isWinner && "bg-green-500/20 text-green-500",
                        !isWinner && !isDraw && "bg-destructive/20 text-destructive",
                        isDraw && "bg-muted text-muted-foreground"
                      )}>
                        {isWinner ? <Trophy className="w-4 h-4" /> : isDraw ? <Minus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{match.opponent?.username || '未知对手'}</span>
                          <Badge variant="secondary" className="text-xs">
                            Lv.{match.opponent?.level || '?'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {match.match_type === 'ranked' ? (
                            <><Swords className="w-3 h-3" /> 排位赛</>
                          ) : (
                            <><Globe className="w-3 h-3" /> 自由服</>
                          )}
                          <span>· {formatDate(match.ended_at || match.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-xl font-bold", isWinner ? "text-green-500" : isDraw ? "text-muted-foreground" : "text-destructive")}>
                        {myScore}
                      </span>
                      <span className="text-muted-foreground mx-1">:</span>
                      <span className="text-xl font-bold text-muted-foreground">{oppScore}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchHistory;
