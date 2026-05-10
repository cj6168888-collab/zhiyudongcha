import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Laptop,
  Smartphone,
  Server,
  Monitor,
  Tablet,
  Glasses,
  Cpu,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  Flame,
  Eye,
  Trash2,
  Skull,
  Radio,
  Battery,
  MemoryStick,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

interface DeviceCapabilities {
  canRunLocalModel: boolean;
  localModelName?: string;
  maxModelSize?: string;
  gpuAvailable?: boolean;
  gpuMemoryMB?: number;
  cpuCores: number;
  memoryMB: number;
  batteryLevel?: number;
  isPluggedIn?: boolean;
  networkType?: string;
  features: string[];
}

interface DeviceStats {
  jobsCompleted: number;
  jobsFailed: number;
  averageLatencyMs: number;
  successRate: number;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  userId: string;
  userRole: string;
  connectedAt: number;
  lastHeartbeat: number;
  capabilities: DeviceCapabilities;
  stats: DeviceStats;
}

interface BattleReport {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  localAICapable: number;
  gpuDevices: number;
  totalJobsCompleted: number;
  totalJobsFailed: number;
  devicesByType: Record<string, number>;
  devicesByStatus: Record<string, number>;
}

interface SecurityStatus {
  overallLevel: string;
  meltdownReady: boolean;
  lastMeltdownCheck: number;
  activeThreats: number;
}

interface CommandCenterStatus {
  success: boolean;
  timestamp: number;
  battleReport: BattleReport;
  devices: Device[];
  securityStatus: SecurityStatus;
}

const deviceTypeIcons: Record<string, React.ReactNode> = {
  MOBILE: <Smartphone className="w-5 h-5" />,
  TABLET: <Tablet className="w-5 h-5" />,
  LAPTOP: <Laptop className="w-5 h-5" />,
  DESKTOP: <Monitor className="w-5 h-5" />,
  SERVER: <Server className="w-5 h-5" />,
  EDGE: <Cpu className="w-5 h-5" />,
  AR_GLASSES: <Glasses className="w-5 h-5" />,
  UNKNOWN: <Monitor className="w-5 h-5" />,
};

const statusColors: Record<string, string> = {
  ONLINE: "text-green-500",
  BUSY: "text-yellow-500",
  IDLE: "text-blue-500",
  OFFLINE: "text-gray-500",
  SLEEPING: "text-purple-500",
};

const statusLabels: Record<string, string> = {
  ONLINE: "在线",
  BUSY: "繁忙",
  IDLE: "空闲",
  OFFLINE: "离线",
  SLEEPING: "休眠",
};

const deviceTypeLabels: Record<string, string> = {
  MOBILE: "手机",
  TABLET: "平板",
  LAPTOP: "笔记本",
  DESKTOP: "台式机",
  SERVER: "服务器",
  EDGE: "边缘设备",
  AR_GLASSES: "AR眼镜",
  UNKNOWN: "未知",
};

const meltdownLevels = [
  { value: "LEVEL_1_VISUAL", label: "Level 1: 视觉清空", icon: <Eye className="w-4 h-4" />, color: "bg-yellow-500" },
  { value: "LEVEL_2_CACHE", label: "Level 2: 缓存销毁", icon: <Trash2 className="w-4 h-4" />, color: "bg-orange-500" },
  { value: "LEVEL_3_LOCAL", label: "Level 3: 本地熔断", icon: <Flame className="w-4 h-4" />, color: "bg-red-500" },
  { value: "LEVEL_4_SCORCHED", label: "Level 4: 焦土策略", icon: <Skull className="w-4 h-4" />, color: "bg-purple-500" },
];

export default function CommandCenter() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeltdownLevel, setSelectedMeltdownLevel] = useState("LEVEL_1_VISUAL");
  const [meltdownDialogOpen, setMeltdownDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const { data: status, isLoading, refetch } = useQuery<CommandCenterStatus>({
    queryKey: ["/api/command-center/status"],
    refetchInterval: 5000,
  });

  const meltdownMutation = useMutation({
    mutationFn: async (level: string) => {
      const response = await apiRequest("POST", "/api/command-center/meltdown", { level });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "熔断协议已执行",
        description: `销毁文件: ${data.report?.filesDestroyed || 0}, 清除缓存: ${data.report?.cachesCleared || 0}`,
      });
      setMeltdownDialogOpen(false);
      setConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["/api/command-center/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "熔断执行失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMeltdown = () => {
    if (confirmText !== "确认熔断") {
      toast({
        title: "确认失败",
        description: '请输入"确认熔断"以继续',
        variant: "destructive",
      });
      return;
    }
    meltdownMutation.mutate(selectedMeltdownLevel);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-cyan-400">加载战情室...</span>
        </div>
      </div>
    );
  }

  const report = status?.battleReport;
  const devices = status?.devices || [];
  const security = status?.securityStatus;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 md:p-6" data-testid="page-command-center">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              司令部战情室
            </h1>
            <p className="text-gray-400 mt-1">实时设备监控与远程指挥</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-cyan-600 text-cyan-400 hover:bg-cyan-950"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Dialog open={meltdownDialogOpen} onOpenChange={setMeltdownDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-meltdown"
                >
                  <Flame className="w-4 h-4 mr-2" />
                  熔断
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-red-600">
                <DialogHeader>
                  <DialogTitle className="text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    启动熔断协议
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    此操作将触发数据销毁程序，请谨慎操作。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">选择熔断等级</label>
                    <Select value={selectedMeltdownLevel} onValueChange={setSelectedMeltdownLevel}>
                      <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-meltdown-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {meltdownLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              {level.icon}
                              <span>{level.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">输入"确认熔断"以继续</label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
                      placeholder="确认熔断"
                      data-testid="input-meltdown-confirm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMeltdownDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleMeltdown}
                    disabled={meltdownMutation.isPending || confirmText !== "确认熔断"}
                    data-testid="button-confirm-meltdown"
                  >
                    {meltdownMutation.isPending ? "执行中..." : "执行熔断"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">在线设备</p>
                    <p className="text-2xl font-bold text-green-400" data-testid="text-online-count">
                      {report?.onlineDevices || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <Wifi className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">总计 {report?.totalDevices || 0} 台设备</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">AI能力</p>
                    <p className="text-2xl font-bold text-cyan-400" data-testid="text-ai-count">
                      {report?.localAICapable || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-cyan-500/10 rounded-full">
                    <Cpu className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">GPU设备 {report?.gpuDevices || 0} 台</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">任务完成</p>
                    <p className="text-2xl font-bold text-blue-400" data-testid="text-jobs-completed">
                      {report?.totalJobsCompleted || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Activity className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">失败 {report?.totalJobsFailed || 0} 个</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">安全态势</p>
                    <p className={`text-2xl font-bold ${
                      security?.overallLevel === 'GREEN' ? 'text-green-400' :
                      security?.overallLevel === 'YELLOW' ? 'text-yellow-400' : 'text-red-400'
                    }`} data-testid="text-security-level">
                      {security?.overallLevel === 'GREEN' ? '安全' :
                       security?.overallLevel === 'YELLOW' ? '警戒' : '危险'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${
                    security?.overallLevel === 'GREEN' ? 'bg-green-500/10' :
                    security?.overallLevel === 'YELLOW' ? 'bg-yellow-500/10' : 'bg-red-500/10'
                  }`}>
                    {security?.overallLevel === 'GREEN' ? (
                      <ShieldCheck className="w-6 h-6 text-green-400" />
                    ) : security?.overallLevel === 'YELLOW' ? (
                      <Shield className="w-6 h-6 text-yellow-400" />
                    ) : (
                      <ShieldAlert className="w-6 h-6 text-red-400" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  熔断就绪: {security?.meltdownReady ? '是' : '否'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="devices" className="data-[state=active]:bg-cyan-600">
              设备列表
            </TabsTrigger>
            <TabsTrigger value="distribution" className="data-[state=active]:bg-cyan-600">
              设备分布
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {devices.map((device, index) => (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-slate-900/70 border-slate-800 hover:border-cyan-700 transition-colors" data-testid={`card-device-${device.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-slate-800 ${statusColors[device.status]}`}>
                              {deviceTypeIcons[device.type] || deviceTypeIcons.UNKNOWN}
                            </div>
                            <div>
                              <CardTitle className="text-base text-white">{device.name}</CardTitle>
                              <p className="text-xs text-gray-500">{device.id.slice(0, 12)}...</p>
                            </div>
                          </div>
                          <Badge
                            variant={device.status === 'ONLINE' || device.status === 'IDLE' ? 'default' : 'secondary'}
                            className={`${
                              device.status === 'ONLINE' ? 'bg-green-500/20 text-green-400 border-green-500' :
                              device.status === 'BUSY' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' :
                              device.status === 'IDLE' ? 'bg-blue-500/20 text-blue-400 border-blue-500' :
                              'bg-gray-500/20 text-gray-400 border-gray-500'
                            }`}
                          >
                            {statusLabels[device.status] || device.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Cpu className="w-3 h-3" />
                            <span>{device.capabilities.cpuCores} 核</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <MemoryStick className="w-3 h-3" />
                            <span>{Math.round((device.capabilities.memoryMB || 0) / 1024)}GB</span>
                          </div>
                          {device.capabilities.batteryLevel !== undefined && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Battery className="w-3 h-3" />
                              <span>{device.capabilities.batteryLevel}%</span>
                            </div>
                          )}
                          {device.capabilities.gpuAvailable && (
                            <div className="flex items-center gap-2 text-cyan-400">
                              <Zap className="w-3 h-3" />
                              <span>GPU</span>
                            </div>
                          )}
                        </div>

                        {device.capabilities.canRunLocalModel && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-cyan-600 text-cyan-400">
                              本地AI: {device.capabilities.localModelName || device.capabilities.maxModelSize || 'Ready'}
                            </Badge>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-800">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>心跳: {formatTime(device.lastHeartbeat)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                {device.stats.jobsCompleted}
                              </span>
                              {device.stats.jobsFailed > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                  <XCircle className="w-3 h-3" />
                                  {device.stats.jobsFailed}
                                </span>
                              )}
                            </div>
                          </div>
                          {device.stats.successRate < 1 && device.stats.jobsCompleted > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500">成功率</span>
                                <span className="text-gray-400">{(device.stats.successRate * 100).toFixed(0)}%</span>
                              </div>
                              <Progress value={device.stats.successRate * 100} className="h-1" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {devices.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                  <WifiOff className="w-12 h-12 mb-4" />
                  <p>暂无设备连接</p>
                  <p className="text-sm mt-1">设备上线后将自动显示</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="mt-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">设备类型分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(report?.devicesByType || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="p-2 bg-slate-700 rounded-lg text-cyan-400">
                        {deviceTypeIcons[type] || deviceTypeIcons.UNKNOWN}
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{count}</p>
                        <p className="text-xs text-gray-400">{deviceTypeLabels[type] || type}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h4 className="text-sm text-gray-400 mb-3">状态分布</h4>
                  <div className="space-y-2">
                    {Object.entries(report?.devicesByStatus || {}).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          status === 'ONLINE' ? 'bg-green-500' :
                          status === 'BUSY' ? 'bg-yellow-500' :
                          status === 'IDLE' ? 'bg-blue-500' :
                          status === 'SLEEPING' ? 'bg-purple-500' : 'bg-gray-500'
                        }`} />
                        <span className="text-sm text-gray-400 w-20">{statusLabels[status] || status}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              status === 'ONLINE' ? 'bg-green-500' :
                              status === 'BUSY' ? 'bg-yellow-500' :
                              status === 'IDLE' ? 'bg-blue-500' :
                              status === 'SLEEPING' ? 'bg-purple-500' : 'bg-gray-500'
                            }`}
                            style={{ width: `${(count / (report?.totalDevices || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-white w-8">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-gray-600 py-4">
          最后更新: {status?.timestamp ? formatTime(status.timestamp) : '--'}
        </div>
      </div>
    </div>
  );
}
