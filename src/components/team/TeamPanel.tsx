import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, Shield, Users, Crown, Plus, LogOut, UserPlus, Check, X, Loader2, Trophy, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  description: string | null;
  captain_id: string;
  avatar_url: string | null;
  max_members: number;
  total_xp: number;
  total_wins: number;
  created_at: string;
  member_count?: number;
  captain_name?: string;
}

interface TeamMember {
  id: string;
  profile_id: string;
  role: string;
  username: string;
  level: number;
  avatar_url: string | null;
  total_xp: number;
}

export const TeamPanel = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (profile) loadTeamData();
  }, [profile]);

  const loadTeamData = async () => {
    if (!profile) return;
    setLoading(true);

    // Check if user is in a team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('profile_id', profile.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      // Load team details
      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .single();

      if (team) {
        // Load members
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('id, profile_id, role')
          .eq('team_id', team.id);

        if (teamMembers) {
          const memberIds = teamMembers.map(m => m.profile_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, level, avatar_url, total_xp, wins')
            .in('id', memberIds);

          const enrichedMembers = teamMembers.map(m => {
            const p = profiles?.find(pr => pr.id === m.profile_id);
            return {
              ...m,
              username: p?.username || '未知',
              level: p?.level || 1,
              avatar_url: p?.avatar_url || null,
              total_xp: p?.total_xp || 0,
            };
          }).sort((a, b) => a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : b.total_xp - a.total_xp);

          setMembers(enrichedMembers);

          // Aggregate team stats from members (teams.total_xp/total_wins isn't auto-updated)
          const aggXp = (profiles ?? []).reduce((s, p: any) => s + (p.total_xp || 0), 0);
          const aggWins = (profiles ?? []).reduce((s, p: any) => s + (p.wins || 0), 0);

          // Get captain name
          const captain = profiles?.find(p => p.id === team.captain_id);
          setMyTeam({ ...team, total_xp: aggXp, total_wins: aggWins, member_count: teamMembers.length, captain_name: captain?.username });
        }

        // Load pending join requests if captain
        if (team.captain_id === profile.id) {
          const { data: requests } = await supabase
            .from('team_join_requests')
            .select('*')
            .eq('team_id', team.id)
            .eq('status', 'pending');

          if (requests && requests.length > 0) {
            const reqProfileIds = requests.map(r => r.profile_id);
            const { data: reqProfiles } = await supabase
              .from('profiles')
              .select('id, username, level, avatar_url')
              .in('id', reqProfileIds);

            setPendingRequests(requests.map(r => ({
              ...r,
              profile: reqProfiles?.find(p => p.id === r.profile_id),
            })));
          }
        }
      }
    } else {
      // Load all teams for browsing
      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .order('total_xp', { ascending: false });

      if (teams) {
        // Count members for each team
        const enriched = await Promise.all(teams.map(async (t) => {
          const { data: tm } = await supabase
            .from('team_members')
            .select('profile_id')
            .eq('team_id', t.id);
          const ids = (tm ?? []).map(x => x.profile_id);
          let aggXp = 0, aggWins = 0;
          if (ids.length) {
            const { data: ps } = await supabase
              .from('profiles')
              .select('total_xp, wins')
              .in('id', ids);
            aggXp = (ps ?? []).reduce((s: number, p: any) => s + (p.total_xp || 0), 0);
            aggWins = (ps ?? []).reduce((s: number, p: any) => s + (p.wins || 0), 0);
          }

          const { data: captain } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', t.captain_id)
            .single();

          return { ...t, total_xp: aggXp, total_wins: aggWins, member_count: ids.length, captain_name: captain?.username };
        }));
        enriched.sort((a, b) => b.total_xp - a.total_xp);
        setAllTeams(enriched);
      }
    }

    setLoading(false);
  };

  const createTeam = async () => {
    if (!profile || !newTeamName.trim()) return;
    setCreating(true);

    try {
      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          name: newTeamName.trim(),
          description: newTeamDesc.trim() || null,
          captain_id: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add captain as member
      await supabase.from('team_members').insert({
        team_id: team.id,
        profile_id: profile.id,
        role: 'captain',
      });

      toast.success('战队创建成功！');
      setShowCreate(false);
      setNewTeamName("");
      setNewTeamDesc("");
      loadTeamData();
    } catch (err: any) {
      toast.error(err.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const requestJoin = async (teamId: string) => {
    if (!profile) return;
    try {
      await supabase.from('team_join_requests').insert({
        team_id: teamId,
        profile_id: profile.id,
      });
      toast.success('申请已发送，等待队长审批');
    } catch {
      toast.error('申请失败');
    }
  };

  const handleRequest = async (requestId: string, accept: boolean, _teamId: string, _requestProfileId: string) => {
    try {
      const { error } = await supabase.rpc('handle_team_join_request', {
        _request_id: requestId,
        _accept: accept,
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('team is full')) toast.error('战队已满');
        else if (msg.includes('already handled')) toast.error('该申请已处理');
        else if (msg.includes('only captain')) toast.error('只有队长可以审批');
        else toast.error('操作失败');
        return;
      }
      toast.success(accept ? '已接受' : '已拒绝');
      loadTeamData();
    } catch {
      toast.error('操作失败');
    }
  };

  const leaveTeam = async () => {
    if (!profile || !myTeam) return;
    
    if (myTeam.captain_id === profile.id) {
      toast.error('队长不能离开战队，请先转让队长');
      return;
    }

    await supabase
      .from('team_members')
      .delete()
      .eq('team_id', myTeam.id)
      .eq('profile_id', profile.id);

    toast.success('已离开战队');
    setMyTeam(null);
    setMembers([]);
    loadTeamData();
  };

  const disbandTeam = async () => {
    if (!profile || !myTeam || myTeam.captain_id !== profile.id) return;

    await supabase.from('team_members').delete().eq('team_id', myTeam.id);
    await supabase.from('team_join_requests').delete().eq('team_id', myTeam.id);
    await supabase.from('teams').delete().eq('id', myTeam.id);

    toast.success('战队已解散');
    setMyTeam(null);
    setMembers([]);
    loadTeamData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User has a team
  if (myTeam) {
    const isCaptain = myTeam.captain_id === profile?.id;

    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-gaming">我的战队</h1>
          </div>

          {/* Team info */}
          <Card className="mb-6 border-2 border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {myTeam.name}
                </CardTitle>
                <Badge variant="secondary">{myTeam.member_count}/{myTeam.max_members} 人</Badge>
              </div>
              {myTeam.description && (
                <p className="text-sm text-muted-foreground">{myTeam.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-secondary/30 rounded-lg">
                  <Trophy className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
                  <p className="text-lg font-bold">{myTeam.total_wins}</p>
                  <p className="text-xs text-muted-foreground">总胜场</p>
                </div>
                <div className="text-center p-2 bg-secondary/30 rounded-lg">
                  <p className="text-lg font-bold">{myTeam.total_xp}</p>
                  <p className="text-xs text-muted-foreground">总经验</p>
                </div>
                <div className="text-center p-2 bg-secondary/30 rounded-lg">
                  <Crown className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <p className="text-sm font-bold">{myTeam.captain_name}</p>
                  <p className="text-xs text-muted-foreground">队长</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {isCaptain ? (
                  <Button variant="destructive" size="sm" onClick={disbandTeam} className="flex-1">
                    解散战队
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={leaveTeam} className="flex-1">
                    <LogOut className="w-4 h-4 mr-1" /> 离开战队
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending requests (captain only) */}
          {isCaptain && pendingRequests.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> 加入申请 ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                        {req.profile?.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{req.profile?.username}</p>
                        <p className="text-xs text-muted-foreground">Lv.{req.profile?.level}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleRequest(req.id, false, req.team_id, req.profile_id)}>
                        <X className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleRequest(req.id, true, req.team_id, req.profile_id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Members list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" /> 成员列表
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        member.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{member.username}</span>
                        {member.role === 'captain' && (
                          <Badge variant="default" className="text-xs"><Crown className="w-3 h-3 mr-1" />队长</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Lv.{member.level} · XP {member.total_xp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No team - show browse/create
  const filteredTeams = searchQuery
    ? allTeams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTeams;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-gaming">战队系统</h1>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-6">
          <Button onClick={() => setShowCreate(true)} className="flex-1">
            <Plus className="w-4 h-4 mr-2" /> 创建战队
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索战队..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Team list */}
        {filteredTeams.length === 0 ? (
          <Card className="text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">暂无战队</p>
            <p className="text-sm text-muted-foreground">创建一个战队，邀请好友加入吧！</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTeams.map(team => (
              <Card key={team.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold">{team.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span><Crown className="w-3 h-3 inline mr-1" />{team.captain_name}</span>
                        <span>· {team.member_count}/{team.max_members}人</span>
                        <span>· XP {team.total_xp}</span>
                      </div>
                      {team.description && (
                        <p className="text-xs text-muted-foreground mt-1">{team.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => requestJoin(team.id)}
                    disabled={(team.member_count || 0) >= team.max_members}
                  >
                    {(team.member_count || 0) >= team.max_members ? '已满' : '申请加入'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create team dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建战队</DialogTitle>
              <DialogDescription>创建你的战队，成为队长！</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">战队名称</label>
                <Input
                  placeholder="输入战队名称..."
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-sm font-medium">战队简介（可选）</label>
                <Input
                  placeholder="输入战队简介..."
                  value={newTeamDesc}
                  onChange={e => setNewTeamDesc(e.target.value)}
                  maxLength={100}
                />
              </div>
              <Button
                onClick={createTeam}
                disabled={!newTeamName.trim() || creating}
                className="w-full"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                创建战队
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
