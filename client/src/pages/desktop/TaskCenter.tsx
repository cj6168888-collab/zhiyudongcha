/**
 * TaskCenterDesktop - 桌面端任务中心
 *
 * 提供桌面端的任务管理、PC 代理执行和告警查看功能
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Play, Pause, Plus, Trash2, Save, Settings, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Clock, Zap, GitBranch, Layers, Monitor, MousePointer2, Keyboard, Camera,
  AppWindow, FileText, Mail, Folder, Globe, Power, Terminal, Bell, BellOff,
  ArrowRight, Copy, Edit3, MoreVertical, Search, Filter, X, Check, Eye, EyeOff,
  Wifi, WifiOff, AlertTriangle, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from '@/lib/queryClient';

type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
type TriggerType = 'CRON' | 'HEARTBEAT' | 'MANUAL' | 'WEBHOOK';
type DeviceStatus = 'OFFLINE' | 'ONLINE' | 'BUSY' | 'ERROR';
type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================
// 类型定义
// ============================================

interface Task {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: TriggerType;
    config: Record<string, unknown>;
  };
  actions: TaskAction[];
  options: Record<string, unknown>;
  status: TaskStatus;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
}

interface TaskAction {
  id: string;
  deviceId: string;
  deviceType: string;
  actionType: string;
  params: Record<string, unknown>;
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: number;
  completedAt?: number;
  result?: {
    success: boolean;
    completedActions: number;
    failedActions: number;
    totalDuration: number;
    error?: string;
  };
}

interface Device {
  id: string;
  name: string;
  platform: 'WINDOWS' | 'MACOS' | 'LINUX';
  osVersion?: string;
  capabilities?: {
    screenCapture: boolean;
    mouseControl: boolean;
    keyboardControl: boolean;
  };
  status: DeviceStatus;
  lastSeen: number;
}

interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'READ' | 'DISMISSED';
  createdAt: number;
  taskId?: string;
}

// ============================================
// 状态配置
// ============================================

const statusConfig: Record<TaskStatus, { color: string; bgColor: string; label: string }> = {
  PENDING: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: '待执行' },
  RUNNING: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: '执行中' },
  COMPLETED: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: '已完成' },
  FAILED: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: '失败' },
  CANCELLED: { color: 'text-gray-500', bgColor: 'bg-gray-500/20', label: '已取消' },
  PAUSED: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: '已暂停' },
};

const triggerConfig: Record<TriggerType, { color: string; label: string }> = {
  CRON: { color: 'text-purple-400', label: '定时' },
  HEARTBEAT: { color: 'text-orange-400', label: '心跳' },
  MANUAL: { color: 'text-blue-400', label: '手动' },
  WEBHOOK: { color: 'text-cyan-400', label: 'Webhook' },
};

const severityConfig: Record<AlertSeverity, { color: string; bgColor: string; label: string }> = {
  LOW: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: '低' },
  MEDIUM: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: '中' },
  HIGH: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: '高' },
  CRITICAL: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: '严重' },
};

// ============================================
// 主组件
// ============================================

export default function TaskCenterDesktop() {
  const [, setLocation] = useLocation();

  // 状态
  const [activeTab, setActiveTab] = useState<'tasks' | 'devices' | 'alerts'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();

    // 设置轮询
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    await Promise.all([loadTasks(), loadDevices(), loadAlerts(), loadExecutions()]);
  };

  const loadTasks = async () => {
    try {
      const res = await apiRequest('GET', '/api/tasks');
      const json = await res.json();
      if (json.success) {
        setTasks(json.data || []);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await apiRequest('GET', '/api/remote/devices');
      const json = await res.json();
      if (json.success) {
        setDevices(json.data || []);
      }
    } catch (error) {
      console.error('加载设备失败:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await apiRequest('GET', '/api/alerts/pending?limit=20');
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data || []);
      }
    } catch (error) {
      console.error('加载告警失败:', error);
    }
  };

  const loadExecutions = async () => {
    try {
      const res = await apiRequest('GET', '/api/tasks/executions/all?limit=50');
      const json = await res.json();
      if (json.success) {
        setExecutions(json.data || []);
      }
    } catch (error) {
      console.error('加载执行记录失败:', error);
    }
  };

  // 执行任务
  const executeTask = async (taskId: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', `/api/tasks/${taskId}/execute`);
      const json = await res.json();
      if (json.success) {
        loadTasks();
        loadExecutions();
      }
    } catch (error) {
      console.error('执行任务失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除任务
  const deleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
      const res = await apiRequest('DELETE', `/api/tasks/${taskId}`);
      const json = await res.json();
      if (json.success) {
        loadTasks();
      }
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  // 消散告警
  const dismissAlert = async (alertId: string) => {
    try {
      await apiRequest('POST', `/api/alerts/${alertId}/dismiss`);
      loadAlerts();
    } catch (error) {
      console.error('消散告警失败:', error);
    }
  };

  // 筛选任务
  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 统计
  const stats = {
    totalTasks: tasks.length,
    runningTasks: tasks.filter(t => t.status === 'RUNNING').length,
    failedTasks: tasks.filter(t => t.status === 'FAILED').length,
    onlineDevices: devices.filter(d => d.status === 'ONLINE').length,
    totalDevices: devices.length,
    pendingAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
  };

  return (
    <div className="h-full flex flex-col bg-[#030712]">
      {/* 顶部导航 */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">任务中心</h1>
            <p className="text-xs text-gray-500 mt-1">任务编排 · PC代理执行 · 告警管理</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">新建任务</span>
          </button>
        </div>
      </header>

      {/* 统计卡片 */}
      <div className="flex-shrink-0 px-6 py-4 grid grid-cols-7 gap-4">
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="总任务"
          value={stats.totalTasks}
          color="text-blue-400"
        />
        <StatCard
          icon={<RefreshCw className="w-5 h-5" />}
          label="执行中"
          value={stats.runningTasks}
          color="text-yellow-400"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5" />}
          label="失败"
          value={stats.failedTasks}
          color="text-red-400"
        />
        <StatCard
          icon={<Monitor className="w-5 h-5" />}
          label="在线设备"
          value={`${stats.onlineDevices}/${stats.totalDevices}`}
          color="text-green-400"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          label="待处理告警"
          value={stats.pendingAlerts}
          color="text-orange-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="严重告警"
          value={stats.criticalAlerts}
          color="text-red-400"
          highlight={stats.criticalAlerts > 0}
        />
        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">刷新</span>
        </button>
      </div>

      {/* Tab 导航 */}
      <div className="flex-shrink-0 px-6 border-b border-white/5">
        <nav className="flex gap-1">
          {[
            { id: 'tasks', label: '任务列表', icon: Layers },
            { id: 'devices', label: '设备管理', icon: Monitor },
            { id: 'alerts', label: '告警中心', icon: Bell },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'tasks' && (
          <TasksPanel
            tasks={filteredTasks}
            executions={executions}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onExecute={executeTask}
            onDelete={deleteTask}
            onSelect={setSelectedTask}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'devices' && (
          <DevicesPanel devices={devices} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPanel
            alerts={alerts}
            onDismiss={dismissAlert}
          />
        )}
      </div>

      {/* 创建任务模态框 */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadTasks();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// 统计卡片组件
// ============================================

function StatCard({
  icon,
  label,
  value,
  color,
  highlight
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "p-4 rounded-xl bg-white/5 border border-white/5",
      highlight && "border-red-500/50 bg-red-500/10"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-white/5", color)}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={cn("text-lg font-bold", highlight ? "text-red-400" : color)}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 任务列表面板
// ============================================

function TasksPanel({
  tasks,
  executions,
  searchQuery,
  onSearchChange,
  onExecute,
  onDelete,
  onSelect,
  isLoading,
}: {
  tasks: Task[];
  executions: TaskExecution[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExecute: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onSelect: (task: Task) => void;
  isLoading: boolean;
}) {
  return (
    <div className="h-full flex flex-col p-6">
      {/* 搜索栏 */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索任务..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Layers className="w-16 h-16 text-gray-700 mb-4" />
            <p className="text-gray-500">暂无任务</p>
            <p className="text-xs text-gray-600 mt-1">点击右上角按钮创建第一个任务</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              executions={executions.filter(e => e.taskId === task.id)}
              onExecute={() => onExecute(task.id)}
              onDelete={() => onDelete(task.id)}
              onClick={() => onSelect(task)}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// 任务卡片组件
// ============================================

function TaskCard({
  task,
  executions,
  onExecute,
  onDelete,
  onClick,
  isLoading,
}: {
  task: Task;
  executions: TaskExecution[];
  onExecute: () => void;
  onDelete: () => void;
  onClick: () => void;
  isLoading: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const status = statusConfig[task.status] || statusConfig.PENDING;
  const trigger = triggerConfig[task.trigger?.type] || triggerConfig.MANUAL;
  const lastExecution = executions[0];

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{task.name}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", status.bgColor, status.color)}>
              {status.label}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5", trigger.color)}>
              {trigger.label}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-gray-500 mt-1 truncate">{task.description}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
            <span>{task.actions?.length || 0} 个动作</span>
            {task.lastRunAt && (
              <span>上次: {new Date(task.lastRunAt).toLocaleString('zh-CN')}</span>
            )}
            {lastExecution?.result?.totalDuration && (
              <span>耗时: {lastExecution.result.totalDuration}ms</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onExecute(); }}
            disabled={isLoading || task.status === 'RUNNING'}
            className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-[#1a1a2e] border border-white/10 shadow-xl z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 设备管理面板
// ============================================

function DevicesPanel({ devices }: { devices: Device[] }) {
  const statusColors: Record<DeviceStatus, string> = {
    ONLINE: 'bg-green-500',
    OFFLINE: 'bg-gray-500',
    BUSY: 'bg-yellow-500',
    ERROR: 'bg-red-500',
  };

  return (
    <div className="h-full p-6 overflow-y-auto">
      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Monitor className="w-16 h-16 text-gray-700 mb-4" />
          <p className="text-gray-500">暂无设备</p>
          <p className="text-xs text-gray-600 mt-1">连接您的PC代理，以接收指令并回传执行结果</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map(device => (
            <div
              key={device.id}
              className="p-4 rounded-xl bg-white/5 border border-white/5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <Monitor className="w-8 h-8 text-gray-400" />
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#030712]",
                    statusColors[device.status]
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{device.name}</h3>
                  <p className="text-xs text-gray-500">{device.platform}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">状态</span>
                  <span className={cn(
                    "font-medium",
                    device.status === 'ONLINE' ? 'text-green-400' :
                    device.status === 'BUSY' ? 'text-yellow-400' : 'text-gray-500'
                  )}>
                    {device.status === 'ONLINE' ? '在线' :
                     device.status === 'BUSY' ? '忙碌' :
                     device.status === 'ERROR' ? '错误' : '离线'}
                  </span>
                </div>

                {device.capabilities && (
                  <div className="flex items-center gap-1 pt-2 border-t border-white/5">
                    {device.capabilities.screenCapture && (
                      <div title="屏幕截图">
                        <Camera className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                    {device.capabilities.mouseControl && (
                      <div title="鼠标控制">
                        <MousePointer2 className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                    {device.capabilities.keyboardControl && (
                      <div title="键盘控制">
                        <Keyboard className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// 告警中心面板
// ============================================

function AlertsPanel({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  return (
    <div className="h-full p-6 overflow-y-auto">
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <BellOff className="w-16 h-16 text-gray-700 mb-4" />
          <p className="text-gray-500">暂无告警</p>
          <p className="text-xs text-gray-600 mt-1">所有系统运行正常</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const severity = severityConfig[alert.severity] || severityConfig.MEDIUM;

            return (
              <div
                key={alert.id}
                className={cn(
                  "p-4 rounded-xl border",
                  alert.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30' :
                  alert.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30' :
                  alert.severity === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-white/5 border-white/5'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={cn("w-4 h-4", severity.color)} />
                      <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", severity.bgColor, severity.color)}>
                        {severity.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{alert.message}</p>
                    <p className="text-[10px] text-gray-600 mt-2">
                      {new Date(alert.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  <button
                    onClick={() => onDismiss(alert.id)}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// 创建任务模态框
// ============================================

function CreateTaskModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('MANUAL');
  const [cronExpression, setCronExpression] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const taskData = {
        name: name.trim(),
        description: description.trim(),
        trigger: {
          type: triggerType,
          config: triggerType === 'CRON' ? { expression: cronExpression } : {},
        },
        actions: [],
        options: {
          retryCount: 3,
          retryDelay: 1000,
          timeout: 30000,
          continueOnError: false,
        },
        enabled: false,
      };

      const res = await apiRequest('POST', '/api/tasks', taskData);
      const json = await res.json();

      if (json.success) {
        onCreated();
      }
    } catch (error) {
      console.error('创建任务失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-[#0a0a0f] rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">新建任务</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">任务名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入任务名称"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="任务描述（可选）"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">触发方式</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(triggerConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setTriggerType(key as TriggerType)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    triggerType === key
                      ? "bg-blue-500/30 text-blue-400 border border-blue-500/50"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                  )}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'CRON' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">CRON 表达式</label>
              <input
                type="text"
                value={cronExpression}
                onChange={e => setCronExpression(e.target.value)}
                placeholder="0 8 * * *"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">格式: 分 时 日 月 周 (例: 0 8 * * * 表示每天8点)</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
