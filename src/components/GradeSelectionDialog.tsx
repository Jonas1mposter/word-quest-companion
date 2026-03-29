import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GradeSelectionDialogProps {
  open: boolean;
  onClose: () => void;
}

const GradeSelectionDialog = ({ open, onClose }: GradeSelectionDialogProps) => {
  const { profile, refreshProfile } = useAuth();
  const [selectedGrade, setSelectedGrade] = useState<7 | 8 | null>(null);
  const [saving, setSaving] = useState(false);

  const getGradeSelectionStorageKey = (profileId: string) => `grade-selection-resolved:${profileId}`;

  const handleConfirm = async () => {
    if (!selectedGrade || !profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ grade: selectedGrade })
        .eq("id", profile.id);

      if (error) throw error;

      localStorage.setItem(getGradeSelectionStorageKey(profile.id), "1");
      await refreshProfile();
      toast.success(`已设置为 ${selectedGrade} 年级`);
      onClose();
    } catch (err) {
      console.error("Failed to update grade:", err);
      toast.error("设置年级失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="w-6 h-6 text-primary" />
            选择你的年级
          </DialogTitle>
          <DialogDescription>
            系统未能自动识别你的年级，请手动选择以获取对应的学习内容。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {([7, 8] as const).map((grade) => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`
                relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all duration-200
                ${selectedGrade === grade
                  ? "border-primary bg-primary/10 shadow-md scale-[1.02]"
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
                }
              `}
            >
              <span className="text-4xl font-bold text-foreground">{grade}</span>
              <span className="text-sm text-muted-foreground">年级</span>
              {selectedGrade === grade && (
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selectedGrade || saving}
          className="w-full"
          size="lg"
        >
          {saving ? "保存中..." : "确认选择"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default GradeSelectionDialog;
