import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { apiRequest } from "@/lib/queryClient";
import {
  Eye,
  MessageSquare,
  Target,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Users,
  Brain,
  Zap,
  ChevronRight,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Radar,
  Play,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Inbox,
  Settings,
  Lightbulb,
  Moon
} from "lucide-react";

interface Person {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  negotiationStyle?: string;
  commitmentRate?: number;
}

interface CommunicationPrediction {
  likelyResponses: Array<{
    response: string;
    probability: number;
    reasoning: string;
  }>;
  counterArguments: Array<{
    point: string;
    counterTactic: string;
    successRate: number;
  }>;
  bestApproachTime: string;
  recommendedTone: string;
  riskLevel: number;
}

interface StrategySimulation {
  scenarios: Array<{
    scenarioName: string;
    description: string;
    probability: number;
    expectedReturn: number;
    potentialRisk: number;
    timeHorizon: string;
    keyFactors: string[];
  }>;
  recommendedStrategy: string;
  overallRiskLevel: number;
  confidenceScore: number;
  gameTheoryAnalysis: string;
}

interface RiskAssessment {
  warnings: Array<{
    type: string;
    severity: string;
    description: string;
    detectedAt: string;
    suggestedAction: string;
    relatedEntities: string[];
  }>;
  overallRiskScore: number;
  recommendation: string;
  monitoringPriority: string[];
}

interface Opportunity {
  id: string;
  title: string;
  summary: string;
  source: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DETECTED' | 'ANALYZING' | 'REFINED' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

interface RefinementRun {
  id: string;
  opportunityId: string;
  runType: 'DREAM' | 'QUICK_ANALYSIS' | 'DEEP_DIVE';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  result?: any;
  createdAt: string;
}

interface StrategyProposal {
  id: string;
  opportunityId: string;
  proposalText: string;
  actions: any[];
  alternatives: any[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'DEFERRED';
  createdAt: string;
}

interface StrategistDashboard {
  activeOpportunities: Opportunity[];
  pendingProposals: StrategyProposal[];
  runningRefinements: RefinementRun[];
  recentAlignmentSignals: any[];
  stats: {
    totalOpportunities: number;
    acceptedProposals: number;
    rejectedProposals: number;
    alignmentScore: number;
  };
}

function getRiskColor(level: number): string {
  if (level >= 70) return "text-red-500";
  if (level >= 40) return "text-yellow-500";
  return "text-green-500";
}

function getSeverityBadge(severity: string) {
  const colors: Record<string, string> = {
    low: "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    high: "bg-orange-500/20 text-orange-400",
    critical: "bg-red-500/20 text-red-400",
  };
  return colors[severity] || "bg-gray-500/20 text-gray-400";
}

export default function OraclePage() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const [activeTab, setActiveTab] = useState("strategist");

  // 检查localStorage以处理zustand hydration延迟
  const effectiveRole = role === 'MASTER' ? 'MASTER' :
    (typeof window !== 'undefined' && localStorage.getItem('avatar_role') === 'MASTER' ? 'MASTER' : role);

  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [proposedMessage, setProposedMessage] = useState("");
  const [messageContext, setMessageContext] = useState("");

  const [strategyObjective, setStrategyObjective] = useState("");
  const [scenarios, setScenarios] = useState([
    { name: "方案A：强硬", description: "" },
    { name: "方案B：妥协", description: "" },
  ]);

  const [riskIndustry, setRiskIndustry] = useState("");
  const [riskProjectContext, setRiskProjectContext] = useState("");

  const { data: persons = [] } = useQuery<Person[]>({
    queryKey: ["/api/persons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/persons");
      return res.json();
    },
  });

  const { data: oracleStatus } = useQuery({
    queryKey: ["/api/oracle/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/oracle/status");
      return res.json();
    },
  });

  const communicationMutation = useMutation({
    mutationFn: async (data: { personId: string; proposedMessage: string; context?: string }) => {
      const res = await apiRequest("POST", "/api/oracle/communication", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "预测完成", description: "沟通反馈预测已生成" });
    },
    onError: (error: any) => {
      toast({ title: "预测失败", description: error.message, variant: "destructive" });
    },
  });

  const strategyMutation = useMutation({
    mutationFn: async (data: { personId: string; scenarios: any[]; objective: string }) => {
      const res = await apiRequest("POST", "/api/oracle/strategy", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "推演完成", description: "策略沙盘推演已生成" });
    },
    onError: (error: any) => {
      toast({ title: "推演失败", description: error.message, variant: "destructive" });
    },
  });

  const riskMutation = useMutation({
    mutationFn: async (data: { personId?: string; industry?: string; projectContext?: string }) => {
      const res = await apiRequest("POST", "/api/oracle/risk", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "评估完成", description: "风险评估报告已生成" });
    },
    onError: (error: any) => {
      toast({ title: "评估失败", description: error.message, variant: "destructive" });
    },
  });

  const { data: strategistDashboard, refetch: refetchStrategist } = useQuery<StrategistDashboard>({
    queryKey: ["/api/strategist/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/strategist/dashboard");
      return res.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/strategist/scan");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "扫描完成", description: `发现 ${data.count} 个商机` });
      refetchStrategist();
    },
    onError: (error: any) => {
      toast({ title: "扫描失败", description: error.message, variant: "destructive" });
    },
  });

  const refineMutation = useMutation({
    mutationFn: async (data: { opportunityId: string; runType: string }) => {
      const res = await apiRequest("POST", `/api/strategist/refine/${data.opportunityId}`, { runType: data.runType });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "推演启动", description: "梦境推演已开始运行" });
      refetchStrategist();
    },
    onError: (error: any) => {
      toast({ title: "推演失败", description: error.message, variant: "destructive" });
    },
  });

  const decideMutation = useMutation({
    mutationFn: async (data: { proposalId: string; decision: string; feedback?: string }) => {
      const res = await apiRequest("POST", `/api/strategist/decide/${data.proposalId}`, {
        decision: data.decision,
        feedback: data.feedback
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "决策已记录", description: "小星正在学习您的偏好" });
      refetchStrategist();
    },
    onError: (error: any) => {
      toast({ title: "决策失败", description: error.message, variant: "destructive" });
    },
  });

  const learnMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/strategist/learn");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "学习完成", description: `处理了 ${data.processedCount} 个信号` });
    },
    onError: (error: any) => {
      toast({ title: "学习失败", description: error.message, variant: "destructive" });
    },
  });

  if (effectiveRole !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              红色区域：访问被拒绝
            </CardTitle>
            <CardDescription>
              预言家协议仅限主人协议级别访问
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-950/20">
      <GlobalWakeHeader />

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <Eye className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                预言家协议
              </h1>
              <p className="text-muted-foreground">Project Oracle · 多维预测推演系统</p>
            </div>
          </div>

          <Badge variant={oracleStatus?.available ? "default" : "destructive"} className="gap-1">
            {oracleStatus?.available ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {oracleStatus?.available ? "天眼在线" : "天眼离线"}
          </Badge>
        </div>

        <Card className="border-purple-500/20">
          <CardHeader className="pb-3">
            <Label>选择预测对象</Label>
            <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
              <SelectTrigger data-testid="select-person">
                <SelectValue placeholder="选择联系人进行预测分析..." />
              </SelectTrigger>
              <SelectContent>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={person.id} data-testid={`person-${person.id}`}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{person.name}</span>
                      {person.organization && (
                        <span className="text-muted-foreground">· {person.organization}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPerson && (
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{selectedPerson.role || "未知角色"}</Badge>
                <Badge variant="outline">承诺率: {((selectedPerson.commitmentRate || 0.5) * 100).toFixed(0)}%</Badge>
                <Badge variant="outline">{selectedPerson.negotiationStyle || "未知风格"}</Badge>
              </div>
            )}
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="strategist" className="gap-2" data-testid="tab-strategist">
              <Radar className="w-4 h-4" />
              策略家
            </TabsTrigger>
            <TabsTrigger value="communication" className="gap-2" data-testid="tab-communication">
              <MessageSquare className="w-4 h-4" />
              沟通预测
            </TabsTrigger>
            <TabsTrigger value="strategy" className="gap-2" data-testid="tab-strategy">
              <Target className="w-4 h-4" />
              策略沙盘
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2" data-testid="tab-risk">
              <ShieldAlert className="w-4 h-4" />
              风险预警
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategist" className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Card className="border-cyan-500/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-cyan-400">{strategistDashboard?.stats?.totalOpportunities || 0}</p>
                  <p className="text-sm text-muted-foreground">总商机</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-green-400">{strategistDashboard?.stats?.acceptedProposals || 0}</p>
                  <p className="text-sm text-muted-foreground">已采纳</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-red-400">{strategistDashboard?.stats?.rejectedProposals || 0}</p>
                  <p className="text-sm text-muted-foreground">已拒绝</p>
                </CardContent>
              </Card>
              <Card className="border-purple-500/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-purple-400">{strategistDashboard?.stats?.alignmentScore || 50}%</p>
                  <p className="text-sm text-muted-foreground">对齐度</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600"
                data-testid="btn-scan"
              >
                {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                扫描商机
              </Button>
              <Button
                variant="outline"
                onClick={() => refetchStrategist()}
                className="gap-2"
                data-testid="btn-refresh"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </Button>
              <Button
                variant="outline"
                onClick={() => learnMutation.mutate()}
                disabled={learnMutation.isPending}
                className="gap-2"
                data-testid="btn-learn"
              >
                {learnMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                学习偏好
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Radar className="w-5 h-5 text-cyan-400" />
                    猎寻雷达
                  </CardTitle>
                  <CardDescription>活跃商机与推演状态</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    {strategistDashboard?.activeOpportunities?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Radar className="w-12 h-12 opacity-20 mb-2" />
                        <p>暂无活跃商机</p>
                        <p className="text-sm">点击"扫描商机"开始猎寻</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {strategistDashboard?.activeOpportunities?.map((opp: Opportunity) => (
                          <div key={opp.id} className="p-3 rounded bg-muted/30 border border-muted">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium">{opp.title}</span>
                              <Badge variant={opp.priority === 'HIGH' ? 'destructive' : opp.priority === 'MEDIUM' ? 'default' : 'secondary'}>
                                {opp.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{opp.summary}</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => refineMutation.mutate({ opportunityId: opp.id, runType: 'DREAM' })}
                                disabled={refineMutation.isPending}
                                className="gap-1"
                                data-testid={`btn-refine-${opp.id}`}
                              >
                                <Moon className="w-3 h-3" />
                                梦境推演
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => refineMutation.mutate({ opportunityId: opp.id, runType: 'QUICK_ANALYSIS' })}
                                disabled={refineMutation.isPending}
                                className="gap-1"
                                data-testid={`btn-quick-${opp.id}`}
                              >
                                <Play className="w-3 h-3" />
                                快速分析
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {strategistDashboard?.runningRefinements && strategistDashboard.runningRefinements.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        运行中的推演
                      </h4>
                      {strategistDashboard.runningRefinements.map((run: RefinementRun) => (
                        <div key={run.id} className="p-2 rounded bg-purple-500/10 border border-purple-500/20 mb-2">
                          <div className="flex justify-between">
                            <Badge variant="outline">{run.runType}</Badge>
                            <Badge variant="secondary">{run.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Inbox className="w-5 h-5 text-amber-400" />
                    提案收件箱
                  </CardTitle>
                  <CardDescription>待决策的策略提案</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[380px] pr-4">
                    {strategistDashboard?.pendingProposals?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Inbox className="w-12 h-12 opacity-20 mb-2" />
                        <p>暂无待处理提案</p>
                        <p className="text-sm">推演完成后将生成提案</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {strategistDashboard?.pendingProposals?.map((proposal: StrategyProposal) => (
                          <div key={proposal.id} className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
                            <p className="text-sm mb-3">{proposal.proposalText}</p>

                            {proposal.actions?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-muted-foreground mb-1">建议行动:</p>
                                {proposal.actions.map((action: any, i: number) => (
                                  <Badge key={i} variant="outline" className="mr-1 mb-1">
                                    {action.action || action}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => decideMutation.mutate({ proposalId: proposal.id, decision: 'ACCEPT' })}
                                disabled={decideMutation.isPending}
                                className="gap-1 bg-green-600 hover:bg-green-700"
                                data-testid={`btn-accept-${proposal.id}`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                采纳
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => decideMutation.mutate({ proposalId: proposal.id, decision: 'REJECT' })}
                                disabled={decideMutation.isPending}
                                className="gap-1"
                                data-testid={`btn-reject-${proposal.id}`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                                拒绝
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decideMutation.mutate({ proposalId: proposal.id, decision: 'DEFER' })}
                                disabled={decideMutation.isPending}
                                className="gap-1"
                                data-testid={`btn-defer-${proposal.id}`}
                              >
                                <Clock className="w-3 h-3" />
                                稍后
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    沟通反馈预测器
                  </CardTitle>
                  <CardDescription>
                    预测对方收到信息后的可能回应和反驳点
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>你准备发送的信息</Label>
                    <Textarea
                      value={proposedMessage}
                      onChange={(e) => setProposedMessage(e.target.value)}
                      placeholder="例如：我希望提高10%的预付款比例..."
                      className="mt-1.5 min-h-[100px]"
                      data-testid="input-message"
                    />
                  </div>
                  <div>
                    <Label>背景上下文 (可选)</Label>
                    <Textarea
                      value={messageContext}
                      onChange={(e) => setMessageContext(e.target.value)}
                      placeholder="补充背景信息，如：这是我们第三次合作..."
                      className="mt-1.5"
                      data-testid="input-context"
                    />
                  </div>
                  <Button
                    onClick={() => communicationMutation.mutate({
                      personId: selectedPersonId,
                      proposedMessage,
                      context: messageContext || undefined,
                    })}
                    disabled={!selectedPersonId || !proposedMessage || communicationMutation.isPending}
                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
                    data-testid="btn-predict-communication"
                  >
                    {communicationMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />预测中...</>
                    ) : (
                      <><Brain className="w-4 h-4" />开启天眼预测</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    预测结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {communicationMutation.isError ? (
                    <div className="h-[400px] flex items-center justify-center">
                      <div className="text-center text-red-400">
                        <XCircle className="w-12 h-12 mx-auto mb-4 opacity-60" />
                        <p className="font-medium">预测失败</p>
                        <p className="text-sm text-muted-foreground mt-1">{communicationMutation.error?.message || '请稍后重试'}</p>
                      </div>
                    </div>
                  ) : communicationMutation.data?.prediction ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">风险指数</span>
                          <span className={`font-bold ${getRiskColor(communicationMutation.data.prediction.riskLevel)}`}>
                            {communicationMutation.data.prediction.riskLevel}%
                          </span>
                        </div>
                        <Progress
                          value={communicationMutation.data.prediction.riskLevel}
                          className="h-2"
                        />

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 rounded bg-muted/50">
                            <Clock className="w-4 h-4 text-blue-400 mb-1" />
                            <p className="text-muted-foreground">最佳时机</p>
                            <p className="font-medium">{communicationMutation.data.prediction.bestApproachTime}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <MessageSquare className="w-4 h-4 text-purple-400 mb-1" />
                            <p className="text-muted-foreground">建议语气</p>
                            <p className="font-medium">{communicationMutation.data.prediction.recommendedTone}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">可能的回应</h4>
                          {communicationMutation.data.prediction.likelyResponses?.map((resp: any, i: number) => (
                            <div key={i} className="p-3 rounded bg-blue-500/10 border border-blue-500/20 mb-2">
                              <div className="flex justify-between mb-1">
                                <Badge variant="outline">{(resp.probability * 100).toFixed(0)}% 概率</Badge>
                              </div>
                              <p className="text-sm">{resp.response}</p>
                              <p className="text-xs text-muted-foreground mt-1">{resp.reasoning}</p>
                            </div>
                          ))}
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">反驳点与反击话术</h4>
                          {communicationMutation.data.prediction.counterArguments?.map((arg: any, i: number) => (
                            <div key={i} className="p-3 rounded bg-purple-500/10 border border-purple-500/20 mb-2">
                              <p className="text-sm font-medium text-red-400">反驳: {arg.point}</p>
                              <p className="text-sm text-green-400 mt-1">反击: {arg.counterTactic}</p>
                              <Badge variant="outline" className="mt-1">成功率: {(arg.successRate * 100).toFixed(0)}%</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>选择联系人并输入信息后开启预测</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5 text-green-400" />
                    策略沙盘推演
                  </CardTitle>
                  <CardDescription>
                    博弈论分析：模拟不同策略路径的期望收益与风险
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>我的目标</Label>
                    <Textarea
                      value={strategyObjective}
                      onChange={(e) => setStrategyObjective(e.target.value)}
                      placeholder="例如：在保持合作关系的前提下，争取更有利的付款条件..."
                      className="mt-1.5"
                      data-testid="input-objective"
                    />
                  </div>

                  {scenarios.map((scenario, i) => (
                    <div key={i} className="space-y-2">
                      <Label>{scenario.name}</Label>
                      <Textarea
                        value={scenario.description}
                        onChange={(e) => {
                          const newScenarios = [...scenarios];
                          newScenarios[i].description = e.target.value;
                          setScenarios(newScenarios);
                        }}
                        placeholder={`描述${scenario.name}的具体内容...`}
                        className="min-h-[60px]"
                        data-testid={`input-scenario-${i}`}
                      />
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScenarios([...scenarios, { name: `方案${String.fromCharCode(65 + scenarios.length)}`, description: "" }])}
                    data-testid="btn-add-scenario"
                  >
                    + 添加方案
                  </Button>

                  <Button
                    onClick={() => strategyMutation.mutate({
                      personId: selectedPersonId,
                      scenarios: scenarios.filter(s => s.description),
                      objective: strategyObjective,
                    })}
                    disabled={!selectedPersonId || !strategyObjective || strategyMutation.isPending}
                    className="w-full gap-2 bg-gradient-to-r from-green-600 to-blue-600"
                    data-testid="btn-simulate-strategy"
                  >
                    {strategyMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />推演中...</>
                    ) : (
                      <><BarChart3 className="w-4 h-4" />启动沙盘推演</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    推演结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {strategyMutation.isError ? (
                    <div className="h-[400px] flex items-center justify-center">
                      <div className="text-center text-red-400">
                        <XCircle className="w-12 h-12 mx-auto mb-4 opacity-60" />
                        <p className="font-medium">推演失败</p>
                        <p className="text-sm text-muted-foreground mt-1">{strategyMutation.error?.message || '请稍后重试'}</p>
                      </div>
                    </div>
                  ) : strategyMutation.data?.simulation ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">整体风险</p>
                            <p className={`text-2xl font-bold ${getRiskColor(strategyMutation.data.simulation.overallRiskLevel)}`}>
                              {strategyMutation.data.simulation.overallRiskLevel}%
                            </p>
                          </div>
                          <div className="p-3 rounded bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">置信度</p>
                            <p className="text-2xl font-bold text-blue-400">
                              {(strategyMutation.data.simulation.confidenceScore * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                          <h4 className="font-medium text-green-400 mb-1">推荐策略</h4>
                          <p className="text-sm">{strategyMutation.data.simulation.recommendedStrategy}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">各方案分析</h4>
                          {strategyMutation.data.simulation.scenarios?.map((s: any, i: number) => (
                            <div key={i} className="p-3 rounded bg-muted/30 border border-muted mb-2">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">{s.scenarioName}</span>
                                <Badge variant="outline">{(s.probability * 100).toFixed(0)}% 概率</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center">
                                  <p className="text-muted-foreground">期望收益</p>
                                  <p className="text-green-400 font-medium">{s.expectedReturn}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-muted-foreground">潜在风险</p>
                                  <p className="text-red-400 font-medium">{s.potentialRisk}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-muted-foreground">时间周期</p>
                                  <p className="font-medium">{s.timeHorizon}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 rounded bg-purple-500/10 border border-purple-500/20">
                          <h4 className="font-medium text-purple-400 mb-1">博弈论分析</h4>
                          <p className="text-sm">{strategyMutation.data.simulation.gameTheoryAnalysis}</p>
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>设置目标和方案后启动推演</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    风险预警系统
                  </CardTitle>
                  <CardDescription>
                    检测行业诉讼、高管变动、市场异常等潜在风险
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>目标行业</Label>
                    <Input
                      value={riskIndustry}
                      onChange={(e) => setRiskIndustry(e.target.value)}
                      placeholder="例如：房地产、互联网金融..."
                      className="mt-1.5"
                      data-testid="input-industry"
                    />
                  </div>
                  <div>
                    <Label>项目背景</Label>
                    <Textarea
                      value={riskProjectContext}
                      onChange={(e) => setRiskProjectContext(e.target.value)}
                      placeholder="描述当前项目或合作的背景信息..."
                      className="mt-1.5"
                      data-testid="input-project-context"
                    />
                  </div>
                  <Button
                    onClick={() => riskMutation.mutate({
                      personId: selectedPersonId || undefined,
                      industry: riskIndustry || undefined,
                      projectContext: riskProjectContext || undefined,
                    })}
                    disabled={riskMutation.isPending}
                    className="w-full gap-2 bg-gradient-to-r from-red-600 to-orange-600"
                    data-testid="btn-assess-risk"
                  >
                    {riskMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />评估中...</>
                    ) : (
                      <><Zap className="w-4 h-4" />启动风险扫描</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    风险评估报告
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {riskMutation.isError ? (
                    <div className="h-[400px] flex items-center justify-center">
                      <div className="text-center text-red-400">
                        <XCircle className="w-12 h-12 mx-auto mb-4 opacity-60" />
                        <p className="font-medium">评估失败</p>
                        <p className="text-sm text-muted-foreground mt-1">{riskMutation.error?.message || '请稍后重试'}</p>
                      </div>
                    </div>
                  ) : riskMutation.data?.assessment ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        <div className="p-4 rounded bg-muted/50 text-center">
                          <p className="text-sm text-muted-foreground mb-1">整体风险评分</p>
                          <p className={`text-4xl font-bold ${getRiskColor(riskMutation.data.assessment.overallRiskScore)}`}>
                            {riskMutation.data.assessment.overallRiskScore}
                          </p>
                          <Progress
                            value={riskMutation.data.assessment.overallRiskScore}
                            className="h-2 mt-2"
                          />
                        </div>

                        <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                          <h4 className="font-medium text-blue-400 mb-1">总体建议</h4>
                          <p className="text-sm">{riskMutation.data.assessment.recommendation}</p>
                        </div>

                        {riskMutation.data.assessment.warnings?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">风险预警</h4>
                            {riskMutation.data.assessment.warnings.map((w: any, i: number) => (
                              <div key={i} className="p-3 rounded bg-red-500/10 border border-red-500/20 mb-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getSeverityBadge(w.severity)}>
                                    {w.severity.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">{w.type}</Badge>
                                </div>
                                <p className="text-sm font-medium">{w.description}</p>
                                <p className="text-xs text-green-400 mt-1">建议: {w.suggestedAction}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {riskMutation.data.assessment.monitoringPriority?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">优先监控项</h4>
                            <div className="flex flex-wrap gap-2">
                              {riskMutation.data.assessment.monitoringPriority.map((item: string, i: number) => (
                                <Badge key={i} variant="outline" className="gap-1">
                                  <ChevronRight className="w-3 h-3" />
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>输入行业或项目信息后启动扫描</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
