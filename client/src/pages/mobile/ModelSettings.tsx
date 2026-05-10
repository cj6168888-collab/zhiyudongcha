/**
 * ModelSettings - 吉麟核心：算力引擎与本地模型管理
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Cpu, Cloud, Download, HardDrive, CheckCircle2,
  Settings, Play, Pause, Trash2, AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ModelSettings() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  // 模拟本地模型状态
  const { data: localModel } = useQuery({
    queryKey: ['/api/ai/local-model/status'],
    initialData: { exists: false, size: '1.2GB', version: 'Q4_K_M' }
  });

  const handleDownload = () => {
    setDownloading(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setDownloading(false);
        toast.success("本地模型已就绪，算力 Tier 1 激活");
      }
    }, 500);
  };

  return (
    <SafeLayout headerTitle="算力内核" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 1. 运行模式切换 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">Engine Mode</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-5 rounded-[2rem] bg-primary border-2 border-primary text-left flex flex-col gap-2">
              <HardDrive className="w-5 h-5 text-white" />
              <span className="text-xs font-black text-white uppercase">本地优先</span>
              <p className="text-[8px] text-white/60">离线可用，隐私极致</p>
            </button>
            <button className="p-5 rounded-[2rem] bg-white/5 border border-white/10 text-left flex flex-col gap-2 opacity-50">
              <Cloud className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-black text-white uppercase">云端增强</span>
              <p className="text-[8px] text-gray-500">高并发，全量知识库</p>
            </button>
          </div>
        </section>

        {/* 2. 本地模型下载管理 */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">Local Resource (GGUF)</h3>
          <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">JiLin-7B-Instruct</h4>
                  <p className="text-[10px] text-gray-500">体积: {localModel.size} | 精度: {localModel.version}</p>
                </div>
              </div>
              {!localModel.exists && !downloading && (
                <button onClick={handleDownload} className="p-3 rounded-xl bg-primary text-white active:scale-95">
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>

            {downloading && (
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-mono text-primary uppercase">
                  <span>Downloading Data Nodes...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {localModel.exists && !downloading && (
              <div className="flex gap-2">
                <button className="flex-1 py-3 rounded-xl bg-green-600/20 text-green-400 text-[10px] font-black uppercase">已安装</button>
                <button className="p-3 rounded-xl bg-red-600/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </section>

        {/* 3. API 路由兜底 */}
        <section className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-200/70 leading-relaxed italic">
            若本地算力不足（RAM &lt; 4GB），系统将自动切换至蜂群 API Key 模式进行知识补偿。
          </p>
        </section>

      </div>
    </SafeLayout>
  );
}
