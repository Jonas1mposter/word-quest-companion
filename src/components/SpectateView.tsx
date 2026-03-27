import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Eye, Loader2, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PlayerBattleCard from "./battle/PlayerBattleCard";

interface SpectateViewProps {
  matchId: string;
  onBack: () => void;
}

const SpectateView = ({ matchId, onBack }: SpectateViewProps) => {
  const [match, setMatch] = useState<any>(null);
  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [currentWord, setCurrentWord] = useState<any>(null);
  const [p1Answers, setP1Answers] = useState(0);
  const [p2Answers, setP2Answers] = useState(0);
  const [matchOver, setMatchOver] = useState(false);

  useEffect(() => {
    loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ranked_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!data) {
      setLoading(false);
      return;
    }

    setMatch(data);
    setP1Score(data.player1_score);
    setP2Score(data.player2_score);
    
    if (data.status === 'completed') {
      setMatchOver(true);
    }

    const words = (data.words as any[]) || [];
    if (words.length > 0) setCurrentWord(words[0]);

    // Load players
    const [{ data: p1 }, { data: p2 }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', data.player1_id!).single(),
      supabase.from('profiles').select('*').eq('id', data.player2_id!).single(),
    ]);
    setPlayer1(p1);
    setPlayer2(p2);

    // Get current answer counts
    const { data: answers } = await supabase
      .from('match_answers')
      .select('player_id')
      .eq('match_id', matchId);
    
    if (answers) {
      setP1Answers(answers.filter(a => a.player_id === data.player1_id).length);
      setP2Answers(answers.filter(a => a.player_id === data.player2_id).length);
    }

    // Subscribe to real-time updates
    const channel = supabase.channel(`spectate-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_answers',
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const answer = payload.new as any;
        if (answer.player_id === data.player1_id) {
          if (answer.is_correct) setP1Score(prev => prev + 1);
          setP1Answers(prev => prev + 1);
        } else {
          if (answer.is_correct) setP2Score(prev => prev + 1);
          setP2Answers(prev => prev + 1);
        }
        // Update current word being shown
        const maxAnswer = Math.max(
          answer.player_id === data.player1_id ? answer.question_index : 0,
          answer.player_id === data.player2_id ? answer.question_index : 0
        );
        if (words[maxAnswer]) setCurrentWord(words[maxAnswer]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ranked_matches',
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setP1Score(updated.player1_score);
        setP2Score(updated.player2_score);
        if (updated.status === 'completed') {
          setMatchOver(true);
          setMatch(updated);
        }
      })
      .subscribe();

    setLoading(false);
    return () => { supabase.removeChannel(channel); };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Eye className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4">比赛未找到</h2>
          <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button>
        </div>
      </div>
    );
  }

  const totalQuestions = ((match.words as any[]) || []).length;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />返回
          </Button>
          <Badge variant="default" className="animate-pulse">
            <Eye className="w-3 h-3 mr-1" />
            {matchOver ? '比赛结束' : '观战中'}
          </Badge>
        </div>

        {/* Players and scores */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="text-center flex-1">
            <PlayerBattleCard
              profile={player1 ? {
                id: player1.id,
                username: player1.username,
                level: player1.level,
                rank_tier: player1.rank_tier,
                rank_stars: player1.rank_stars,
                wins: player1.wins,
                losses: player1.losses,
                avatar_url: player1.avatar_url,
              } : null}
              variant="left"
              className="mx-auto"
            />
            <p className="text-4xl font-gaming text-primary mt-4">{p1Score}</p>
            <p className="text-xs text-muted-foreground">已答 {p1Answers}/{totalQuestions}</p>
          </div>
          
          <div className="text-3xl font-gaming text-muted-foreground">VS</div>
          
          <div className="text-center flex-1">
            <PlayerBattleCard
              profile={player2 ? {
                id: player2.id,
                username: player2.username,
                level: player2.level,
                rank_tier: player2.rank_tier,
                rank_stars: player2.rank_stars,
                wins: player2.wins,
                losses: player2.losses,
                avatar_url: player2.avatar_url,
              } : null}
              variant="right"
              className="mx-auto"
            />
            <p className="text-4xl font-gaming text-neon-blue mt-4">{p2Score}</p>
            <p className="text-xs text-muted-foreground">已答 {p2Answers}/{totalQuestions}</p>
          </div>
        </div>

        {/* Current word display */}
        {currentWord && !matchOver && (
          <Card className="max-w-md mx-auto p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">当前题目</p>
            <h3 className="text-3xl font-gaming mb-2">{currentWord.word}</h3>
            {currentWord.phonetic && <p className="text-muted-foreground">{currentWord.phonetic}</p>}
            <p className="text-lg mt-2">{currentWord.meaning}</p>
          </Card>
        )}

        {/* Match over result */}
        {matchOver && (
          <Card className="max-w-md mx-auto p-6 text-center">
            <h3 className="text-2xl font-gaming mb-2">
              {!match.winner_id ? '平局！' : 
                match.winner_id === player1?.id ? `${player1?.username} 获胜！` : 
                `${player2?.username} 获胜！`}
            </h3>
            <p className="text-muted-foreground">最终比分 {p1Score} : {p2Score}</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SpectateView;
