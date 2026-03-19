import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { seedWordsIfNeeded } from "@/lib/seedData";
import Dashboard from "@/components/Dashboard";
import GradeSelector from "@/components/GradeSelector";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [grade, setGrade] = useState<7 | 8>(7);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Seed word data on first load
  useEffect(() => {
    seedWordsIfNeeded();
  }, []);

  // Sync grade from profile
  useEffect(() => {
    if (profile?.grade) {
      setGrade(profile.grade as 7 | 8);
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

  return <Dashboard grade={grade} />;
};

export default Index;
