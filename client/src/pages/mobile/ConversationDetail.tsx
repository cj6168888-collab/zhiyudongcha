import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  AlertCircle,
  ArrowUpRight,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Edit3,
  ListTodo,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Send,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo, useState } from "react";

interface Segment {
  id: string;
  sequence: number;
  segmentType: string;
  text: string | null;
  speaker: string | null;
  speakerType: string | null;
  createdAt: string;
}

interface Candidate {
  id: string;
  candidateType: string;
  status: string;
  content: Record<string, unknown>;
  confidence: string | null;
  riskLevel: string | null;
  linkedEntityId: string | null;
  linkedEntityType?: string | null;
  createdAt: string;
}

interface ConversationDetailRecord {
  id: string;
  source: string;
  mode: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

interface ConversationDetailResponse {
  success: boolean;
  conversation?: ConversationDetailRecord;
  segments?: Segment[];
  candidates?: Candidate[];
  error?: string;
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return response.json() as Promise<T>;
}

function candidateMeta(type: string): { label: string; icon: LucideIcon; cls: string } {
  if (type === "task") {
    return { label: "任务", icon: ListTodo, cls: "border-blue-400/30 bg-blue-400/10 text-blue-100" };
  }
  if (type === "memory") {
    return { label: "记忆", icon: Brain, cls: "border-violet-400/30 bg-violet-400/10 text-violet-100" };
  }
  if (type === "event") {
    return { label: "日程", icon: CalendarCheck, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" };
  }
  return { label: type, icon: AlertCircle, cls: "border-slate-400/20 bg-white/[0.04] text-slate-200" };
}

function candidateStatus(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待确认", cls: "border-amber-300/30 bg-amber-300/10 text-amber-100" },
    accepted: { label: "已接受", cls: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" },
    rejected: { label: "已拒绝", cls: "border-red-300/25 bg-red-300/10 text-red-100" },
    applied: { label: "已应用", cls: "border-blue-300/25 bg-blue-300/10 text-blue-100" },
    edited: { label: "已编辑", cls: "border-violet-300/25 bg-violet-300/10 text-violet-100" },
  };
  return map[status] ?? { label: status, cls: "border-white/10 bg-white/[0.04] text-slate-300" };
}

function conversationStatus(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    in_progress: { label: "进行中", cls: "border-sky-400/25 text-sky-200 bg-sky-400/10" },
    processing: { label: "整理中", cls: "border-violet-400/25 text-violet-200 bg-violet-400/10" },
    review_pending: { label: "需处理", cls: "border-amber-300/30 text-amber-100 bg-amber-300/10" },
    completed: { label: "已完成", cls: "border-emerald-300/25 text-emerald-100 bg-emerald-300/10" },
    failed: { label: "异常", cls: "border-red-300/25 text-red-100 bg-red-300/10" },
  };
  return map[status] ?? { label: status, cls: "border-white/10 text-slate-300 bg-white/[0.04]" };
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

function formatTime(value?: string | null) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return format(date, "MM-dd HH:mm");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function candidateTitle(content: Record<string, unknown>) {
  return (
    stringValue(content.title) ??
    stringValue(content.name) ??
    stringValue(content.summary) ??
    stringValue(content.content) ??
    stringValue(content.message) ??
    JSON.stringify(content)
  );
}

function candidateDetail(content: Record<string, unknown>, title: string) {
  const detail =
    stringValue(content.description) ??
    stringValue(content.detail) ??
    stringValue(content.message) ??
    stringValue(content.content);
  return detail && detail !== title ? detail : null;
}

function routeForCandidate(candidate: Candidate) {
  if (!candidate.linkedEntityId) return null;
  if (candidate.linkedEntityType === "project" || candidate.candidateType === "task") {
    return `/projects/${candidate.linkedEntityId}`;
  }
  if (candidate.linkedEntityType === "vault_item" || candidate.candidateType === "memory") return "/vault";
  if (candidate.candidateType === "event") return "/tasks";
  return null;
}

function linkedEntityLabel(candidate: Candidate) {
  if (candidate.linkedEntityType === "project" || candidate.candidateType === "task") return "查看项目";
  if (candidate.linkedEntityType === "vault_item" || candidate.candidateType === "memory") return "查看智库";
  if (candidate.candidateType === "event") return "查看日程";
  return "查看结果";
}

function CandidateCard({ candidate, convId, onMutated }: {
  candidate: Candidate;
  convId: string;
  onMutated: () => void;
}) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const meta = candidateMeta(candidate.candidateType);
  const Icon = meta.icon;
  const status = candidateStatus(candidate.status);
  const title = candidateTitle(candidate.content);
  const detail = candidateDetail(candidate.content, title);
  const route = routeForCandidate(candidate);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(JSON.stringify(candidate.content, null, 2));

  const action = useMutation({
    mutationFn: ({ act, body }: { act: string; body?: object }) =>
      apiFetch<{ success: boolean; error?: string }>(`/api/conversation-candidates/${candidate.id}/${act}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: (data, { act }) => {
      if (!data.success) {
        toast.error(data.error ?? "操作失败");
        return;
      }
      const labels: Record<string, string> = { accept: "已接受", reject: "已拒绝", apply: "已应用", edit: "已保存修改" };
      toast.success(labels[act] ?? "已操作");
      void qc.invalidateQueries({ queryKey: ["conversation-detail", convId] });
      void qc.invalidateQueries({ queryKey: ["conversation-inbox"] });
      void qc.invalidateQueries({ queryKey: ["conversation-inbox-counts"] });
      onMutated();
    },
    onError: () => toast.error("网络异常，请重试"),
  });

  const handleSaveEdit = () => {
    try {
      const content = JSON.parse(editedContent);
      action.mutate({ act: "edit", body: { content } });
      setEditing(false);
    } catch {
      toast.error("JSON 格式错误");
    }
  };

  return (
    <div data-testid="work-feedback-card" className={cn("rounded-lg border p-3.5", meta.cls)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/15">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black">{meta.label}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", status.cls)}>{status.label}</span>
            {candidate.riskLevel && candidate.riskLevel !== "low" && (
              <span className="rounded-full border border-orange-300/30 bg-orange-300/10 px-2 py-0.5 text-[10px] font-black text-orange-100">
                风险 {candidate.riskLevel}
              </span>
            )}
          </div>

          {!editing && (
            <>
              <p className="mt-2 text-sm font-black leading-relaxed text-white">{title.slice(0, 160)}</p>
              {detail && <p className="mt-1 text-xs leading-relaxed text-white/65">{detail.slice(0, 180)}</p>}
            </>
          )}
        </div>
      </div>

      {editing && (
        <textarea
          data-testid="candidate-edit-json"
          value={editedContent}
          onChange={(event) => setEditedContent(event.target.value)}
          className="mt-3 h-36 w-full resize-none rounded-lg border border-white/15 bg-black/35 p-3 font-mono text-xs leading-relaxed text-white/80"
        />
      )}

      {candidate.status === "pending" && (
        <div data-testid="candidate-actions" className="mt-3 flex flex-wrap gap-2">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => action.mutate({ act: "accept" })}
                disabled={action.isPending}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 text-xs font-black text-emerald-100 active:bg-emerald-400/25 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> 接受
              </button>
              <button
                type="button"
                onClick={() => action.mutate({ act: "apply" })}
                disabled={action.isPending}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-400/15 px-3 text-xs font-black text-blue-100 active:bg-blue-400/25 disabled:opacity-50"
              >
                <ArrowUpRight className="h-3.5 w-3.5" /> 应用
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-200 active:bg-white/10"
              >
                <Edit3 className="h-3.5 w-3.5" /> 编辑
              </button>
              <button
                type="button"
                onClick={() => action.mutate({ act: "reject" })}
                disabled={action.isPending}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-red-400/15 px-3 text-xs font-black text-red-100 active:bg-red-400/25 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" /> 拒绝
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-400/15 px-3 text-xs font-black text-violet-100 active:bg-violet-400/25"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> 保存修改
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditedContent(JSON.stringify(candidate.content, null, 2));
                }}
                className="flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-300"
              >
                取消
              </button>
            </>
          )}
          {action.isPending && <Loader2 className="mt-2 h-4 w-4 animate-spin text-white/60" />}
        </div>
      )}

      {candidate.linkedEntityId && (
        <div data-testid="candidate-linked-entity" className="mt-3 flex items-center justify-between gap-3 border-t border-current/15 pt-3">
          <p className="min-w-0 truncate text-[10px] font-bold text-white/55">已回流：{candidate.linkedEntityId}</p>
          {route && (
            <button
              type="button"
              onClick={() => setLocation(route)}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-white active:bg-white/10"
            >
              {linkedEntityLabel(candidate)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentBubble({ segment }: { segment: Segment }) {
  const isUser = segment.speakerType === "user" || segment.speaker === "user";
  const isAssistant = segment.speakerType === "assistant" || segment.speaker === "assistant" || segment.speaker === "xiaozhi";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[86%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-tr-md bg-violet-500 text-white"
              : "rounded-tl-md border border-white/10 bg-white/[0.06] text-slate-100"
          )}
        >
          {segment.text ?? "(无文字)"}
        </div>
        <div className={cn("mt-1 flex items-center gap-1 px-1 text-[10px] font-bold text-slate-600", isUser ? "justify-end" : "justify-start")}>
          <span>{isUser ? "你" : isAssistant ? "小智" : segment.speaker ?? "记录"}</span>
          <span>·</span>
          <span>{formatTime(segment.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  params: { id: string };
}

export default function ConversationDetail({ params }: Props) {
  const { id } = params;
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversation-detail", id],
    queryFn: () => apiFetch<ConversationDetailResponse>(`/api/conversations/${id}`),
    staleTime: 10_000,
  });

  const conv = data?.conversation;
  const segments = useMemo(() => [...(data?.segments ?? [])].sort((a, b) => a.sequence - b.sequence), [data?.segments]);
  const candidates = data?.candidates ?? [];
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "pending");
  const processedCandidates = candidates.filter((candidate) => candidate.status !== "pending");
  const status = conv ? conversationStatus(conv.status) : null;

  if (isLoading) {
    return (
      <SafeLayout headerTitle="加载中…">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
        </div>
      </SafeLayout>
    );
  }

  if (!conv) {
    return (
      <SafeLayout headerTitle="对话不存在">
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <AlertCircle className="h-10 w-10 text-red-300" />
          <p className="text-sm text-slate-500">找不到这段对话</p>
        </div>
      </SafeLayout>
    );
  }

  const continueParams = new URLSearchParams({
    resumeConversationId: conv.id,
    resumeTitle: conv.title ?? conv.summary ?? "这段会话",
  });
  const continueConversationPath = `/?${continueParams.toString()}`;

  return (
    <SafeLayout headerTitle={conv.title ?? "会话详情"}>
      <section data-testid="conversation-detail-overview" className="mb-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-violet-200">{modeLabel(conv.mode)}</span>
          <span className="text-[10px] font-bold text-slate-500">{sourceLabel(conv.source)}</span>
          {status && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", status.cls)}>{status.label}</span>}
        </div>

        <h1 className="mt-3 text-xl font-black tracking-tight text-white">{conv.title ?? "未命名会话"}</h1>
        {conv.summary && <p className="mt-2 text-sm leading-relaxed text-slate-400">{conv.summary}</p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-black text-slate-500">消息</p>
            <p className="mt-1 text-lg font-black text-white">{segments.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-black text-slate-500">工作</p>
            <p className="mt-1 text-lg font-black text-white">{candidates.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-black text-slate-500">待确认</p>
            <p className={cn("mt-1 text-lg font-black", pendingCandidates.length > 0 ? "text-amber-100" : "text-emerald-100")}>
              {pendingCandidates.length}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-600">
          <Clock3 className="h-3 w-3" />
          <span>{formatTime(conv.startedAt ?? conv.createdAt)}</span>
          <span>·</span>
          <span>更新 {formatTime(conv.updatedAt ?? conv.endedAt ?? conv.createdAt)}</span>
        </div>
      </section>

      {pendingCandidates.length > 0 && (
        <section data-testid="conversation-work-alert" className="mb-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-50">有工作结果需要你确认</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-50/70">
                小智已经从这段沟通里整理出 {pendingCandidates.length} 项可执行结果，确认后会继续回流到项目、智库或任务。
              </p>
            </div>
          </div>
        </section>
      )}

      <section data-testid="conversation-timeline" className="mb-5 space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs font-black text-slate-500">对话时间线</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-600">{segments.length} 条</span>
        </div>

        {segments.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-500">
            这段会话还没有可展示的文字记录。
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((segment) => (
              <SegmentBubble key={segment.id} segment={segment} />
            ))}
          </div>
        )}
      </section>

      <section data-testid="work-feedback-section" className="mb-5 space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs font-black text-slate-500">工作回流</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-600">{candidates.length} 项</span>
        </div>

        {pendingCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            convId={id}
            onMutated={() => qc.invalidateQueries({ queryKey: ["conversation-detail", id] })}
          />
        ))}

        {processedCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            convId={id}
            onMutated={() => qc.invalidateQueries({ queryKey: ["conversation-detail", id] })}
          />
        ))}

        {candidates.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-500">
            这段沟通暂时没有形成需要确认或回流的工作项。
          </div>
        )}
      </section>

      <section className="space-y-2 pb-4">
        <button
          type="button"
          data-testid="continue-conversation"
          onClick={() => setLocation(continueConversationPath)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 text-sm font-black text-white active:bg-violet-600"
        >
          <MessageCircle className="h-4 w-4" />
          继续和小智聊
        </button>
        <button
          type="button"
          data-testid="back-to-conversation-history"
          onClick={() => setLocation("/inbox")}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-slate-200 active:bg-white/10"
        >
          <Send className="h-4 w-4" />
          回到会话历史
        </button>
      </section>
    </SafeLayout>
  );
}
