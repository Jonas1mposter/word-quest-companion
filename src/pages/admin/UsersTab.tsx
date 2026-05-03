import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Crown, User, UserX } from "lucide-react";
import { UserProfile, WordStat } from "./types";

interface Props {
  users: UserProfile[];
  loadingUsers: boolean;
  wordStats: WordStat[];
  currentUserId: string | undefined;
  refresh: () => void;
}

export const UsersTab = ({ users, loadingUsers, wordStats, currentUserId, refresh }: Props) => {
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const toggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      if (currentIsAdmin) {
        const { error } = await supabase.from("user_roles").delete()
          .eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
        toast.success("已移除管理员权限");
      } else {
        const { error } = await supabase.from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error) throw error;
        toast.success("已授予管理员权限");
      }
      refresh();
    } catch { toast.error("操作失败"); }
  };

  const toggleTeacher = async (userId: string, currentIsTeacher: boolean) => {
    try {
      if (currentIsTeacher) {
        const { error } = await supabase.from("user_roles").delete()
          .eq("user_id", userId).eq("role", "teacher");
        if (error) throw error;
        toast.success("已移除教师权限");
      } else {
        const { error } = await supabase.from("user_roles")
          .insert({ user_id: userId, role: "teacher" });
        if (error) throw error;
        toast.success("已授予教师权限");
      }
      refresh();
    } catch { toast.error("操作失败"); }
  };

  const deleteUser = async (userId: string, username: string) => {
    setDeletingUser(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data.error) toast.error(data.error);
      else { toast.success(`用户 ${username} 已成功删除`); refresh(); }
    } catch { toast.error("删除用户失败"); }
    finally { setDeletingUser(null); }
  };

  const updateUserGrade = async (profileId: string, newGrade: number) => {
    try {
      const { error } = await supabase.from("profiles")
        .update({ grade: newGrade }).eq("id", profileId);
      if (error) throw error;
      toast.success(`已更新年级为${newGrade}年级`);
      refresh();
    } catch { toast.error("更新年级失败"); }
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />用户列表</CardTitle>
        <CardDescription>共 {users.length} 个注册用户</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingUsers ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {u.isAdmin ? <Crown className="w-5 h-5 text-accent" /> : <User className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.username}</span>
                      {u.isAdmin && <Badge className="bg-accent text-accent-foreground">管理员</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">Lv.{u.level} · {u.rank_tier}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={u.grade.toString()} onValueChange={(v) => updateUserGrade(u.id, parseInt(v))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {wordStats.map((s) => (
                        <SelectItem key={s.grade} value={s.grade.toString()}>{s.grade}年级</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {u.user_id !== currentUserId && (
                    <>
                      <Button variant={u.isAdmin ? "destructive" : "outline"} size="sm"
                        onClick={() => toggleAdmin(u.user_id, !!u.isAdmin)}>
                        {u.isAdmin ? "移除管理员" : "设为管理员"}
                      </Button>
                      <Button variant={u.isTeacher ? "destructive" : "outline"} size="sm"
                        onClick={() => toggleTeacher(u.user_id, !!u.isTeacher)}>
                        {u.isTeacher ? "移除教师" : "设为教师"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={deletingUser === u.user_id}>
                            <UserX className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除账号</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除用户 <strong>{u.username}</strong> 的账号吗？此操作不可撤销，将永久删除该用户的所有数据。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteUser(u.user_id, u.username)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  {u.user_id === currentUserId && <Badge variant="outline">当前用户</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
