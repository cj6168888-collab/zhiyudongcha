import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  Trash2,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Cpu,
  HardDrive,
  Battery,
  Lock,
  Eye,
  Smartphone,
  Laptop,
  Play,
  StopCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface HealthReport {
  overallScore: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  lastScan?: ScanResult;
  pendingActions: number;
  message: string;
}

interface ScanResult {
  scanId: string;
  deviceId: string;
  scanType: string;
  status: string;
  overallHealthScore: number;
  memoryHealthScore: number;
  storageHealthScore: number;
  batteryHealthScore: number;
  privacyHealthScore: number;
  totalMemoryMb: number;
  usedMemoryMb: number;
  totalStorageMb: number;
  usedStorageMb: number;
  cacheCleanableMb: number;
  appsScanned: number;
  threatsFound: number;
  warningsFound: number;
  topThreats: ThreatAssessment[];
  recommendations: string[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface ThreatAssessment {
  appName: string;
  packageName: string;
  threatLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  reasons: string[];
  sensitivePermissions: string[];
  recommendations: string[];
}

interface ImmuneStatus {
  service: string;
  status: string;
  version: string;
  capabilities: string[];
}

const threatLevelColors: Record<string, { bg: string; text: string; border: string }> = {
  SAFE: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  LOW: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  MEDIUM: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  HIGH: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

const statusColors: Record<string, { bg: string; icon: React.ComponentType<any> }> = {
  HEALTHY: { bg: 'from-green-500/20 to-emerald-500/20', icon: ShieldCheck },
  WARNING: { bg: 'from-yellow-500/20 to-amber-500/20', icon: ShieldAlert },
  CRITICAL: { bg: 'from-red-500/20 to-rose-500/20', icon: ShieldX },
};

export default function ImmuneDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState('primary_device');
  const [isScanning, setIsScanning] = useState(false);

  const { data: immuneStatus } = useQuery<{ success: boolean; data: ImmuneStatus }>({
    queryKey: ['/api/immune/status'],
    refetchInterval: 60000,
  });

  const { data: healthReport, refetch: refetchHealth } = useQuery<{ success: boolean; data: HealthReport }>({
    queryKey: ['/api/immune/health', selectedDevice],
    queryFn: () => fetch(`/api/immune/health/${selectedDevice}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: threats, refetch: refetchThreats } = useQuery<{ success: boolean; data: { threats: ThreatAssessment[]; totalThreats: number; criticalCount: number; highCount: number } }>({
    queryKey: ['/api/immune/threats', selectedDevice],
    queryFn: () => fetch(`/api/immune/threats/${selectedDevice}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const scanMutation = useMutation({
    mutationFn: async (scanType: string) => {
      const res = await apiRequest('POST', '/api/immune/scan', {
        deviceId: selectedDevice,
        scanType,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: '体检完成',
        description: data.message,
      });
      refetchHealth();
      refetchThreats();
      setIsScanning(false);
    },
    onError: () => {
      toast({
        title: '体检失败',
        description: '无法完成系统扫描',
        variant: 'destructive',
      });
      setIsScanning(false);
    },
  });

  const remediateMutation = useMutation({
    mutationFn: async (request: { actionType: string; targetApp: string; targetPackage: string; reason: string; severity: string }) => {
      const res = await apiRequest('POST', '/api/immune/remediate', request);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: '净化执行',
        description: data.message,
      });
      refetchThreats();
    },
    onError: () => {
      toast({
        title: '净化失败',
        description: '无法执行净化操作',
        variant: 'destructive',
      });
    },
  });

  const handleScan = (scanType: string) => {
    setIsScanning(true);
    scanMutation.mutate(scanType);
  };

  const handleRemediate = (threat: ThreatAssessment) => {
    remediateMutation.mutate({
      actionType: threat.recommendations[0] || 'FORCE_STOP',
      targetApp: threat.appName,
      targetPackage: threat.packageName,
      reason: threat.reasons[0] || '威胁应用',
      severity: threat.threatLevel,
    });
  };

  const health = healthReport?.data;
  const lastScan = health?.lastScan;
  const statusInfo = statusColors[health?.status || 'WARNING'];
  const StatusIcon = statusInfo?.icon || ShieldAlert;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" data-testid="immune-dashboard">
      <GlobalWakeHeader />
      
      <div className="container mx-auto px-4 pt-8 pb-24 md:pb-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">免疫系统</h1>
              <p className="text-slate-400 text-sm">设备健康与安全防护</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
              <Activity className="w-3 h-3 mr-1" />
              {immuneStatus?.data?.status || '在线'}
            </Badge>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className={`bg-gradient-to-br ${statusInfo?.bg || 'from-blue-500/20 to-cyan-500/20'} border-slate-700/50 backdrop-blur-sm`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <StatusIcon className={`w-6 h-6 ${health?.status === 'HEALTHY' ? 'text-green-400' : health?.status === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`} />
                    健康状态
                  </CardTitle>
                  <div className="text-3xl font-bold text-white">
                    {health?.overallScore || 0}
                    <span className="text-lg text-slate-400 ml-1">分</span>
                  </div>
                </div>
                <CardDescription className="text-slate-300">
                  {health?.message || '等待体检...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <HealthMetric
                    icon={<Cpu className="w-5 h-5" />}
                    label="内存"
                    value={lastScan?.memoryHealthScore || 0}
                    color="blue"
                  />
                  <HealthMetric
                    icon={<HardDrive className="w-5 h-5" />}
                    label="存储"
                    value={lastScan?.storageHealthScore || 0}
                    color="purple"
                  />
                  <HealthMetric
                    icon={<Battery className="w-5 h-5" />}
                    label="电池"
                    value={lastScan?.batteryHealthScore || 0}
                    color="green"
                  />
                  <HealthMetric
                    icon={<Lock className="w-5 h-5" />}
                    label="隐私"
                    value={lastScan?.privacyHealthScore || 0}
                    color="yellow"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleScan('FULL')}
                    disabled={isScanning}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-full-scan"
                  >
                    {isScanning ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    全面体检
                  </Button>
                  <Button
                    onClick={() => handleScan('QUICK')}
                    disabled={isScanning}
                    variant="outline"
                    className="border-slate-600"
                    data-testid="button-quick-scan"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    快速扫描
                  </Button>
                  <Button
                    onClick={() => handleScan('PERMISSION')}
                    disabled={isScanning}
                    variant="outline"
                    className="border-slate-600"
                    data-testid="button-permission-scan"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    权限检查
                  </Button>
                </div>

                {lastScan && (
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>扫描应用: {lastScan.appsScanned}</span>
                    <span className="text-red-400">威胁: {lastScan.threatsFound}</span>
                    <span className="text-yellow-400">警告: {lastScan.warningsFound}</span>
                    {lastScan.durationMs && <span>耗时: {lastScan.durationMs}ms</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-800/50 border-slate-700/50 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  设备管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant={selectedDevice === 'primary_device' ? 'default' : 'outline'}
                  className={`w-full justify-start ${selectedDevice === 'primary_device' ? 'bg-blue-600' : 'border-slate-600'}`}
                  onClick={() => setSelectedDevice('primary_device')}
                  data-testid="button-device-phone"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  主手机
                </Button>
                <Button
                  variant={selectedDevice === 'laptop_device' ? 'default' : 'outline'}
                  className={`w-full justify-start ${selectedDevice === 'laptop_device' ? 'bg-blue-600' : 'border-slate-600'}`}
                  onClick={() => setSelectedDevice('laptop_device')}
                  data-testid="button-device-laptop"
                >
                  <Laptop className="w-4 h-4 mr-2" />
                  笔记本电脑
                </Button>
                
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    待处理操作: {health?.pendingActions || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                威胁检测
                {threats?.data?.totalThreats ? (
                  <Badge variant="destructive" className="ml-2">
                    {threats.data.totalThreats}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="text-slate-400">
                检测到的可疑应用和潜在威胁
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <AnimatePresence>
                  {threats?.data?.threats && threats.data.threats.length > 0 ? (
                    <div className="space-y-3">
                      {threats.data.threats.map((threat, index) => (
                        <ThreatCard
                          key={threat.packageName}
                          threat={threat}
                          onRemediate={() => handleRemediate(threat)}
                          isLoading={remediateMutation.isPending}
                          delay={index * 0.05}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <ShieldCheck className="w-16 h-16 mb-4 text-green-500/50" />
                      <p className="text-lg">环境安全</p>
                      <p className="text-sm">没有检测到威胁应用</p>
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {lastScan?.recommendations && lastScan.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lastScan.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function HealthMetric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500',
    purple: 'text-purple-400 bg-purple-500',
    green: 'text-green-400 bg-green-500',
    yellow: 'text-yellow-400 bg-yellow-500',
  };
  
  const textColor = colorClasses[color]?.split(' ')[0] || 'text-slate-400';
  const bgColor = colorClasses[color]?.split(' ')[1] || 'bg-slate-500';
  
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className={`flex items-center gap-2 mb-2 ${textColor}`}>
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={value} className={`flex-1 h-2 [&>div]:${bgColor}`} />
        <span className="text-white font-medium text-sm">{value}</span>
      </div>
    </div>
  );
}

function ThreatCard({ 
  threat, 
  onRemediate, 
  isLoading,
  delay 
}: { 
  threat: ThreatAssessment; 
  onRemediate: () => void;
  isLoading: boolean;
  delay: number;
}) {
  const colors = threatLevelColors[threat.threatLevel] || threatLevelColors.MEDIUM;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
      data-testid={`card-threat-${threat.packageName}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">{threat.appName}</span>
            <Badge className={`${colors.bg} ${colors.text} border-0`}>
              {threat.threatLevel}
            </Badge>
            <span className="text-sm text-slate-500">风险: {threat.riskScore}</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">{threat.packageName}</p>
          
          {threat.reasons.length > 0 && (
            <ul className="space-y-1 mb-2">
              {threat.reasons.slice(0, 3).map((reason, idx) => (
                <li key={idx} className="text-sm text-slate-400 flex items-start gap-1">
                  <XCircle className="w-3 h-3 mt-1 flex-shrink-0 text-red-400" />
                  {reason}
                </li>
              ))}
            </ul>
          )}
          
          {threat.sensitivePermissions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {threat.sensitivePermissions.slice(0, 5).map((perm, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-slate-600 text-slate-400">
                  {perm.split('.').pop()}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <Button
            size="sm"
            variant="destructive"
            onClick={onRemediate}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
            data-testid={`button-remediate-${threat.packageName}`}
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <StopCircle className="w-3 h-3 mr-1" />
                净化
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
