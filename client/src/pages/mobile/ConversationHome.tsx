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
import { useNetworkStatus } from "@/hooks/use-device-info";
import { apiRequest } from "@/lib/queryClient";
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

interface TaskDefinitionSummary {
  id: string;
  name: string;
  enabled: boolean;
  trigger?: {
    type?: "CRON" | "HEARTBEAT" | "MANUAL" | "WEBHOOK";
    config?: Record<string, unknown>;
  };
  nextRunAt?: number;
  updatedAt?: number;
}

interface TaskSummaryResponse {
  success: boolean;
  count: number;
  data: TaskDefinitionSummary[];
}

interface PendingAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp?: number;
  createdAt?: string | number;
}

interface PendingAlertsResponse {
  success: boolean;
  count: number;
  data: PendingAlert[];
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

interface PendingQueueItem {
  id: string;
  kind: "pending" | "draft";
  label: string;
  meta: string;
  itemCount?: number;
}

interface LocalConversationHomeState {
  inputText?: string;
  failedSend?: FailedSend | null;
  activeDraft?: {
    responseId: string;
    items: DraftItem[];
    editing: boolean;
    updatedAt: number;
  } | null;
  updatedAt: number;
}

const ACTION_META: Record<string, { label: string; icon: typeof FolderKanban }> = {
  create_project: { label: "项目", icon: FolderKanban },
  create_task: { label: "任务", icon: Check },
  save_memory: { label: "记忆", icon: Brain },
  create_person: { label: "联系人", icon: UserRound },
};

const LOCAL_STATE_KEY = "navigator.mobile.conversation-home.local-state.v1";
const LOCAL_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

function draftQueueLabel(items?: DraftItem[]) {
  const firstItem = items?.[0];
  if (!firstItem) return "待确认草案";
  return firstItem.label || describePendingAction(firstItem.action, firstItem.actionParams);
}

const TRIGGER_LABELS: Record<string, string> = {
  CRON: "定时任务",
  HEARTBEAT: "心跳任务",
  MANUAL: "手动任务",
  WEBHOOK: "Webhook",
};

const ALERT_SEVERITY_PRIORITY: Record<PendingAlert["severity"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const ALERT_SEVERITY_LABEL: Record<PendingAlert["severity"], string> = {
  CRITICAL: "高危风险",
  HIGH: "高优先风险",
  MEDIUM: "提醒",
  LOW: "观察",
};

function sortAlertsByPriority(alerts: PendingAlert[]) {
  return [...alerts].sort((left, right) => {
    const severityDiff = ALERT_SEVERITY_PRIORITY[left.severity] - ALERT_SEVERITY_PRIORITY[right.severity];
    if (severityDiff !== 0) return severityDiff;

    const leftTime = Number(left.timestamp ?? left.createdAt ?? 0);
    const rightTime = Number(right.timestamp ?? right.createdAt ?? 0);
    return rightTime - leftTime;
  });
}

function formatTriggerLabel(triggerType?: string) {
  if (!triggerType) return "等待配置";
  return TRIGGER_LABELS[triggerType] ?? triggerType;
}

function describeCronExpression(expression?: unknown) {
  if (typeof expression !== "string" || !expression.trim()) return "未配置时间";
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [minute, hour, , , weekday] = parts;
  if (minute === "0" && hour === "*") return "每小时";
  if (minute === "0" && hour === "0") return "每天午夜";
  if (minute === "0" && hour === "9" && weekday === "1") return "每周一 09:00";
  if (minute === "0" && hour !== "*") return `每天 ${hour.padStart(2, "0")}:00`;
  return expression;
}

function formatNextReminderTime(timestamp?: number) {
  if (!timestamp) return "暂无安排";

  const delta = timestamp - Date.now();
  if (delta <= 0) return "即将触发";

  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes} 分钟后`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isDraftItemArray(value: unknown): value is DraftItem[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<DraftItem>;
    return typeof candidate.action === "string" && typeof candidate.actionParams === "object" && candidate.actionParams !== null;
  });
}

function readLocalConversationHomeState(): LocalConversationHomeState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalConversationHomeState>;
    if (typeof parsed.updatedAt !== "number" || Date.now() - parsed.updatedAt > LOCAL_STATE_MAX_AGE_MS) {
      window.localStorage.removeItem(LOCAL_STATE_KEY);
      return null;
    }

    const inputText = typeof parsed.inputText === "string" ? parsed.inputText : "";
    const failedSend = parsed.failedSend && typeof parsed.failedSend.message === "string"
      ? {
          message: parsed.failedSend.message,
          detail: typeof parsed.failedSend.detail === "string" ? parsed.failedSend.detail : "待重新发送",
          attempts: typeof parsed.failedSend.attempts === "number" ? parsed.failedSend.attempts : 1,
          createdAt: typeof parsed.failedSend.createdAt === "number" ? parsed.failedSend.createdAt : Date.now(),
        }
      : null;
    const activeDraft = parsed.activeDraft &&
      typeof parsed.activeDraft.responseId === "string" &&
      isDraftItemArray(parsed.activeDraft.items)
      ? {
          responseId: parsed.activeDraft.responseId,
          items: parsed.activeDraft.items,
          editing: parsed.activeDraft.editing === true,
          updatedAt: typeof parsed.activeDraft.updatedAt === "number" ? parsed.activeDraft.updatedAt : parsed.updatedAt,
        }
      : null;

    return {
      inputText,
      failedSend,
      activeDraft,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    window.localStorage.removeItem(LOCAL_STATE_KEY);
    return null;
  }
}

function writeLocalConversationHomeState(state: Omit<LocalConversationHomeState, "updatedAt">) {
  if (typeof window === "undefined") return;

  const hasInput = Boolean(state.inputText?.trim());
  const hasFailedSend = Boolean(state.failedSend?.message?.trim());
  const hasActiveDraft = Boolean(state.activeDraft?.responseId && state.activeDraft.items.length);

  if (!hasInput && !hasFailedSend && !hasActiveDraft) {
    window.localStorage.removeItem(LOCAL_STATE_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({
    ...state,
    updatedAt: Date.now(),
  }));
}

export default function ConversationHome() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const networkStatus = useNetworkStatus();
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

  const {
    data: hpStatus,
    isLoading: hpLoading,
    isError: hpError,
  } = useQuery<HpBalanceResponse>({
    queryKey: ["/api/hp/balance"],
    refetchInterval: 30000,
  });

  const {
    data: modelStatus,
    isLoading: modelLoading,
    isError: modelError,
  } = useQuery<ModelStatusResponse>({
    queryKey: ["/api/models/status"],
    refetchInterval: 30000,
  });

  const {
    data: deviceBindings,
    isLoading: deviceBindingsLoading,
    isError: deviceBindingsError,
  } = useQuery<DeviceBindingsResponse>({
    queryKey: ["/api/device-bindings"],
    refetchInterval: 30000,
  });

  const {
    data: assistantPending,
    isError: assistantPendingError,
  } = useQuery({
    queryKey: ["assistant-pending-summary"],
    queryFn: getAssistantPendingSummary,
    refetchInterval: 15000,
  });

  const {
    data: taskSummary,
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery<TaskSummaryResponse>({
    queryKey: ["conversation-home-tasks"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tasks");
      return await response.json();
    },
    refetchInterval: 30000,
  });

  const {
    data: alertSummary,
    isLoading: alertsLoading,
    isError: alertsError,
  } = useQuery<PendingAlertsResponse>({
    queryKey: ["conversation-home-alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/alerts/pending?limit=5");
      return await response.json();
    },
    refetchInterval: 30000,
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
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null);
  const [consumedPendingIds, setConsumedPendingIds] = useState<string[]>([]);
  const [localStateHydrated, setLocalStateHydrated] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const lastVoiceTranscriptRef = useRef("");
  const retainedActiveDraftRef = useRef<LocalConversationHomeState["activeDraft"]>(null);

  const activeService = useMemo(
    () => aiServices.find((service) => service.isActive && service.isConfigured) ?? null,
    [aiServices]
  );
  const hpCurrent = hpStatus?.data?.current ?? hpBalance;
  const hpMax = hpStatus?.data?.maximum ?? MAX_HP;
  const hpPercent = Math.max(0, Math.min(100, Math.round((hpCurrent / hpMax) * 100)));
  const isOffline = networkStatus === "offline";
  const boundDevices = deviceBindings?.devices ?? [];
  const tasks = taskSummary?.data ?? [];
  const enabledTasks = tasks.filter((task) => task.enabled);
  const nextAutomation = enabledTasks[0] ?? null;
  const nextReminderTask = enabledTasks
    .filter((task) => typeof task.nextRunAt === "number" && task.nextRunAt > Date.now())
    .sort((left, right) => (left.nextRunAt ?? 0) - (right.nextRunAt ?? 0))[0] ?? null;
  const fallbackScheduledTask = enabledTasks.find((task) => task.trigger?.type === "CRON") ?? nextAutomation;
  const pendingAlerts = sortAlertsByPriority(alertSummary?.data ?? []);
  const highestPendingAlert = pendingAlerts[0] ?? null;
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
  const headerLoading = !hpStatus && !modelStatus && !deviceBindings && (hpLoading || modelLoading || deviceBindingsLoading);
  const summaryLoading = (tasksLoading && !taskSummary) || (alertsLoading && !alertSummary);
  const backendDegraded = isOffline || hpError || modelError || deviceBindingsError || assistantPendingError || tasksError || alertsError;
  const deviceSetupNeeded = !deviceHealthy && !deviceBindingsLoading;
  const automationLabel = enabledTasks.length > 0
    ? nextAutomation
      ? `${formatTriggerLabel(nextAutomation.trigger?.type)} · ${nextAutomation.name}`
      : "已启用"
    : "去查看";
  const nextReminderLabel = nextReminderTask
    ? formatNextReminderTime(nextReminderTask.nextRunAt)
    : fallbackScheduledTask?.trigger?.type === "CRON"
      ? describeCronExpression(fallbackScheduledTask.trigger.config?.expression)
      : "暂无安排";
  const nextReminderDetail = nextReminderTask
    ? nextReminderTask.name
    : fallbackScheduledTask
      ? `${formatTriggerLabel(fallbackScheduledTask.trigger?.type)} · ${fallbackScheduledTask.name}`
      : "去任务中心创建提醒";
  const noticeTitle = highestPendingAlert
    ? `${ALERT_SEVERITY_LABEL[highestPendingAlert.severity]} · ${highestPendingAlert.title}`
    : enabledTasks.length > 0
      ? `已启用 ${enabledTasks.length} 个自动化任务`
      : null;
  const noticeDetail = highestPendingAlert
    ? highestPendingAlert.message
    : nextAutomation
      ? `${formatTriggerLabel(nextAutomation.trigger?.type)} 已待命，可前往任务中心查看执行细节。`
      : null;
  const noticeTone = highestPendingAlert
    ? (highestPendingAlert.severity === "CRITICAL" || highestPendingAlert.severity === "HIGH" ? "danger" : "warning")
    : "info";
  const rawPendingQueue = useMemo<PendingQueueItem[]>(() => {
    const pending = (assistantPending?.pending ?? []).map((item) => ({
      id: item.id,
      kind: "pending" as const,
      label: describePendingAction(item.action, item.actionParams),
      meta: actionLabel(item.action),
    }));
    const drafts = (assistantPending?.draft ?? [])
      .filter((item) => item.items?.length)
      .map((item) => {
        const items = item.items?.map(normalizeDraftItem) ?? [];
        return {
          id: item.id,
          kind: "draft" as const,
          label: draftQueueLabel(items),
          meta: `草案 · ${items.length} 项`,
          itemCount: items.length,
        };
      });
    return [...pending, ...drafts];
  }, [assistantPending]);
  const pendingQueue = useMemo(
    () => rawPendingQueue.filter((item) => !consumedPendingIds.includes(item.id)),
    [rawPendingQueue, consumedPendingIds],
  );
  const localPendingCount = (pendingConfirmation ? 1 : 0) + (pendingDraft ? 1 : 0);
  const pendingCount = Math.max(pendingQueue.length, localPendingCount);
  const isBusy = isProcessing || activeAction !== null;
  const brainLabel = modelStatus?.cloud?.ready
    ? `云端就绪 · ${modelStatus.cloud.availableProviders.length} 源`
    : modelStatus?.syncing
      ? `模型同步中 ${Math.round(modelStatus.progress ?? 0)}%`
      : activeService?.name ?? modelStatus?.currentModel ?? modelStatus?.localModel ?? "模型待配置";

  useEffect(() => {
    const localState = readLocalConversationHomeState();
    if (localState?.inputText) setInputText(localState.inputText);
    if (localState?.failedSend) setFailedSend(localState.failedSend);
    retainedActiveDraftRef.current = localState?.activeDraft ?? null;
    setLocalStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!localStateHydrated) return;

    const activeDraft = pendingDraft && draftEditing
      ? {
          responseId: pendingDraft.responseId,
          items: draftEdits.map(normalizeDraftItem),
          editing: true,
          updatedAt: Date.now(),
        }
      : pendingDraft
        ? null
        : retainedActiveDraftRef.current;

    retainedActiveDraftRef.current = activeDraft;

    writeLocalConversationHomeState({
      inputText,
      failedSend,
      activeDraft,
    });
  }, [draftEditing, draftEdits, failedSend, inputText, localStateHydrated, pendingDraft]);

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

  const restoreDraftEdits = (responseId: string, items: DraftItem[]) => {
    const activeDraft = retainedActiveDraftRef.current;
    if (activeDraft?.responseId !== responseId) {
      return {
        edits: cloneDraftItems(items),
        editing: false,
      };
    }

    return {
      edits: activeDraft.items.map(normalizeDraftItem),
      editing: activeDraft.editing,
    };
  };

  const selectPendingQueueItem = (responseId: string) => {
    if (isBusy) return;

    const pendingItem = assistantPending?.pending?.find((item) => item.id === responseId);
    if (pendingItem) {
      const message = describePendingAction(pendingItem.action, pendingItem.actionParams);
      setSelectedPendingId(responseId);
      setPendingConfirmation({
        responseId: pendingItem.id,
        message,
        reason: message,
        action: pendingItem.action ?? undefined,
      });
      setPendingDraft(null);
      setDraftEditing(false);
      setDraftEdits([]);
      setActionError(null);
      return;
    }

    const draftItem = assistantPending?.draft?.find((item) => item.id === responseId && item.items?.length);
    if (draftItem?.items?.length) {
      const items = draftItem.items.map(normalizeDraftItem);
      const restored = restoreDraftEdits(draftItem.id, items);
      setSelectedPendingId(responseId);
      setPendingDraft({
        responseId: draftItem.id,
        message: `我恢复了一份待确认草案，共 ${draftItem.items.length} 项。`,
        items,
      });
      setPendingConfirmation(null);
      setDraftEditing(restored.editing);
      setDraftEdits(restored.edits);
      setActionError(null);
    }
  };

  const consumePendingItem = (responseId: string) => {
    setConsumedPendingIds((current) => current.includes(responseId) ? current : [...current, responseId]);
    setSelectedPendingId((current) => current === responseId ? null : current);
  };

  useEffect(() => {
    setConsumedPendingIds((current) => {
      const activeIds = new Set(rawPendingQueue.map((item) => item.id));
      const next = current.filter((id) => activeIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [rawPendingQueue]);

  useEffect(() => {
    const activeResponseId = pendingConfirmation?.responseId ?? pendingDraft?.responseId ?? null;
    if (activeResponseId && pendingQueue.some((item) => item.id === activeResponseId)) {
      if (selectedPendingId !== activeResponseId) setSelectedPendingId(activeResponseId);
      return;
    }

    if (activeResponseId && !rawPendingQueue.some((item) => item.id === activeResponseId)) {
      return;
    }

    const firstQueueItem = pendingQueue[0];
    if (!firstQueueItem) {
      setSelectedPendingId(null);
      return;
    }

    const firstPending = assistantPending?.pending?.find((item) => item.id === firstQueueItem.id);
    if (firstPending) {
      const message = describePendingAction(firstPending.action, firstPending.actionParams);
      setSelectedPendingId(firstPending.id);
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

    const firstDraft = assistantPending?.draft?.find((item) => item.id === firstQueueItem.id && item.items?.length);
    if (firstDraft?.items?.length) {
      const items = firstDraft.items.map(normalizeDraftItem);
      const restored = restoreDraftEdits(firstDraft.id, items);
      setSelectedPendingId(firstDraft.id);
      setPendingDraft({
        responseId: firstDraft.id,
        message: `我恢复了一份待确认草案，共 ${firstDraft.items.length} 项。`,
        items,
      });
      setDraftEditing(restored.editing);
      setDraftEdits(restored.edits);
      setActionError(null);
    }
  }, [assistantPending, pendingConfirmation, pendingDraft, pendingQueue, rawPendingQueue, selectedPendingId]);

  useEffect(() => {
    if (!localStateHydrated || !assistantPending || pendingDraft) return;
    const activeDraft = retainedActiveDraftRef.current;
    if (!activeDraft) return;

    const draftStillPending = assistantPending.draft?.some((item) =>
      item.id === activeDraft.responseId && item.items?.length
    );
    if (draftStillPending) return;

    retainedActiveDraftRef.current = null;
    writeLocalConversationHomeState({
      inputText,
      failedSend,
      activeDraft: null,
    });
  }, [assistantPending, failedSend, inputText, localStateHydrated, pendingDraft]);

  const appendAssistantResponse = (response: AssistantResponse, executionSummary?: string | null) => {
    const content = executionSummary ? `${response.message}\n\n${executionSummary}` : response.message;
    addMessage({ role: "assistant", content, timestamp: Date.now() });
    setFailedSend(null);
    setActionError(null);
    retainedActiveDraftRef.current = null;

    if (response.type === "confirm") {
      setSelectedPendingId(response.id);
      setConsumedPendingIds((current) => current.filter((id) => id !== response.id));
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
      setSelectedPendingId(response.id);
      setConsumedPendingIds((current) => current.filter((id) => id !== response.id));
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
    setSelectedPendingId(null);
    setDraftEditing(false);
    setDraftEdits([]);
  };

  const requireBackendConnection = (message: string) => {
    if (!isOffline) return true;
    setActionError(message);
    return false;
  };

  const handleSend = async (overrideText?: string, options?: { appendUser?: boolean }) => {
    const message = (overrideText ?? inputText).trim();
    if (!message || isBusy) return;
    const retainedFailure = options?.appendUser === false && failedSend?.message === message ? failedSend : null;
    const nextAttempt = retainedFailure ? retainedFailure.attempts + 1 : 1;
    const failedAt = retainedFailure?.createdAt ?? Date.now();

    if (options?.appendUser ?? true) {
      addMessage({ role: "user", content: message, timestamp: Date.now() });
    }
    setInputText("");
    setPendingConfirmation(null);
    setPendingDraft(null);
    setSelectedPendingId(null);
    setDraftEditing(false);
    setDraftEdits([]);
    setFailedSend(null);
    setActionError(null);

    if (isOffline) {
      setFailedSend({
        message,
        detail: "当前离线，我先替你保留这条请求",
        attempts: nextAttempt,
        createdAt: failedAt,
      });
      return;
    }

    try {
      useAvatarStore.getState().setProcessing(true);
      const result = await sendAssistantMessage(message);
      appendAssistantResponse(result.response, formatExecutionSummary(result.execution));
    } catch (error) {
      setFailedSend((current) => ({
        message,
        detail: errorDetail(error, "助手服务暂无响应"),
        attempts: current?.message === message ? current.attempts + 1 : nextAttempt,
        createdAt: current?.message === message ? current.createdAt : failedAt,
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

  const handleDismissFailedSend = () => {
    setFailedSend(null);
    setActionError(null);
  };

  const handleApprove = async () => {
    if (!pendingConfirmation || isBusy) return;
    if (!requireBackendConnection("当前离线，恢复连接后再确认执行。")) return;
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
      consumePendingItem(pendingConfirmation.responseId);
      setPendingConfirmation(null);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/hp/balance"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-home-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-home-alerts"] });
    } catch (error) {
      setActionError(`确认执行失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!pendingConfirmation || isBusy) return;
    if (!requireBackendConnection("当前离线，恢复连接后再取消这项执行。")) return;
    try {
      setActiveAction("deny");
      setActionError(null);
      await denyAssistantAction(pendingConfirmation.responseId);
      addMessage({ role: "assistant", content: "好的，已取消这次执行。", timestamp: Date.now() });
      consumePendingItem(pendingConfirmation.responseId);
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
    if (!requireBackendConnection("当前离线，恢复连接后再执行这份草稿。")) return;
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
      consumePendingItem(pendingDraft.responseId);
      retainedActiveDraftRef.current = null;
      setPendingDraft(null);
      setDraftEditing(false);
      setDraftEdits([]);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/hp/balance"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-home-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-home-alerts"] });
    } catch (error) {
      setActionError(`草案执行失败：${errorDetail(error, "请稍后重试")}`);
    } finally {
      setActiveAction(null);
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDenyDraft = async () => {
    if (!pendingDraft || isBusy) return;
    if (!requireBackendConnection("当前离线，恢复连接后再取消这份草稿。")) return;
    try {
      setActiveAction("denyDraft");
      setActionError(null);
      await discardAssistantPending(pendingDraft.responseId);
      addMessage({ role: "assistant", content: "好的，已取消这份草案。", timestamp: Date.now() });
      consumePendingItem(pendingDraft.responseId);
      retainedActiveDraftRef.current = null;
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
    if (!requireBackendConnection("当前离线，恢复连接后再保存草稿修改。")) return;
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
        loading={headerLoading}
        onOpenNavigator={() => setLocation("/navigator-command")}
      />

      <main className="flex-1 overflow-y-auto px-4 py-3">
        <NowStrip
          currentProjectTitle={currentProject?.title ?? null}
          pendingCount={pendingCount}
          automationCount={enabledTasks.length}
          automationLabel={automationLabel}
          nextReminderLabel={nextReminderLabel}
          nextReminderDetail={nextReminderDetail}
          noticeTitle={noticeTitle}
          noticeDetail={noticeDetail}
          noticeTone={noticeTone}
          loading={summaryLoading}
          onOpenContext={() => currentProject && setLocation("/projects")}
          onOpenPending={() => pendingCount > 0 && streamEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          onOpenTasks={() => setLocation("/tasks")}
        />

        {backendDegraded && (
          <section data-testid="backend-degraded-card" className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <div className="min-w-0 flex-1">
                <p data-testid="backend-degraded-title" className="text-xs font-black text-amber-100">
                  {isOffline ? "当前离线，执行确认暂不可用" : "服务状态同步异常"}
                </p>
                <p data-testid="backend-degraded-detail" className="mt-1 text-[11px] leading-relaxed text-amber-50/80">
                  {isOffline
                    ? "我会保留你的输入，等连接恢复后可以直接重试发送、确认或保存草稿。"
                    : "首页部分状态暂时没有同步成功，你仍可继续浏览，稍后再尝试执行需要服务器确认的操作。"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    data-testid="backend-degraded-action"
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs"
                    onClick={() => setLocation("/navigator-settings")}
                  >
                    检查连接
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {deviceSetupNeeded && (
          <section data-testid="device-setup-card" className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-3">
            <div className="flex items-start gap-2">
              <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-sky-100">设备协同尚未完成配置</p>
                <p className="mt-1 text-[11px] leading-relaxed text-sky-50/80">
                  现在可以继续聊天和整理草稿，但远程控制、设备联动和更可靠的执行回流还需要先绑定设备。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    data-testid="device-setup-action"
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs"
                    onClick={() => setLocation("/devices")}
                  >
                    去绑定设备
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

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
            <div data-testid="failed-send-card" className="rounded-lg border border-red-300/25 bg-red-300/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-red-100">消息没有送达</p>
                  <p className="mt-1 text-xs leading-relaxed text-red-50/75">
                    已保留这条请求，可以直接重试、放回输入框修改，或不再保留。
                  </p>
                  <p className="mt-2 line-clamp-2 rounded-md bg-black/20 px-2.5 py-2 text-xs text-red-50/80">
                    {failedSend.message}
                  </p>
                  <p className="mt-1 text-[10px] text-red-100/50">
                    {failedSend.detail} · 第 {failedSend.attempts} 次失败
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button data-testid="failed-send-retry" size="sm" className="h-9 bg-red-500 text-xs hover:bg-red-600" onClick={handleRetryFailedSend} disabled={isBusy}>
                      {isProcessing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      重试发送
                    </Button>
                    <Button data-testid="failed-send-restore" size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleRestoreFailedSend} disabled={isBusy}>
                      放回输入
                    </Button>
                    <Button data-testid="failed-send-dismiss" size="sm" variant="ghost" className="h-9 text-xs text-red-50/70 hover:bg-white/5 hover:text-red-50" onClick={handleDismissFailedSend} disabled={isBusy}>
                      不再保留
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingQueue.length > 1 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-slate-300">待确认队列</p>
                <p className="text-[10px] text-slate-500">{pendingQueue.length} 项</p>
              </div>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                {pendingQueue.map((item, index) => {
                  const active = item.id === selectedPendingId || item.id === pendingConfirmation?.responseId || item.id === pendingDraft?.responseId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectPendingQueueItem(item.id)}
                      disabled={isBusy}
                      className={cn(
                        "w-36 shrink-0 rounded-lg border px-2.5 py-2 text-left active:bg-white/10 disabled:opacity-60",
                        active
                          ? "border-violet-300/40 bg-violet-300/15"
                          : "border-white/10 bg-black/20"
                      )}
                    >
                      <p className="text-[10px] font-bold text-slate-500">
                        {index + 1} · {item.kind === "draft" ? "草案" : "确认"}
                      </p>
                      <p className="mt-1 truncate text-xs font-black text-white">{item.label}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.meta}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {pendingConfirmation && (
            <div data-testid="pending-confirmation-card" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
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
                  {pendingQueue.length > 1 && (
                    <p className="mt-1 text-[10px] text-amber-100/55">
                      队列中还有 {pendingQueue.length - 1} 项待处理。
                    </p>
                  )}
                  {actionError && (
                    <p className="mt-2 rounded-md border border-red-300/20 bg-red-300/10 px-2.5 py-2 text-xs text-red-100">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button data-testid="pending-confirmation-approve" size="sm" className="h-9 bg-emerald-500 text-xs hover:bg-emerald-600" onClick={handleApprove} disabled={isBusy || isOffline}>
                      {activeAction === "approve" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                      确认执行
                    </Button>
                    <Button data-testid="pending-confirmation-deny" size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleDeny} disabled={isBusy || isOffline}>
                      {activeAction === "deny" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingDraft && (
            <div data-testid="pending-draft-card" className="rounded-lg border border-blue-300/25 bg-blue-300/10 p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-blue-100">草案待确认</p>
                  <p className="mt-1 text-xs text-blue-50/75">我整理了 {pendingDraft.items.length} 项，确认后一并写入或执行。</p>
                  {pendingQueue.length > 1 && (
                    <p className="mt-1 text-[10px] text-blue-100/55">
                      队列中还有 {pendingQueue.length - 1} 项待处理。
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
                                  data-testid={`draft-field-${index}-${primary.key}`}
                                  value={String(item.actionParams[primary.key] ?? "")}
                                  onChange={(event) => handleDraftFieldChange(index, primary.key, event.target.value)}
                                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-white/[0.06] px-2.5 text-xs text-white outline-none focus:border-blue-300/40"
                                />
                              </label>
                              {secondary && (
                                <label className="block">
                                  <span className="text-[10px] font-bold text-blue-100/60">{secondary.label}</span>
                                  <textarea
                                    data-testid={`draft-field-${index}-${secondary.key}`}
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
                        <Button data-testid="draft-save-button" size="sm" className="h-9 bg-blue-500 text-xs hover:bg-blue-600" onClick={handleSaveDraftEdits} disabled={isBusy || isOffline}>
                          {activeAction === "saveDraft" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                          保存修改
                        </Button>
                        <Button data-testid="draft-cancel-edit-button" size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleCancelDraftEdit} disabled={isBusy}>
                          <X className="mr-1 h-3.5 w-3.5" />
                          放弃
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button data-testid="draft-confirm-button" size="sm" className="h-9 bg-blue-500 text-xs hover:bg-blue-600" onClick={handleConfirmDraft} disabled={isBusy || isOffline}>
                          {activeAction === "confirmDraft" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                          全部执行
                        </Button>
                        <Button data-testid="draft-edit-button" size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleStartDraftEdit} disabled={isBusy}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          修改
                        </Button>
                        <Button data-testid="draft-deny-button" size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-xs" onClick={handleDenyDraft} disabled={isBusy || isOffline}>
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
