import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { seedWordsIfNeeded } from "@/lib/seedData";
import Dashboard from "@/components/Dashboard";
import GradeSelectionDialog from "@/components/GradeSelectionDialog";
import OnboardingTour from "@/components/OnboardingTour";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [grade, setGrade] = useState<number>(7);
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // 每人必须亲自选一次年级；选过后（服务端记录）在任何设备都不再弹出
  const hasResolvedGradeSelection = !!(profile as any)?.grade_selected_at;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Show grade selection dialog if auto-detection failed
  useEffect(() => {
    if (!loading && profile && !hasResolvedGradeSelection) {
      setShowGradeDialog(true);
      return;
    }

    setShowGradeDialog(false);
  }, [loading, profile, gradeAutoDetected, hasResolvedGradeSelection]);

  // First-time onboarding: new accounts (few XP, no matches) that haven't seen the tour
  useEffect(() => {
    if (loading || !profile) return;
    let done = false;
    try { done = window.localStorage.getItem(`onboarding-done:${profile.id}`) === "1"; } catch {}
    const isNew = (profile.total_xp ?? profile.xp ?? 0) < 50 && (profile.wins ?? 0) + (profile.losses ?? 0) === 0;
    if (!done && isNew) setShowTour(true);
  }, [loading, profile?.id]);

  useEffect(() => {
    const open = () => setShowTour(true);
    window.addEventListener("open-onboarding", open);
    return () => window.removeEventListener("open-onboarding", open);
  }, []);

  // Seed word data on first load
  useEffect(() => {
    seedWordsIfNeeded();
  }, []);

  // Sync grade from profile
  useEffect(() => {
    if (profile?.grade) {
      setGrade(Number(profile.grade));
    }
  }, [profile?.grade]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const closeTour = () => {
    try { window.localStorage.setItem(`onboarding-done:${profile.id}`, "1"); } catch {}
    setShowTour(false);
  };

  return (
    <>
      <Dashboard grade={grade} />
      <GradeSelectionDialog
        open={showGradeDialog}
        onClose={() => setShowGradeDialog(false)}
      />
      <OnboardingTour open={showTour && !showGradeDialog} onClose={closeTour} />
    </>
  );
};

export default Index;
