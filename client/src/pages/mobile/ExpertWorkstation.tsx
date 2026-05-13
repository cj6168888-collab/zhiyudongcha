/**
 * ExpertWorkstation - 专家深度工作站
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Send, BrainCircuit, FileText, ChevronRight, Activity, LineChart, X, ShieldCheck, AlertTriangle
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

type ExpertType = 'LEGAL' | 'FINANCE' | 'STRATEGY' | 'PSYCHOLOGY' | 'PLANNING' | 'SECRETARY';
type ExpertId = 'lawyer' | 'legal' | 'finance' | 'psychology' | 'planner' | 'strategy' | 'secretary';

interface ExpertConfig {
  name: string;
  icon: typeof BrainCircuit;
  color: string;
  description: string;
  expertType: ExpertType;
  professionalMode?: 'LEGAL' | 'FINANCE';
}

interface ThoughtStep {
  step: number;
  reasoning: string;
  evidence?: string[];
  conclusion: string;
  confidence: number;
}

interface ExpertAnalysis {
  expert: ExpertType;
  finalVerdict: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  chainOfThought: ThoughtStep[];
  executionTimeMs?: number;
}

interface ProfessionalResult {
  success: boolean;
  response?: {
    answer: string;
    confidenceScore: number;
    dataSources?: Array<{ title?: string; matchScore?: number; path?: string }>;
    warnings?: string[];
    isRefused?: boolean;
    refusalReason?: string;
  };
  cotSteps?: Array<{ step: string; status: string; details: string }>;
  processingTimeMs?: number;
}

interface WorkstationResult {
  analysis?: ExpertAnalysis;
  professional?: ProfessionalResult;
}

interface VaultItem {
  id: string;
  fileName: string;
}

const EXPERT_CONFIG: Record<ExpertId, ExpertConfig> = {
  lawyer: { name: '随身律师', icon: ShieldCheck, color: 'text-blue-400', description: '合同评审、法律咨询', expertType: 'LEGAL', professionalMode: 'LEGAL' },
  legal: { name: '随身律师', icon: ShieldCheck, color: 'text-blue-400', description: '合同评审、法律咨询', expertType: 'LEGAL', professionalMode: 'LEGAL' },
  finance: { name: '财务主管', icon: BrainCircuit, color: 'text-green-400', description: '收支归类、税务预判', expertType: 'FINANCE', professionalMode: 'FINANCE' },
  psychology: { name: '心理专家', icon: BrainCircuit, color: 'text-rose-400', description: '对手性格分析、博弈建议', expertType: 'PSYCHOLOGY' },
  planner: { name: '首席策划', icon: BrainCircuit, color: 'text-purple-400', description: '竞品分析、博弈推演', expertType: 'PLANNING' },
  strategy: { name: '首席策划', icon: BrainCircuit, color: 'text-purple-400', description: '竞品分析、博弈推演', expertType: 'STRATEGY' },
  secretary: { name: '商务秘书', icon: BrainCircuit, color: 'text-amber-400', description: '会议纪要、日程同步', expertType: 'SECRETARY' },
};

const RISK_STYLE: Record<ExpertAnalysis['riskLevel'], string> = {
  LOW: 'text-green-400 border-green-500/30 bg-green-500/10',
  MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  HIGH: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL: 'text-red-400 border-red-500/30 bg-red-500/10',
};

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await apiRequest('POST', path, body);
  return await res.json() as T;
}

export default function ExpertWorkstation({ params }: { params: { id: string } }) {
  const expertId = params.id as ExpertId;
  const expertConfig = useMemo(() => {
    return EXPERT_CONFIG[expertId] || EXPERT_CONFIG.lawyer;
  }, [expertId]);

  const [activeTab, setActiveTab] = useState<'live' | 'knowledge' | 'simulation'>('live');
  const [queryInput, setQueryInput] = useState('');
  const [reasoningSteps, setSteps] = useState<string[]>([]);
  const [result, setResult] = useState<WorkstationResult | null>(null);

  const { data: vaultItems, refetch: refetchVault } = useQuery<VaultItem[]>({
    queryKey: ['/api/vault', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/vault?expertId=${params.id}`);
      const data = await res.json();
      return data.items || [];
    }
  });

  const analysisMutation = useMutation({
    mutationFn: async (query: string): Promise<WorkstationResult> => {
      setResult(null);
      setSteps(['提交真实专家接口']);

      let professional: ProfessionalResult | undefined;
      if (expertConfig.professionalMode) {
        setSteps(prev => [...prev, '执行零幻觉知识库检索']);
        professional = await postJson<ProfessionalResult>('/api/professional/query', {
          query,
          mode: expertConfig.professionalMode,
        });
      }

      setSteps(prev => [...prev, '执行专家分析与风险判定']);
      const single = await postJson<{ success: boolean; data: ExpertAnalysis }>('/api/expert-orchestrator/single', {
        query,
        expertType: expertConfig.expertType,
        useKnowledgeBase: true,
      });

      return { professional, analysis: single.data };
    },
    onSuccess: async (data) => {
      setResult(data);
      setSteps(prev => [...prev, '产出已返回，可核查依据和建议']);
      await refetchVault();
      toast.success("专家分析完成");
    },
    onError: (error) => {
      setSteps([]);
      toast.error(error instanceof Error ? error.message : "请求失败，请稍后重试");
    }
  });

  const handleQuerySubmit = () => {
    if (!queryInput.trim()) {
      toast.error("请输入查询内容");
      return;
    }
    analysisMutation.mutate(queryInput);
  };

  const answer = result?.professional?.response?.answer || result?.analysis?.finalVerdict;
  const confidence = result?.professional?.response?.confidenceScore;
  const dataSources = result?.professional?.response?.dataSources || [];
  const riskLevel = result?.analysis?.riskLevel;

  return (
    <SafeLayout headerTitle={expertConfig.name} showBack={true}>
      <div className="flex h-full flex-col px-1">
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <expertConfig.icon className={cn("h-5 w-5", expertConfig.color)} />
            <div>
              <p className="text-sm font-bold text-white">{expertConfig.name}</p>
              <p className="text-[10px] text-gray-500">{expertConfig.description}</p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex rounded-lg bg-white/5 p-1">
          {(['live', 'knowledge', 'simulation'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all",
                activeTab === tab ? "bg-white/10 text-white shadow-lg" : "text-gray-500 active:bg-white/5"
              )}
            >
              {tab === 'live' ? '实时互动' : tab === 'knowledge' ? '知识库' : '推演'}
            </button>
          ))}
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto pb-24">
          {activeTab === 'live' ? (
            <div className="flex min-h-[400px] flex-col justify-between">
              <div className="flex-1 space-y-3 p-1">
                {reasoningSteps.map((step, index) => (
                  <div key={`${step}-${index}`} className="rounded-lg border border-white/5 bg-white/[0.04] p-3 text-xs text-gray-300">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-[9px] font-mono text-gray-600">Step {index + 1}</span>
                    </div>
                    {step}
                  </div>
                ))}

                {!result && reasoningSteps.length === 0 && (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                      <BrainCircuit className="h-10 w-10 text-primary" />
                    </div>
                    <p className="max-w-64 text-xs leading-relaxed text-gray-500">输入具体事实、合同条款或函件内容后，系统会返回可核查的法律分析结果。</p>
                  </div>
                )}

                {answer && (
                  <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {riskLevel && (
                        <span className={cn("rounded-md border px-2 py-1 text-[10px] font-black", RISK_STYLE[riskLevel])}>
                          {riskLevel}
                        </span>
                      )}
                      {typeof confidence === 'number' && (
                        <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-black text-blue-300">
                          置信度 {Math.round(confidence * 100)}%
                        </span>
                      )}
                      {result?.professional?.response?.isRefused && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-300">
                          <AlertTriangle className="h-3 w-3" />
                          依据不足
                        </span>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap text-xs leading-relaxed text-gray-200">{answer}</div>

                    {dataSources.length > 0 && (
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <p className="text-[10px] font-black uppercase text-gray-500">引用来源</p>
                        {dataSources.slice(0, 4).map((source, index) => (
                          <div key={`${source.path || source.title}-${index}`} className="rounded-md bg-black/20 p-2 text-[10px] text-gray-400">
                            {index + 1}. {source.title || source.path || '知识库来源'} {typeof source.matchScore === 'number' ? `(${Math.round(source.matchScore * 100)}%)` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {result?.analysis?.recommendations?.length ? (
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <p className="text-[10px] font-black uppercase text-gray-500">行动建议</p>
                        {result.analysis.recommendations.slice(0, 5).map((recommendation, index) => (
                          <div key={`${recommendation}-${index}`} className="text-xs leading-relaxed text-gray-300">
                            {index + 1}. {recommendation}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit()}
                  placeholder={`向${expertConfig.name}提问...`}
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                  disabled={analysisMutation.isPending}
                />
                {queryInput && (
                  <button onClick={() => setQueryInput('')} className="rounded-md p-2 text-gray-500 active:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleQuerySubmit}
                  disabled={analysisMutation.isPending || !queryInput.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-all active:scale-95 disabled:opacity-50"
                >
                  {analysisMutation.isPending ? (
                    <Activity className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'knowledge' ? (
            <div className="space-y-3">
              <h4 className="px-1 text-[10px] font-bold uppercase text-gray-500">关联交付物 ({vaultItems?.length || 0})</h4>
              {vaultItems?.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-sm text-gray-200">{item.fileName}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <LineChart className="mx-auto mb-4 h-16 w-16 text-primary/20" />
              <p className="px-10 text-xs italic leading-relaxed text-gray-500">推演模式会调用多专家编排接口，对法律、财务和策略风险进行交叉仲裁。</p>
            </div>
          )}
        </div>
      </div>
    </SafeLayout>
  );
}
