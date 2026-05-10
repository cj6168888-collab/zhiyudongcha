/**
 * ConversationInbox - 对话收件箱
 * 展示待确认的候选项（任务、记忆、事件）
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Inbox, CheckCircle2, Brain, CalendarCheck, ListTodo, RefreshCw, ChevronRight, Radio, Moon } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── 类型 ──────────────────────────────────────────────

interface Conversation {
  id: string;
  source: string;
  mode: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
}

interface InboxCounts {
  total: number;
  task?: number;
  memory?: number;
  event?: number;
}

// ── 工具函数 ─────────────────────────────────────────

function fetchJson(url: string) {
  return fetch(url).then((r) => r.json());
}

function modeLabel(mode: string | null) {
  const map: Record<string, string> = {
    task_request: "任务请求",
    record_note: "快速笔记",
    conversation_record: "对话记录",
    casual_chat: "闲聊",
  };
  return mode ? (map[mode] ?? mode) : "对话";
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    mobile: "手机",
    desktop: "桌面",
    manual: "手动",
    import: "导入",
  };
  return map[source] ?? source;
}

// ── 组件 ─────────────────────────────────────────────

function CountBadge({ label, count, icon: Icon, color }: {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", color)}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
      <span className="ml-auto text-sm font-bold">{count}</span>
    </div>
  );
}

function ConvCard({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Inbox className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-indigo-400 font-medium">{modeLabel(conv.mode)}</span>
          <span className="text-[10px] text-gray-500">{sourceLabel(conv.source)}</span>
        </div>
        <p className="text-sm text-white/90 font-medium truncate">
          {conv.title ?? conv.summary ?? "无标题对话"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {format(new Date(conv.createdAt), "MM-dd HH:mm")}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-2" />
    </button>
  );
}

export default function ConversationInbox() {
  const [, setLocation] = useLocation();

  const { data: inboxData, isLoading: loadingList, refetch } = useQuery({
    queryKey: ["conversation-inbox"],
    queryFn: () => fetchJson("/api/conversation-inbox?limit=30"),
    staleTime: 10_000,
  });

  const { data: countsData } = useQuery({
    queryKey: ["conversation-inbox-counts"],
    queryFn: () => fetchJson("/api/conversation-inbox/counts"),
    staleTime: 10_000,
  });

  const conversations: Conversation[] = inboxData?.conversations ?? [];
  const counts: InboxCounts = countsData?.counts ?? { total: 0 };

  return (
    <SafeLayout
      headerTitle="对话收件箱"
      headerRight={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocation("/dream-review")}
            className="p-2 text-indigo-400 active:text-indigo-300"
            title="梦境复盘"
          >
            <Moon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setLocation("/omi-import")}
            className="p-2 text-indigo-400 active:text-indigo-300"
            title="Omi 导入"
          >
            <Radio className="w-5 h-5" />
          </button>
          <button onClick={() => refetch()} className="p-2 text-gray-400 active:text-primary">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      }
    >
      {/* 计数统计区 */}
      <div className="space-y-2 mb-6">
        <p className="text-xs text-gray-500 mb-3">待确认的候选项</p>
        <CountBadge label="任务候选" count={counts.task ?? 0} icon={ListTodo} color="border-blue-500/30 text-blue-400 bg-blue-500/10" />
        <CountBadge label="记忆候选" count={counts.memory ?? 0} icon={Brain} color="border-purple-500/30 text-purple-400 bg-purple-500/10" />
        <CountBadge label="事件候选" count={counts.event ?? 0} icon={CalendarCheck} color="border-emerald-500/30 text-emerald-400 bg-emerald-500/10" />
      </div>

      {/* 对话列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white/80">待处理对话</h2>
          <span className="text-xs text-gray-500">{conversations.length} 条</span>
        </div>

        {loadingList && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}

        {!loadingList && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/50" />
            <p className="text-sm text-gray-500">收件箱已清空</p>
            <p className="text-xs text-gray-600">与领航者对话产生的任务和记忆候选会出现在这里</p>
          </div>
        )}

        {conversations.map((conv) => (
          <ConvCard
            key={conv.id}
            conv={conv}
            onClick={() => setLocation(`/inbox/${conv.id}`)}
          />
        ))}
      </div>
    </SafeLayout>
  );
}
