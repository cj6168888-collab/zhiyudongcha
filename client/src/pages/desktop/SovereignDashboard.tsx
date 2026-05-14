/**
 * SovereignDashboard - Navigator-X SOVEREIGN (老板) 控制台
 *
 * 老板专属功能：
 * 1. 舰队总览 - 所有节点状态
 * 2. 汇报审批 - 待审批汇报
 * 3. 预警监控 - 红线预警
 * 4. 想法暂存 - 捕捉想法并带回对话展开
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Ship, Activity, AlertTriangle, TrendingUp,
  CheckCircle, XCircle,
  Plus, MessageCircle, Sparkles
} from "lucide-react";

interface DesktopUser {
  id: string;
  username: string;
  role: 'SOVEREIGN' | 'NODE';
}

const ideaCaptureKey = 'xiaozhi_idea_capture_notes';

function saveIdeaLocally(content: string) {
  let ideas: unknown[] = [];
  try {
    const raw = localStorage.getItem(ideaCaptureKey);
    const parsed = raw ? JSON.parse(raw) : [];
    ideas = Array.isArray(parsed) ? parsed : [];
  } catch {
    ideas = [];
  }
  const next = [{ id: `${Date.now()}`, content, createdAt: Date.now() }, ...ideas].slice(0, 20);
  localStorage.setItem(ideaCaptureKey, JSON.stringify(next));
}

function readList<T>(value: unknown, key?: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (key && value && typeof value === 'object') {
    const nested = (value as Record<string, unknown>)[key];
    return Array.isArray(nested) ? nested as T[] : [];
  }
  return [];
}

// 获取用户信息
function getUser(): DesktopUser | null {
  const stored = localStorage.getItem('desktop_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export default function SovereignDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user] = useState<DesktopUser | null>(getUser);
  const [, setLocation] = useLocation();
  const [inspirationText, setInspirationText] = useState('');

  // 检查权限
  useEffect(() => {
    if (!user || user.role !== 'SOVEREIGN') {
      toast({ title: '您没有权限访问此页面', variant: 'destructive' });
      setLocation('/desktop/login');
    }
  }, [user, setLocation, toast]);

  // 数据获取
  const { data: nodesResponse, isLoading: nodesLoading } = useQuery<unknown>({
    queryKey: ['/api/navigator/nodes'],
    refetchInterval: 5000,
  });

  const { data: reportsResponse } = useQuery<unknown>({
    queryKey: ['/api/navigator/pending-reports'],
    refetchInterval: 3000,
  });

  const { data: alertsResponse } = useQuery<unknown>({
    queryKey: ['/api/navigator/alerts'],
    refetchInterval: 2000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/navigator/stats'],
    refetchInterval: 5000,
  });

  // 变异操作
  const approveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await fetch(`/api/navigator/reports/${reportId}/approve`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/pending-reports'] });
      toast({ title: '已准予立项' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await fetch(`/api/navigator/reports/${reportId}/reject`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/pending-reports'] });
      toast({ title: '已打回修正' });
    },
  });

  const handleSaveIdea = () => {
    const content = inspirationText.trim();
    if (!content) return;
    saveIdeaLocally(content);
    toast({ title: '想法已暂存', description: '回到和小智的对话里继续展开，不会自动分发或立项。' });
    setInspirationText('');
  };

  // 统计数据
  const nodes = readList<any>(nodesResponse, 'nodes');
  const reports = readList<any>(reportsResponse);
  const alerts = readList<any>(alertsResponse);
  const activeNodes = nodes.filter((n: any) => n.status === 'ACTIVE').length;
  const pendingReports = reports.length;
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'CRITICAL' && !a.acknowledged).length;

  if (!user || user.role !== 'SOVEREIGN') {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">领航者控制台</h1>
            <p className="text-gray-500 text-sm">欢迎回来，{user.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              SOVEREIGN
            </span>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Ship className="w-8 h-8 text-indigo-400" />
                <div>
                  <p className="text-2xl font-black">{activeNodes}/{nodes.length}</p>
                  <p className="text-xs text-gray-500">在线节点</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-black">{pendingReports}</p>
                  <p className="text-xs text-gray-500">待审批汇报</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <div>
                  <p className="text-2xl font-black text-red-400">{criticalAlerts}</p>
                  <p className="text-xs text-gray-500">严重预警</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-black">{stats?.avgMoraleScore || 75}%</p>
                  <p className="text-xs text-gray-500">平均士气</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主要内容区 */}
        <div className="grid grid-cols-3 gap-6">
          {/* 想法暂存 */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                想法暂存
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={inspirationText}
                onChange={(e) => setInspirationText(e.target.value)}
                placeholder="先记下这个想法，再回到和小智的对话里继续展开..."
                className="min-h-[100px] bg-white/5 border-white/10"
              />
              {inspirationText && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex items-center gap-2 text-indigo-400 text-xs mb-2">
                    <MessageCircle className="w-4 h-4" />
                    对话入口
                  </div>
                  <p className="text-xs text-gray-400">
                    这条想法只会本机暂存，不会自动广播、立项或生成假分析。
                  </p>
                </div>
              )}
              <Button
                className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                disabled={!inspirationText.trim()}
                onClick={handleSaveIdea}
              >
                <Sparkles className="w-4 h-4" />
                暂存想法
              </Button>
            </CardContent>
          </Card>

          {/* 待审批汇报 */}
          <Card className="bg-white/5 border-white/10 col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                待审批汇报
              </CardTitle>
              <Badge variant="outline">{pendingReports}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>暂无待审批汇报</p>
                </div>
              ) : (
                reports.slice(0, 5).map((report: any) => (
                  <div key={report.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-400">
                            {report.nodeName?.slice(0, 2) || 'N'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{report.nodeName}</p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(report.submittedAt).toLocaleTimeString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-lg font-black",
                        report.authenticityScore >= 80 ? "text-green-400" :
                        report.authenticityScore >= 60 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {report.authenticityScore}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 italic mb-3">"{report.summary}"</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        onClick={() => approveMutation.mutate(report.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        准予
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        onClick={() => rejectMutation.mutate(report.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        打回
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* 节点总览 */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-indigo-400" />
              舰队节点
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" />
              添加节点
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {nodesLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 animate-pulse h-32" />
                ))
              ) : nodes.slice(0, 8).map((node: any) => (
                <div key={node.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold">{node.name}</span>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      node.status === 'ACTIVE' ? "bg-green-500" : "bg-gray-500"
                    )} />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>进度</span>
                        <span>{node.metadata?.progress || Math.floor(Math.random() * 100)}%</span>
                      </div>
                      <Progress value={node.metadata?.progress || Math.floor(Math.random() * 100)} className="h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>士气</span>
                        <span className="text-green-400">{node.metadata?.moraleScore || 75}%</span>
                      </div>
                      <Progress value={node.metadata?.moraleScore || 75} className="h-1 [&>div]:bg-green-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 红线预警 */}
        {alerts.filter((a: any) => !a.acknowledged).length > 0 && (
          <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                红线预警 ({alerts.filter((a: any) => !a.acknowledged).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.filter((a: any) => !a.acknowledged).slice(0, 3).map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                  <div>
                    <p className="text-sm font-medium text-red-400">{alert.title}</p>
                    <p className="text-xs text-gray-400">{alert.description}</p>
                  </div>
                  <Badge className={cn(
                    alert.severity === 'CRITICAL' ? "bg-red-500" :
                    alert.severity === 'HIGH' ? "bg-orange-500" : "bg-yellow-500"
                  )}>
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
