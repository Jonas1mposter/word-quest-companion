import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Shield, Users, Crown, BookOpen, Award, Coins,
  MessageSquareText, Swords,
} from "lucide-react";
import { useAdminData } from "./admin/useAdminData";
import { UsersTab } from "./admin/UsersTab";
import { CoinsTab } from "./admin/CoinsTab";
import { WordsTab } from "./admin/WordsTab";
import { ExamplesTab } from "./admin/ExamplesTab";
import { RewardsTab } from "./admin/RewardsTab";
import { MatchesTab } from "./admin/MatchesTab";

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();

  const {
    users, loadingUsers, fetchUsers,
    wordStats, wordsWithoutExamples, fetchWordStats,
    matchCount, setMatchCount, fetchMatchCount,
  } = useAdminData(isAdmin);

  const loading = authLoading || roleLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">请先登录</p>
            <Button onClick={() => navigate("/auth")}>去登录</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-destructive mb-4" />
            <p className="text-muted-foreground mb-4">您没有管理员权限</p>
            <Button variant="outline" onClick={() => navigate("/auth")}>返回登录</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-gaming text-glow-purple flex items-center gap-2">
              <Crown className="w-6 h-6 text-accent" />
              超级管理员后台
            </h1>
            <p className="text-muted-foreground text-sm">管理用户和词汇数据</p>
          </div>
          <div className="flex gap-2">
            {wordStats.map((stat) => (
              <Badge key={stat.grade} variant="outline">
                {stat.grade}年级: {stat.count}词
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 max-w-3xl">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />用户管理
            </TabsTrigger>
            <TabsTrigger value="coins" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />发放狄邦豆
            </TabsTrigger>
            <TabsTrigger value="words" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />词汇导入
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4" />生成例句
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Award className="w-4 h-4" />奖励发放
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-2">
              <Swords className="w-4 h-4" />对局管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersTab users={users} loadingUsers={loadingUsers} wordStats={wordStats}
              currentUserId={user?.id} refresh={fetchUsers} />
          </TabsContent>
          <TabsContent value="coins">
            <CoinsTab users={users} refresh={fetchUsers} />
          </TabsContent>
          <TabsContent value="words">
            <WordsTab wordStats={wordStats} refresh={fetchWordStats} />
          </TabsContent>
          <TabsContent value="examples">
            <ExamplesTab wordStats={wordStats} wordsWithoutExamples={wordsWithoutExamples}
              refresh={fetchWordStats} />
          </TabsContent>
          <TabsContent value="rewards">
            <RewardsTab />
          </TabsContent>
          <TabsContent value="matches">
            <MatchesTab matchCount={matchCount} setMatchCount={setMatchCount} refresh={fetchMatchCount} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
