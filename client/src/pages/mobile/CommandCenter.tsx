/**
 * CommandCenter - 待确认中心
 *
 * 展示真实 assistant pending/draft 队列。具体确认、修改和执行仍回到首页对话流处理。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getAssistantPendingSummary, type AssistantPendingSummary } from "@/lib/assistant-api";
import { cn } from "@/lib/utils";

type QueueItem =
  | AssistantPendingSummary["pending"][number]
  | AssistantPendingSummary["draft"][number];

export default function CommandCenter() {
  const [, setLocation] = useLocation();
  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["assistant-pending-summary"],
    queryFn: getAssistantPendingSummary,
    refetchInterval: 5000,
  });

  const pendingItems = summary?.pending ?? [];
  const draftItems = summary?.draft ?? [];
  const total = summary?.count ?? pendingItems.length + draftItems.length;

  return (
    <SafeLayout headerTitle="待确认中心" showBack={true}>
      <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-amber-200/15 bg-[#171207] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/25 bg-amber-300/[0.12] text-amber-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">需要你确认的动作</h2>
              <p className="mt-1 text-xs leading-5 text-amber-100/70">
                小智遇到写入、外发、删除、PC 执行等需要确认的动作时，会把它们放到这里。
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="总数" value={`${total}`} tone={total > 0 ? "amber" : "emerald"} />
            <Metric label="待执行" value={`${pendingItems.length}`} tone="cyan" />
            <Metric label="草稿" value={`${draftItems.length}`} tone="violet" />
          </div>
        </section>

        {isError && (
          <section className="rounded-xl border border-red-300/20 bg-red-300/[0.08] p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-red-100">队列读取失败</p>
                <p className="mt-1 text-[11px] leading-5 text-red-100/70">稍后重试，或回到首页继续对话。</p>
              </div>
              <button onClick={() => refetch()} className="text-[11px] font-bold text-red-100">
                重试
              </button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">当前队列</h3>
            <span className="text-[10px] font-bold text-slate-500">实时同步</span>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : total === 0 ? (
            <EmptyQueue onBackToChat={() => setLocation("/")} />
          ) : (
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <QueueCard key={item.id} item={item} kind="pending" onOpen={() => setLocation("/")} />
              ))}
              {draftItems.map((item) => (
                <QueueCard key={item.id} item={item} kind="draft" onOpen={() => setLocation("/")} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
            <p className="text-[11px] leading-5 text-cyan-100/75">
              这里负责总览；真正确认、修改草稿、讨论原因和查看执行结果都回到首页对话流，避免用户在不同窗口里判断。
            </p>
          </div>
        </section>

        <button
          onClick={() => setLocation("/")}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-black text-slate-950 active:scale-[0.99]"
        >
          <MessageCircle className="h-4 w-4" />
          回到和小智沟通
        </button>
      </div>
    </SafeLayout>
  );
}

function EmptyQueue({ onBackToChat }: { onBackToChat: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-100">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">没有待确认事项</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            当前没有可处理动作。新的确认卡会从首页对话里产生，并同步到这里。
          </p>
        </div>
      </div>
      <button
        onClick={onBackToChat}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-sm font-black text-white active:bg-white/10"
      >
        <Sparkles className="h-4 w-4 text-cyan-100" />
        发起新沟通
      </button>
    </div>
  );
}

function QueueCard({ item, kind, onOpen }: { item: QueueItem; kind: "pending" | "draft"; onOpen: () => void }) {
  const isDraft = kind === "draft";
  const detail = isDraft ? describeDraft(item as AssistantPendingSummary["draft"][number]) : describePending(item);

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left active:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isDraft ? "bg-violet-300/10 text-violet-200" : "bg-amber-300/10 text-amber-100",
            )}
          >
            {isDraft ? <FileText className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">{isDraft ? "草稿待确认" : "动作待确认"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-600">创建于 {formatTime(item.createdAt)}</p>
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
      </div>
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "amber" | "emerald" | "cyan" | "violet" }) {
  const toneClass = {
    amber: "text-amber-100",
    emerald: "text-emerald-100",
    cyan: "text-cyan-100",
    violet: "text-violet-200",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-black", toneClass)}>{value}</p>
    </div>
  );
}

function describePending(item: QueueItem) {
  if (item.action) return `动作：${item.action}`;
  return "小智需要你确认后才会继续执行。";
}

function describeDraft(item: AssistantPendingSummary["draft"][number]) {
  const count = item.items?.length ?? 0;
  if (count > 0) return `小智整理了 ${count} 项内容，确认后会写入或执行。`;
  return "有草稿内容等待你检查。";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
