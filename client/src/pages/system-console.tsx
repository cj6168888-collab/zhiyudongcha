import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { 
  Shield,
  Activity,
  Cpu,
  Brain,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Users,
  Server,
  Wifi,
  WifiOff,
  Clock,
  DollarSign
} from "lucide-react";

interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  uptime: number;
  memoryUsage: { used: number; total: number; percent: number };
  cpuUsage: number;
  activeConnections: number;
  queueDepth: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsPerMinute: number;
}

interface HPMetrics {
  totalConsumed: number;
  regenerated: number;
  currentBalance: number;
  consumptionByModule: Record<string, number>;
}

interface TelemetryDashboard {
  systemHealth: SystemHealth;
  requestMetrics: RequestMetrics;
  hpMetrics: HPMetrics;
  recentAlerts: Array<{
    id: string;
    severity: string;
    message: string;
    timestamp: number;
  }>;
  topEndpoints: Array<{
    path: string;
    count: number;
    avgTime: number;
  }>;
}

interface ExpertStats {
  [key: string]: {
    calls: number;
    avgTime: number;
    avgConfidence: number;
  };
}

interface SyncStats {
  totalDevices: number;
  onlineDevices: number;
  pendingOperations: number;
  unresolvedConflicts: number;
}

interface ThreatStats {
  total: number;
  active: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

const statusColors = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  CRITICAL: 'bg-red-500',
};

const statusLabels = {
  HEALTHY: '健康',
  DEGRADED: '降级',
  CRITICAL: '危急',
};

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}小时 ${minutes}分钟`;
}

function MetricCard({ icon: Icon, title, value, subtitle, color = 'text-amber-400' }: {
  icon: React.ComponentType<any>;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-800 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-400">{title}</p>
              <p className="text-xl font-semibold text-white">{value}</p>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface TelemetryStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  uptime: number;
  requests: RequestMetrics;
  hp: HPMetrics;
  cost: { totalUsd: number; byModel: Record<string, number> };
  alertCount: number;
}

function SystemOverview() {
  const { data: telemetry } = useQuery<{ success: boolean; data: TelemetryStatus }>({
    queryKey: ['/api/telemetry/status'],
    refetchInterval: 10000,
  });

  const status = telemetry?.data?.status ?? 'HEALTHY';
  const uptime = telemetry?.data?.uptime ?? 0;
  const requests = telemetry?.data?.requests;
  const hp = telemetry?.data?.hp;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">系统概览</h3>
        <Badge className={`${statusColors[status]} text-white`}>
          {statusLabels[status]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Clock}
          title="运行时间"
          value={uptime ? formatUptime(uptime) : '-'}
          color="text-blue-400"
        />
        <MetricCard
          icon={Activity}
          title="请求总数"
          value={requests?.totalRequests ?? 0}
          subtitle={requests ? `成功率 ${requests.totalRequests ? ((requests.successfulRequests / requests.totalRequests) * 100).toFixed(1) : 100}%` : ''}
          color="text-purple-400"
        />
        <MetricCard
          icon={Zap}
          title="HP余量"
          value={hp?.currentBalance ?? '-'}
          subtitle={hp ? `已消耗 ${hp.totalConsumed}` : ''}
          color="text-amber-400"
        />
        <MetricCard
          icon={Activity}
          title="请求/分钟"
          value={requests?.requestsPerMinute.toFixed(1) ?? '-'}
          subtitle={requests ? `总计 ${requests.totalRequests}` : ''}
          color="text-green-400"
        />
      </div>

      {requests && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">响应时间分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-amber-400">{requests.avgResponseTimeMs}ms</p>
                <p className="text-xs text-slate-500">平均</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{requests.p50ResponseTimeMs}ms</p>
                <p className="text-xs text-slate-500">P50</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{requests.p95ResponseTimeMs}ms</p>
                <p className="text-xs text-slate-500">P95</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{requests.p99ResponseTimeMs}ms</p>
                <p className="text-xs text-slate-500">P99</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SecurityPanel() {
  const { data: threats } = useQuery<{ success: boolean; data: ThreatStats }>({
    queryKey: ['/api/security/threats/stats'],
    refetchInterval: 30000,
  });

  const { data: alerts } = useQuery<{ success: boolean; data: Array<any> }>({
    queryKey: ['/api/telemetry/alerts'],
    refetchInterval: 15000,
  });

  const stats = threats?.data;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <Shield className="h-5 w-5 text-amber-400" />
        安全状态
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={AlertTriangle}
          title="活跃威胁"
          value={stats?.active ?? 0}
          color={stats?.active ? 'text-red-400' : 'text-green-400'}
        />
        <MetricCard
          icon={CheckCircle2}
          title="已处理"
          value={(stats?.total ?? 0) - (stats?.active ?? 0)}
          color="text-green-400"
        />
      </div>

      {alerts?.data && alerts.data.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">最近告警</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              {alerts.data.slice(0, 5).map((alert: any) => (
                <div key={alert.id} className="flex items-center gap-2 py-2 border-b border-slate-800 last:border-0">
                  <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-xs">
                    {alert.severity}
                  </Badge>
                  <span className="text-sm text-slate-300 truncate">{alert.message}</span>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExpertPanel() {
  const { data: stats } = useQuery<{ success: boolean; data: ExpertStats }>({
    queryKey: ['/api/experts/stats'],
    refetchInterval: 30000,
  });

  const expertNames: Record<string, string> = {
    LEGAL: '法务',
    FINANCE: '财务',
    STRATEGY: '战略',
    PSYCHOLOGY: '心理',
    PLANNING: '规划',
    SECRETARY: '秘书',
  };

  const expertData = stats?.data ? Object.entries(stats.data) : [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <Brain className="h-5 w-5 text-purple-400" />
        专家协同
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {expertData.map(([type, data]) => (
          <Card key={type} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{expertNames[type] || type}</span>
                <Badge variant="outline" className="text-xs">{data.calls}次</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">平均时间</span>
                  <span className="text-slate-300">{data.avgTime}ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">置信度</span>
                  <span className="text-amber-400">{data.avgConfidence}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SyncPanel() {
  const { data: syncStats } = useQuery<{ success: boolean; data: SyncStats }>({
    queryKey: ['/api/offline/stats'],
    refetchInterval: 30000,
  });

  const stats = syncStats?.data;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <Server className="h-5 w-5 text-blue-400" />
        离线同步
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Wifi}
          title="在线设备"
          value={stats?.onlineDevices ?? 0}
          subtitle={`共 ${stats?.totalDevices ?? 0} 台`}
          color="text-green-400"
        />
        <MetricCard
          icon={TrendingUp}
          title="待同步"
          value={stats?.pendingOperations ?? 0}
          color={stats?.pendingOperations ? 'text-yellow-400' : 'text-green-400'}
        />
      </div>

      {stats?.unresolvedConflicts && stats.unresolvedConflicts > 0 && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-300">
              {stats.unresolvedConflicts} 个同步冲突待解决
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CostPanel() {
  const { data: cost } = useQuery<{ success: boolean; data: { totalUsd: number; byModel: Record<string, number> } }>({
    queryKey: ['/api/telemetry/cost'],
    refetchInterval: 60000,
  });

  const costData = cost?.data;
  const modelCosts = costData?.byModel ? Object.entries(costData.byModel).filter(([, v]) => v > 0) : [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-green-400" />
        API成本
      </h3>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="text-center mb-4">
            <p className="text-3xl font-bold text-amber-400">${costData?.totalUsd.toFixed(4) ?? '0.0000'}</p>
            <p className="text-sm text-slate-500">累计消耗 (USD)</p>
          </div>

          {modelCosts.length > 0 && (
            <div className="space-y-2">
              {modelCosts.map(([model, amount]) => (
                <div key={model} className="flex justify-between text-sm">
                  <span className="text-slate-400">{model}</span>
                  <span className="text-white">${amount.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemConsole() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <GlobalWakeHeader title="系统控制台" />
      
      <ScrollArea className="h-[calc(100vh-60px)]">
        <div className="p-4 space-y-6 pb-24">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-800">
              <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
              <TabsTrigger value="security" className="text-xs">安全</TabsTrigger>
              <TabsTrigger value="experts" className="text-xs">专家</TabsTrigger>
              <TabsTrigger value="sync" className="text-xs">同步</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4 space-y-6">
              <SystemOverview />
              <CostPanel />
            </TabsContent>
            
            <TabsContent value="security" className="mt-4">
              <SecurityPanel />
            </TabsContent>
            
            <TabsContent value="experts" className="mt-4">
              <ExpertPanel />
            </TabsContent>
            
            <TabsContent value="sync" className="mt-4">
              <SyncPanel />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
