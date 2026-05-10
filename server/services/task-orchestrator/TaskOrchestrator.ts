/**
 * 任务编排引擎 - TaskOrchestrator (完整企业版 + 数据库持久化)
 *
 * 提供完整的任务管理、执行和调度能力：
 * - 任务 CRUD 操作 (支持数据库持久化)
 * - 任务执行引擎
 * - 触发器系统 (CRON/心跳/手动/Webhook)
 * - 执行历史记录 (数据库持久化)
 *
 * @version 2.1.0
 * @author 架构组
 */

import { createServiceLogger } from '../../lib/logger';
import { randomUUID } from 'crypto';
import * as cron from 'node-cron';
import remoteControlService from '../remote-control/RemoteControlService';
import { taskRepository, taskExecutionRepository } from '../../repositories';

const logger = createServiceLogger('TaskOrchestrator');

// ============================================
// 类型定义
// ============================================

export type TaskTriggerType = 'CRON' | 'HEARTBEAT' | 'MANUAL' | 'WEBHOOK';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
export type DeviceType = 'PC' | 'ANDROID' | 'IOS' | 'SERVER';
export type ActionType = 'CLICK' | 'TYPE' | 'SCREENSHOT' | 'FILE' | 'APP' | 'COMMAND' | 'HTTP';

export interface TaskAction {
  id: string;
  deviceId: string;
  deviceType: DeviceType;
  actionType: ActionType;
  params: Record<string, unknown>;
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

export interface CronConfig {
  expression: string;
  timezone?: string;
}

export interface HeartbeatConfig {
  deviceId: string;
  condition: 'online' | 'offline' | 'status_change';
  value?: string;
}

export interface TaskTrigger {
  type: TaskTriggerType;
  config: CronConfig | HeartbeatConfig | Record<string, unknown>;
}

export interface TaskOptions {
  retryCount: number;
  retryDelay: number;
  timeout: number;
  continueOnError: boolean;
  parallel: boolean;
  onSuccessTaskId?: string;
  onFailureTaskId?: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: TaskTrigger;
  actions: TaskAction[];
  options: TaskOptions;
  status: TaskStatus;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: number;
  completedAt?: number;
  result?: TaskResult;
  actions: TaskActionExecution[];
}

export interface TaskActionExecution {
  actionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
  duration: number;
}

export interface TaskResult {
  success: boolean;
  completedActions: number;
  failedActions: number;
  totalDuration: number;
  error?: string;
}

export interface TaskOrchestratorConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  defaultRetryCount: number;
}

const DEFAULT_CONFIG: TaskOrchestratorConfig = {
  maxConcurrentTasks: 5,
  defaultTimeout: 30000,
  defaultRetryCount: 3,
};

// ============================================
// 服务实现
// ============================================

export class TaskOrchestrator {
  private static instance: TaskOrchestrator | null = null;

  private config: TaskOrchestratorConfig;
  private tasks: Map<string, TaskDefinition> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();

  private constructor(config: Partial<TaskOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<TaskOrchestratorConfig>): TaskOrchestrator {
    if (!TaskOrchestrator.instance) {
      TaskOrchestrator.instance = new TaskOrchestrator(config);
    }
    return TaskOrchestrator.instance;
  }

  // ============================================
  // CRUD 操作 (带数据库持久化)
  // ============================================

  /**
   * 创建任务
   */
  public async createTask(task: Omit<TaskDefinition, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<TaskDefinition> {
    const now = Date.now();
    const newTask: TaskDefinition = {
      ...task,
      id: randomUUID(),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    // 保存到数据库
    try {
      await taskRepository.create({
        id: newTask.id,
        name: newTask.name,
        description: newTask.description,
        triggerType: newTask.trigger.type,
        triggerConfig: newTask.trigger.config as Record<string, unknown>,
        actions: newTask.actions as unknown as Record<string, unknown>[],
        options: newTask.options as unknown as Record<string, unknown>,
        status: newTask.status,
        enabled: newTask.enabled,
        lastRunAt: newTask.lastRunAt ? new Date(newTask.lastRunAt) : null,
        nextRunAt: newTask.nextRunAt ? new Date(newTask.nextRunAt) : null,
        createdBy: newTask.createdBy,
      });
    } catch (error) {
      logger.error({ taskId: newTask.id, error }, 'Failed to persist task to database');
    }

    // 保存到内存缓存
    this.tasks.set(newTask.id, newTask);

    // 注册触发器
    if (newTask.enabled && newTask.trigger.type === 'CRON') {
      this.registerCronJob(newTask);
    }

    logger.info({ taskId: newTask.id, taskName: newTask.name }, 'Task created');
    return newTask;
  }

  /**
   * 获取所有任务
   */
  public async getAllTasks(): Promise<TaskDefinition[]> {
    // 从数据库加载最新数据
    try {
      const dbTasks = await taskRepository.findAll(1000);
      const taskMap = new Map<string, TaskDefinition>();

      // 转换数据库任务到内存格式
      for (const dbTask of dbTasks) {
        const task: TaskDefinition = {
          id: dbTask.id,
          name: dbTask.name,
          description: dbTask.description || undefined,
          trigger: {
            type: dbTask.triggerType as TaskTriggerType,
            config: dbTask.triggerConfig as Record<string, unknown>,
          },
          actions: dbTask.actions as unknown as TaskAction[],
          options: dbTask.options as unknown as TaskOptions,
          status: dbTask.status as TaskStatus,
          enabled: dbTask.enabled,
          lastRunAt: dbTask.lastRunAt?.getTime(),
          nextRunAt: dbTask.nextRunAt?.getTime(),
          createdAt: dbTask.createdAt.getTime(),
          updatedAt: dbTask.updatedAt.getTime(),
        };
        taskMap.set(task.id, task);
      }

      // 合并到内存缓存
      this.tasks = taskMap;
    } catch (error) {
      logger.error({ error }, 'Failed to load tasks from database, using memory cache');
    }

    return Array.from(this.tasks.values());
  }

  /**
   * 获取启用的任务
   */
  public async getEnabledTasks(): Promise<TaskDefinition[]> {
    await this.getAllTasks();
    return this.getAllTasksCached().filter(task => task.enabled);
  }

  /**
   * 从缓存获取所有任务 (不查询数据库)
   */
  public getAllTasksCached(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取单个任务
   */
  public async getTask(taskId: string): Promise<TaskDefinition | undefined> {
    // 先从缓存获取
    const cachedTask = this.tasks.get(taskId);
    if (cachedTask) {
      return cachedTask;
    }

    // 从数据库加载
    try {
      const dbTask = await taskRepository.findById(taskId);
      if (!dbTask) return undefined;

      const task: TaskDefinition = {
        id: dbTask.id,
        name: dbTask.name,
        description: dbTask.description || undefined,
        trigger: {
          type: dbTask.triggerType as TaskTriggerType,
          config: dbTask.triggerConfig as Record<string, unknown>,
        },
        actions: dbTask.actions as unknown as TaskAction[],
        options: dbTask.options as unknown as TaskOptions,
        status: dbTask.status as TaskStatus,
        enabled: dbTask.enabled,
        lastRunAt: dbTask.lastRunAt?.getTime(),
        nextRunAt: dbTask.nextRunAt?.getTime(),
        createdAt: dbTask.createdAt.getTime(),
        updatedAt: dbTask.updatedAt.getTime(),
      };

      this.tasks.set(taskId, task);
      return task;
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to get task from database');
      return undefined;
    }
  }

  /**
   * 更新任务
   */
  public async updateTask(taskId: string, updates: Partial<TaskDefinition>): Promise<TaskDefinition | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) {
      // 尝试从数据库加载
      const dbTask = await this.getTask(taskId);
      if (!dbTask) return undefined;
    }

    const currentTask = this.tasks.get(taskId);
    if (!currentTask) return undefined;

    // 如果触发器类型改变，需要重新注册
    if (updates.trigger && updates.trigger.type !== currentTask.trigger.type) {
      this.unregisterCronJob(taskId);
      if (updates.enabled !== false) {
        this.registerCronJob({ ...currentTask, ...updates });
      }
    }

    const updatedTask: TaskDefinition = {
      ...currentTask,
      ...updates,
      updatedAt: Date.now(),
    };

    // 更新数据库
    try {
      await taskRepository.update(taskId, {
        name: updatedTask.name,
        description: updatedTask.description,
        triggerType: updatedTask.trigger.type,
        triggerConfig: updatedTask.trigger.config as Record<string, unknown>,
        actions: updatedTask.actions as unknown as Record<string, unknown>[],
        options: updatedTask.options as unknown as Record<string, unknown>,
        status: updatedTask.status,
        enabled: updatedTask.enabled,
        lastRunAt: updatedTask.lastRunAt ? new Date(updatedTask.lastRunAt) : null,
        nextRunAt: updatedTask.nextRunAt ? new Date(updatedTask.nextRunAt) : null,
      });
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to update task in database');
    }

    // 更新内存缓存
    this.tasks.set(taskId, updatedTask);
    logger.info({ taskId }, 'Task updated');
    return updatedTask;
  }

  /**
   * 删除任务
   */
  public async deleteTask(taskId: string): Promise<boolean> {
    this.unregisterCronJob(taskId);

    // 从数据库删除
    try {
      await taskRepository.delete(taskId);
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to delete task from database');
    }

    // 从内存缓存删除
    return this.tasks.delete(taskId);
  }

  // ============================================
  // 任务执行 (带数据库持久化)
  // ============================================

  /**
   * 执行任务
   */
  public async executeTask(taskId: string, triggeredBy?: string): Promise<TaskExecution> {
    // 确保任务是最新的
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error('Max concurrent tasks reached');
    }

    if (task.status === 'RUNNING') {
      throw new Error('Task is already running');
    }

    const executionId = randomUUID();
    const execution: TaskExecution = {
      id: executionId,
      taskId,
      status: 'RUNNING',
      startedAt: Date.now(),
      actions: task.actions.map(action => ({
        actionId: action.id,
        status: 'PENDING' as const,
        duration: 0,
      })),
    };

    // 保存执行记录到数据库
    try {
      await taskExecutionRepository.create({
        id: executionId,
        taskId,
        taskName: task.name,
        status: 'RUNNING',
        triggeredBy,
        startedAt: new Date(execution.startedAt),
        actionResults: execution.actions as unknown as Record<string, unknown>[],
      });
    } catch (error) {
      logger.error({ taskId, executionId, error }, 'Failed to save execution to database');
    }

    this.executions.set(executionId, execution);
    this.runningTasks.add(taskId);

    // 更新任务状态
    task.status = 'RUNNING';
    task.lastRunAt = Date.now();
    this.tasks.set(taskId, task);

    // 更新数据库中的任务状态
    try {
      await taskRepository.updateStatus(taskId, 'RUNNING');
      await taskRepository.updateLastRunAt(taskId);
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to update task status in database');
    }

    logger.info({ taskId, executionId, triggeredBy }, 'Task execution started');

    try {
      // 执行所有动作
      let completedActions = 0;
      let failedActions = 0;

      for (let i = 0; i < task.actions.length; i++) {
        const action = task.actions[i];
        const actionExecution = execution.actions[i];

        actionExecution.status = 'RUNNING';

        const result = await this.executeAction(action);

        actionExecution.status = result.success ? 'COMPLETED' : 'FAILED';
        actionExecution.result = result;
        actionExecution.duration = Date.now() - execution.startedAt;

        if (result.success) {
          completedActions++;
        } else {
          failedActions++;

          if (!task.options.continueOnError) {
            break;
          }
        }
      }

      // 完成执行
      const success = failedActions === 0;
      execution.status = success ? 'COMPLETED' : 'FAILED';
      execution.completedAt = Date.now();
      execution.result = {
        success,
        completedActions,
        failedActions,
        totalDuration: execution.completedAt - execution.startedAt,
        error: failedActions > 0 ? `${failedActions} actions failed` : undefined,
      };

      task.status = success ? 'COMPLETED' : 'FAILED';

      // 更新数据库中的执行记录
      try {
        await taskExecutionRepository.complete(executionId, execution.result);
      } catch (error) {
        logger.error({ executionId, error }, 'Failed to update execution in database');
      }

    } catch (error) {
      execution.status = 'FAILED';
      execution.completedAt = Date.now();
      execution.result = {
        success: false,
        completedActions: 0,
        failedActions: task.actions.length,
        totalDuration: execution.completedAt - execution.startedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      task.status = 'FAILED';

      // 更新数据库中的执行记录
      try {
        await taskExecutionRepository.complete(executionId, execution.result);
      } catch (dbError) {
        logger.error({ executionId, error: dbError }, 'Failed to update execution in database');
      }

      logger.error({ taskId, executionId, error }, 'Task execution failed');
    } finally {
      this.runningTasks.delete(taskId);
      task.updatedAt = Date.now();
      this.tasks.set(taskId, task);

      // 更新数据库中的任务状态
      try {
        await taskRepository.updateStatus(taskId, task.status);
      } catch (error) {
        logger.error({ taskId, error }, 'Failed to update task status in database');
      }
    }

    // 执行后续任务
    if (execution.result?.success && task.options.onSuccessTaskId) {
      this.executeTask(task.options.onSuccessTaskId, `success:${taskId}`);
    } else if (!execution.result?.success && task.options.onFailureTaskId) {
      this.executeTask(task.options.onFailureTaskId, `failure:${taskId}`);
    }

    return execution;
  }

  /**
   * 执行单个动作
   */
  private async executeAction(action: TaskAction): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { deviceId, deviceType, actionType, params, timeout, retryCount, retryDelay } = action;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          logger.info({ actionId: action.id, attempt }, 'Retrying action');
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        // 根据设备类型和动作类型执行
        if (deviceType === 'PC') {
          const command = this.buildCommand(actionType, params);
          const result = await remoteControlService.sendCommand(deviceId, command);

          if (result.success) {
            return { success: true, data: result.data };
          }
          lastError = result.error;
        } else if (deviceType === 'HTTP') {
          // HTTP 请求动作
          const response = await this.executeHttpAction(params as Record<string, unknown>);
          if (response.success) {
            return response;
          }
          lastError = response.error;
        } else {
          // 其他设备类型暂时返回不支持
          return { success: false, error: `Unsupported device type: ${deviceType}` };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * 构建控制命令
   */
  private buildCommand(actionType: ActionType, params: Record<string, unknown>): {
    type: 'MOUSE' | 'KEYBOARD' | 'SCREENSHOT' | 'APP' | 'SYSTEM';
    action: string;
    params?: Record<string, unknown>;
  } {
    const actionMap: Record<string, { type: 'MOUSE' | 'KEYBOARD' | 'SCREENSHOT' | 'APP' | 'SYSTEM'; action: string }> = {
      'CLICK': { type: 'MOUSE', action: 'CLICK' },
      'DOUBLE_CLICK': { type: 'MOUSE', action: 'DOUBLE_CLICK' },
      'TYPE': { type: 'KEYBOARD', action: 'TYPE' },
      'SCREENSHOT': { type: 'SCREENSHOT', action: 'CAPTURE' },
      'APP': { type: 'APP', action: 'OPEN' },
      'COMMAND': { type: 'SYSTEM', action: 'EXECUTE' },
    };

    const mapping = actionMap[actionType] || { type: 'SYSTEM' as const, action: actionType };

    return {
      type: mapping.type,
      action: mapping.action,
      params,
    };
  }

  /**
   * 执行 HTTP 动作
   */
  private async executeHttpAction(params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { url, method = 'GET', headers, body } = params;

    try {
      const response = await fetch(url as string, {
        method: method as string,
        headers: headers as Record<string, string>,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      return {
        success: response.ok,
        data,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTTP request failed',
      };
    }
  }

  // ============================================
  // 执行历史 (带数据库持久化)
  // ============================================

  /**
   * 获取任务执行历史
   */
  public async getTaskHistory(taskId: string, limit?: number): Promise<TaskExecution[]> {
    // 从数据库获取历史记录
    try {
      const dbExecutions = await taskExecutionRepository.findByTaskId(taskId, limit || 50);
      return dbExecutions.map(exec => ({
        id: exec.id,
        taskId: exec.taskId,
        status: exec.status as TaskStatus,
        startedAt: exec.startedAt.getTime(),
        completedAt: exec.completedAt?.getTime(),
        result: exec.result as TaskResult | undefined,
        actions: exec.actionResults as unknown as TaskActionExecution[],
      }));
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to get task history from database');
      // 回退到内存缓存
      let executions = Array.from(this.executions.values())
        .filter(exec => exec.taskId === taskId)
        .sort((a, b) => b.startedAt - a.startedAt);

      if (limit) {
        executions = executions.slice(0, limit);
      }
      return executions;
    }
  }

  /**
   * 获取单个执行记录
   */
  public async getExecution(executionId: string): Promise<TaskExecution | undefined> {
    // 从数据库获取
    try {
      const dbExecution = await taskExecutionRepository.findById(executionId);
      if (!dbExecution) return undefined;

      return {
        id: dbExecution.id,
        taskId: dbExecution.taskId,
        status: dbExecution.status as TaskStatus,
        startedAt: dbExecution.startedAt.getTime(),
        completedAt: dbExecution.completedAt?.getTime(),
        result: dbExecution.result as TaskResult | undefined,
        actions: dbExecution.actionResults as unknown as TaskActionExecution[],
      };
    } catch (error) {
      logger.error({ executionId, error }, 'Failed to get execution from database');
      // 回退到内存缓存
      return this.executions.get(executionId);
    }
  }

  /**
   * 获取所有执行记录
   */
  public async getAllExecutions(limit: number = 50): Promise<TaskExecution[]> {
    // 从数据库获取
    try {
      const dbExecutions = await taskExecutionRepository.findAll(limit);
      return dbExecutions.map(exec => ({
        id: exec.id,
        taskId: exec.taskId,
        status: exec.status as TaskStatus,
        startedAt: exec.startedAt.getTime(),
        completedAt: exec.completedAt?.getTime(),
        result: exec.result as TaskResult | undefined,
        actions: exec.actionResults as unknown as TaskActionExecution[],
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get all executions from database');
      // 回退到内存缓存
      return Array.from(this.executions.values())
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    }
  }

  /**
   * 获取任务统计信息
   */
  public async getTaskStats(taskId: string): Promise<{
    totalRuns: number;
    successCount: number;
    failedCount: number;
    avgDuration: number;
    lastRun: Date | null;
  }> {
    try {
      return await taskExecutionRepository.getTaskStats(taskId);
    } catch (error) {
      logger.error({ taskId, error }, 'Failed to get task stats from database');
      return {
        totalRuns: 0,
        successCount: 0,
        failedCount: 0,
        avgDuration: 0,
        lastRun: null,
      };
    }
  }

  // ============================================
  // 触发器管理
  // ============================================

  /**
   * 注册 CRON 任务
   */
  private registerCronJob(task: TaskDefinition): void {
    if (task.trigger.type !== 'CRON') return;

    const cronConfig = task.trigger.config as CronConfig;

    try {
      const job = cron.schedule(cronConfig.expression, () => {
        logger.info({ taskId: task.id }, 'Cron trigger fired');
        this.executeTask(task.id, 'cron');
      }, {
        timezone: cronConfig.timezone || 'Asia/Shanghai',
      });

      this.cronJobs.set(task.id, job);

      // 计算下次执行时间
      const nextRun = cron.schedule(cronConfig.expression, () => {}, {
        scheduled: false,
      }).nextDates(1);

      task.nextRunAt = nextRun?.toDate().getTime();

      logger.info({ taskId: task.id, expression: cronConfig.expression }, 'Cron job registered');
    } catch (error) {
      logger.error({ taskId: task.id, error }, 'Failed to register cron job');
    }
  }

  /**
   * 取消注册 CRON 任务
   */
  private unregisterCronJob(taskId: string): void {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }
  }

  // ============================================
  // 生命周期
  // ============================================

  /**
   * 初始化（从存储加载任务）
   */
  public async initialize(): Promise<void> {
    logger.info('TaskOrchestrator initializing');

    // 重新注册所有启用的 CRON 任务
    for (const task of await this.getEnabledTasks()) {
      if (task.trigger.type === 'CRON') {
        this.registerCronJob(task);
      }
    }

    logger.info({ taskCount: this.tasks.size }, 'TaskOrchestrator initialized');
  }

  /**
   * 关闭
   */
  public shutdown(): void {
    // 停止所有 CRON 任务
    for (const [, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();

    logger.info('TaskOrchestrator shutdown');
  }
}

// 导出单例
export const taskOrchestrator = TaskOrchestrator.getInstance();
export default taskOrchestrator;
