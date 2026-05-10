import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Link } from "wouter";
import { 
  FolderKanban, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Lightbulb,
  Target,
  Pause,
  ArrowRight,
  RefreshCw,
  Sparkles,
  BarChart3
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface DashboardSummary {
  totalProjects: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  pendingReviewCount: number;
  inProgressCount: number;
  onHoldCount: number;
  recentlyUpdated: number;
  overdueCount: number;
  pendingReviewProjects: Array<{
    id: string;
    title: string;
    category: string;
    priority: number;
    createdAt: string;
  }>;
  inProgressProjects: Array<{
    id: string;
    title: string;
    category: string;
    priority: number;
    status: string;
  }>;
  riskProjects: Array<{
    id: string;
    title: string;
    status: string;
    priority: number;
  }>;
}

interface Insight {
  type: 'warning' | 'opportunity' | 'info' | 'action';
  title: string;
  content: string;
  projectId?: string;
  priority: 'high' | 'medium' | 'low';
}

interface InsightsResponse {
  insights: Insight[];
  summary: string;
  generatedAt: string;
  aiAvailable: boolean;
  insightSource: 'ai' | 'heuristic';
}

interface RiskAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  projectId?: string;
  projectTitle?: string;
  action?: string;
  createdAt: string;
}

interface RiskAlertsResponse {
  alerts: RiskAlert[];
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  generatedAt: string;
}

const statusLabels: Record<string, string> = {
  PENDING: '待定',
  PENDING_REVIEW: '待审',
  APPROVED: '立项',
  ON_HOLD: '暂缓',
  DEPRECATED: '废除',
  COMPLETED: '完成',
};

const statusColors: Record<string, string> = {
  PENDING: '#eab308',
  PENDING_REVIEW: '#a855f7',
  APPROVED: '#22c55e',
  ON_HOLD: '#f97316',
  DEPRECATED: '#ef4444',
  COMPLETED: '#3b82f6',
};

const priorityLabels: Record<string, string> = {
  CRITICAL: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const priorityColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#6b7280',
};

const insightIcons: Record<string, React.ReactNode> = {
  warning: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  opportunity: <Lightbulb className="w-5 h-5 text-yellow-400" />,
  info: <CheckCircle className="w-5 h-5 text-blue-400" />,
  action: <Target className="w-5 h-5 text-purple-400" />,
};

const insightColors: Record<string, string> = {
  warning: 'border-orange-500/30 bg-orange-500/10',
  opportunity: 'border-yellow-500/30 bg-yellow-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
  action: 'border-purple-500/30 bg-purple-500/10',
};

export default function ProjectDashboard() {
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<DashboardSummary>({
    queryKey: ['/api/projects/dashboard/summary'],
    refetchInterval: 30000,
  });

  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<InsightsResponse>({
    queryKey: ['/api/projects/dashboard/ai-insights'],
    refetchInterval: 60000,
  });

  const { data: riskAlerts, isLoading: riskLoading, refetch: refetchRisks } = useQuery<RiskAlertsResponse>({
    queryKey: ['/api/projects/dashboard/risk-alerts'],
    refetchInterval: 30000,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchInsights();
    refetchRisks();
  };

  const statusChartData = summary ? 
    Object.entries(summary.statusCounts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      color: statusColors[status] || '#6b7280',
    })) : [];

  const priorityChartData = summary ?
    Object.entries(summary.priorityCounts).map(([priority, count]) => ({
      name: priorityLabels[priority] || priority,
      count,
      fill: priorityColors[priority] || '#6b7280',
    })) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <GlobalWakeHeader 
        title="项目仪表盘" 
        subtitle="全局视图与AI洞察"
      />
      
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-gold-400" />
            <h1 className="text-2xl font-bold text-white" data-testid="text-dashboard-title">项目智能仪表盘</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新数据
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <FolderKanban className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white" data-testid="text-total-projects">{summary?.totalProjects || 0}</p>
                  <p className="text-xs text-slate-400">项目总数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white" data-testid="text-pending-review">{summary?.pendingReviewCount || 0}</p>
                  <p className="text-xs text-slate-400">待审批</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white" data-testid="text-in-progress">{summary?.inProgressCount || 0}</p>
                  <p className="text-xs text-slate-400">进行中</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Pause className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white" data-testid="text-on-hold">{summary?.onHoldCount || 0}</p>
                  <p className="text-xs text-slate-400">暂缓/风险</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <CardTitle className="text-white">AI智能洞察</CardTitle>
              </div>
              {insightsData && (
                <Badge 
                  variant="outline" 
                  className={insightsData.aiAvailable 
                    ? "border-green-500/50 text-green-400" 
                    : "border-slate-500/50 text-slate-400"
                  }
                  data-testid="badge-ai-status"
                >
                  {insightsData.insightSource === 'ai' ? 'AI驱动' : '规则分析'}
                </Badge>
              )}
            </div>
            <CardDescription className="text-slate-400">
              {insightsData?.aiAvailable 
                ? '基于AI的项目数据智能分析和建议' 
                : '基于规则的项目状态分析'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                <span className="ml-2 text-slate-400">生成洞察中...</span>
              </div>
            ) : insightsData?.insights && insightsData.insights.length > 0 ? (
              <div className="space-y-3">
                {insightsData.insights.map((insight, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border ${insightColors[insight.type]} flex items-start gap-3`}
                    data-testid={`insight-card-${index}`}
                  >
                    {insightIcons[insight.type]}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{insight.title}</span>
                        <Badge 
                          variant="outline" 
                          className={
                            insight.priority === 'high' ? 'border-red-500/50 text-red-400' :
                            insight.priority === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                            'border-slate-500/50 text-slate-400'
                          }
                        >
                          {insight.priority === 'high' ? '重要' : insight.priority === 'medium' ? '一般' : '参考'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-300">{insight.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                暂无洞察数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Alerts Section */}
        <Card className="bg-slate-900/60 border-red-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <CardTitle className="text-white text-lg">风险预警</CardTitle>
                {riskAlerts && riskAlerts.criticalCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    {riskAlerts.criticalCount} 紧急
                  </Badge>
                )}
                {riskAlerts && riskAlerts.warningCount > 0 && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    {riskAlerts.warningCount} 警告
                  </Badge>
                )}
              </div>
              <span className="text-xs text-slate-500">
                实时监控 · 自动刷新
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : riskAlerts?.alerts && riskAlerts.alerts.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {riskAlerts.alerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-3 rounded-lg border ${
                        alert.type === 'critical' ? 'border-red-500/40 bg-red-500/10' :
                        alert.type === 'warning' ? 'border-orange-500/30 bg-orange-500/10' :
                        'border-blue-500/30 bg-blue-500/10'
                      }`}
                      data-testid={`risk-alert-${alert.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded ${
                          alert.type === 'critical' ? 'bg-red-500/20' :
                          alert.type === 'warning' ? 'bg-orange-500/20' :
                          'bg-blue-500/20'
                        }`}>
                          {alert.type === 'critical' ? (
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          ) : alert.type === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          ) : (
                            <Lightbulb className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`font-medium ${
                              alert.type === 'critical' ? 'text-red-400' :
                              alert.type === 'warning' ? 'text-orange-400' :
                              'text-blue-400'
                            }`}>
                              {alert.title}
                            </h4>
                            {alert.projectId && (
                              <Link href={`/projects/${alert.projectId}`}>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 text-xs text-slate-400 hover:text-white"
                                  data-testid={`button-risk-action-${alert.id}`}
                                >
                                  {alert.action || '查看'} <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                            )}
                          </div>
                          <p className="text-sm text-slate-300">{alert.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-green-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                <p>当前无风险预警</p>
                <p className="text-xs text-slate-500 mt-1">系统持续监控中...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Status Distribution Chart */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              {statusChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={{ stroke: '#64748b' }}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority Distribution Chart */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">优先级分布</CardTitle>
            </CardHeader>
            <CardContent>
              {priorityChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityChartData} layout="vertical">
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="#64748b"
                        width={50}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Lists */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pending Review Projects */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <CardTitle className="text-white text-lg">待审批项目</CardTitle>
                </div>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300" data-testid="link-view-all-pending">
                    查看全部 <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {summary?.pendingReviewProjects && summary.pendingReviewProjects.length > 0 ? (
                  <div className="space-y-2">
                    {summary.pendingReviewProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <div 
                          className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 cursor-pointer transition-colors"
                          data-testid={`pending-project-${project.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white truncate">{project.title}</span>
                            <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                              {project.category || '业务'}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    暂无待审批项目
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Risk Projects */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <CardTitle className="text-white text-lg">风险/暂缓项目</CardTitle>
                </div>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300" data-testid="link-view-all-risk">
                    查看全部 <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {summary?.riskProjects && summary.riskProjects.length > 0 ? (
                  <div className="space-y-2">
                    {summary.riskProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <div 
                          className="p-3 rounded-lg bg-slate-800/50 border border-orange-500/30 hover:border-orange-500/50 cursor-pointer transition-colors"
                          data-testid={`risk-project-${project.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white truncate">{project.title}</span>
                            <Badge variant="outline" className="border-orange-500/50 text-orange-400 text-xs">
                              暂缓
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-green-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                    无风险项目
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
