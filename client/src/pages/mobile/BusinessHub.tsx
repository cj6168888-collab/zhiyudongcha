/**
 * BusinessHub - 吉麟洞察 21.0 (动态数据修复版)
 *
 * 修复：动态日期、系统状态API对接
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  ShieldCheck, Wallet, FileText, BrainCircuit, Heart,
  FolderKanban, Users2, Cpu, Zap, Shield,
  ArrowRight, FileBarChart, Scan, ListTodo, Monitor, Sparkles, Layers
} from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store/globalStore";

interface BattleReport {
  available: boolean;
  highlights: string;
  concerns: string;
  date?: string;
  projectCount?: number;
  taskCount?: number;
}

interface SystemStatus {
  hp: number;
  computeMode: string;
  defenseLevel: string;
}

export default function BusinessHub() {
  const [, setLocation] = useLocation();
  const currentProject = useGlobalStore((s) => s.currentProject);
  const recentScans = useGlobalStore((s) => s.recentScans);

  // 获取当前日期
  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
  }, []);

  // 1. 对接后端战备报告接口
  const { data: report } = useQuery<BattleReport>({
    queryKey: ['/api/report/summary'],
    refetchInterval: 60000,
    initialData: {
      available: true,
      highlights: "Node #772 完成法务对冲",
      concerns: "检测到 2 处潜在财务风险",
      date: currentDate
    }
  });

  // 2. 获取系统状态
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/system/status'],
    refetchInterval: 30000,
    initialData: {
      hp: 98.4,
      computeMode: '4.5 Omni',
      defenseLevel: 'SSS'
    }
  });

  // 格式化显示日期
  const displayDate = report?.date || currentDate;

  return (
    <SafeLayout headerTitle="指挥中心">
      <div className="space-y-4 pb-6">

        {/* 系统状态遥测 */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="min-h-14 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-1 active:bg-white/10 cursor-pointer transition-all"
            onClick={() => setLocation('/resources')}
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-gray-500">HP 状态</span>
            <span className="text-xs font-black text-white">{systemStatus?.hp ?? '--'}%</span>
          </div>
          <div className="min-h-14 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-1">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] text-gray-500">算力模式</span>
            <span className="max-w-full px-1 text-[10px] font-black text-white uppercase italic truncate">{systemStatus?.computeMode ?? '--'}</span>
          </div>
          <div
            className="min-h-14 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-1 active:bg-white/10 cursor-pointer transition-all"
            onClick={() => setLocation('/security')}
          >
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-[10px] text-gray-500">防线等级</span>
            <span className="text-xs font-black text-white">{systemStatus?.defenseLevel ?? '--'}</span>
          </div>
          </div>

        {/* 当前项目上下文（全局 Store 联动） */}
        {currentProject && (
          <section>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderKanban className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-[10px] text-primary/60 uppercase font-black">Active Context</p>
                  <p className="text-xs font-bold text-white">{currentProject.title}</p>
                </div>
              </div>
              <button
                onClick={() => setLocation('/projects')}
                className="px-2 py-1 rounded-md text-[10px] text-primary/70 font-bold active:bg-primary/10"
              >
                切换
              </button>
            </div>
          </section>
        )}

        {/* 每日战备报告摘要 */}
        <section>
          <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/15 to-white/[0.02] border border-amber-500/25 relative overflow-hidden group">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-amber-400">
                <FileBarChart className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase">Battle Report</span>
              </div>
              <span className="text-[10px] text-gray-600 font-mono shrink-0">{displayDate}</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-white font-semibold leading-snug">今日核心：{report.highlights}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">风险预警：{report.concerns}</p>
            </div>
            <button onClick={() => setLocation('/vault')} className="mt-3 inline-flex items-center gap-1.5 rounded-md py-1 text-[11px] font-black text-amber-400 active:translate-x-1 transition-transform">
              立即查看全量战报 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </section>

        {/* 专家矩阵 */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-black text-gray-500 uppercase">Intelligence Nodes</h2>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'lawyer', name: '律师', icon: ShieldCheck, color: 'text-blue-400' },
              { id: 'finance', name: '财务', icon: Wallet, color: 'text-green-400' },
              { id: 'psychology', name: '心理', icon: Heart, color: 'text-rose-400' },
              { id: 'planner', name: '策划', icon: BrainCircuit, color: 'text-purple-400' },
              { id: 'secretary', name: '秘书', icon: FileText, color: 'text-amber-400' },
            ].map((expert) => (
              <button
                key={expert.id}
                onClick={() => setLocation(`/experts/${expert.id}`)}
                className="flex flex-col items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/10 active:bg-white/10 transition-all"
              >
                <div className="p-2 rounded-lg bg-white/5">
                  <expert.icon className={cn("w-5 h-5", expert.color)} />
                </div>
                <span className="text-[9px] font-bold text-gray-300 text-center leading-tight">{expert.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 商务核心入口 */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <button onClick={() => setLocation('/projects')} className="p-4 min-h-24 rounded-lg bg-white/[0.04] border border-white/10 text-left active:scale-[0.98] transition-all">
            <FolderKanban className="w-6 h-6 text-blue-400 mb-3" />
            <h3 className="text-sm font-bold text-white uppercase leading-tight">Strategic Core</h3>
            <p className="text-[10px] text-gray-500 mt-1">项目建设</p>
          </button>
          <button onClick={() => setLocation('/contacts')} className="p-4 min-h-24 rounded-lg bg-white/[0.04] border border-white/10 text-left active:scale-[0.98] transition-all">
            <Users2 className="w-6 h-6 text-amber-400 mb-3" />
            <h3 className="text-sm font-bold text-white uppercase leading-tight">Human Assets</h3>
            <p className="text-[10px] text-gray-500 mt-1">人脉/档案库</p>
          </button>
        </div>

        {/* 全局快捷操作入口（扫描 + 任务） */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation('/scanner')}
            className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-left active:scale-[0.98] transition-all flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">扫描实验室</p>
              <p className="text-[9px] text-gray-500">
                {recentScans.length > 0
                  ? `最近 ${recentScans.length} 条`
                  : "多模态采集"}
              </p>
            </div>
          </button>
          <button
            onClick={() => setLocation('/tasks')}
            className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-left active:scale-[0.98] transition-all flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <ListTodo className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">任务编排</p>
              <p className="text-[9px] text-gray-500">定时 / 手动</p>
            </div>
          </button>
        </div>

        <section>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'PC 代理', desc: '指令执行', icon: Monitor, path: '/remote-pc', color: 'text-blue-300' },
              { label: '技能', desc: '能力库', icon: Sparkles, path: '/skills', color: 'text-violet-300' },
              { label: '工作流', desc: '自动化', icon: Layers, path: '/workflow', color: 'text-cyan-300' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-left active:bg-white/10"
              >
                <item.icon className={cn("mb-2 h-4 w-4", item.color)} />
                <p className="text-xs font-bold text-white">{item.label}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">{item.desc}</p>
              </button>
            ))}
          </div>
        </section>

      </div>
    </SafeLayout>
  );
}
