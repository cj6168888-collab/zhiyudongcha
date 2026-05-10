/**
 * InspirationBroadcast - Navigator-X 灵感广播面板 - 移动端UI
 *
 * 功能：
 * 1. 灵感输入（语音/文字）
 * 2. 语义血缘可视化
 * 3. 广播状态追踪
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Mic, Send, Sparkles, Radio, CheckCircle,
  ChevronRight, Clock, Target
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function InspirationBroadcast() {
  const [inspiration, setInspiration] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['/api/navigator/broadcasts'],
    initialData: []
  });

  const handleBroadcast = async () => {
    if (!inspiration.trim()) return;

    setIsBroadcasting(true);
    setBroadcastProgress(0);
    toast.success("灵感已捕捉，正在语义血缘补全...");

    // 模拟广播进度
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setBroadcastProgress(i);
    }

    toast.success("灵感已广播至全舰队节点");
    setIsBroadcasting(false);
    setInspiration("");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PARTIAL': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'FAILED': return <ChevronRight className="w-4 h-4 text-red-500" />;
      default: return <Radio className="w-4 h-4 text-primary animate-pulse" />;
    }
  };

  return (
    <SafeLayout headerTitle="灵感广播">
      <div className="space-y-6 pb-10">

        {/* 灵感输入 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Capture Inspiration
          </h3>
          <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
            <textarea
              value={inspiration}
              onChange={(e) => setInspiration(e.target.value)}
              placeholder="洗澡时的灵感、对领航者耳语..."
              className="w-full h-28 bg-transparent text-sm text-white outline-none resize-none placeholder:text-gray-600"
            />

            {/* 语义血缘预览 */}
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">语义血缘预览</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {inspiration ? `正在分析"${inspiration.slice(0, 30)}..."的语义血缘...` : '输入灵感后自动生成'}
              </p>

              {/* 背景资料 */}
              <div className="space-y-1">
                <p className="text-[9px] text-gray-600">背景资料:</p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-400">市场可行性分析</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-400">竞争格局研究</span>
                </div>
              </div>

              {/* KPI预览 */}
              <div className="flex items-center gap-2 text-[9px] text-gray-500">
                <Target className="w-3 h-3" />
                <span>KPI: 任务完成率 100%</span>
              </div>
            </div>

            {/* 广播按钮 */}
            <div className="space-y-2">
              {isBroadcasting && (
                <div className="space-y-1">
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${broadcastProgress}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-500 text-center">
                    广播中... {broadcastProgress}%
                  </p>
                </div>
              )}
              <button
                onClick={handleBroadcast}
                disabled={!inspiration.trim() || isBroadcasting}
                className="w-full py-4 rounded-3xl bg-primary text-white font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <Radio className={cn("w-5 h-5", isBroadcasting && "animate-pulse")} />
                {isBroadcasting ? '广播中...' : '广播至全舰队'}
              </button>
            </div>
          </div>
        </section>

        {/* 广播历史 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Broadcast History
          </h3>
          <div className="space-y-2">
            {broadcasts.map((broadcast: any) => (
              <div key={broadcast.id} className="p-4 rounded-3xl bg-white/5 border border-white/5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(broadcast.status)}
                    <p className="text-xs text-gray-400">{broadcast.content}</p>
                  </div>
                  <span className="text-[9px] text-gray-600">{new Date(broadcast.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] text-gray-500">
                  <span>推送节点: {broadcast.deliveredNodes}/{broadcast.totalNodes}</span>
                  <span>成功率: {broadcast.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </SafeLayout>
  );
}
