/**
 * DreamReview — P5 梦境复盘
 * 展示每日复盘结果，支持手动触发，候选项在收件箱确认
 */
import React, { useState } from "react";
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Moon, RefreshCw, Sparkles, ChevronRight, AlertTriangle,
  ListTodo, Users, Brain, Clock, CheckCircle2, Play, Sunrise,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── 类型 ──────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  title: string | null;
  summary: string | null;
  started_at: string;
  created_at: string;
}

interface RunResult {
  conversationId: string;
  summary: string;
  missedTaskCount: number;
  projectRiskCount: number;
  relationshipSignalCount: number;
  memoryConflictCount: number;
  totalCandidates: number;
  sourcedFrom: number;
}

interface BriefingItem {
  type: 'task' | 'project_risk' | 'relationship_signal' | 'memory_conflict';
  title: string;
  description: string;
}

interface MorningBriefing {
  ownerId: string;
  reviewDate: string;
  generatedAt: string;
  reviewSummary: string;
  topItems: BriefingItem[];
  suggestedActions: string[];
  totalPending: number;
}

// ── 工具 ─────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

// ── 子组件 ────────────────────────────────────────────────

function StatChip({ icon: Icon, label, count, color }: {
  icon: React.ElementType; label: string; count: number; color: string;
}) {
  if (count === 0) return null;
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium", color)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

function RunResultCard({ result }: { result: RunResult }) {
  const [, setLocation] = useLocation();
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-white/90">复盘完成</span>
      </div>
      <p className="text-xs text-white/70 leading-relaxed">{result.summary}</p>
      <p className="text-[10px] text-gray-500">来源 {result.sourcedFrom} 条对话，生成 {result.totalCandidates} 个候选项</p>
      <div className="flex flex-wrap gap-2">
        <StatChip icon={ListTodo} label="遗漏任务" count={result.missedTaskCount} color="border-blue-500/30 text-blue-400 bg-blue-500/10" />
        <StatChip icon={AlertTriangle} label="项目风险" count={result.projectRiskCount} color="border-amber-500/30 text-amber-400 bg-amber-500/10" />
        <StatChip icon={Users} label="关系信号" count={result.relationshipSignalCount} color="border-purple-500/30 text-purple-400 bg-purple-500/10" />
        <StatChip icon={Brain} label="记忆冲突" count={result.memoryConflictCount} color="border-red-500/30 text-red-400 bg-red-500/10" />
      </div>
      {result.totalCandidates > 0 && (
        <button
          onClick={() => setLocation("/inbox")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600/80 text-white text-xs font-semibold active:scale-95 transition-all"
        >
          前往收件箱确认候选项
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const ITEM_TYPE_STYLE: Record<BriefingItem['type'], { icon: React.ElementType; color: string; label: string }> = {
  task: { icon: ListTodo, color: "text-blue-400", label: "遗漏任务" },
  project_risk: { icon: AlertTriangle, color: "text-amber-400", label: "项目风险" },
  relationship_signal: { icon: Users, color: "text-purple-400", label: "关系信号" },
  memory_conflict: { icon: Brain, color: "text-red-400", label: "记忆冲突" },
};

function MorningBriefingCard({ briefing }: { briefing: MorningBriefing }) {
  const [, setLocation] = useLocation();
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sunrise className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white/90">醒来建议</span>
        <span className="ml-auto text-[10px] text-gray-500">{briefing.reviewDate}</span>
      </div>
      <p className="text-xs text-white/70 leading-relaxed">{briefing.reviewSummary}</p>

      {briefing.topItems.length > 0 && (
        <div className="space-y-1.5">
          {briefing.topItems.slice(0, 5).map((item, i) => {
            const style = ITEM_TYPE_STYLE[item.type];
            const Icon = style.icon;
            return (
              <div key={i} className="flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${style.color}`} />
                <div className="min-w-0">
                  <p className="text-xs text-white/80 font-medium truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-[10px] text-gray-500 line-clamp-1">{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {briefing.totalPending > 0 && (
        <button
          onClick={() => setLocation("/inbox")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-600/80 text-white text-xs font-semibold active:scale-95 transition-all"
        >
          前往收件箱处理 {briefing.totalPending} 个待办
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function HistoryCard({ review }: { review: ReviewRow }) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(`/inbox/${review.id}`)}
      className="w-full text-left flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Moon className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 font-medium truncate">
          {review.title ?? "梦境复盘"}
        </p>
        {review.summary && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{review.summary}</p>
        )}
        <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(review.started_at), "MM-dd HH:mm")}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-2" />
    </button>
  );
}

// ── 主页面 ────────────────────────────────────────────────

export default function DreamReview() {
  const qc = useQueryClient();
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const { data: morningData } = useQuery({
    queryKey: ["dream-review-morning"],
    queryFn: () => apiFetch("/api/dream-review/morning"),
    staleTime: 5 * 60_000,
  });

  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ["dream-review-latest"],
    queryFn: () => apiFetch("/api/dream-review/latest"),
    staleTime: 30_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["dream-review-history"],
    queryFn: () => apiFetch("/api/dream-review/history?limit=10"),
    staleTime: 30_000,
  });

  const morningBriefing: MorningBriefing | null = morningData?.briefing ?? null;
  const latest: ReviewRow | null = latestData?.review ?? null;
  const history: ReviewRow[] = historyData?.history ?? [];

  const runMutation = useMutation({
    mutationFn: () => apiFetch("/api/dream-review/run", { method: "POST", body: "{}" }),
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error ?? "复盘失败");
        return;
      }
      if (data.skipped) {
        toast.info("今日暂无对话可复盘");
        return;
      }
      setRunResult(data.result);
      toast.success("复盘完成");
      qc.invalidateQueries({ queryKey: ["dream-review-latest"] });
      qc.invalidateQueries({ queryKey: ["dream-review-history"] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox"] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox-counts"] });
    },
    onError: () => toast.error("网络异常"),
  });

  return (
    <SafeLayout
      headerTitle="梦境复盘"
      headerRight={
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["dream-review-latest"] });
            qc.invalidateQueries({ queryKey: ["dream-review-history"] });
          }}
          className="p-2 text-gray-400 active:text-primary"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      }
    >
      {/* 晨间建议 */}
      {morningBriefing && (
        <div className="mb-6">
          <MorningBriefingCard briefing={morningBriefing} />
        </div>
      )}

      {/* 触发复盘 */}
      <div className="mb-6">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            每晚自动复盘今日所有对话，发现遗漏任务、项目风险、关系信号和记忆冲突，生成候选项送入收件箱。
          </p>
        </div>
        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
        >
          {runMutation.isPending
            ? <><RefreshCw className="w-4 h-4 animate-spin" />复盘中…</>
            : <><Play className="w-4 h-4" />立即复盘今日对话</>
          }
        </button>
      </div>

      {/* 本次复盘结果 */}
      {runResult && (
        <div className="mb-6">
          <RunResultCard result={runResult} />
        </div>
      )}

      {/* 最新复盘摘要 */}
      {!runResult && latest && (
        <div className="mb-6">
          <h2 className="text-xs text-gray-500 mb-2">最近一次复盘</h2>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm font-semibold text-white/90 mb-1">{latest.title ?? "梦境复盘"}</p>
            {latest.summary && (
              <p className="text-xs text-gray-400 line-clamp-3">{latest.summary}</p>
            )}
            <p className="text-[10px] text-gray-600 mt-2">
              {format(new Date(latest.started_at), "MM-dd HH:mm")}
            </p>
          </div>
        </div>
      )}

      {/* 历史列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/80">复盘历史</h2>
          <span className="text-xs text-gray-500">{history.length} 条</span>
        </div>

        {(latestLoading || historyLoading) && (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}

        {!historyLoading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Moon className="w-12 h-12 text-indigo-500/30" />
            <p className="text-sm text-gray-500">尚无复盘记录</p>
            <p className="text-xs text-gray-600">点击上方按钮开始第一次复盘</p>
          </div>
        )}

        <div className="space-y-3">
          {history.map((review) => (
            <HistoryCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </SafeLayout>
  );
}
