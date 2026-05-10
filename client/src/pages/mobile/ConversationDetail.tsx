/**
 * ConversationDetail - 对话详情 + 候选项确认
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { CheckCircle2, XCircle, Edit3, ArrowUpRight, Brain, ListTodo, CalendarCheck, AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

// ── 类型 ──────────────────────────────────────────────

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
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  source: string;
  mode: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
}

// ── 工具 ─────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

function candidateIcon(type: string) {
  if (type === "task") return ListTodo;
  if (type === "memory") return Brain;
  if (type === "event") return CalendarCheck;
  return AlertCircle;
}

function candidateColor(type: string) {
  if (type === "task") return "border-blue-500/40 bg-blue-500/10 text-blue-400";
  if (type === "memory") return "border-purple-500/40 bg-purple-500/10 text-purple-400";
  if (type === "event") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  return "border-gray-500/40 bg-gray-500/10 text-gray-400";
}

function candidateLabel(type: string) {
  const map: Record<string, string> = { task: "任务候选", memory: "记忆候选", event: "事件候选" };
  return map[type] ?? type;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待确认", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
    accepted: { label: "已接受", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
    rejected: { label: "已拒绝", cls: "text-red-400 bg-red-400/10 border-red-400/30" },
    applied: { label: "已应用", cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
    edited: { label: "已编辑", cls: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  };
  const s = map[status] ?? { label: status, cls: "text-gray-400 bg-gray-400/10 border-gray-400/30" };
  return <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", s.cls)}>{s.label}</span>;
}

// ── 候选项卡片 ────────────────────────────────────────

function CandidateCard({ candidate, convId, onMutated }: {
  candidate: Candidate;
  convId: string;
  onMutated: () => void;
}) {
  const qc = useQueryClient();
  const Icon = candidateIcon(candidate.candidateType);
  const color = candidateColor(candidate.candidateType);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(
    JSON.stringify(candidate.content, null, 2)
  );

  const action = useMutation({
    mutationFn: ({ act, body }: { act: string; body?: object }) =>
      apiFetch(`/api/conversation-candidates/${candidate.id}/${act}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: (data, { act }) => {
      if (!data.success) { toast.error(data.error ?? "操作失败"); return; }
      const labels: Record<string, string> = { accept: "已接受", reject: "已拒绝", apply: "已应用", edit: "已保存修改" };
      toast.success(labels[act] ?? "已操作");
      qc.invalidateQueries({ queryKey: ["conversation-detail", convId] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox"] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox-counts"] });
      onMutated();
    },
    onError: () => toast.error("网络异常，请重试"),
  });

  const isPending = candidate.status === "pending";

  const handleSaveEdit = () => {
    try {
      const content = JSON.parse(editedContent);
      action.mutate({ act: "edit", body: { content } });
      setEditing(false);
    } catch {
      toast.error("JSON 格式错误");
    }
  };

  // 渲染内容摘要
  const content = candidate.content as any;
  const contentSummary = content.title ?? content.content ?? JSON.stringify(content);

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", color)}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold">{candidateLabel(candidate.candidateType)}</span>
            {statusBadge(candidate.status)}
            {candidate.riskLevel && candidate.riskLevel !== "low" && (
              <span className="text-[10px] text-orange-400 border border-orange-400/30 px-1.5 py-0.5 rounded-md">
                风险：{candidate.riskLevel}
              </span>
            )}
          </div>
          {!editing && (
            <p className="text-sm text-white/90 mt-2 leading-relaxed">
              {String(contentSummary).slice(0, 200)}
            </p>
          )}
          {content.description && (
            <p className="text-xs text-white/50 mt-1">{String(content.description).slice(0, 100)}</p>
          )}
        </div>
      </div>

      {editing && (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-xs text-white/80 font-mono resize-none h-32"
        />
      )}

      {isPending && (
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <>
              <button
                onClick={() => action.mutate({ act: "accept" })}
                disabled={action.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 接受
              </button>
              <button
                onClick={() => action.mutate({ act: "apply" })}
                disabled={action.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> 应用
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-gray-400 text-xs font-semibold active:scale-95 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" /> 编辑
              </button>
              <button
                onClick={() => action.mutate({ act: "reject" })}
                disabled={action.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> 拒绝
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 text-xs font-semibold active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 保存修改
              </button>
              <button
                onClick={() => { setEditing(false); setEditedContent(JSON.stringify(candidate.content, null, 2)); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-gray-400 text-xs font-semibold"
              >
                取消
              </button>
            </>
          )}
          {action.isPending && <Loader2 className="w-4 h-4 text-gray-400 animate-spin mt-1.5" />}
        </div>
      )}

      {candidate.linkedEntityId && (
        <p className="text-[10px] text-blue-400 border-t border-white/10 pt-2">
          已关联实体：{candidate.linkedEntityId}
        </p>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default function ConversationDetail({ params }: Props) {
  const { id } = params;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversation-detail", id],
    queryFn: () => apiFetch(`/api/conversations/${id}`),
    staleTime: 10_000,
  });

  const conv: ConversationDetail | undefined = data?.conversation;
  const segments: Segment[] = data?.segments ?? [];
  const candidates: Candidate[] = data?.candidates ?? [];

  const pendingCandidates = candidates.filter((c) => c.status === "pending");
  const doneCandidates = candidates.filter((c) => c.status !== "pending");

  if (isLoading) {
    return (
      <SafeLayout headerTitle="加载中…">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </SafeLayout>
    );
  }

  if (!conv) {
    return (
      <SafeLayout headerTitle="对话不存在">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-gray-500">找不到这段对话</p>
        </div>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout headerTitle={conv.title ?? "对话详情"}>
      {/* 对话摘要 */}
      {conv.summary && (
        <div className="mb-5 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
          <p className="text-xs text-indigo-400 font-semibold mb-1">摘要</p>
          <p className="text-sm text-white/80 leading-relaxed">{conv.summary}</p>
        </div>
      )}

      {/* 对话记录 */}
      {segments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">对话记录</h2>
          </div>
          <div className="space-y-2">
            {segments.map((seg) => {
              const isUser = seg.speakerType === "user" || seg.speaker === "user";
              return (
                <div
                  key={seg.id}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm leading-relaxed",
                    isUser
                      ? "bg-white/8 border border-white/10 text-white/80"
                      : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                  )}
                >
                  <span className={cn("text-[10px] font-bold mr-2", isUser ? "text-gray-500" : "text-indigo-400")}>
                    {isUser ? "你" : "领航者"}
                  </span>
                  {seg.text ?? "(无文字)"}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 待确认候选项 */}
      {pendingCandidates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/80">待确认</h2>
            <span className="text-xs text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-md">
              {pendingCandidates.length} 个
            </span>
          </div>
          <div className="space-y-3">
            {pendingCandidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                convId={id}
                onMutated={() => qc.invalidateQueries({ queryKey: ["conversation-detail", id] })}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已处理候选项 */}
      {doneCandidates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">已处理</h2>
          <div className="space-y-3 opacity-60">
            {doneCandidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                convId={id}
                onMutated={() => qc.invalidateQueries({ queryKey: ["conversation-detail", id] })}
              />
            ))}
          </div>
        </div>
      )}

      {candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <CheckCircle2 className="w-10 h-10 text-gray-600" />
          <p className="text-sm text-gray-500">这段对话没有待确认的候选项</p>
        </div>
      )}

      <div className="pb-4 text-center">
        <p className="text-[10px] text-gray-700">
          {format(new Date(conv.createdAt), "yyyy-MM-dd HH:mm")} · {conv.source}
        </p>
      </div>
    </SafeLayout>
  );
}
