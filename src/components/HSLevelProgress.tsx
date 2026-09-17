import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Star, Loader2, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";

export interface HSWord {
  id: string;
  word: string;
  meaning: string;
  phonetic: string | null;
  definition: string | null;
  example: string | null;
  subject: string;
  unit: number;
  unit_name: string | null;
}

interface HSLevelProgressProps {
  onSelectLevel: (levelId: string, levelName: string, words: HSWord[], mode?: "learn" | "quiz") => void;
}

// Subject display config (extend as more subjects are imported)
export const HS_SUBJECT_CONFIG: Record<string, { name: string; color: string; gradient: string }> = {
  economics: { name: "经济", color: "text-amber-500", gradient: "from-amber-500 to-yellow-600" },
  physics: { name: "物理", color: "text-orange-500", gradient: "from-orange-500 to-red-500" },
  chemistry: { name: "化学", color: "text-blue-500", gradient: "from-blue-500 to-cyan-500" },
  biology: { name: "生物", color: "text-green-500", gradient: "from-green-500 to-emerald-600" },
  math: { name: "数学", color: "text-purple-500", gradient: "from-purple-500 to-indigo-500" },
};

const HSLevelProgress = ({ onSelectLevel }: HSLevelProgressProps) => {
  const { profile } = useAuth();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(["economics"]));
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const { data: allWords = [], isLoading: wordsLoading } = useQuery({
    queryKey: ["hs-words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hs_words" as any)
        .select("id, word, meaning, phonetic, definition, example, subject, unit, unit_name")
        .order("subject", { ascending: true })
        .order("unit", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as HSWord[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: userProgress = {}, isLoading: progressLoading } = useQuery({
    queryKey: ["hs-learning-progress", profile?.id],
    queryFn: async () => {
      if (!profile) return {};
      const { data, error } = await supabase
        .from("hs_learning_progress" as any)
        .select("word_id, mastery_level")
        .eq("profile_id", profile.id);
      if (error) throw error;
      const map: Record<string, { mastery_level: number }> = {};
      (data as any[])?.forEach((p) => {
        map[p.word_id] = { mastery_level: p.mastery_level };
      });
      return map;
    },
    enabled: !!profile,
    staleTime: 30 * 1000,
  });

  const loading = wordsLoading || progressLoading;

  const subjects = useMemo(() => {
    const groups: Record<string, Record<number, { unitName: string; words: HSWord[] }>> = {};
    allWords.forEach((w) => {
      if (!groups[w.subject]) groups[w.subject] = {};
      if (!groups[w.subject][w.unit]) groups[w.subject][w.unit] = { unitName: w.unit_name || `Unit ${w.unit}`, words: [] };
      groups[w.subject][w.unit].words.push(w);
    });
    return Object.entries(groups).map(([subject, units]) => ({
      subject,
      units: Object.entries(units)
        .map(([unit, v]) => ({ unit: Number(unit), unitName: v.unitName, words: v.words }))
        .sort((a, b) => a.unit - b.unit),
      totalWords: allWords.filter(w => w.subject === subject).length,
      completedWords: allWords.filter(w => w.subject === subject && userProgress[w.id]?.mastery_level >= 1).length,
    }));
  }, [allWords, userProgress]);

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  };

  const getUnitStars = (words: HSWord[]) => {
    if (words.length === 0) return 0;
    const ratio = words.filter(w => userProgress[w.id]?.mastery_level >= 1).length / words.length;
    if (ratio === 1) return 3;
    if (ratio >= 0.7) return 2;
    if (ratio >= 0.3) return 1;
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        高中分区词汇正在录入中，敬请期待
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
        <GraduationCap className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-muted-foreground">
          <span className="text-foreground font-medium">高中分区</span> - 国际课程学科词汇（IB / AP / A-Level / IG）
        </span>
      </div>

      {subjects.map(({ subject, units, totalWords, completedWords }, sIdx) => {
        const cfg = HS_SUBJECT_CONFIG[subject] || { name: subject, color: "text-primary", gradient: "from-primary to-primary/60" };
        const isExpanded = expandedSubjects.has(subject);
        const isComplete = totalWords > 0 && completedWords === totalWords;

        return (
          <Collapsible key={subject} open={isExpanded} onOpenChange={() => setExpandedSubjects(prev => toggleSet(prev, subject))}>
            <Card
              variant={isComplete ? "gold" : "glow"}
              className="transition-all duration-300 animate-slide-up overflow-hidden"
              style={{ animationDelay: `${sIdx * 0.05}s` }}
            >
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br",
                      isComplete ? "from-success to-emerald-600 shadow-success/30" : cfg.gradient
                    )}>
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-gaming text-base">{cfg.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{units.length} 单元</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{completedWords}/{totalWords} 个单词</p>
                      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn("h-full bg-gradient-to-r transition-all duration-500", cfg.gradient)}
                          style={{ width: totalWords ? `${(completedWords / totalWords) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </CardContent>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2">
                  {units.map(({ unit, unitName, words }) => {
                    const key = `${subject}-${unit}`;
                    const unitOpen = expandedUnits.has(key);
                    const done = words.filter(w => userProgress[w.id]?.mastery_level >= 1).length;
                    const unitComplete = done === words.length && words.length > 0;
                    const stars = getUnitStars(words);

                    return (
                      <Collapsible key={key} open={unitOpen} onOpenChange={() => setExpandedUnits(prev => toggleSet(prev, key))}>
                        <div className={cn(
                          "rounded-lg border transition-all",
                          unitComplete ? "bg-success/10 border-success/20" : "bg-secondary/30 border-border/40"
                        )}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/40 rounded-lg transition-colors">
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold bg-gradient-to-br text-white",
                                unitComplete ? "from-success to-emerald-600" : cfg.gradient
                              )}>
                                {unit}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{unitName}</p>
                                <p className="text-xs text-muted-foreground">{done}/{words.length} 词</p>
                              </div>
                              {unitComplete && (
                                <div className="flex gap-0.5">
                                  {[1, 2, 3].map(s => (
                                    <Star key={s} className={cn("w-3 h-3", s <= stars ? "text-accent fill-accent" : "text-muted-foreground/30")} />
                                  ))}
                                </div>
                              )}
                              {unitOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                              <Button
                                variant={unitComplete ? "outline" : "hero"}
                                size="sm"
                                onClick={() => onSelectLevel(`hs-${subject}-${unit}`, `${cfg.name} · ${unitName}`, words, "learn")}
                              >
                                {unitComplete ? "重玩本单元" : done > 0 ? "继续学习" : "开始学习"}（{words.length}）
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectLevel(`hs-${subject}-${unit}`, `${cfg.name} · ${unitName}`, words, "quiz")}
                              >
                                直接练习题
                              </Button>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};

export default HSLevelProgress;
