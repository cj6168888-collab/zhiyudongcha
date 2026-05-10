/**
 * NavigatorSettings - 舰队统筹与 API 管理 (仅主权端可见)
 * Navigator-X v1.0
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Key, Shield, Users, Zap, Plus, Trash2,
  CheckCircle2, Globe, Lock, Info, Ship, Compass,
  Cpu, Mic, HardDrive, Volume2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store/globalStore";
import { useDiagnostics } from "@/hooks/use-diagnostics";

export default function NavigatorSettings() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [keyProvider, setKeyProvider] = useState("OpenAI");

  const deviceHealth   = useGlobalStore((s) => s.deviceHealth);
  const { isChecking, checkHealth } = useDiagnostics(false);

  // 1. 获取当前 API Key 池 (模拟后端接口)
  const { data: keys = [] } = useQuery({
    queryKey: ['/api/navigator/keys'],
    initialData: [
      { id: '1', provider: 'OpenAI', key: 'sk-proj-....xxxx', status: 'ACTIVE' },
      { id: '2', provider: 'Claude', key: 'sk-ant-....yyyy', status: 'ACTIVE' },
      { id: '3', provider: 'DeepSeek', key: 'sk-ds-....zzzz', status: 'ACTIVE' }
    ]
  });

  // 2. 检查权限：非主权端禁止访问
  const userRole = localStorage.getItem("jilin_user_role");
  if (userRole !== "SOVEREIGN") {
    return (
      <SafeLayout headerTitle="系统权限" showBack={true}>
        <div className="flex flex-col items-center justify-center pt-40 px-10 text-center">
          <Lock className="w-16 h-16 text-red-500 mb-6" />
          <h2 className="text-xl font-black text-white uppercase italic">Access Denied</h2>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed">
            舰队统筹协议属于主权级权限。当前账户身份不足，已触发自动安全隔离。
          </p>
        </div>
      </SafeLayout>
    );
  }

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    toast.success(`${keyProvider} API Key 已录入舰队密钥池`);
    setNewKey("");
  };

  const handleEmergencyRecall = () => {
    toast.success("紧急召回已触发，所有节点端已回收");
  };

  return (
    <SafeLayout headerTitle="舰队统筹" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 0. 设备健康诊断 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Device Health</h3>
            <button
              onClick={() => checkHealth()}
              disabled={isChecking}
              className="flex items-center gap-1 text-[10px] text-primary font-bold"
            >
              <RefreshCw className={cn("w-3 h-3", isChecking && "animate-spin")} />
              {isChecking ? '检测中...' : '重新检测'}
            </button>
          </div>

          {deviceHealth ? (
            <div className="p-5 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-3">
              {/* JNI / 本地模型 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">本地 AI 模型</span>
                </div>
                <span className={cn("text-[10px] font-black uppercase", deviceHealth.jni_loaded ? "text-green-400" : "text-red-400")}>
                  {deviceHealth.jni_loaded ? 'LOADED' : deviceHealth.jni_error ?? 'NOT_LOADED'}
                </span>
              </div>
              {/* TTS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white">TTS 引擎</span>
                </div>
                <span className={cn("text-[10px] font-black uppercase", deviceHealth.tts_ready ? "text-green-400" : "text-yellow-400")}>
                  {deviceHealth.tts_ready ? 'READY' : 'NOT_READY'}
                </span>
              </div>
              {/* 麦克风权限 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-white">麦克风权限</span>
                </div>
                <span className={cn("text-[10px] font-black uppercase", deviceHealth.permissions.RECORD_AUDIO ? "text-green-400" : "text-red-400")}>
                  {deviceHealth.permissions.RECORD_AUDIO ? 'GRANTED' : 'DENIED'}
                </span>
              </div>
              {/* 存储空间 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">可用存储</span>
                </div>
                <span className={cn("text-[10px] font-black", deviceHealth.free_storage_mb < 500 ? "text-red-400" : "text-gray-400")}>
                  {deviceHealth.free_storage_mb.toFixed(0)} MB
                  {deviceHealth.free_storage_mb < 500 && <AlertTriangle className="inline w-3 h-3 ml-1 text-red-400" />}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-[2.5rem] bg-white/5 border border-white/5 text-center">
              <p className="text-[10px] text-gray-600 italic">
                {isChecking ? '正在检测设备状态...' : '仅在 Android 设备上可用'}
              </p>
            </div>
          )}
        </section>

        {/* 1. API 密钥池管理 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Global API Matrix</h3>
            <Badge className="bg-primary/20 text-primary text-[8px] font-black">FLEET_ACTIVE</Badge>
          </div>

          <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4">
            <div className="flex gap-2">
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-primary"
              >
                <option>OpenAI</option>
                <option>Claude</option>
                <option>DeepSeek</option>
                <option>Gemini</option>
              </select>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="录入新密钥..."
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-primary"
              />
              <button
                onClick={handleAddKey}
                className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {keys.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-[11px] font-black text-white uppercase">{k.provider}</p>
                      <p className="text-[9px] text-gray-600 font-mono mt-0.5">{k.key}</p>
                    </div>
                  </div>
                  <button className="p-2 text-gray-700 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. 节点权限管理 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">Node Management</h3>
          <div className="bg-white/5 border border-white/5 rounded-[2.5rem] divide-y divide-white/5 overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-white">节点端自动分配</p>
                  <p className="text-[9px] text-gray-500">新注册账户自动创建节点端并分配受限密钥权限</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-green-600 rounded-full flex items-center justify-end px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </div>

            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Compass className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-bold text-white">专家席位路由</p>
                  <p className="text-[9px] text-gray-500">启用多模型路由，自动分配最优专家模型</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-green-600 rounded-full flex items-center justify-end px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </div>

            <div className="p-5 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-4">
                <Ship className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-bold text-white">灵感广播同步</p>
                  <p className="text-[9px] text-gray-500">灵感自动同步至所有节点端</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-gray-700 rounded-full px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </div>
          </div>
        </section>

        {/* 3. 紧急召回功能 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest italic px-1">Emergency Protocol</h3>
          <button
            onClick={handleEmergencyRecall}
            className="w-full p-5 rounded-[2.5rem] bg-red-500/10 border border-red-500/30 flex items-center justify-center gap-3 active:bg-red-500/20 transition-all"
          >
            <Shield className="w-5 h-5 text-red-500" />
            <span className="text-sm font-black text-red-500 uppercase tracking-widest">Emergency Recall</span>
          </button>
        </section>

        {/* 4. 安全告知 */}
        <div className="p-5 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex gap-4">
          <Info className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-[10px] text-blue-300 leading-relaxed italic">
            领航者效应提示：主权端对 API Key 的更改将即时影响所有节点端。建议在高并发时段动态切换备用 Key 以保障系统 HP。
          </p>
        </div>

      </div>
    </SafeLayout>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full", className)}>
      {children}
    </span>
  );
}
