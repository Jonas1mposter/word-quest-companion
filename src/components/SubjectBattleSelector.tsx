import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Calculator,
  FlaskConical,
  Swords,
  Sparkles,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BattleSubject =
  | "mixed" | "english" | "math" | "science"
  | "economics" | "physics" | "chemistry" | "biology" | "hsmath" | "sat";

interface SubjectBattleSelectorProps {
  onSelectSubject: (subject: BattleSubject) => void;
  onBack: () => void;
  battleType: "ranked" | "free";
  isHighSchool?: boolean;
  zoneGrade?: number;
}

interface SubjectDef {
  id: BattleSubject;
  name: string;
  description: string;
  icon: typeof Sparkles;
  /** full-bleed artwork gradient */
  art: string;
  badge?: string;
}

const SubjectBattleSelector = ({ onSelectSubject, onBack, battleType, isHighSchool = false, zoneGrade = 7 }: SubjectBattleSelectorProps) => {
  const [selectedSubject, setSelectedSubject] = useState<BattleSubject | null>(null);

  const hsSubjects: SubjectDef[] = [
    { id: "mixed", name: "综合词汇", description: "高中五大学科混合出题", icon: Sparkles, art: "from-primary/80 via-rose-950 to-background", badge: "推荐" },
    { id: "economics", name: "经济词汇", description: "经济学科专业术语", icon: BookOpen, art: "from-amber-500/70 via-yellow-950 to-background" },
    { id: "physics", name: "物理词汇", description: "物理学科专业术语", icon: Zap, art: "from-orange-500/70 via-red-950 to-background" },
    { id: "chemistry", name: "化学词汇", description: "化学学科专业术语", icon: FlaskConical, art: "from-sky-500/70 via-cyan-950 to-background" },
    { id: "biology", name: "生物词汇", description: "生物学科专业术语", icon: FlaskConical, art: "from-emerald-500/70 via-green-950 to-background" },
    { id: "hsmath", name: "数学词汇", description: "高中数学专业术语", icon: Calculator, art: "from-violet-500/70 via-indigo-950 to-background" },
    { id: "sat", name: "SAT词汇", description: "SAT/ACT 考试核心词汇", icon: BookOpen, art: "from-red-500/70 via-rose-950 to-background", badge: "新" },
  ];

  const juniorSubjects: SubjectDef[] = [
    { id: "mixed", name: "综合词汇", description: "英语、数学、科学混合出题", icon: Sparkles, art: "from-primary/80 via-rose-950 to-background", badge: "推荐" },
    { id: "english", name: "英语词汇", description: "仅英语课本词汇", icon: BookOpen, art: "from-sky-500/70 via-cyan-950 to-background" },
    { id: "math", name: "数学词汇", description: "0580数学专业术语", icon: Calculator, art: "from-amber-500/70 via-orange-950 to-background", badge: "新" },
    { id: "science", name: "科学词汇", description: "物理、化学、生物术语", icon: FlaskConical, art: "from-emerald-500/70 via-green-950 to-background", badge: "新" },
  ];

  const primarySubjects: SubjectDef[] = [
    { id: "mixed", name: "综合词汇", description: "科学、数学混合出题", icon: Sparkles, art: "from-primary/80 via-rose-950 to-background", badge: "推荐" },
    { id: "science", name: "科学词汇", description: "本年级课本单元词汇", icon: FlaskConical, art: "from-emerald-500/70 via-green-950 to-background" },
    { id: "math", name: "数学词汇", description: "本年级数学术语词汇", icon: Calculator, art: "from-amber-500/70 via-orange-950 to-background", badge: "新" },
  ];

  const isPrimary = zoneGrade >= 1 && zoneGrade <= 6;
  const subjects = isPrimary ? primarySubjects : isHighSchool ? hsSubjects : juniorSubjects;

  const handleConfirm = () => {
    if (selectedSubject) onSelectSubject(selectedSubject);
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex flex-col">
      {/* Close button — top right, like the reference */}
      <button
        onClick={onBack}
        aria-label="关闭"
        className="fixed top-4 right-4 z-20 w-10 h-10 flex items-center justify-center border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary transition-colors val-cut-sm"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 w-full max-w-5xl mx-auto">
        {/* Centered title with side rules */}
        <div className="flex items-center gap-4 w-full max-w-xl mb-8">
          <div className="flex-1 h-px bg-border" />
          <h1 className="font-tactical text-2xl md:text-3xl font-bold uppercase tracking-[0.2em] text-center">
            {battleType === "ranked" ? "选择排位队列" : "选择对战队列"}
          </h1>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Mode cards grid */}
        <div className={cn(
          "grid gap-3 w-full",
          subjects.length > 4 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
        )}>
          {subjects.map((subject) => {
            const Icon = subject.icon;
            const isSelected = selectedSubject === subject.id;

            return (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject.id)}
                className={cn(
                  "group relative h-36 md:h-44 overflow-hidden text-left border transition-all duration-200",
                  isSelected
                    ? "border-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]"
                    : "border-border/60 hover:border-foreground/40"
                )}
              >
                {/* Artwork background */}
                <div className={cn("absolute inset-0 bg-gradient-to-br", subject.art)} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

                {/* Giant watermark icon */}
                <Icon className="absolute -right-4 -bottom-4 w-28 h-28 text-foreground/10 group-hover:text-foreground/20 transition-colors" />

                {/* Badge */}
                {subject.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider val-cut-sm">
                    {subject.badge}
                  </span>
                )}

                {/* Selected corner tick — like the reference's green corner */}
                {isSelected && (
                  <div className="absolute top-0 left-0 w-0 h-0 border-t-[26px] border-l-[26px] border-t-primary border-l-primary border-r-transparent border-b-transparent" />
                )}

                {/* Label — bottom left */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-tactical font-bold text-lg uppercase tracking-wider">
                      {subject.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{subject.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <Button
          variant="hero"
          className={cn(
            "mt-8 h-14 px-16 font-tactical text-xl font-bold uppercase tracking-[0.25em] val-cut transition-all",
            !selectedSubject && "opacity-40"
          )}
          disabled={!selectedSubject}
          onClick={handleConfirm}
        >
          <Swords className="w-5 h-5 mr-2" />
          开始匹配
        </Button>

        <p className="mt-4 text-xs text-muted-foreground tracking-wider">
          选择专项模式后，对战中将只出现该科目的词汇
        </p>
      </div>
    </div>
  );
};

export default SubjectBattleSelector;
