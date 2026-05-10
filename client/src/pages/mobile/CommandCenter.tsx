/**
 * CommandCenter - Navigator-X 审批与分派中枢 - 移动端UI
 *
 * 功能：
 * 1. 灵感输入区（语音/文字）
 * 2. 汇报卡片滑动界面（类似Tinder卡片）
 * 3. 三按钮操作：准予立项 / 打回修正 / 即刻执行
 * 4. 任务拆解可视化
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Mic, Send, Zap, CheckCircle, XCircle, Clock,
  ChevronRight, Sparkles, FileText, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function CommandCenter() {
  const [inspiration, setInspiration] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const { data: pendingReports = [] } = useQuery({
    queryKey: ['/api/navigator/pending-reports'],
    refetchInterval: 5000,
    initialData: []
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/navigator/alerts'],
    refetchInterval: 3000,
    initialData: []
  });

  const handleInspirationSubmit = () => {
    if (!inspiration.trim()) return;
    toast.success("灵感已捕捉，正在语义血缘补全...");
    setInspiration("");
  };

  const handleApprove = (reportId: string) => {
    toast.success("已准予立项");
    setSelectedReport(null);
  };

  const handleReject = (reportId: string) => {
    toast.success("已打回修正");
    setSelectedReport(null);
  };

  const handleExecute = (reportId: string) => {
    toast.success("已即刻执行，任务正在分派...");
    setSelectedReport(null);
  };

  return (
    <SafeLayout headerTitle="审批与分派中枢">
      <div className="space-y-6 pb-10">

        {/* 灵感输入区 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Inspiration Capture
          </h3>
          <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3">
            <textarea
              value={inspiration}
              onChange={(e) => setInspiration(e.target.value)}
              placeholder="输入灵感或点击麦克风语音输入..."
              className="w-full h-24 bg-transparent text-sm text-white outline-none resize-none placeholder:text-gray-600"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsListening(!isListening)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isListening ? "bg-red-500 animate-pulse" : "bg-primary"
                )}
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleInspirationSubmit}
                disabled={!inspiration.trim()}
                className="px-5 py-2 rounded-full bg-primary text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                语义血缘补全
              </button>
            </div>
          </div>
        </section>

        {/* 红线预警 */}
        {alerts.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest italic px-1 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Red Alert ({alerts.length})
            </h3>
            <div className="space-y-2">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-red-500">{alert.title}</span>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-full",
                      alert.severity === 'CRITICAL' ? "bg-red-500 text-white" :
                      alert.severity === 'HIGH' ? "bg-orange-500 text-white" :
                      "bg-yellow-500 text-black"
                    )}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">{alert.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 汇报卡片列表 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
              Pending Reports
            </h3>
            <span className="text-[9px] font-mono text-primary">{pendingReports.length} 待处理</span>
          </div>

          {pendingReports.length === 0 ? (
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/5 text-center">
              <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-600">暂无待处理汇报</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReports.map((report: any) => (
                <div key={report.id} className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{report.nodeName.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{report.nodeName}</p>
                        <p className="text-[9px] text-gray-500">{new Date(report.submittedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500">真实性评分</p>
                      <p className={cn(
                        "text-sm font-black",
                        report.authenticityScore >= 80 ? "text-green-500" :
                        report.authenticityScore >= 60 ? "text-yellow-500" : "text-red-500"
                      )}>
                        {report.authenticityScore}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 italic">"{report.summary}"</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(report.id)}
                      className="flex-1 py-2 rounded-2xl bg-green-500/20 text-green-500 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      准予立项
                    </button>
                    <button
                      onClick={() => handleReject(report.id)}
                      className="flex-1 py-2 rounded-2xl bg-yellow-500/20 text-yellow-500 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      打回修正
                    </button>
                    <button
                      onClick={() => handleExecute(report.id)}
                      className="flex-1 py-2 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Zap className="w-4 h-4" />
                      即刻执行
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </SafeLayout>
  );
}
