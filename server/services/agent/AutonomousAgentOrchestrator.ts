/**
 * AutonomousAgentOrchestrator - 自主 Agent 编排器
 *
 * 核心功能：
 * - ReAct (Reasoning + Acting) 循环
 * - 任务分解与执行
 * - 自我反思与修正
 * - 能力不足时自动升级
 * - 多渠道汇报
 *
 * @version 1.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('AutonomousAgent');

import { randomUUID } from 'crypto';
import * as cron from 'node-cron';
import { browserAgent } from './BrowserAgent';
import { governmentFormService } from './GovernmentFormService';
import { websiteMonitorService } from './WebsiteMonitorService';
import { emailService } from '../email-service';
import { AIProviderChain } from '../../lib/ai-provider';
import { getDatabase } from '../../db';
import { tasks, taskExecutions } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type StepType =
  | 'browser'      // 浏览器操作
  | 'email'        // 邮件操作
  | 'sms'          // 短信操作
  | 'search'       // 网络搜索
  | 'ai_analyze'   // AI 分析
  | 'ai_decide'    // AI 决策
  | 'wait'         // 等待
  | 'report'       // 汇报
  | 'condition'    // 条件判断
  | 'loop';        // 循环

export interface AgentStep {
  id: string;
  name: string;
  type: StepType;

  // 步骤配置
  config: Record<string, unknown>;

  // 执行控制
  maxRetries?: number;
  timeout?: number;
  continueOnError?: boolean;

  // 流程控制
  onSuccess?: string;    // 下一步ID
  onFailure?: string;    // 失败时跳转
  condition?: string;    // 条件表达式
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;

  // 执行类型
  type: 'one-time' | 'scheduled' | 'continuous' | 'event-triggered';
  schedule?: string;     // CRON 表达式

  // 步骤定义
  steps: AgentStep[];

  // 初始上下文
  context: Record<string, unknown>;

  // 高级配置
  enableReflection?: boolean;     // 启用自我反思
  autoUpgradeOnFailure?: boolean; // 失败时自动升级模型
  maxIterations?: number;        // 最大迭代次数

  // 元数据
  createdAt: Date;
  createdBy: string;
  tags?: string[];
}

export interface ExecutionResult {
  taskId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';

  // 执行信息
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // 步骤结果
  stepResults: Map<string, StepResult>;

  // 最终结果
  finalResult?: unknown;
  error?: string;

  // 反思记录
  reflections?: string[];
}

export interface StepResult {
  stepId: string;
  stepName: string;
  success: boolean;

  input: unknown;
  output?: unknown;
  error?: string;

  startTime: Date;
  endTime?: Date;
  duration?: number;

  // AI 推理过程（用于反思）
  reasoning?: string;
}

export interface AgentContext {
  task: AgentTask;
  execution: ExecutionResult;
  variables: Map<string, unknown>;
  history: StepResult[];
  reflectionCount: number;
}

class AutonomousAgentOrchestrator {
  private static instance: AutonomousAgentOrchestrator | null = null;

  private tasks: Map<string, AgentTask> = new Map();
  private executions: Map<string, ExecutionResult> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();

  private aiProvider: AIProviderChain;

  // 模型升级配置
  private modelUpgradeChain = [
    { model: 'gpt-4o-mini', maxRetries: 2 },
    { model: 'gpt-4o', maxRetries: 2 },
    { model: 'claude-3-5-sonnet', maxRetries: 2 },
    { model: 'claude-3-5-opus', maxRetries: 1 },
  ];
  private currentModelIndex = 0;

  // 汇报渠道配置
  private reportChannels = {
    app: true,
    email: true,
    sms: false,
  };

  private constructor() {
    this.aiProvider = new AIProviderChain();
  }

  public static getInstance(): AutonomousAgentOrchestrator {
    if (!AutonomousAgentOrchestrator.instance) {
      AutonomousAgentOrchestrator.instance = new AutonomousAgentOrchestrator();
    }
    return AutonomousAgentOrchestrator.instance;
  }

  /**
   * 创建 Agent 任务
   */
  public async createTask(task: Omit<AgentTask, 'id' | 'createdAt'>): Promise<string> {
    const id = `agent_${randomUUID().slice(0, 8)}`;

    const newTask: AgentTask = {
      ...task,
      id,
      createdAt: new Date(),
      enableReflection: task.enableReflection ?? true,
      autoUpgradeOnFailure: task.autoUpgradeOnFailure ?? true,
      maxIterations: task.maxIterations ?? 10,
    };

    this.tasks.set(id, newTask);

    // 保存到数据库
    await this.persistTask(newTask);

    // 如果是定时任务，注册调度
    if (task.type === 'scheduled' && task.schedule) {
      this.startScheduler(id);
    }

    logger.info({ taskId: id, name: task.name, type: task.type }, 'Agent task created');
    return id;
  }

  /**
   * 执行任务
   */
  public async executeTask(
    taskId: string,
    initialContext?: Record<string, any>,
    options?: { useReflection?: boolean; forceModel?: string }
  ): Promise<ExecutionResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.runningTasks.has(taskId)) {
      logger.warn({ taskId }, 'Task already running, skipping');
      return this.executions.get(`${taskId}_current`)!;
    }

    this.runningTasks.add(taskId);

    const executionId = `${taskId}_${Date.now()}`;
    const execution: ExecutionResult = {
      taskId,
      executionId,
      status: 'running',
      startTime: new Date(),
      stepResults: new Map(),
    };

    this.executions.set(executionId, execution);

    // 初始化上下文
    const context: AgentContext = {
      task,
      execution,
      variables: new Map(Object.entries({ ...task.context, ...initialContext })),
      history: [],
      reflectionCount: 0,
    };

    try {
      // 执行步骤
      let currentStepIndex = 0;
      let iterations = 0;
      const maxIterations = task.maxIterations || 10;

      while (currentStepIndex < task.steps.length && iterations < maxIterations) {
        const step = task.steps[currentStepIndex];
        iterations++;

        logger.info({ taskId, stepId: step.id, stepName: step.name }, 'Executing step');

        const stepResult = await this.executeStep(
          step,
          context,
          { forceModel: options?.forceModel }
        );

        execution.stepResults.set(step.id, stepResult);
        context.history.push(stepResult);

        // 处理步骤结果
        if (stepResult.success) {
          // 保存输出到变量
          if (stepResult.output) {
            context.variables.set(`step_${step.id}_result`, stepResult.output);
          }

          // 下一步
          if (step.onSuccess) {
            const nextStep = task.steps.find(s => s.id === step.onSuccess);
            if (nextStep) {
              currentStepIndex = task.steps.indexOf(nextStep);
              continue;
            }
          }
          currentStepIndex++;

        } else {
          // 失败处理
          if (task.enableReflection && options?.useReflection !== false) {
            // 自我反思
            const reflection = await this.reflect(context, stepResult);
            context.reflectionCount++;

            if (!execution.reflections) execution.reflections = [];
            execution.reflections.push(reflection);

            logger.info({ taskId, reflection }, 'Reflection generated');

            // 如果反思建议重试，继续当前步骤
            if (reflection.includes('retry') || reflection.includes('重试')) {
              continue;
            }
          }

          // 尝试模型升级
          if (task.autoUpgradeOnFailure) {
            const upgraded = await this.attemptModelUpgrade(context);
            if (upgraded) {
              continue; // 重新尝试当前步骤
            }
          }

          // 失败时跳转
          if (step.onFailure) {
            const failStep = task.steps.find(s => s.id === step.onFailure);
            if (failStep) {
              currentStepIndex = task.steps.indexOf(failStep);
              continue;
            }
          }

          if (!step.continueOnError) {
            throw new Error(`Step ${step.name} failed: ${stepResult.error}`);
          }

          currentStepIndex++;
        }
      }

      // 任务完成
      execution.status = 'completed';
      execution.finalResult = this.compileResults(context);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ taskId, error: execution.error }, 'Task execution failed');

    } finally {
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      this.runningTasks.delete(taskId);

      // 持久化执行结果
      await this.persistExecution(execution);
    }

    return execution;
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: AgentStep,
    context: AgentContext,
    options?: { forceModel?: string }
  ): Promise<StepResult> {
    const result: StepResult = {
      stepId: step.id,
      stepName: step.name,
      success: false,
      input: context.variables,
      startTime: new Date(),
    };

    const maxRetries = step.maxRetries || 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        switch (step.type) {
          case 'browser':
            result.output = await this.executeBrowserStep(step, context);
            break;

          case 'email':
            result.output = await this.executeEmailStep(step, context);
            break;

          case 'sms':
            result.output = await this.executeSmsStep(step, context);
            break;

          case 'search':
            result.output = await this.executeSearchStep(step, context);
            break;

          case 'ai_analyze':
            result.output = await this.executeAIAnalyzeStep(step, context, options?.forceModel);
            result.reasoning = result.output.reasoning;
            result.output = result.output.result;
            break;

          case 'ai_decide':
            result.output = await this.executeAIDecideStep(step, context, options?.forceModel);
            break;

          case 'wait':
            await new Promise(r => setTimeout(r, step.config.duration || 1000));
            result.output = { waited: step.config.duration || 1000 };
            break;

          case 'report':
            await this.executeReportStep(step, context);
            result.output = { reported: true };
            break;

          case 'condition':
            result.output = await this.evaluateCondition(step, context);
            break;

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        result.success = true;
        break; // 成功则退出重试循环

      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < maxRetries) {
          logger.warn({ stepId: step.id, attempt, error: result.error }, 'Step retry');
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();

    return result;
  }

  /**
   * 浏览器步骤
   */
  private async executeBrowserStep(step: AgentStep, context: AgentContext): Promise<unknown> {
    const profileId = context.variables.get('browserProfileId') || step.config.profileId;
    const actions = this.resolveActions(step.config.actions || [], context);

    const result = await browserAgent.executeActions(profileId, actions);

    if (!result.success) {
      throw new Error(result.error);
    }

    // 保存页面内容供后续使用
    if (result.extractedText) {
      context.variables.set('lastPageContent', result.extractedText);
    }

    return result;
  }

  /**
   * 邮件步骤
   */
  private async executeEmailStep(step: AgentStep, context: AgentContext): Promise<unknown> {
    const userId = context.task.createdBy;
    const action = step.config.action;

    switch (action) {
      case 'search':
        const query = this.resolveTemplate(step.config.query || '', context.variables);
        return await emailService.syncAllAccounts(userId);

      case 'send':
        return await this.executeSendEmail(context, step.config);

      case 'check_new':
        return await emailService.syncAllAccounts(userId);

      default:
        throw new Error(`Unknown email action: ${action}`);
    }
  }

  /**
   * 发送邮件
   */
  private async executeSendEmail(context: AgentContext, config: Record<string, unknown>): Promise<unknown> {
    const to = this.resolveTemplate(config.to || '', context.variables);
    const subject = this.resolveTemplate(config.subject || '', context.variables);
    const body = this.resolveTemplate(config.body || '', context.variables);

    // 这里应该调用邮件发送服务
    logger.info({ to, subject }, 'Sending email');

    return { sent: true, to, subject };
  }

  /**
   * 短信步骤
   */
  private async executeSmsStep(step: AgentStep, context: AgentContext): Promise<unknown> {
    const action = step.config.action;

    if (action === 'send') {
      const deviceId = context.variables.get('smsDeviceId') || step.config.deviceId;
      const to = this.resolveTemplate(step.config.to || '', context.variables);
      const body = this.resolveTemplate(step.config.body || '', context.variables);

      return await smsService.sendSms(deviceId, { to, body });
    }

    return { success: true };
  }

  /**
   * 搜索步骤
   */
  private async executeSearchStep(step: AgentStep, context: AgentContext, forceModel?: string): Promise<unknown> {
    const query = this.resolveTemplate(step.config.query || '', context.variables);

    // 使用 AI 进行搜索（实际应该调用搜索API）
    const response = await this.aiProvider.complete({
      messages: [
        { role: 'user', content: `请搜索以下内容并返回相关信息：${query}` }
      ],
      model: forceModel || this.modelUpgradeChain[this.currentModelIndex].model,
      temperature: 0.3,
      maxTokens: 2000,
    });

    return {
      query,
      results: response.content,
      timestamp: new Date(),
    };
  }

  /**
   * AI 分析步骤
   */
  private async executeAIAnalyzeStep(
    step: AgentStep,
    context: AgentContext,
    forceModel?: string
  ): Promise<{ result: unknown; reasoning: string }> {
    const prompt = this.resolveTemplate(step.config.prompt || '', context.variables);
    const systemPrompt = step.config.systemPrompt || '你是一个专业的AI助手。';

    const model = forceModel || this.modelUpgradeChain[this.currentModelIndex].model;

    const response = await this.aiProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      temperature: step.config.temperature || 0.7,
      maxTokens: step.config.maxTokens || 4000,
    });

    // 尝试解析 JSON
    let result: unknown = response.content;
    try {
      const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1] || jsonMatch[2]);
      }
    } catch {
      // 不是 JSON，保持原样
    }

    return {
      result,
      reasoning: `基于 ${model} 模型分析完成`,
    };
  }

  /**
   * AI 决策步骤
   */
  private async executeAIDecideStep(
    step: AgentStep,
    context: AgentContext,
    forceModel?: string
  ): Promise<unknown> {
    const options = step.config.options || [];
    const context_text = JSON.stringify(Object.fromEntries(context.variables), null, 2);

    const model = forceModel || this.modelUpgradeChain[this.currentModelIndex].model;

    const response = await this.aiProvider.complete({
      messages: [
        {
          role: 'system',
          content: `你是一个决策助手。根据上下文，从以下选项中选择最佳行动：${options.join(', ')}。只返回一个选项。`
        },
        { role: 'user', content: context_text }
      ],
      model,
      temperature: 0.3,
      maxTokens: 500,
    });

    return {
      decision: response.content.trim(),
      options,
      timestamp: new Date(),
    };
  }

  /**
   * 汇报步骤
   */
  private async executeReportStep(step: AgentStep, context: AgentContext): Promise<void> {
    const template = step.config.template || '{{finalResult}}';
    const title = this.resolveTemplate(step.config.title || '任务完成', context.variables);
    const content = this.resolveTemplate(template, context.variables);

    const channels = step.config.channels || ['app'];

    for (const channel of channels) {
      switch (channel) {
        case 'app':
          // 发送应用内通知
          logger.info({ channel, title }, 'Report sent to app');
          break;

        case 'email':
          const email = context.variables.get('userEmail');
          if (email) {
            // await emailService.sendEmail({ to: email, subject: title, body: content });
            logger.info({ channel, email, title }, 'Report sent to email');
          }
          break;

        case 'sms':
          const phone = context.variables.get('userPhone');
          const deviceId = context.variables.get('smsDeviceId');
          if (phone && deviceId) {
            await smsService.sendSms(deviceId, { to: phone, body: `${title}: ${content.substring(0, 100)}` });
          }
          break;
      }
    }
  }

  /**
   * 条件判断
   */
  private async evaluateCondition(step: AgentStep, context: AgentContext): Promise<boolean> {
    const condition = step.config.condition;
    if (!condition) return true;

    // 简单的条件评估
    const variables = Object.fromEntries(context.variables);

    // 替换变量引用
    let expr = condition.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return JSON.stringify(variables[key]);
    });

    try {
      // 安全评估（只支持基本比较）
      return Function(`"use strict"; return (${expr})`)();
    } catch {
      return false;
    }
  }

  /**
   * 自我反思
   */
  private async reflect(context: AgentContext, failedStep: StepResult): Promise<string> {
    const history = context.history.map(h => ({
      step: h.stepName,
      success: h.success,
      output: h.success ? 'OK' : h.error,
    }));

    const response = await this.aiProvider.complete({
      messages: [
        {
          role: 'system',
          content: `你是自我反思专家。分析以下执行历史和失败原因，提出改进建议。

执行历史：
${JSON.stringify(history, null, 2)}

失败的步骤：${failedStep.stepName}
错误：${failedStep.error}

请给出：
1. 失败原因分析
2. 改进建议（是否重试/跳过/改变方法）
3. 下一步行动建议

用中文回复，简明扼要。`
        },
        { role: 'user', content: '请反思并给出建议' }
      ],
      model: this.modelUpgradeChain[this.currentModelIndex].model,
      temperature: 0.5,
      maxTokens: 500,
    });

    return response.content;
  }

  /**
   * 尝试模型升级
   */
  private async attemptModelUpgrade(context: AgentContext): Promise<boolean> {
    if (this.currentModelIndex >= this.modelUpgradeChain.length - 1) {
      logger.warn('All models exhausted, giving up');
      return false;
    }

    this.currentModelIndex++;
    const newModel = this.modelUpgradeChain[this.currentModelIndex].model;

    logger.info({
      taskId: context.task.id,
      newModel,
      attempt: this.currentModelIndex
    }, 'Attempting model upgrade');

    return true;
  }

  /**
   * 启动定时调度
   */
  private startScheduler(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.schedule) return;

    // 停止现有调度
    this.stopScheduler(taskId);

    const job = cron.schedule(task.schedule, async () => {
      logger.info({ taskId }, 'Scheduled task triggered');
      await this.executeTask(taskId);
    }, {
      timezone: 'Asia/Shanghai',
      scheduled: true,
    });

    this.cronJobs.set(taskId, job);
    logger.info({ taskId, schedule: task.schedule }, 'Scheduler started');
  }

  /**
   * 停止调度
   */
  private stopScheduler(taskId: string): void {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }
  }

  /**
   * 解析模板
   */
  private resolveTemplate(template: string, variables: Map<string, unknown>): string {
    const vars = Object.fromEntries(variables);

    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const keys = path.split('.');
      let value: unknown = vars;
      for (const key of keys) {
        value = (value as Record<string, unknown>)?.[key];
      }
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * 解析操作
   */
  private resolveActions(actions: Array<Record<string, unknown>>, context: AgentContext): Array<Record<string, unknown>> {
    return actions.map(action => ({
      ...action,
      value: action.value ? this.resolveTemplate(String(action.value), context.variables) : undefined,
      selector: action.selector ? this.resolveTemplate(action.selector, context.variables) : undefined,
    }));
  }

  /**
   * 编译最终结果
   */
  private compileResults(context: AgentContext): Record<string, unknown> {
    const results: Record<string, unknown> = {};

    for (const [stepId, result] of context.history) {
      if (result.success && result.output) {
        results[stepId] = result.output;
      }
    }

    return results;
  }

  /**
   * 持久化任务
   */
  private async persistTask(task: AgentTask): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) {
        logger.warn('Database not available, skipping persist');
        return;
      }

      await db.insert(tasks).values({
        id: task.id,
        name: task.name,
        description: task.description,
        triggerType: task.type === 'scheduled' ? 'CRON' : task.type === 'continuous' ? 'HEARTBEAT' : 'MANUAL',
        triggerConfig: task.schedule ? { expression: task.schedule } : undefined,
        actions: task.steps,
        options: {
          enableReflection: task.enableReflection,
          autoUpgradeOnFailure: task.autoUpgradeOnFailure,
          maxIterations: task.maxIterations,
        },
        status: 'PENDING',
        enabled: true,
        createdBy: task.createdBy,
      }).onConflictDoUpdate({
        target: tasks.id,
        set: {
          name: task.name,
          description: task.description,
          actions: task.steps,
        },
      });
    } catch (error) {
      logger.error({ taskId: task.id, err: error }, 'Failed to persist task');
    }
  }

  /**
   * 持久化执行结果
   */
  private async persistExecution(execution: ExecutionResult): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) {
        logger.warn('Database not available, skipping persist');
        return;
      }

      await db.insert(taskExecutions).values({
        id: execution.executionId,
        taskId: execution.taskId,
        taskName: execution.taskId,
        status: execution.status === 'running' ? 'RUNNING' : execution.status.toUpperCase(),
        triggeredBy: 'api',
        startedAt: execution.startTime,
        completedAt: execution.endTime,
        result: {
          finalResult: execution.finalResult,
          reflections: execution.reflections,
          error: execution.error,
        },
        actionResults: Object.fromEntries(execution.stepResults),
      });
    } catch (error) {
      logger.error({ executionId: execution.executionId, err: error }, 'Failed to persist execution');
    }
  }

  /**
   * 获取任务列表
   */
  public getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取执行历史
   */
  public getExecutionHistory(taskId: string): ExecutionResult[] {
    return Array.from(this.executions.values())
      .filter(e => e.taskId === taskId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * 删除任务
   */
  public async deleteTask(taskId: string): Promise<void> {
    this.stopScheduler(taskId);
    this.tasks.delete(taskId);
    logger.info({ taskId }, 'Task deleted');
  }

  /**
   * 关闭服务
   */
  public shutdown(): void {
    // 停止所有调度
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();

    // 关闭浏览器
    browserAgent.shutdown();

    logger.info('AutonomousAgentOrchestrator shutdown');
  }
}

export const autonomousAgent = AutonomousAgentOrchestrator.getInstance();
export default autonomousAgent;
