/**
 * ExpertCenter - Navigator-X 五大专家席位 (High Council)
 * Navigator-X v1.0
 *
 * 功能：
 * 1. 五大专家席位卡片式布局
 * 2. 实时状态指示灯（咨询中/空闲/分析中）
 * 3. 专家贡献度可视化
 * 4. 仲裁结果一键采纳
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  ShieldCheck, Wallet, BrainCircuit, HeartPulse, FileText,
  ArrowRight, Sparkles, TrendingUp, Clock, CheckCircle2
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";

const expertServices = [
  {
    id: 'legal',
    name: '法务专家',
    icon: ShieldCheck,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    desc: '陷阱条款识别、谈判辩论策略、合同风险评分',
    status: 'idle',
    contribution: 85,
    model: 'Claude Sonnet'
  },
  {
    id: 'finance',
    name: '财务专家',
    icon: Wallet,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    desc: '盈亏平衡分析、资金流预警、异常支出检测',
    status: 'idle',
    contribution: 92,
    model: 'DeepSeek V3'
  },
  {
    id: 'strategy',
    name: '策划专家',
    icon: BrainCircuit,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    desc: '商业闭环方案生成、行业数据分析',
    status: 'analyzing',
    contribution: 78,
    model: 'GPT-4o'
  },
  {
    id: 'psychology',
    name: '心理专家',
    icon: HeartPulse,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    desc: '团队士气曲线、员工状态预警',
    status: 'idle',
    contribution: 65,
    model: 'Claude Haiku'
  },
  {
    id: 'secretary',
    name: '全能秘书',
    icon: FileText,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    desc: '模糊口令执行、日程智能对冲、礼仪提醒',
    status: 'consulting',
    contribution: 88,
    model: 'GPT-4o Mini'
  },
];

export default function ExpertCenter() {
  const [, setLocation] = useLocation();

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'consulting':
        return <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-[8px] text-yellow-500 uppercase">Consulting</span>
        </span>;
      case 'analyzing':
        return <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[8px] text-blue-500 uppercase">Analyzing</span>
        </span>;
      default:
        return <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[8px] text-green-500 uppercase">Available</span>
        </span>;
    }
  };

  return (
    <SafeLayout headerTitle="五大专家席位">
      <div className="space-y-4 pb-10">
        <div className="p-4 rounded-3xl bg-primary/10 border border-primary/20">
          <p className="text-[11px] text-primary leading-relaxed">
            Navigator-X 领航者系统已为您配备五大专家席位，多模型路由自动选择最优专家。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {expertServices.map((expert) => (
            <div
              key={expert.id}
              className="p-5 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4 relative overflow-hidden group"
            >
              {/* 贡献度条 */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                <div
                  className={cn("h-full transition-all", expert.color.replace('text-', 'bg-'))}
                  style={{ width: `${expert.contribution}%` }}
                />
              </div>

              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl ${expert.bg} flex items-center justify-center shrink-0`}>
                  <expert.icon className={`w-7 h-7 ${expert.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">{expert.name}</h3>
                    {getStatusIndicator(expert.status)}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{expert.desc}</p>
                  <p className="text-[9px] text-gray-600 mt-1">Model: {expert.model}</p>
                </div>
                <button
                  onClick={() => setLocation(`/experts/${expert.id}`)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center active:bg-primary/20 transition-all"
                >
                  <ArrowRight className="w-4 h-4 text-primary" />
                </button>
              </div>

              {/* 贡献度统计 */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-[9px] text-gray-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>贡献度 {expert.contribution}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>响应 &lt;200ms</span>
                  </div>
                </div>
                {expert.contribution >= 80 && (
                  <span className="text-[8px] text-green-500 font-bold uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Top Performer
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 快速入口 */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            onClick={() => setLocation('/command')}
            className="p-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 active:bg-white/10"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-white">一键仲裁</span>
          </button>
          <button
            onClick={() => setLocation('/inspiration')}
            className="p-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 active:bg-white/10"
          >
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white">灵感广播</span>
          </button>
        </div>
      </div>
    </SafeLayout>
  );
}
