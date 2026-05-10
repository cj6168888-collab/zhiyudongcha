/**
 * SwarmSettings - 蜂群统筹与 API 管理 (仅主账户可见)
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Key, Shield, Users, Zap, Plus, Trash2,
  CheckCircle2, Globe, Lock, Info
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SwarmSettings() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [keyProvider, setKeyProvider] = useState("OpenAI");

  // 1. 获取当前 API Key 池 (模拟后端接口)
  const { data: keys = [] } = useQuery({
    queryKey: ['/api/swarm/keys'],
    initialData: [
      { id: '1', provider: 'OpenAI', key: 'sk-proj-....xxxx', status: 'ACTIVE' },
      { id: '2', provider: 'Claude', key: 'sk-ant-....yyyy', status: 'ACTIVE' }
    ]
  });

  // 2. 检查权限：非主账户禁止访问
  const userRole = localStorage.getItem("jilin_user_role");
  if (userRole !== "MASTER") {
    return (
      <SafeLayout headerTitle="系统权限" showBack={true}>
        <div className="flex flex-col items-center justify-center pt-40 px-10 text-center">
          <Lock className="w-16 h-16 text-red-500 mb-6" />
          <h2 className="text-xl font-black text-white uppercase italic">Access Denied</h2>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed">
            蜂群统筹协议属于主控级权限。当前账户身份不足，已触发自动安全隔离。
          </p>
        </div>
      </SafeLayout>
    );
  }

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    toast.success(`${keyProvider} API Key 已录入蜂群密钥池`);
    setNewKey("");
    // 实际应调用后端 /api/swarm/keys 接口
  };

  return (
    <SafeLayout headerTitle="蜂群统筹" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 1. API 密钥池管理 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Global API Matrix</h3>
            <Badge className="bg-primary/20 text-primary text-[8px] font-black">POOL_ACTIVE</Badge>
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

        {/* 2. 分账户分配概览 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">Node Permissions</h3>
          <div className="bg-white/5 border border-white/5 rounded-[2.5rem] divide-y divide-white/5 overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-white">分账户自动分配</p>
                  <p className="text-[9px] text-gray-500">新注册账户自动继承受限密钥权限</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-green-600 rounded-full flex items-center justify-end px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </div>

            <div className="p-5 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-4">
                <Globe className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-bold text-white">公共知识库共享</p>
                  <p className="text-[9px] text-gray-500">主账户标记为[公开]的资料全网可见</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-gray-700 rounded-full px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </div>
          </div>
        </section>

        {/* 3. 安全告知 */}
        <div className="p-5 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex gap-4">
          <Info className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-[10px] text-blue-300 leading-relaxed italic">
            蜂群效应提示：主账户对 API Key 的更改将即时影响所有子节点。建议在高并发时段动态切换备用 Key 以保障系统 HP。
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
