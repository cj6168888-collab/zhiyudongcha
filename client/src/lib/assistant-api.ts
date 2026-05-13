import { apiRequest } from "@/lib/queryClient";

export interface AssistantExecution {
  success: boolean;
  action: string;
  entityType?: "project" | "task" | "memory" | "pc_task";
  entityId?: string;
  entityData?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AssistantAuthorizationOption {
  label: string;
  action: "approve" | "deny" | "modify" | "discuss";
}

export interface DraftItem {
  action: "create_project" | "create_task" | "save_memory" | "create_person";
  label: string;
  actionParams: Record<string, unknown>;
}

export interface AssistantResponse {
  id: string;
  handler: "direct" | "ai" | "hybrid";
  category?: string;
  type: "execute" | "confirm" | "draft" | "discuss" | "question" | "report" | "greeting";
  message: string;
  ai?: {
    provider: string;
    model: string;
    latencyMs: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  draftItems?: DraftItem[];
  action?: string;
  actionParams?: Record<string, unknown>;
  authorization?: {
    required: boolean;
    reason: string;
    operation: string;
    amount?: number;
    options: AssistantAuthorizationOption[];
  };
}

export interface AssistantChatResult {
  success: boolean;
  response: AssistantResponse;
  execution?: AssistantExecution;
}

export interface AssistantAuthorizeResult {
  success: boolean;
  message: string;
  execution?: AssistantExecution;
}

export interface DraftConfirmResult {
  success: boolean;
  executions: AssistantExecution[];
}

export interface DraftUpdateResult {
  success: boolean;
  draft: {
    id: string;
    entryType: "draft";
    action: null;
    items: DraftItem[];
    expiresAt: string;
    createdAt: string;
  };
}

export interface AssistantDiscardResult {
  success: boolean;
  discarded: boolean;
}

export interface AssistantPendingSummary {
  success: boolean;
  count: number;
  pending: Array<{
    id: string;
    entryType: "pending";
    action: string | null;
    actionParams?: Record<string, unknown>;
    expiresAt: string;
    createdAt: string;
  }>;
  draft: Array<{
    id: string;
    entryType: "draft";
    action: string | null;
    items?: DraftItem[];
    expiresAt: string;
    createdAt: string;
  }>;
}

export interface AssistantHistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  ai?: AssistantResponse["ai"];
}

export interface AssistantHistoryResult {
  success: boolean;
  scope?: AssistantConversationContext;
  messages: AssistantHistoryMessage[];
}

export interface AssistantConversationContext {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  source?: string;
  resumeConversationId?: string;
  resumeConversationTitle?: string;
}

function contextParams(context?: AssistantConversationContext) {
  return Object.fromEntries(
    Object.entries(context ?? {}).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  );
}

export async function sendAssistantMessage(
  message: string,
  context?: AssistantConversationContext,
): Promise<AssistantChatResult> {
  const res = await apiRequest("POST", "/api/assistant", {
    message,
    type: "text",
    source: "app",
    ...contextParams(context),
  });
  return await res.json();
}

export async function getAssistantHistory(
  limit = 20,
  context?: AssistantConversationContext,
): Promise<AssistantHistoryResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    ...contextParams(context),
  });
  const res = await apiRequest("GET", `/api/assistant/history?${params.toString()}`);
  return await res.json();
}

export async function approveAssistantAction(
  responseId: string,
  context?: AssistantConversationContext,
): Promise<AssistantAuthorizeResult> {
  const res = await apiRequest("POST", "/api/assistant/authorize", {
    responseId,
    action: "approve_once",
    ...contextParams(context),
  });
  return await res.json();
}

export async function denyAssistantAction(
  responseId: string,
  context?: AssistantConversationContext,
): Promise<AssistantAuthorizeResult> {
  const res = await apiRequest("POST", "/api/assistant/authorize", {
    responseId,
    action: "deny",
    ...contextParams(context),
  });
  return await res.json();
}

export async function confirmAssistantDraft(
  responseId: string,
  context?: AssistantConversationContext,
): Promise<DraftConfirmResult> {
  const res = await apiRequest("POST", "/api/assistant/draft/confirm", {
    responseId,
    ...contextParams(context),
  });
  return await res.json();
}

export async function updateAssistantDraft(responseId: string, items: DraftItem[]): Promise<DraftUpdateResult> {
  const res = await apiRequest("POST", "/api/assistant/draft/update", { responseId, items });
  return await res.json();
}

export async function discardAssistantPending(responseId: string): Promise<AssistantDiscardResult> {
  const res = await apiRequest("POST", "/api/assistant/pending/discard", { responseId });
  return await res.json();
}

export async function getAssistantPendingSummary(): Promise<AssistantPendingSummary> {
  const res = await apiRequest("GET", "/api/assistant/pending");
  return await res.json();
}

export function formatExecutionSummary(execution?: AssistantExecution): string | null {
  if (!execution) return null;

  if (!execution.success) {
    return `执行失败：${execution.errorMessage ?? "未知错误"}`;
  }

  const entityLabel: Record<string, string> = {
    project: "项目",
    task: "任务",
    memory: "记忆",
    pc_task: "PC 执行",
  };
  const entityName = execution.entityType ? entityLabel[execution.entityType] : "事项";
  const title =
    execution.entityData?.title ??
    execution.entityData?.name ??
    execution.entityData?.fileName ??
    execution.entityData?.message ??
    execution.entityId;

  return `已完成：${entityName}${title ? `「${String(title)}」` : ""}`;
}
