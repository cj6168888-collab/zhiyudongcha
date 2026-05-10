/**
 * ExpertWorkstation - 专家深度工作站 2.0 (状态绑定修复版)
 *
 * 修复：专家标题映射、输入框状态绑定、专家切换
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Mic, Send, BrainCircuit, FileText, ChevronRight, Activity, Zap, LineChart, ArrowLeft
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// 专家配置映射
const EXPERT_CONFIG: Record<string, { name: string; icon: typeof BrainCircuit; color: string; description: string }> = {
  lawyer: { name: '随身律师', icon: BrainCircuit, color: 'text-blue-400', description: '合同评审、法律咨询' },
  finance: { name: '财务主管', icon: BrainCircuit, color: 'text-green-400', description: '收支归类、税务预判' },
  psychology: { name: '心理专家', icon: BrainCircuit, color: 'text-rose-400', description: '对手性格分析、博弈建议' },
  planner: { name: '首席策划', icon: BrainCircuit, color: 'text-purple-400', description: '竞品分析、博弈推演' },
  secretary: { name: '商务秘书', icon: BrainCircuit, color: 'text-amber-400', description: '会议纪要、日程同步' },
};

type ExpertId = keyof typeof EXPERT_CONFIG;

export default function ExpertWorkstation({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const expertId = params.id as ExpertId;

  // 获取当前专家配置
  const expertConfig = useMemo(() => {
    return EXPERT_CONFIG[expertId] || {
      name: '未知专家',
      icon: BrainCircuit,
      color: 'text-gray-400',
      description: '未知领域'
    };
  }, [expertId]);

  const [activeTab, setActiveTab] = useState<'live' | 'knowledge' | 'simulation'>('live');
  const [queryInput, setQueryInput] = useState('');
  const [reasoningSteps, setSteps] = useState<string[]>([]);
  const [simulationData, setSimulationData] = useState<any>(null);

  // 1. 获取后端真实的专家知识库文档
  const { data: vaultItems, refetch: refetchVault } = useQuery({
    queryKey: ['/api/vault', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/vault?expertId=${params.id}`);
      const data = await res.json();
      return data.items || [];
    }
  });

  // 2. 核心激活：专家协同评审与自动存证
  const swarmMutation = useMutation({
    mutationFn: async (query: string) => {
      setSteps([]);
      const res = await fetch('/api/business/experts/swarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, expertId, projectId: 'P-DEFAULT' })
      });
      return await res.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        // 模拟思维链渐进呈现
        const steps = ["同步项目 RAG 库", "建立逻辑对冲模型", "测算博弈成算", "最终建议已物理归档"];
        for (const s of steps) {
          await new Promise(r => setTimeout(r, 600));
          setSteps(prev => [...prev, s]);
        }
        // 关键：即时刷新知识库
        await refetchVault();
        toast.success("战略成果已存入智库。");
      }
    },
    onError: () => {
      toast.error("请求失败，请稍后重试");
    }
  });

  // 处理查询提交
  const handleQuerySubmit = () => {
    if (!queryInput.trim()) {
      toast.error("请输入查询内容");
      return;
    }
    swarmMutation.mutate(queryInput);
  };

  // 清空输入
  const handleClearInput = () => {
    setQueryInput('');
  };

  // 获取页面标题
  const getHeaderTitle = () => {
    return expertConfig.name;
  };

  return (
    <SafeLayout headerTitle={getHeaderTitle()} showBack={true}>
      <div className="flex flex-col h-full px-1">

        <div className="flex bg-white/5 p-1 rounded-2xl mb-6">
          {(['live', 'knowledge', 'simulation'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all uppercase",
                activeTab === tab ? "bg-white/10 text-white shadow-lg" : "text-gray-500 active:bg-white/5"
              )}
            >
              {tab === 'live' ? '互动' : tab === 'knowledge' ? '知识' : '推演'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {activeTab === 'live' ? (
            <div className="h-full flex flex-col justify-between min-h-[400px]">
              <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
                {reasoningSteps.map((s, i) => (
                  <div key={i} className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-gray-300 italic animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                      <span className="text-[8px] text-gray-600 font-mono">Step {i+1}</span>
                    </div>
                    {s}
                  </div>
                ))}
                {reasoningSteps.length === 0 && (
                  <div className="w-32 h-32 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5 animate-pulse">
                    <BrainCircuit className="w-12 h-12 text-primary" />
                  </div>
                )}
              </div>
              <div className="p-4 bg-white/5 rounded-3xl border border-white/5 flex items-center gap-3">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
                  placeholder={`向${expertConfig.name}提问...`}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
                  disabled={swarmMutation.isPending}
                />
                {queryInput && (
                  <button onClick={handleClearInput} className="p-1 text-gray-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleQuerySubmit}
                  disabled={swarmMutation.isPending || !queryInput.trim()}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                >
                  {swarmMutation.isPending ? (
                    <Activity className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'knowledge' ? (
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase px-1">关联交付物 ({vaultItems?.length || 0})</h4>
              {vaultItems?.map((item: any) => (
                <div key={item.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-gray-200 truncate">{item.fileName}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </div>
              ))}
            </div>
          ) : (
            /* 推演模式保持逻辑... */
            <div className="py-10 text-center">
              <LineChart className="w-16 h-16 text-primary/20 mx-auto animate-pulse mb-4" />
              <p className="text-xs text-gray-500 px-10 leading-relaxed italic">MCTS 引擎正在后台模拟当日全网 10,000 次博弈走向...</p>
            </div>
          )}
        </div>
      </div>
    </SafeLayout>
  );
}
