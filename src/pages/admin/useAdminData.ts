import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserProfile, WordStat } from "./types";

export function useAdminData(isAdmin: boolean) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [wordStats, setWordStats] = useState<WordStat[]>([]);
  const [wordsWithoutExamples, setWordsWithoutExamples] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles").select("*").order("created_at", { ascending: false });
      if (profilesError) throw profilesError;
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;
      const adminIds = new Set(roles?.filter((r) => r.role === "admin").map((r) => r.user_id) || []);
      const teacherIds = new Set(roles?.filter((r) => r.role === "teacher").map((r) => r.user_id) || []);
      setUsers(profiles?.map((p) => ({
        ...p,
        isAdmin: adminIds.has(p.user_id),
        isTeacher: teacherIds.has(p.user_id),
      })) || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("获取用户列表失败");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchWordStats = useCallback(async () => {
    const { data } = await supabase.from("words").select("grade");
    if (data) {
      const stats: Record<number, number> = {};
      data.forEach((w: any) => { stats[w.grade] = (stats[w.grade] || 0) + 1; });
      setWordStats(Object.entries(stats).map(([g, c]) => ({ grade: parseInt(g), count: c })));
    }
    const { count } = await supabase
      .from("words").select("id", { count: "exact", head: true }).is("example", null);
    setWordsWithoutExamples(count || 0);
  }, []);

  const fetchMatchCount = useCallback(async () => {
    const { count } = await supabase
      .from("ranked_matches").select("id", { count: "exact", head: true });
    setMatchCount(count || 0);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchWordStats();
      fetchMatchCount();
    }
  }, [isAdmin, fetchUsers, fetchWordStats, fetchMatchCount]);

  return {
    users, loadingUsers, fetchUsers,
    wordStats, wordsWithoutExamples, fetchWordStats,
    matchCount, setMatchCount, fetchMatchCount,
  };
}
