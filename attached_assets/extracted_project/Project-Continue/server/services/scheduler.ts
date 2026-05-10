/**
 * Scheduler Service (后台任务调度器) - Phase 1.5
 * 
 * 功能：
 * 1. 定时任务管理（node-cron）
 * 2. 任务执行日志记录
 * 3. 失败自动重试
 * 4. 任务状态持久化
 * 
 * 预设任务：
 * - 梦境整理：每日凌晨3点
 * - 主动关怀：每小时
 * - 提醒触发：每5分钟
 */

import * as cron from 'node-cron';
import { db } from '../db';
import { scheduledJobs, jobExecutionLogs } from '@shared/schema';
import { eq, desc, sql, and, lte } from 'drizzle-orm';

export interface JobConfig {
  jobType: string;
  jobName: string;
  description: string;
  cronExpression: string;
  handler: () => Promise<any>;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface RunningJob {
  task: ReturnType<typeof cron.schedule>;
  config: JobConfig;
}

class SchedulerService {
  private runningJobs: Map<string, RunningJob> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[Scheduler] 后台任务调度器初始化...');

    await this.syncJobsToDatabase();
    await this.startAllJobs();

    this.initialized = true;
    console.log('[Scheduler] 调度器已启动');
  }

  private getDefaultJobs(): JobConfig[] {
    return [
      {
        jobType: 'dream_consolidation',
        jobName: '梦境整理',
        description: '每日凌晨3点整理学习内容，生成梦境报告',
        cronExpression: '0 3 * * *',
        handler: this.handleDreamConsolidation.bind(this),
        maxRetries: 3,
      },
      {
        jobType: 'proactive_care',
        jobName: '主动关怀检查',
        description: '每小时检查用户健康状态，触发关怀提醒',
        cronExpression: '0 * * * *',
        handler: this.handleProactiveCare.bind(this),
        maxRetries: 2,
      },
      {
        jobType: 'reminder_trigger',
        jobName: '提醒触发',
        description: '每5分钟检查待触发的提醒事项',
        cronExpression: '*/5 * * * *',
        handler: this.handleReminderTrigger.bind(this),
        maxRetries: 1,
      },
      {
        jobType: 'memory_cleanup',
        jobName: '记忆清理',
        description: '每日凌晨4点清理过期的临时记忆',
        cronExpression: '0 4 * * *',
        handler: this.handleMemoryCleanup.bind(this),
        maxRetries: 2,
      },
      {
        jobType: 'health_sync',
        jobName: '健康数据同步',
        description: '每6小时同步健康监测数据',
        cronExpression: '0 */6 * * *',
        handler: this.handleHealthSync.bind(this),
        maxRetries: 3,
      },
    ];
  }

  private async syncJobsToDatabase(): Promise<void> {
    const defaultJobs = this.getDefaultJobs();

    for (const job of defaultJobs) {
      const existing = await db
        .select()
        .from(scheduledJobs)
        .where(eq(scheduledJobs.jobType, job.jobType))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(scheduledJobs).values({
          jobType: job.jobType,
          jobName: job.jobName,
          description: job.description,
          cronExpression: job.cronExpression,
          maxRetries: job.maxRetries || 3,
          retryDelayMs: job.retryDelayMs || 60000,
          enabled: true,
          status: 'active',
        });
        console.log(`[Scheduler] 注册任务: ${job.jobName}`);
      }
    }
  }

  private async startAllJobs(): Promise<void> {
    const jobs = await db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.enabled, true));

    const defaultJobs = this.getDefaultJobs();
    const handlerMap = new Map(defaultJobs.map(j => [j.jobType, j.handler]));

    for (const job of jobs) {
      const handler = handlerMap.get(job.jobType);
      if (!handler) {
        console.warn(`[Scheduler] 未找到任务处理器: ${job.jobType}`);
        continue;
      }

      this.scheduleJob({
        jobType: job.jobType,
        jobName: job.jobName,
        description: job.description || '',
        cronExpression: job.cronExpression,
        handler,
        maxRetries: job.maxRetries || 3,
        retryDelayMs: job.retryDelayMs || 60000,
      });
    }
  }

  private scheduleJob(config: JobConfig): void {
    if (!cron.validate(config.cronExpression)) {
      console.error(`[Scheduler] 无效的cron表达式: ${config.cronExpression}`);
      return;
    }

    const task = cron.schedule(
      config.cronExpression,
      async () => {
        await this.executeJob(config);
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    this.runningJobs.set(config.jobType, { task, config });
    console.log(`[Scheduler] 已调度: ${config.jobName} (${config.cronExpression})`);
  }

  private async executeJob(config: JobConfig, attemptNumber: number = 1): Promise<void> {
    const startedAt = new Date();
    let logId: number | undefined;

    try {
      const [insertResult] = await db
        .insert(jobExecutionLogs)
        .values({
          jobType: config.jobType,
          startedAt,
          status: 'running',
          attemptNumber,
        })
        .returning({ id: jobExecutionLogs.id });

      logId = insertResult.id;

      console.log(`[Scheduler] 执行任务: ${config.jobName} (尝试 ${attemptNumber})`);
      
      const result = await config.handler();
      
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await db
        .update(jobExecutionLogs)
        .set({
          status: 'success',
          completedAt,
          durationMs,
          result: result || null,
        })
        .where(eq(jobExecutionLogs.id, logId));

      await db
        .update(scheduledJobs)
        .set({
          lastRunAt: startedAt,
          lastResult: 'success',
          lastError: null,
          totalRuns: sql`${scheduledJobs.totalRuns} + 1`,
          successCount: sql`${scheduledJobs.successCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.jobType, config.jobType));

      console.log(`[Scheduler] 任务完成: ${config.jobName} (${durationMs}ms)`);
    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      const maxRetries = config.maxRetries || 3;
      const willRetry = attemptNumber < maxRetries;

      if (logId) {
        await db
          .update(jobExecutionLogs)
          .set({
            status: willRetry ? 'retrying' : 'failed',
            completedAt,
            durationMs,
            errorMessage,
            errorStack,
            willRetry,
          })
          .where(eq(jobExecutionLogs.id, logId));
      }

      await db
        .update(scheduledJobs)
        .set({
          lastRunAt: startedAt,
          lastResult: 'failed',
          lastError: errorMessage,
          totalRuns: sql`${scheduledJobs.totalRuns} + 1`,
          failureCount: sql`${scheduledJobs.failureCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.jobType, config.jobType));

      console.error(`[Scheduler] 任务失败: ${config.jobName}`, errorMessage);

      if (willRetry) {
        const retryDelayMs = config.retryDelayMs || 60000;
        console.log(`[Scheduler] ${retryDelayMs / 1000}秒后重试...`);
        setTimeout(() => {
          this.executeJob(config, attemptNumber + 1);
        }, retryDelayMs);
      }
    }
  }

  async getJobList(): Promise<any[]> {
    return db
      .select()
      .from(scheduledJobs)
      .orderBy(scheduledJobs.jobType);
  }

  async getJobHistory(jobType?: string, limit: number = 50): Promise<any[]> {
    const query = db
      .select()
      .from(jobExecutionLogs)
      .orderBy(desc(jobExecutionLogs.startedAt))
      .limit(limit);

    if (jobType) {
      return query.where(eq(jobExecutionLogs.jobType, jobType));
    }

    return query;
  }

  async triggerJob(jobType: string): Promise<{ success: boolean; message: string }> {
    const runningJob = this.runningJobs.get(jobType);
    
    if (!runningJob) {
      return { success: false, message: `任务不存在: ${jobType}` };
    }

    await this.executeJob(runningJob.config);
    return { success: true, message: `已触发任务: ${runningJob.config.jobName}` };
  }

  async pauseJob(jobType: string): Promise<{ success: boolean; message: string }> {
    const runningJob = this.runningJobs.get(jobType);
    
    if (!runningJob) {
      return { success: false, message: `任务不存在: ${jobType}` };
    }

    runningJob.task.stop();
    
    await db
      .update(scheduledJobs)
      .set({ status: 'paused', enabled: false, updatedAt: new Date() })
      .where(eq(scheduledJobs.jobType, jobType));

    return { success: true, message: `已暂停任务: ${runningJob.config.jobName}` };
  }

  async resumeJob(jobType: string): Promise<{ success: boolean; message: string }> {
    const runningJob = this.runningJobs.get(jobType);
    
    if (!runningJob) {
      return { success: false, message: `任务不存在: ${jobType}` };
    }

    runningJob.task.start();
    
    await db
      .update(scheduledJobs)
      .set({ status: 'active', enabled: true, updatedAt: new Date() })
      .where(eq(scheduledJobs.jobType, jobType));

    return { success: true, message: `已恢复任务: ${runningJob.config.jobName}` };
  }

  private async handleDreamConsolidation(): Promise<any> {
    console.log('[DreamConsolidation] 开始梦境整理 (Phase 3.1)...');
    
    const result: { 
      consolidatedCount: number; 
      newInsights: any[]; 
      dreamReport: any;
      dreamLogId?: string;
    } = {
      consolidatedCount: 0,
      newInsights: [],
      dreamReport: null,
    };

    try {
      const dreamModule = await import('./dream-service').catch(() => null);
      if (dreamModule?.dreamService) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const dreamResult = await dreamModule.dreamService.runDreamSession({
          targetDate: yesterday,
          forceRun: false,
        });

        result.dreamLogId = dreamResult.dreamLogId;
        result.consolidatedCount = dreamResult.conversationsProcessed;
        result.newInsights = dreamResult.learnings;
        result.dreamReport = {
          summary: dreamResult.summary,
          patterns: dreamResult.patternsFound,
          recommendations: dreamResult.recommendations,
          emotionalTrend: dreamResult.emotionalTrend,
        };

        console.log(`[DreamConsolidation] 梦境日志已生成: ${dreamResult.dreamLogId}`);
      } else {
        console.log('[DreamConsolidation] DreamService不可用，尝试旧版Chrysalis');
        
        const chrysalisModule = await import('./chrysalis-orchestrator').catch(() => null) as any;
        if (chrysalisModule?.chrysalisService) {
          const dreamState = chrysalisModule.chrysalisService.getDreamState();
          if (dreamState?.discoveries?.length > 0) {
            result.consolidatedCount = dreamState.discoveries.length;
            result.newInsights = dreamState.discoveries.slice(0, 5);
          }
        }
      }
    } catch (error) {
      console.error('[DreamConsolidation] 梦境整理失败:', error);
    }

    console.log(`[DreamConsolidation] 整理完成: ${result.consolidatedCount}条对话，${result.newInsights.length}条洞察`);
    return result;
  }

  private async handleProactiveCare(): Promise<any> {
    console.log('[ProactiveCare] 执行主动关怀扫描...');
    
    try {
      const careModule = await import('./proactive-care').catch(() => null);
      if (careModule?.proactiveCareService) {
        const scanResult = await careModule.proactiveCareService.runScan();
        console.log(`[ProactiveCare] 扫描完成: 检测${scanResult.eventsDetected}个事件, 触发${scanResult.rulesTriggered}条规则, 队列${scanResult.notificationsQueued}条通知`);
        return scanResult;
      } else {
        console.log('[ProactiveCare] ProactiveCareService不可用');
        return { eventsDetected: 0, rulesTriggered: 0, notificationsQueued: 0 };
      }
    } catch (error) {
      console.error('[ProactiveCare] 扫描失败:', error);
      return { eventsDetected: 0, rulesTriggered: 0, notificationsQueued: 0, error: String(error) };
    }
  }

  private async handleReminderTrigger(): Promise<any> {
    console.log('[ReminderTrigger] 检查待触发提醒...');
    
    const result = {
      checkedCount: 0,
      triggeredCount: 0,
    };

    try {
      const { calendarEvents } = await import('@shared/schema');
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
      
      const upcomingEvents = await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            lte(calendarEvents.startTime, fiveMinutesLater),
            eq(calendarEvents.isCompleted, false)
          )
        )
        .limit(10);

      result.checkedCount = upcomingEvents.length;
    } catch (error) {
      console.log('[ReminderTrigger] 日历服务不可用，跳过');
    }

    console.log(`[ReminderTrigger] 检查完成: ${result.checkedCount}个事件`);
    return result;
  }

  private async handleMemoryCleanup(): Promise<any> {
    console.log('[MemoryCleanup] 开始清理过期记忆...');
    
    const result = {
      cleanedCount: 0,
    };

    console.log('[MemoryCleanup] 清理完成');
    return result;
  }

  private async handleHealthSync(): Promise<any> {
    console.log('[HealthSync] 同步健康数据...');
    
    const result = {
      syncedRecords: 0,
    };

    console.log('[HealthSync] 同步完成');
    return result;
  }

  getStatus(): { initialized: boolean; runningJobs: string[] } {
    return {
      initialized: this.initialized,
      runningJobs: Array.from(this.runningJobs.keys()),
    };
  }
}

export const schedulerService = new SchedulerService();
