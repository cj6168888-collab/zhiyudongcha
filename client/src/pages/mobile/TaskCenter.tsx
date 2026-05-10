/**
 * TaskCenter (Mobile) - 吉麟任务编排中心 1.0 (移动端版)
 *
 * 功能：移动端任务列表、任务执行、新建任务抽屉
 * 布局：列表 + 底部抽屉详情，全触控友好
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  ListTodo,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Clock,
  Loader2,
  Zap,
  Server,
  Smartphone,
  Monitor,
  Plus,
  X,
  ChevronRight,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useApiQuery, useApiMutation } from "@/lib/useApi";
import { useGlobalStore } from "@/store/globalStore";

// ==================== 类型定义 ====================

interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: "CRON" | "HEARTBEAT" | "MANUAL" | "WEBHOOK";
    config: Record<string, unknown>;
  };
  actions: TaskAction[];
  options: {
    retryCount: number;
    retryDelay: number;
    timeout: number;
    continueOnError: boolean;
    parallel: boolean;
    onSuccessTaskId?: string;
    onFailureTaskId?: string;
  };
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

interface TaskAction {
  id: string;
  deviceId: string;
  deviceType: "PC" | "ANDROID" | "IOS" | "SERVER";
  actionType: "CLICK" | "TYPE" | "SCREENSHOT" | "FILE" | "APP" | "COMMAND" | "HTTP";
  params: Record<string, unknown>;
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: number;
  completedAt?: number;
  duration?: number;
  triggeredBy: string;
}

// ==================== 常量映射 ====================

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  RUNNING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  FAILED: "bg-red-500",
  CANCELLED: "bg-gray-500",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "等待中",
  RUNNING: "执行中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const TRIGGER_LABELS: Record<string, string> = {
  CRON: "定时",
  HEARTBEAT: "心跳",
  MANUAL: "手动",
  WEBHOOK: "Webhook",
};

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  PC: Monitor,
  ANDROID: Smartphone,
  IOS: Smartphone,
  SERVER: Server,
};

// ==================== 工具函数 ====================

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (ms?: number) => {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
};

const getCronDescription = (config: Record<string, unknown>) => {
  const expression = config.expression as string;
  if (!expression) return "未配置";
  const parts = expression.split(" ");
  if (parts.length === 5) {
    const [minute, hour] = parts;
    if (minute === "*" && hour === "*") return "每分钟";
    if (minute === "0" && hour === "*") return "每小时";
    if (minute === "0" && hour === "0") return "每天午夜";
    return `自定义: ${expression}`;
  }
  return expression;
};

// ==================== 新建任务表单类型 ====================

interface CreateForm {
  name: string;
  description: string;
  triggerType: "MANUAL" | "CRON";
  cronExpression: string;
  deviceId: string;
  actionType: string;
}

// ==================== 主组件 ====================

export default function TaskCenterMobile() {
  const [selectedTask, setSelectedTask] = useState<TaskDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const currentProjectId = useGlobalStore((s) => s.currentProject?.id ?? null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    description: "",
    triggerType: "MANUAL",
    cronExpression: "0 * * * *",
    deviceId: "",
    actionType: "CLICK",
  });

  // 获取任务列表（统一 API 封装）
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useApiQuery(
    ["/api/tasks"],
    async () => {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      return (data.data || data.items || []) as TaskDefinition[];
    }
  );

  // 获取执行历史（统一 API 封装）
  const { data: executions = [], refetch: refetchExecutions } = useApiQuery(
    ["/api/tasks/executions/recent"],
    async () => {
      const res = await fetch("/api/tasks/executions/all?limit=20");
      const data = await res.json();
      return (data.data || data.items || []) as TaskExecution[];
    }
  );

  // 删除任务
  const deleteMutation = useApiMutation(
    (taskId: string) =>
      fetch(`/api/tasks/${taskId}`, { method: "DELETE" }).then(r => r.json()),
    {
      successMessage: "任务已删除",
      errorMessage: "删除失败",
      invalidateKeys: [["/api/tasks"]],
      onSuccess: () => setSelectedTask(null),
    }
  );

  // 切换启用状态
  const toggleMutation = useApiMutation(
    ({ taskId, enabled }: { taskId: string; enabled: boolean }) =>
      fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }).then(r => r.json()),
    {
      successMessage: undefined,
      errorMessage: "操作失败",
      invalidateKeys: [["/api/tasks"]],
    }
  );

  // 执行任务
  const executeMutation = useApiMutation(
    (taskId: string) =>
      fetch(`/api/tasks/${taskId}/execute`, { method: "POST" }).then(r => r.json()),
    {
      successMessage: "任务已触发执行",
      errorMessage: "执行失败",
      invalidateKeys: [["/api/tasks/executions/recent"]],
    }
  );

  // 新建任务
  const createMutation = useApiMutation(
    (form: CreateForm) => {
      const payload = {
        name: form.name,
        description: form.description,
        trigger: {
          type: form.triggerType,
          config:
            form.triggerType === "CRON"
              ? { expression: form.cronExpression }
              : {},
        },
        actions: form.deviceId
          ? [
              {
                deviceId: form.deviceId,
                deviceType: "PC" as const,
                actionType: form.actionType,
                params: {},
                timeout: 30000,
                retryCount: 2,
                retryDelay: 1000,
              },
            ]
          : [],
        options: {
          retryCount: 2,
          retryDelay: 1000,
          timeout: 60000,
          continueOnError: false,
          parallel: false,
        },
        enabled: true,
      };
      return fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(r => r.json());
    },
    {
      successMessage: "任务节点建立成功",
      errorMessage: "创建失败",
      invalidateKeys: [["/api/tasks"]],
      onSuccess: () => {
        setShowCreate(false);
        setCreateForm({
          name: "",
          description: "",
          triggerType: "MANUAL",
          cronExpression: "0 * * * *",
          deviceId: "",
          actionType: "CLICK",
        });
      },
    }
  );

  // 处理新建提交
  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error("请输入任务名称");
      return;
    }
    createMutation.mutate(createForm);
  };

  // 统计
  const enabledCount = tasks.filter((t) => t.enabled).length;
  const runningCount = executions.filter((e) => e.status === "RUNNING").length;

  return (
    <SafeLayout headerTitle="任务中心" showBack={true}>
      <div className="space-y-5 pb-10">
        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-[2rem] bg-white/5 border border-white/5 text-center">
            <p className="text-2xl font-black text-white">{tasks.length}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
              总任务
            </p>
          </div>
          <div className="p-4 rounded-[2rem] bg-primary/10 border border-primary/20 text-center">
            <p className="text-2xl font-black text-primary">{enabledCount}</p>
            <p className="text-[9px] text-primary/70 uppercase tracking-widest font-bold mt-1">
              启用中
            </p>
          </div>
          <div className="p-4 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-2xl font-black text-blue-400">{runningCount}</p>
            <p className="text-[9px] text-blue-400/70 uppercase tracking-widest font-bold mt-1">
              执行中
            </p>
          </div>
        </div>

        {/* 快捷操作入口 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="h-24 rounded-[2.5rem] bg-primary flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-primary/20"
          >
            <Plus className="w-6 h-6 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              新建任务
            </span>
          </button>
          <button
            onClick={() => refetchTasks()}
            className="h-24 rounded-[2.5rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <RefreshCw className="w-6 h-6 text-blue-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              刷新列表
            </span>
          </button>
        </div>

        {/* 最近执行记录 */}
        {executions.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
              Recent Executions
            </h3>
            <div className="space-y-2">
              {executions.slice(0, 5).map((exec) => (
                <div
                  key={exec.id}
                  className="p-4 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        STATUS_COLORS[exec.status]
                      )}
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{exec.taskName}</p>
                      <p className="text-[9px] text-gray-600">
                        {formatTime(exec.startedAt)} · {exec.triggeredBy}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-500 uppercase">
                      {STATUS_TEXT[exec.status]}
                    </p>
                    <p className="text-[9px] text-gray-600">
                      {formatDuration(exec.duration)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 任务列表 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Task Definitions ({tasks.length})
          </h3>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-[2rem] bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">暂无任务</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-6 py-3 rounded-full bg-primary text-white text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
              >
                创建第一个任务
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={cn(
                    "p-5 rounded-[2.5rem] bg-white/5 border transition-all active:scale-[0.98] cursor-pointer group",
                    selectedTask?.id === task.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/5",
                    !task.enabled && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                          task.enabled ? "bg-primary/10" : "bg-gray-700/50"
                        )}
                      >
                        <ListTodo
                          className={cn(
                            "w-5 h-5",
                            task.enabled ? "text-primary" : "text-gray-500"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate">
                          {task.name}
                        </h3>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {TRIGGER_LABELS[task.trigger.type]}
                            {task.trigger.type === "CRON" &&
                              ` · ${getCronDescription(task.trigger.config)}`}
                          </span>
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {task.actions.length} 动作
                          </span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 shrink-0 ml-2" />
                  </div>

                  {/* 操作按钮（展开状态可见） */}
                  {selectedTask?.id === task.id && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeMutation.mutate(task.id);
                        }}
                        disabled={!task.enabled || executeMutation.isPending}
                        className="flex-1 h-11 rounded-2xl bg-primary text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {executeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        执行
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMutation.mutate({
                            taskId: task.id,
                            enabled: !task.enabled,
                          });
                        }}
                        className={cn(
                          "w-20 h-11 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 active:scale-95 transition-all",
                          task.enabled
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-green-500/20 text-green-400 border border-green-500/30"
                        )}
                      >
                        {task.enabled ? (
                          <>
                            <Pause className="w-4 h-4" />
                            暂停
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            启用
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("确定要删除这个任务吗？")) {
                            deleteMutation.mutate(task.id);
                          }
                        }}
                        className="w-14 h-11 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center active:scale-95 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 新建任务抽屉 */}
        {showCreate && (
          <div className="fixed inset-0 z-[1000] flex items-end">
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setShowCreate(false)}
            />
            <div className="relative w-full bg-[#0f172a] rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 border-t border-white/10 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tighter">
                  部署新任务节点
                </h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 任务名称 */}
                <input
                  placeholder="任务名称..."
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white outline-none focus:border-primary transition-colors"
                />

                {/* 任务描述 */}
                <textarea
                  placeholder="任务描述（可选）..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, description: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary transition-colors resize-none"
                />

                {/* 触发类型 */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                    Trigger Mode
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["MANUAL", "CRON"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setCreateForm({ ...createForm, triggerType: type })
                        }
                        className={cn(
                          "h-12 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                          createForm.triggerType === type
                            ? "bg-primary text-white border border-primary"
                            : "bg-white/5 text-gray-400 border border-white/10"
                        )}
                      >
                        {TRIGGER_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cron 表达式（仅定时模式显示） */}
                {createForm.triggerType === "CRON" && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                      Cron Expression
                    </p>
                    <input
                      placeholder="0 * * * *"
                      value={createForm.cronExpression}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          cronExpression: e.target.value,
                        })
                      }
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-white text-sm font-mono outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[9px] text-gray-600">
                      格式：分 时 日 月 周，例：0 * * * * = 每小时整点执行
                    </p>
                  </div>
                )}

                {/* 目标设备 */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                    Target Device
                  </p>
                  <input
                    placeholder="设备 ID（可选）..."
                    value={createForm.deviceId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, deviceId: e.target.value })
                    }
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-white text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* 提交按钮 */}
                <button
                  onClick={handleCreate}
                  disabled={
                    createMutation.isPending || !createForm.name.trim()
                  }
                  className="w-full h-16 bg-primary text-white font-black uppercase rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      部署中...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      确认部署
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SafeLayout>
  );
}
