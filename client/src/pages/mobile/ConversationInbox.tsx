import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Brain,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListTodo,
  MessageSquareText,
  Moon,
  Radio,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

interface Conversation {
  id: string;
  source: string;
  mode: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
  pendingCount?: number;
  candidateCounts?: {
    total?: number;
    task?: number;
    memory?: number;
    event?: number;
  };
}

interface InboxCounts {
  total: number;
  task?: number;
  memory?: number;
  event?: number;
}

interface InboxResponse {
  success: boolean;
  conversations?: Conversation[];
  total?: number;
}

interface CountsResponse {
  success: boolean;
  counts?: InboxCounts;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json() as Promise<T>;
}

function modeLabel(mode: string | null) {
  const map: Record<string, string> = {
    task_request: "工作指令",
    record_note: "快速记录",
    conversation_record: "对话记录",
    casual_chat: "日常沟通",
  };
  return mode ? (map[mode] ?? mode) : "对话";
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    mobile: "手机",
    desktop: "桌面",
    xiaozhi_device: "小智设备",
    omi: "Omi",
    browser: "浏览器",
    file: "文件",
    manual: "手动",
    import: "导入",
  };
  return map[source] ?? source;
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    in_progress: { label: "进行中", cls: "border-sky-400/25 text-sky-200 bg-sky-400/10" },
    processing: { label: "整理中", cls: "border-violet-400/25 text-violet-200 bg-violet-400/10" },
    review_pending: { label: "需处理", cls: "border-amber-300/30 text-amber-100 bg-amber-300/10" },
    completed: { label: "已完成", cls: "border-emerald-300/25 text-emerald-100 bg-emerald-300/10" },
    failed: { label: "异常", cls: "border-red-300/25 text-red-100 bg-red-300/10" },
  };
  return map[status] ?? { label: status, cls: "border-white/10 text-slate-300 bg-white/[0.04]" };
}

function formatTime(value?: string | null) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return format(date, "MM-dd HH:mm");
}

function visibleCandidateCounts(conv: Conversation) {
  const counts = conv.candidateCounts ?? {};
  return [
    { label: "任务", count: counts.task ?? 0, icon: ListTodo },
    { label: "记忆", count: counts.memory ?? 0, icon: Brain },
    { label: "日程", count: counts.event ?? 0, icon: CalendarCheck },
  ].filter((item) => item.count > 0);
}

function PendingPill({ label, count, icon: Icon }: { label: string; count: number; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-amber-100">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-[11px] font-black">{label}</span>
      <span className="ml-auto text-xs font-black">{count}</span>
    </div>
  );
}

function ConvCard({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const status = statusLabel(conv.status);
  const pendingCount = conv.pendingCount ?? 0;
  const candidateTotal = conv.candidateCounts?.total ?? 0;
  const counts = visibleCandidateCounts(conv);
  const displayTitle = conv.title ?? conv.summary ?? "未命名会话";
  const displaySummary = conv.summary ?? (pendingCount > 0 ? "有工作结果等待确认" : "这是一段已记录的沟通");

  return (
    <button
      type="button"
      data-testid="conversation-card"
      onClick={onClick}
      className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-3.5 text-left active:bg-white/[0.08]"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            pendingCount > 0 ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-white/[0.04]"
          )}
        >
          {pendingCount > 0 ? (
            <Sparkles className="h-4 w-4 text-amber-100" />
          ) : (
            <MessageSquareText className="h-4 w-4 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-violet-200">{modeLabel(conv.mode)}</span>
            <span className="text-[10px] font-bold text-slate-500">{sourceLabel(conv.source)}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", status.cls)}>
              {status.label}
            </span>
          </div>

          <p className="mt-2 truncate text-sm font-black text-white">{displayTitle}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{displaySummary}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Clock3 className="h-3 w-3" />
              {formatTime(conv.lastActivityAt ?? conv.updatedAt ?? conv.createdAt)}
            </span>
            {pendingCount > 0 ? (
              <span data-testid="conversation-pending-badge" className="rounded-full bg-amber-300/15 px-2 py-1 text-[10px] font-black text-amber-100">
                待处理 {pendingCount}
              </span>
            ) : candidateTotal > 0 ? (
              <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-100">
                工作已归档
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-black text-slate-400">
                纯对话
              </span>
            )}
            {counts.map((item) => (
              <span key={item.label} className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400">
                {item.label} {item.count}
              </span>
            ))}
          </div>
        </div>

        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-600" />
      </div>
    </button>
  );
}

export default function ConversationInbox() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const { data: inboxData, isLoading: loadingList, refetch } = useQuery({
    queryKey: ["conversation-inbox"],
    queryFn: () => fetchJson<InboxResponse>("/api/conversation-inbox?limit=30"),
    staleTime: 10_000,
  });

  const { data: countsData } = useQuery({
    queryKey: ["conversation-inbox-counts"],
    queryFn: () => fetchJson<CountsResponse>("/api/conversation-inbox/counts"),
    staleTime: 10_000,
  });

  const conversations = inboxData?.conversations ?? [];
  const counts = countsData?.counts;
  const pendingTotal = counts?.total ?? conversations.reduce((sum, conv) => sum + (conv.pendingCount ?? 0), 0);
  const pendingSummaryItems = [
    { label: "任务", count: counts?.task ?? 0, icon: ListTodo },
    { label: "记忆", count: counts?.memory ?? 0, icon: Brain },
    { label: "日程", count: counts?.event ?? 0, icon: CalendarCheck },
  ].filter((item) => item.count > 0);
  const visiblePendingSummaryItems = pendingSummaryItems.length > 0
    ? pendingSummaryItems
    : [{ label: "待确认", count: pendingTotal, icon: Sparkles }];
  const totalConversations = inboxData?.total ?? conversations.length;
  const filteredConversations = filter === "pending"
    ? conversations.filter((conv) => (conv.pendingCount ?? 0) > 0)
    : conversations;

  return (
    <SafeLayout
      headerTitle="会话历史"
      headerRight={
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="conversation-dream-review-link"
            onClick={() => setLocation("/dream-review")}
            className="rounded-lg p-2 text-indigo-300 active:bg-white/10"
            aria-label="梦境复盘"
          >
            <Moon className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-testid="conversation-omi-import-link"
            onClick={() => setLocation("/omi-import")}
            className="rounded-lg p-2 text-indigo-300 active:bg-white/10"
            aria-label="Omi 导入"
          >
            <Radio className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-testid="conversation-inbox-refresh"
            onClick={() => refetch()}
            className="rounded-lg p-2 text-slate-400 active:bg-white/10 active:text-white"
            aria-label="刷新会话"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      }
    >
      <section data-testid="conversation-history-overview" className="mb-4 border-b border-white/10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-black tracking-tight text-white">全部会话</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              {totalConversations} 段沟通已记录，语音、文字和工作回流都从这里继续。
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] font-black text-slate-500">待处理</p>
            <p className={cn("text-lg font-black", pendingTotal > 0 ? "text-amber-100" : "text-emerald-100")}>
              {pendingTotal}
            </p>
          </div>
        </div>
      </section>

      {pendingTotal > 0 && (
        <section data-testid="conversation-pending-summary" className="mb-4 flex gap-2">
          {visiblePendingSummaryItems.map((item) => (
            <PendingPill key={item.label} label={item.label} count={item.count} icon={item.icon} />
          ))}
        </section>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          data-testid="conversation-filter-all"
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className={cn(
            "rounded-md px-3 py-2 text-xs font-black",
            filter === "all" ? "bg-white/10 text-white" : "text-slate-500"
          )}
        >
          全部
        </button>
        <button
          type="button"
          data-testid="conversation-filter-pending"
          onClick={() => setFilter("pending")}
          aria-pressed={filter === "pending"}
          className={cn(
            "rounded-md px-3 py-2 text-xs font-black",
            filter === "pending" ? "bg-amber-300/15 text-amber-100" : "text-slate-500"
          )}
        >
          待处理
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-black text-slate-500">最近会话</h2>
          <span className="text-[11px] font-bold text-slate-600">{filteredConversations.length} 条</span>
        </div>

        {loadingList && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-300" />
          </div>
        )}

        {!loadingList && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-slate-700" />
            <p className="text-sm font-bold text-slate-400">还没有会话历史</p>
            <p className="max-w-64 text-xs leading-relaxed text-slate-600">
              从首页和小智语音或文字交流后，记录会出现在这里。
            </p>
          </div>
        )}

        {!loadingList && conversations.length > 0 && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
            <p className="text-sm font-bold text-slate-400">没有待处理会话</p>
            <p className="text-xs text-slate-600">已完成的沟通仍在“全部”里保留。</p>
          </div>
        )}

        {filteredConversations.map((conv) => (
          <ConvCard
            key={conv.id}
            conv={conv}
            onClick={() => setLocation(`/inbox/${conv.id}`)}
          />
        ))}
      </section>
    </SafeLayout>
  );
}
