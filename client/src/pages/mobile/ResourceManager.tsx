/**
 * ResourceManager - 吉麟资源中心 2.0 (计算公式修复版)
 *
 * 修复：HP百分比计算、Token余额计算、添加类型定义
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Battery, Cpu, Coins, Zap, ArrowUpCircle, History, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HPData {
  balance: number;
  max: number;
  daily_consumed: number;
  token_balance?: number;
  status?: 'NORMAL' | 'LOW' | 'CRITICAL';
}

export default function ResourceManager() {
  const queryClient = useQueryClient();

  // 1. 获取HP状态
  const { data: hpData } = useQuery<HPData>({
    queryKey: ['/api/hp/status'],
    queryFn: async () => {
      const res = await fetch('/api/hp/status');
      return await res.json();
    },
    initialData: { balance: 984, max: 1000, daily_consumed: 12 }
  });

  // 2. 计算HP百分比
  const hpPercentage = useMemo(() => {
    if (!hpData?.max) return 0;
    return Math.round((hpData.balance / hpData.max) * 100);
  }, [hpData?.balance, hpData?.max]);

  // 3. 计算Token余额（以千为单位）
  const tokenBalance = useMemo(() => {
    const balance = hpData?.token_balance ?? hpData?.balance ?? 0;
    return (balance / 1000).toFixed(1);
  }, [hpData]);

  // 4. 判断HP状态
  const hpStatus = useMemo(() => {
    if (hpPercentage >= 80) return { label: '健康', color: 'text-green-500', bg: 'bg-green-500' };
    if (hpPercentage >= 50) return { label: '正常', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (hpPercentage >= 20) return { label: '偏低', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { label: '危机', color: 'text-red-500', bg: 'bg-red-500' };
  }, [hpPercentage]);

  // 5. Token补给 Mutation
  const rechargeMutation = useMutation({
    mutationFn: async () => {
      return await fetch('/api/hp/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, trigger: 'MASTER_OVERRIDE' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hp/status'] });
      toast.success("系统算力已全量补给", {
        description: "1.2M Token 已同步至 Z3 分布式存储池。"
      });
    },
    onError: () => {
      toast.error("补给失败，请重试");
    }
  });

  return (
    <SafeLayout headerTitle="资源看板" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* HP大盘 */}
        <div className="flex flex-col items-center py-8 bg-gradient-to-b from-[#6366f1]/10 to-transparent rounded-[3rem] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 shadow-[0_0_20px_#6366f1]" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2">Real-time Vitality</span>

          {/* HP百分比显示 */}
          <div className="text-7xl font-black italic text-white flex items-baseline gap-1">
            {hpPercentage}<span className="text-xl font-bold text-gray-600">%</span>
          </div>

          {/* HP状态标签 */}
          <div className={cn("mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase", hpStatus.bg + "/20", hpStatus.color)}>
            {hpStatus.label}
          </div>

          {/* 详细数据 */}
          <div className="mt-6 flex gap-6">
            <div className="flex flex-col items-center">
              <Coins className="w-4 h-4 text-amber-400 mb-1" />
              <span className="text-[9px] text-gray-500 uppercase">Token余额</span>
              <span className="text-xs font-bold text-white">{tokenBalance}M</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-center">
              <TrendingDown className="w-4 h-4 text-gray-500 mb-1" />
              <span className="text-[9px] text-gray-500 uppercase">今日消耗</span>
              <span className="text-xs font-bold text-white">{hpData?.daily_consumed ?? 0}</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-center">
              <Zap className="w-4 h-4 text-purple-400 mb-1" />
              <span className="text-[9px] text-gray-500 uppercase">上限</span>
              <span className="text-xs font-bold text-white">{(hpData?.max ?? 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 操作区 */}
        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => rechargeMutation.mutate()}
            disabled={rechargeMutation.isPending}
            className="p-5 rounded-3xl bg-primary text-white flex flex-col gap-2 active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rechargeMutation.isPending ? (
              <Cpu className="w-6 h-6 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-6 h-6" />
            )}
            <span className="text-xs font-black uppercase">
              {rechargeMutation.isPending ? '补给中...' : '算力补给'}
            </span>
          </button>
          <button
            onClick={() => toast.info("全网分身资源消耗账单生成中...")}
            className="p-5 rounded-3xl bg-white/5 border border-white/10 text-white flex flex-col gap-2 active:bg-white/10 transition-all"
          >
            <History className="w-6 h-6 text-gray-500" />
            <span className="text-xs font-black uppercase">消耗追踪</span>
          </button>
        </section>

      </div>
    </SafeLayout>
  );
}
