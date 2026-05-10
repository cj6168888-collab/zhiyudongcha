import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Brain,
  Check,
  CircleDot,
  FileText,
  FolderKanban,
  Loader2,
  Monitor,
  Pencil,
  RefreshCw,
  Save,
  ScanLine,
  ShieldCheck,
  UserRound,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CapabilityRail,
  CommandComposer,
  NowStrip,
  StarterPromptList,
  XiaozhiBrief,
  XiaozhiStatusHeader,
  type CapabilityItem,
} from "@/components/mobile/conversation/ConversationHomeSections";
import { useAvatarStore } from "@/lib/avatar/avatar-store";
import { useBirthStore } from "@/lib/birth-state-store";
import { MAX_HP, useZ1Store } from "@/lib/z1/god-protocol";
import { useGlobalStore } from "@/store/globalStore";
import { useNativeVoice } from "@/hooks/use-native-voice";
import {
  approveAssistantAction,
  confirmAssistantDraft,
  denyAssistantAction,
  discardAssistantPending,
  formatExecutionSummary,
  getAssistantPendingSummary,
  sendAssistantMessage,
  updateAssistantDraft,
  type AssistantResponse,
  type DraftItem,
} from "@/lib/assistant-api";

interface HpBalanceResponse {
  success: boolean;
  data: {
    current: number;
    maximum: number;
    academicLevel: string;
  };
}

interface ModelStatusResponse {
  success: boolean;
  syncing?: boolean;
  progress?: number;
  currentModel?: string;
  localModel?: string;
  cloud?: {
    ready: boolean;
    availableProviders: string[];
  };
}

interface DeviceBinding {
  deviceId: string;
  deviceType: string;
  displayName: string | null;
  status: string;
  lastSeenAt: string | null;
}

interface DeviceBindingsResponse {
  success: boolean;
  devices: DeviceBinding[];
}

interface PendingConfirmation {
  responseId: string;
  message: string;
  reason?: string;
  action?: string;
}

interface PendingDraft {
  responseId: string;
  message: string;
  items: DraftItem[];
}

interface FailedSend {
  message: string;
  detail: string;
  attempts: number;
  createdAt: number;
}

type ActiveAction = "approve" | "deny" | "confirmDraft" | "denyDraft" | "saveDraft" | null;

const ACTION_META: Record<string, { label: string; icon: typeof FolderKanban }> = {
  create_project: { label: "项目", icon: FolderKanban },
  create_task: { label: "任务", icon: Check },
  save_memory: { label: "记忆", icon: Brain },
  create_person: { label: "联系人", icon: UserRound },
};

const starterPrompts = [
  "帮我整理今天最该推进的三件事",
  "把这段想法拆成项目和任务",
  "搜索智库里和合同风险有关的资料",
];

const capabilities: CapabilityItem[] = [
  { label: "项目", desc: "推进目标", path: "/projects", icon: FolderKanban, status: "可用" },
  { label: "人脉", desc: "关系档案", path: "/contacts", icon: Users2, status: "可用" },
  { label: "专家", desc: "多角度判断", path: "/experts", icon: Brain, status: "可用" },
  { label: "扫描", desc: "采集材料", path: "/scanner", icon: ScanLine, status: "实验" },
  { label: "远程", desc: "控制 PC", path: "/remote-pc", icon: Monitor, status: "需设备" },
  { label: "安全", desc: "权限与审计", path: "/security", icon: ShieldCheck, status: "可用" },
];

function normalizeAssistantName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === "小星") return "小智";
  return trimmed;
}

function hpTone(hpBalance: number) {
  const percent = hpBalance / MAX_HP;
  if (percent >= 0.6) return "text-emerald-300";
  if (percent >= 0.25) return "text-amber-300";
  return "text-red-300";
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function actionLabel(action?: string | null) {
  if (!action) return "待处理事项";
  return ACTION_META[action]?.label ?? action;
}

function titleFromParams(actionParams?: Record<string, unknown>) {
  return asText(actionParams?.title) ?? asText(actionParams?.name) ?? asText(actionParams?.fileName) ?? asText(actionParams?.content);
}

function describePendingAction(action?: string | null, actionParams?: Record<string, unknown>) {
  const title = titleFromParams(actionParams);
  return title
    ? `准备执行：${actionLabel(action)}「${title}」`
    : `准备执行：${actionLabel(action)}`;
}

function normalizeDraftItem(item: DraftItem): DraftItem {
  return {
    ...item,
    label: item.label || describePendingAction(item.action, item.actionParams),
  };
}

function errorDetail(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function cloneDraftItems(items: DraftItem[]) {
  return items.map((item) => ({
    ...item,
    actionParams: { ...item.actionParams },
  }));
}

function draftPrimaryField(action: DraftItem["action"]) {
  if (action === "create_task") return { key: "name", label: "任务名" };
  if (action === "save_memory") return { key: "content", label: "记忆内容" };
  if (action === "create_person") return { key: "name", label: "姓名" };
  return { key: "title", label: "项目名" };
}

function draftSecondaryField(action: DraftItem["action"]) {
  if (action === "create_project" || action === "create_task") return { key: "description", label: "说明" };
  if (action === "create_person") return { key: "role", label: "角色" };
  return null;
}

function draftItemLabel(item: DraftItem) {
  return describePendingAction(item.action, item.actionParams);
}

export default function ConversationHome() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { avatarConfig } = useBirthStore();
  const { messages, isProcessing, addMessage } = useAvatarStore();
  const {
    isListening: voiceListening,
    transcript: voiceTranscript,
    partialTranscript: voicePartialTranscript,
    isSupported: voiceSupported,
    error: voiceError,
    audioLevel: voiceAudioLevel,
    startListening,
    stopListening,
  } = useNativeVoice();
  const { hpBalance, role, serverNode, aiServices } = useZ1Store();
  const currentProject = useGlobalStore((s) => s.currentProject);
  const deviceHealth = useGlobalStore((s) => s.deviceHealth);

  const { data: hpStatus } = useQuery<HpBalanceResponse>({
    queryKey: ["/api/hp/balance"],
    refetchInterval: 30000,
  });

  const { data: modelStatus } = useQuery<ModelStatusResponse>({
    queryKey: ["/api/models/status"],
    refetchInterval: 30000,
  });

  const { data: deviceBindings } = useQuery<DeviceBindingsResponse>({
    queryKey: ["/api/device-bindings"],
    refetchInterval: 30000,
  });

  const { data: assistantPending } = useQuery({
    queryKey: ["assistant-pending-summary"],
    queryFn: getAssistantPendingSummary,
    refetchInterval: 15000,
  });

  const [inputText, setInputText] = useState("");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [draftEditing, setDraftEditing] = useState(false);
  const [draftEdits, setDraftEdits] = useState<DraftItem[]>([]);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const lastVoiceTranscriptRef = useRef("");

  const activeService = useMemo(
    () => aiServices.find((service) => service.isActive && service.isConfigured) ?? null,
    [aiServices]
  );
  const hpCurrent = hpStatus?.data?.current ?? hpBalance;
  const hpMax = hpStatus?.data?.maximum ?? MAX_HP;
  const hpPercent = Math.max(0, Math.min(100, Math.round((hpCurrent / hpMax) * 100)));
  const boundDevices = deviceBindings?.devices ?? [];
  const onlineBoundDevices = boundDevices.filter((device) => {
    if (device.status?.toUpperCase() === "ONLINE") return true;
    if (!device.lastSeenAt) return false;
    return Date.now() - new Date(device.lastSeenAt).getTime() < 60_000;
  });
  const hasNativeDeviceSignal = Boolean(deviceHealth) || serverNode.status === "CONNECTED";
  const deviceLabel = onlineBoundDevices.length > 0
    ? `在线 ${onlineBoundDevices.length}`
    : boundDevices.length > 0
      ? "已绑定"
      : hasNativeDeviceSignal
        ? "本机在线"
        : "未绑定";
  const deviceHealthy = onlineBoundDevices.length > 0 || hasNativeDeviceSignal;
  const localPendingCount = (pendingConfirmation ? 1 : 0) + (pendingDraft ? 1 : 0);
  const pendingCount = Math.max(assistantPending?.count ?? 0, localPendingCount);
  const isBusy = isProcessing || activeAction !== null;
  const brainLabel = modelStatus?.cloud?.ready
    ? `云端就绪 · ${modelStatus.cloud.availableProviders.length} 源`
    : modelStatus?.syncing
      ? `模型同步中 ${Math.round(modelStatus.progress ?? 0)}%`
      : activeService?.name ?? modelStatus?.currentModel ?? modelStatus?.localModel ?? "模型待配置";

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirmation, pendingDraft, failedSend, actionError, isProcessing]);

  useEffect(() => {
    useAvatarStore.getState().setListening(voiceListening);
  }, [voiceListening]);

  useEffect(() => {
    const transcript = voiceTranscript.trim();
    if (!transcript || transcript === lastVoiceTranscriptRef.current) return;

    lastVoiceTranscriptRef.current = transcript;
    setInputText((current) => {
      const trimmed = current.trim();
      if (!trimmed) return transcript;
      if (trimmed.includes(transcript)) return current;
      return `${trimmed}\n${transcript}`;
    });
    setVoiceNotice("语音已写入输入框");
  }, [voiceTranscript]);

  useEffect(() => {
    if (pendingConfirmation || pendingDraft) return;

    const firstPending = assistantPending?.pending?.[0];
    if (firstPending) {
      const message = describePendingAction(firstPending.action, firstPending.actionParams);
      setPendingConfirmation({
        responseId: firstPending.id,
        message,
        reason: message,
        action: firstPending.action ?? undefined,
      });
      setDraftEditing(false);
      setDraftEdits([]);
      setActionError(null);
      return;
    }

    const firstDraft = assistantPending?.draft?.find((item) => item.items?.length);
    if (firstDraft?.items?.length) {
      const items = firstDraft.items.map(normalizeDraftItem);
      setPendingDraft({
        responseId: firstDraft.id,
        message: `我恢复了一份待确认草案，共 ${firstDraft.items.length} 项。`,
        items,
      });
      setDraftEditing(false);
      setDraftEdits(cloneDraftItems(items));
      setActionError(null);
    }
  }, [assistantPending, pendingConfirmation, pendingDraft]);

  const appendAssistantResponse = (response: AssistantResponse, executionSummary?: string | null) => {
    const content = executionSummary ? `${response.message}\n\n${executionSummary}` : response.message;
    addMessage({ role: "assistant", content, timestamp: Date.now() });
    setFailedSend(null);
    setActionError(null);

    if (response.type === "confirm") {
      setPendingConfirmation({
        responseId: response.id,
        message: response.message,
        reason: response.authorization?.reason,
        action: response.action,
      });
      setPendingDraft(null);
      setDraftEditing(false);
      setDraftEdits([]);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      return;
    }

    if (response.type === "draft" && response.draftItems?.length) {
      const items = response.draftItems.map(normalizeDraftItem);
      setPendingDraft({
        responseId: response.id,
        message: response.message,
        items,
      });
      setPendingConfirmation(null);
      setDraftEditing(false);
      setDraftEdits(cloneDraftItems(items));
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      return;
    }

    setPendingConfirmation(null);
    setPendingDraft(null);
    setDraftEditing(false);
    setDraftEdits([]);
  };

  const handleSend = async (overrideText?: string, options?: { appendUser?: boolean }) => {
    const message = (overrideText ?? inputText).trim();
    if (!message || isBusy) return;

    if (options?.appendUser ?? true) {
      addMessage({ role: "user", content: message, timestamp: Date.now() });
    }
    setInputText("");
    setPendingConfirmation(null);
    setPendingDraft(null);
    setDraftEditing(false);
    setDraftEdits([]);
    setFailedSend(null);
    setActionError(null);

    try {
      useAvatarStore.getState().setProcessing(true);
      const result = await sendAssistantMessage(message);
      appendAssistantResponse(result.response, formatExecutionSummary(result.execution));
    } catch (error) {
      setFailedSend((current) => ({
        message,
        detail: errorDetail(error, "助手服务暂无响应"),
        attempts: current?.message === message ? current.attempts + 1 : 1,
        createdAt: Date.now(),
      }));
      setPendingConfirmation(null);
      setPendingDraft(null);
    } finally {
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleRetryFailedSend = () => {
    if (!failedSend) return;
    void handleSend(failedSend.message, { appendUser: false });
  };

  const handleRestoreFailedSend = () => {
    if (!failedSend) return;
    setInputText(failedSend.message);
    setFailedSend(null);
  };

  const handleApprove = async () => {
    if (!pendingConfirmation || isBusy) return;
    try {
      setActiveAction("approve");
      setActionError(null);
      useAvatarStore.getState().setProcessing(true);
      const result = await approveAssistantAction(pendingConfirmation.responseId);
      const summary = formatExecutionSummary(result.execution);
      addMessage({
        role: "assistant",
        content: summary ? `${result.message}\n\n${summary}` : result.message,
        timestamp: Date.now(),
      });
      setPendingConfirmation(null);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/hp/balance"] });
    } catch (error) {
      setActionError(`确认执行失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!pendingConfirmation || isBusy) return;
    try {
      setActiveAction("deny");
      setActionError(null);
      await denyAssistantAction(pendingConfirmation.responseId);
      addMessage({ role: "assistant", content: "好的，已取消这次执行。", timestamp: Date.now() });
      setPendingConfirmation(null);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
    } catch (error) {
      setActionError(`取消失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleConfirmDraft = async () => {
    if (!pendingDraft || isBusy) return;
    try {
      setActiveAction("confirmDraft");
      setActionError(null);
      useAvatarStore.getState().setProcessing(true);
      const result = await confirmAssistantDraft(pendingDraft.responseId);
      const succeeded = result.executions.filter((execution) => execution.success).length;
      const failed = result.executions.length - succeeded;
      addMessage({
        role: "assistant",
        content: failed > 0 ? `已完成 ${succeeded} 项，${failed} 项失败。` : `已完成全部 ${succeeded} 项。`,
        timestamp: Date.now(),
      });
      setPendingDraft(null);
      setDraftEditing(false);
      setDraftEdits([]);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/hp/balance"] });
    } catch (error) {
      setActionError(`草案执行失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDenyDraft = async () => {
    if (!pendingDraft || isBusy) return;
    try {
      setActiveAction("denyDraft");
      setActionError(null);
      await discardAssistantPending(pendingDraft.responseId);
      addMessage({ role: "assistant", content: "好的，已取消这份草案。", timestamp: Date.now() });
      setPendingDraft(null);
      setDraftEditing(false);
      setDraftEdits([]);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
    } catch (error) {
      setActionError(`取消草案失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleStartDraftEdit = () => {
    if (!pendingDraft || isBusy) return;
    setDraftEdits(cloneDraftItems(pendingDraft.items));
    setDraftEditing(true);
    setActionError(null);
  };

  const handleCancelDraftEdit = () => {
    if (!pendingDraft || isBusy) return;
    setDraftEdits(cloneDraftItems(pendingDraft.items));
    setDraftEditing(false);
    setActionError(null);
  };

  const handleDraftFieldChange = (index: number, key: string, value: string) => {
    setDraftEdits((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const actionParams = { ...item.actionParams, [key]: value };
        return {
          ...item,
          label: draftItemLabel({ ...item, actionParams }),
          actionParams,
        };
      }),
    );
  };

  const handleSaveDraftEdits = async () => {
    if (!pendingDraft || isBusy) return;
    const items = draftEdits.map(normalizeDraftItem);
    try {
      setActiveAction("saveDraft");
      setActionError(null);
      const result = await updateAssistantDraft(pendingDraft.responseId, items);
      const updatedItems = (result.draft.items ?? items).map(normalizeDraftItem);
      setPendingDraft({ ...pendingDraft, items: updatedItems });
      setDraftEdits(cloneDraftItems(updatedItems));
      setDraftEditing(false);
      addMessage({ role: "assistant", content: `已保存草案修改，共 ${updatedItems.length} 项。`, timestamp: Date.now() });
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
    } catch (error) {
      setActionError(`草案保存失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleToggleVoice = async () => {
    if (isBusy && !voiceListening) return;

    if (!voiceSupported) {
      setVoiceNotice("当前环境不支持语音输入");
      return;
    }

    try {
      setVoiceNotice(null);
      if (voiceListening) {
        await stopListening();
      } else {
        lastVoiceTranscriptRef.current = "";
        await startListening();
      }
    } catch (error) {
      setVoiceNotice(errorDetail(error, "语音输入启动失败"));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#030712] text-white">
      <div className="h-[env(safe-area-inset-top,20px)] flex-shrink-0 bg-[#030712]" />

      <XiaozhiStatusHeader
        avatarName={normalizeAssistantName(avatarConfig.name)}
        brainLabel={brainLabel}
        role={role}
        isProcessing={isProcessing}
        hpPercent={hpPercent}
        hpToneClass={hpTone(hpCurrent)}
        deviceLabel={deviceLabel}
        deviceHealthy={deviceHealthy}
        onOpenNavigator={() => setLocation("/navigator-command")}
      />

      <main className="flex-1 overflow-y-auto px-4 py-3">
        <NowStrip
          currentProjectTitle={currentProject?.title ?? null}
          pendingCount={pendingCount}
          onOpenContext={() => currentProject && setLocation("/projects")}
          onOpenPending={() => pendingCount > 0 && streamEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          onOpenTasks={() => setLocation("/tasks")}
        />

        <XiaozhiBrief />

        {messages.length === 0 && (
          <StarterPromptList prompts={starterPrompts} onSelect={setInputText} />
        )}

        <section className="mt-4 space-y-3">
          {messages.map((msg, index) => (
            <div key={`${msg.timestamp}-${index}`} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "rounded-tr-md bg-violet-500 text-white"
                    : "rounded-tl-md border border-white/10 bg-white/[0.06] text-slate-100"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                  小智正在理解...
                </div>
              </div>
            </div>
          )}

          {failedSend && (
            <div className="rounded-lg border border-red-300/25 bg-red-300/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-red-100">消息没有送达</p>
                  <p className="mt-1 text-xs leading-relaxed text-red-50/75">
                    已保留这条请求，可以直接重试或放回输入框修改。
                  </p>
                  <p className="mt-2 line-clamp-2 rounded-md bg-black/20 px-2.5 py-2 text-xs text-red-50/80">
                    {failedSend.message}
                  </p>
                  <p className="mt-1 text-[10px] text-red-100/50">
                    {failedSend.detail} · 第 {failedSend.attempts} 次失败
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="h-9 bg-red-500 text-xs hover:bg-red-600" onClick={handleRetryFailedSend} disabled={isBusy}>
                      {isProcessing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      重试发送
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleRestoreFailedSend} disabled={isBusy}>
                      放回输入
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingConfirmation && (
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-amber-100">需要确认后执行</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-50/80">
                    {pendingConfirmation.reason || pendingConfirmation.message}
                  </p>
                  {pendingConfirmation.action && (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-200/70">
                      动作：{pendingConfirmation.action}
                    </p>
                  )}
                  {assistantPending?.count && assistantPending.count > 1 && (
                    <p className="mt-1 text-[10px] text-amber-100/55">
                      队列中还有 {assistantPending.count - 1} 项待处理。
                    </p>
                  )}
                  {actionError && (
                    <p className="mt-2 rounded-md border border-red-300/20 bg-red-300/10 px-2.5 py-2 text-xs text-red-100">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="h-9 bg-emerald-500 text-xs hover:bg-emerald-600" onClick={handleApprove} disabled={isBusy}>
                      {activeAction === "approve" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                      确认执行
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleDeny} disabled={isBusy}>
                      {activeAction === "deny" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingDraft && (
            <div className="rounded-lg border border-blue-300/25 bg-blue-300/10 p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-blue-100">草案待确认</p>
                  <p className="mt-1 text-xs text-blue-50/75">我整理了 {pendingDraft.items.length} 项，确认后一并写入或执行。</p>
                  {assistantPending?.count && assistantPending.count > 1 && (
                    <p className="mt-1 text-[10px] text-blue-100/55">
                      队列中还有 {assistantPending.count - 1} 项待处理。
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {(draftEditing ? draftEdits : pendingDraft.items).map((item, index) => {
                      const meta = ACTION_META[item.action] ?? { label: item.action, icon: CircleDot };
                      const Icon = meta.icon;
                      const primary = draftPrimaryField(item.action);
                      const secondary = draftSecondaryField(item.action);
                      return (
                        <div key={`${item.action}-${index}`} className="rounded-md bg-black/20 px-2.5 py-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-blue-200" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-white">{item.label}</p>
                              <p className="text-[10px] text-blue-100/50">{meta.label}</p>
                            </div>
                          </div>
                          {draftEditing && (
                            <div className="mt-2 space-y-2">
                              <label className="block">
                                <span className="text-[10px] font-bold text-blue-100/60">{primary.label}</span>
                                <input
                                  value={String(item.actionParams[primary.key] ?? "")}
                                  onChange={(event) => handleDraftFieldChange(index, primary.key, event.target.value)}
                                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-white/[0.06] px-2.5 text-xs text-white outline-none focus:border-blue-300/40"
                                />
                              </label>
                              {secondary && (
                                <label className="block">
                                  <span className="text-[10px] font-bold text-blue-100/60">{secondary.label}</span>
                                  <textarea
                                    value={String(item.actionParams[secondary.key] ?? "")}
                                    onChange={(event) => handleDraftFieldChange(index, secondary.key, event.target.value)}
                                    rows={2}
                                    className="mt-1 w-full resize-none rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs text-white outline-none focus:border-blue-300/40"
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {actionError && (
                    <p className="mt-3 rounded-md border border-red-300/20 bg-red-300/10 px-2.5 py-2 text-xs text-red-100">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draftEditing ? (
                      <>
                        <Button size="sm" className="h-9 bg-blue-500 text-xs hover:bg-blue-600" onClick={handleSaveDraftEdits} disabled={isBusy}>
                          {activeAction === "saveDraft" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                          保存修改
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleCancelDraftEdit} disabled={isBusy}>
                          <X className="mr-1 h-3.5 w-3.5" />
                          放弃
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" className="h-9 bg-blue-500 text-xs hover:bg-blue-600" onClick={handleConfirmDraft} disabled={isBusy}>
                          {activeAction === "confirmDraft" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                          全部执行
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleStartDraftEdit} disabled={isBusy}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          修改
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleDenyDraft} disabled={isBusy}>
                          {activeAction === "denyDraft" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
                          取消
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={streamEndRef} />
        </section>

        <CapabilityRail
          capabilities={capabilities}
          onOpenAll={() => setLocation("/navigator-command")}
          onNavigate={setLocation}
        />
      </main>

      <CommandComposer
        inputText={inputText}
        voiceActive={voiceListening}
        voiceSupported={voiceSupported}
        voiceInterimText={voicePartialTranscript}
        voiceNotice={voiceError || voiceNotice}
        voiceAudioLevel={voiceAudioLevel}
        isProcessing={isBusy}
        onInputChange={setInputText}
        onToggleVoice={() => void handleToggleVoice()}
        onAttach={() => setLocation("/scanner")}
        onSend={() => handleSend()}
      />
    </div>
  );
}
