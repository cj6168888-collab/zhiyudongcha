/**
 * RedAlertPanel - Navigator-X 红线预警面板 - 移动端UI
 *
 * 功能：
 * 1. 实时异常看板
 * 2. 预案激活状态
 * 3. 自我修复日志
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  AlertTriangle, CheckCircle, Clock, Shield,
  Activity, Zap, TrendingDown, Users
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function RedAlertPanel() {
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/navigator/alerts'],
    refetchInterval: 3000,
    initialData: []
  });

  const { data: selfHealingLog = [] } = useQuery({
    queryKey: ['/api/navigator/self-healing'],
    initialData: []
  });

  const handleAcknowledge = (alertId: string) => {
    toast.success("预警已确认");
    setSelectedAlert(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'PROGRESS_DELAY': return <Clock className="w-4 h-4" />;
      case 'QUALITY_DROP': return <TrendingDown className="w-4 h-4" />;
      case 'MORALE_LOW': return <Users className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <SafeLayout headerTitle="红线预警面板">
      <div className="space-y-6 pb-10">

        {/* 概览统计 */}
        <section className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-black text-red-500">{alerts.filter((a: any) => a.severity === 'CRITICAL').length}</p>
            <p className="text-[9px] text-gray-500 uppercase">严重</p>
          </div>
          <div className="p-4 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-center">
            <Zap className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-black text-orange-500">{alerts.filter((a: any) => a.severity === 'HIGH').length}</p>
            <p className="text-[9px] text-gray-500 uppercase">高危</p>
          </div>
          <div className="p-4 rounded-3xl bg-green-500/10 border border-green-500/20 text-center">
            <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-black text-green-500">{selfHealingLog.length}</p>
            <p className="text-[9px] text-gray-500 uppercase">自愈</p>
          </div>
        </section>

        {/* 实时异常列表 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Real-time Anomalies
          </h3>

          {alerts.length === 0 ? (
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/5 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-green-500">系统运行正常</p>
              <p className="text-[10px] text-gray-600 mt-1">暂无异常检测到</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-3xl bg-white/5 border-l-4 space-y-2",
                    alert.severity === 'CRITICAL' ? "border-red-500" :
                    alert.severity === 'HIGH' ? "border-orange-500" :
                    "border-yellow-500"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white", getSeverityColor(alert.severity))}>
                        {getAnomalyIcon(alert.type)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{alert.title}</p>
                        <p className="text-[9px] text-gray-500">{alert.nodeName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500">{new Date(alert.detectedAt).toLocaleString()}</p>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="text-[9px] text-primary hover:underline"
                      >
                        确认
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">{alert.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 自我修复日志 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Self-healing Log
          </h3>
          <div className="space-y-2">
            {selfHealingLog.slice(0, 5).map((record: any, index: number) => (
              <div key={index} className="p-4 rounded-3xl bg-green-500/5 border border-green-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-green-500">{record.planName}</span>
                  <span className="text-[9px] text-gray-500">{new Date(record.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${record.selfHealingScore * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-600 mt-1">
                  自愈分数: {(record.selfHealingScore * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </SafeLayout>
  );
}
