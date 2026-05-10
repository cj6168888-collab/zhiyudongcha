/**
 * NavigatorCommand - 领航者指挥中心 - Navigator-X v1.0
 *
 * 主权端入口 - 统御与决策中心
 * 核心功能：
 * 1. 身份状态与主权入口
 * 2. 舰队遥测看板
 * 3. 全网任务发布
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Zap, Radar, Send, Activity, Database, CheckCircle2,
  ChevronRight, Clock, ShieldCheck, Settings2, Key,
  Compass, Ship, AlertTriangle, Users
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const defaultFleetTasks = [
  { id: 'T1', node: '#772', task: '合同风险交叉建模', progress: 85 },
  { id: 'T2', node: '#104', task: '全球情报自动化猎杀', progress: 42 },
];

export default function NavigatorCommand() {
  const [, setLocation] = useLocation();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    initialData: { role: 'SOVEREIGN', username: 'Navigator-X' }
  });

  const isSovereign = localStorage.getItem("jilin_user_role") === "SOVEREIGN";

  const { data: fleet } = useQuery({
    queryKey: ['/api/business/swarm/status'],
    refetchInterval: 5000,
    initialData: {
      onlineCount: 12,
      tasks: [
        { id: 'T1', node: '#772', task: '合同风险交叉建模', progress: 85 },
        { id: 'T2', node: '#104', task: '全球情报自动化猎杀', progress: 42 }
      ]
    }
  });
  const fleetTasks = Array.isArray((fleet as any)?.tasks) ? (fleet as any).tasks : [];

  return (
    <SafeLayout headerTitle="领航者指挥中心">
      <div className="space-y-6 pb-10">

        {/* 1. 身份状态 & 领航者入口 */}
        <div className="p-6 rounded-[2.5rem] bg-primary/10 border border-primary/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-2xl">
                <Compass className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-base font-black text-white italic tracking-widest uppercase font-serif italic">Navigator-X</h2>
                <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase">Identified: {user.username}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-primary font-black uppercase tracking-tighter">Auth Level</p>
              <p className="text-sm font-black text-white">{isSovereign ? "SOVEREIGN" : "NODE"}</p>
            </div>
          </div>

          {/* 只有主权端可见的领航者入口 */}
          {isSovereign && (
            <button
              onClick={() => setLocation('/navigator-settings')}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 active:bg-white/10 transition-all"
            >
              <Settings2 className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">进入舰队密钥统筹</span>
            </button>
          )}
        </div>

        {/* 舰队遥测看板 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Fleet Telemetry</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] text-green-500 font-mono">{(fleet as any)?.onlineCount ?? 0} Nodes Live</span>
            </div>
          </div>

          <div className="space-y-2">
            {fleetTasks.map((node: any) => (
              <div key={node.id} className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Node {node.node}</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 font-bold">{node.progress}%</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary shadow-[0_0_10px_#6366f1] transition-all duration-1000" style={{ width: `${node.progress}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 font-medium italic">Executing: {node.task}</p>
              </div>
            ))}
            {fleetTasks.length === 0 && (
              <div className="p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No active fleet tasks</p>
              </div>
            )}
          </div>
        </section>

        {/* 快捷入口 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation('/experts')}
            className="p-4 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 active:bg-white/10 transition-all"
          >
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-[9px] font-black text-blue-400 uppercase">High Council</span>
          </button>
          <button
            onClick={() => setLocation('/command')}
            className="p-4 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 active:bg-white/10 transition-all"
          >
            <Ship className="w-5 h-5 text-purple-400" />
            <span className="text-[9px] font-black text-purple-400 uppercase">Command Center</span>
          </button>
        </div>

        {/* 全网任务发布 */}
        <button
          onClick={() => toast.success("灵感已广播至全舰队节点")}
          className="w-full h-16 rounded-[2rem] bg-primary text-white font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
        >
          <Send className="w-5 h-5" /> 发布灵感广播
        </button>

      </div>
    </SafeLayout>
  );
}
