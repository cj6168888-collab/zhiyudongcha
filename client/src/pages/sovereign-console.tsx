/**
 * SovereignConsole - Navigator-X 主权端桌面控制台
 *
 * 桌面端入口 - 统御与决策中心
 * 功能：
 * 1. 舰队总览 - 实时显示所有节点状态
 * 2. 汇报审批 - 审批节点提交的汇报
 * 3. 红线预警 - 异常监控面板
 * 4. 五大专家 - High Council 快速访问
 * 5. 灵感广播 - 灵感捕捉与分派
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Compass, Ship, Users, AlertTriangle, Activity,
  TrendingUp, Zap, Clock, CheckCircle, XCircle,
  FileText, Shield, Key, Plus, RefreshCw,
  BrainCircuit, Wallet, HeartPulse, FileEdit,
  Mic, Send, Radio, Target, Sparkles
} from "lucide-react";

// ============ 类型定义 ============

interface NavigatorNode {
  id: string;
  name: string;
  type: 'SOVEREIGN' | 'NODE' | 'AGENT' | 'OBSERVER';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  capabilities: string[];
  createdAt: number;
  lastActiveAt: number;
  metadata?: {
    progress?: number;
    moraleScore?: number;
  };
}

interface ReportCard {
  id: string;
  nodeId: string;
  nodeName: string;
  summary: string;
  authenticityScore: number;
  submittedAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}

interface RedAlert {
  id: string;
  nodeId: string;
  nodeName: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  detectedAt: number;
  acknowledged: boolean;
}

// ============ 专家配置 ============

const EXPERTS = [
  { id: 'legal', name: '法务专家', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/20', model: 'Claude Sonnet' },
  { id: 'finance', name: '财务专家', icon: Wallet, color: 'text-green-400', bg: 'bg-green-500/20', model: 'DeepSeek V3' },
  { id: 'strategy', name: '策划专家', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-500/20', model: 'GPT-4o' },
  { id: 'psychology', name: '心理专家', icon: HeartPulse, color: 'text-rose-400', bg: 'bg-rose-500/20', model: 'Claude Haiku' },
  { id: 'secretary', name: '全能秘书', icon: FileEdit, color: 'text-amber-400', bg: 'bg-amber-500/20', model: 'GPT-4o Mini' },
];

// ============ 组件 ============

export default function SovereignConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'fleet' | 'reports' | 'alerts' | 'experts' | 'inspiration'>('fleet');
  const [inspirationText, setInspirationText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // ============ 数据获取 ============

  const { data: nodes = [], isLoading: nodesLoading } = useQuery<NavigatorNode[]>({
    queryKey: ['/api/navigator/nodes'],
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/navigator/stats'],
    refetchInterval: 5000,
  });

  const { data: reports = [] } = useQuery<ReportCard[]>({
    queryKey: ['/api/navigator/pending-reports'],
    refetchInterval: 3000,
  });

  const { data: alerts = [] } = useQuery<RedAlert[]>({
    queryKey: ['/api/navigator/alerts'],
    refetchInterval: 2000,
  });

  // ============ 变异操作 ============

  const approveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/navigator/reports/${reportId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('审批失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/pending-reports'] });
      toast({ title: '已准予立项' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/navigator/reports/${reportId}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('打回失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/pending-reports'] });
      toast({ title: '已打回修正' });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/navigator/reports/${reportId}/execute`, { method: 'POST' });
      if (!res.ok) throw new Error('执行失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/pending-reports'] });
      toast({ title: '已即刻执行' });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('/api/navigator/inspiration/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('广播失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '灵感已广播至全舰队' });
      setInspirationText('');
      setIsBroadcasting(false);
    },
  });

  const emergencyRecallMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/navigator/emergency-recall', { method: 'POST' });
      if (!res.ok) throw new Error('紧急召回失败');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/nodes'] });
      toast({ title: `已召回 ${data.recalled} 个节点`, variant: 'destructive' });
    },
  });

  // ============ 状态颜色 ============

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'SUSPENDED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'EXPIRED': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'REVOKED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // ============ 统计数据 ============

  const activeNodes = nodes.filter(n => n.status === 'ACTIVE').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest">Navigator-X</h1>
              <p className="text-[10px] text-amber-400 font-mono">SOVEREIGN TERMINAL</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[8px] text-gray-500 uppercase">Status</p>
              <p className="text-sm font-bold text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                ONLINE
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => emergencyRecallMutation.mutate()}
              disabled={emergencyRecallMutation.isPending}
              className="gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              紧急召回
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#0a0a0f] border-b border-white/10 px-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-transparent border-b border-white/10 h-auto p-0">
            {[
              { id: 'fleet', label: '舰队', icon: Ship, count: activeNodes },
              { id: 'reports', label: '汇报', icon: Activity, count: reports.length },
              { id: 'alerts', label: '预警', icon: AlertTriangle, count: criticalAlerts, critical: true },
              { id: 'experts', label: '专家', icon: Users },
              { id: 'inspiration', label: '灵感', icon: Sparkles },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-4 flex items-center gap-2 text-gray-400 hover:text-white transition-all",
                  activeTab === tab.id && "border-indigo-500 text-white"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-bold">{tab.label}</span>
                {(tab.count ?? 0) > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    tab.critical ? "bg-red-500 text-white" : "bg-indigo-500/20 text-indigo-400"
                  )}>
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Bar */}
      <div className="p-6 grid grid-cols-5 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Ship className="w-5 h-5 text-indigo-400" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">舰队规模</p>
                <p className="text-2xl font-black">{activeNodes}/{nodes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">待审批</p>
                <p className="text-2xl font-black">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">严重预警</p>
                <p className="text-2xl font-black text-red-400">{criticalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">平均士气</p>
                <p className="text-2xl font-black text-green-400">{stats?.avgMoraleScore || 75}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">24h请求</p>
                <p className="text-2xl font-black">{stats?.requests24h || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* 舰队总览 */}
        {activeTab === 'fleet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wider">Fleet Overview</h2>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                添加节点
              </Button>
            </div>
            {nodesLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                    <CardContent className="p-5 h-32" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {nodes.map((node) => (
                  <Card key={node.id} className="bg-white/5 border-white/10 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          {node.name}
                        </CardTitle>
                        <Badge variant="outline" className={getStatusColor(node.status)}>
                          {node.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>进度</span>
                          <span>{node.metadata?.progress || Math.floor(Math.random() * 100)}%</span>
                        </div>
                        <Progress value={node.metadata?.progress || Math.floor(Math.random() * 100)} className="h-1" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>士气</span>
                          <span className="text-green-400">{node.metadata?.moraleScore || 75}%</span>
                        </div>
                        <Progress value={node.metadata?.moraleScore || 75} className="h-1 [&>div]:bg-green-500" />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {node.capabilities.slice(0, 3).map((cap) => (
                          <span key={cap} className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-400">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 汇报审批 */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Pending Reports</h2>
            {reports.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-10 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-400">暂无待审批汇报</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <Card key={report.id} className="bg-white/5 border-white/10">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-400">
                              {report.nodeName.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold">{report.nodeName}</p>
                            <p className="text-[10px] text-gray-500">
                              {new Date(report.submittedAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500">真实性评分</p>
                          <p className={cn(
                            "text-lg font-black",
                            report.authenticityScore >= 80 ? "text-green-400" :
                            report.authenticityScore >= 60 ? "text-yellow-400" : "text-red-400"
                          )}>
                            {report.authenticityScore}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 italic mb-4">"{report.summary}"</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-1"
                          onClick={() => approveMutation.mutate(report.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4" />
                          准予立项
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 gap-1"
                          onClick={() => rejectMutation.mutate(report.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                          打回修正
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 gap-1"
                          onClick={() => executeMutation.mutate(report.id)}
                          disabled={executeMutation.isPending}
                        >
                          <Zap className="w-4 h-4" />
                          即刻执行
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 红线预警 */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Red Alerts</h2>
            {alerts.filter(a => !a.acknowledged).length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-10 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-green-400">系统运行正常</p>
                  <p className="text-[10px] text-gray-600 mt-1">暂无异常检测到</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.filter(a => !a.acknowledged).map((alert) => (
                  <Card key={alert.id} className={cn(
                    "border-l-4",
                    alert.severity === 'CRITICAL' ? "border-l-red-500 bg-red-500/5" :
                    alert.severity === 'HIGH' ? "border-l-orange-500 bg-orange-500/5" :
                    "border-l-yellow-500 bg-yellow-500/5"
                  )}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            alert.severity === 'CRITICAL' ? "bg-red-500" :
                            alert.severity === 'HIGH' ? "bg-orange-500" : "bg-yellow-500"
                          )}>
                            <AlertTriangle className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold">{alert.title}</p>
                            <p className="text-sm text-gray-400">{alert.description}</p>
                          </div>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 五大专家 */}
        {activeTab === 'experts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">High Council</h2>
            <div className="grid grid-cols-5 gap-4">
              {EXPERTS.map((expert) => (
                <Card key={expert.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                  <CardContent className="p-5 text-center">
                    <div className={cn("w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center", expert.bg)}>
                      <expert.icon className={cn("w-7 h-7", expert.color)} />
                    </div>
                    <p className="font-bold mb-1">{expert.name}</p>
                    <p className="text-[9px] text-gray-500 mb-2">{expert.model}</p>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[8px]">
                      Available
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 灵感广播 */}
        {activeTab === 'inspiration' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-black uppercase tracking-wider">Inspiration Broadcast</h2>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-bold">捕捉灵感</span>
                </div>
                <Textarea
                  value={inspirationText}
                  onChange={(e) => setInspirationText(e.target.value)}
                  placeholder="洗澡时的灵感、对领航者耳语..."
                  className="bg-white/5 border-white/10 min-h-[120px]"
                />

                {/* 语义血缘预览 */}
                {inspirationText && (
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                      <Target className="w-4 h-4" />
                      语义血缘预览
                    </div>
                    <p className="text-[10px] text-gray-400">
                      正在分析"{inspirationText.slice(0, 30)}..."的语义血缘...
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-400">背景资料生成中</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-400">KPI生成中</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-2 bg-indigo-500 hover:bg-indigo-600"
                  disabled={!inspirationText || isBroadcasting}
                  onClick={() => {
                    setIsBroadcasting(true);
                    broadcastMutation.mutate(inspirationText);
                  }}
                >
                  {isBroadcasting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      广播中...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      广播至全舰队
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
