/**
 * 知识库调度服务 - Knowledge Scheduler
 * 
 * 功能：
 * 1. 定时执行政策同步任务
 * 2. 管理同步间隔和优先级
 * 3. 监控同步健康状态
 * 4. 支持手动触发和自动调度
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('KnowledgeScheduler');

import { policyHarvester } from './policy-harvester';
import { improvedKnowledgeSearch } from './improved-knowledge-search';

export interface ScheduleConfig {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  failureCount: number;
}

export interface SchedulerStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastSyncResult: unknown;
  nextScheduledRun: Date | null;
}

class KnowledgeScheduler {
  private schedules: Map<string, ScheduleConfig> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.initializeSchedules();
    logger.info('[KnowledgeScheduler] 知识库调度服务已初始化');
  }

  private initializeSchedules(): void {
    // 税务政策同步 - 每6小时
    this.schedules.set('tax_policy_sync', {
      id: 'tax_policy_sync',
      name: '税务政策同步',
      enabled: true,
      intervalMs: 6 * 60 * 60 * 1000,
      priority: 'HIGH',
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      failureCount: 0,
    });

    // 劳动法规同步 - 每12小时
    this.schedules.set('labor_law_sync', {
      id: 'labor_law_sync',
      name: '劳动法规同步',
      enabled: true,
      intervalMs: 12 * 60 * 60 * 1000,
      priority: 'HIGH',
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      failureCount: 0,
    });

    // 法律法规同步 - 每天
    this.schedules.set('legal_policy_sync', {
      id: 'legal_policy_sync',
      name: '法律法规同步',
      enabled: true,
      intervalMs: 24 * 60 * 60 * 1000,
      priority: 'NORMAL',
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      failureCount: 0,
    });

    // 知识库优化 - 每天凌晨
    this.schedules.set('knowledge_optimize', {
      id: 'knowledge_optimize',
      name: '知识库优化',
      enabled: true,
      intervalMs: 24 * 60 * 60 * 1000,
      priority: 'LOW',
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      failureCount: 0,
    });
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('[KnowledgeScheduler] 调度器已在运行中');
      return;
    }

    this.isRunning = true;
    
    // 计算下次运行时间并启动定时器
    this.calculateNextRunTimes();
    this.startTimer();

    logger.info('[KnowledgeScheduler] 调度器已启动');
    this.logScheduleStatus();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('[KnowledgeScheduler] 调度器已停止');
  }

  /**
   * 计算所有任务的下次运行时间
   */
  private calculateNextRunTimes(): void {
    const now = new Date();

    for (const [id, schedule] of this.schedules) {
      if (schedule.enabled && !schedule.nextRunAt) {
        schedule.nextRunAt = new Date(now.getTime() + schedule.intervalMs);
      }
    }
  }

  /**
   * 启动定时器
   */
  private startTimer(): void {
    const runNextTask = () => {
      if (!this.isRunning) return;

      const now = new Date();
      let nearestSchedule: ScheduleConfig | null = null;
      let nearestTime = Infinity;

      // 找到最近需要执行的任务
      for (const schedule of this.schedules.values()) {
        if (!schedule.enabled) continue;
        
        if (!schedule.nextRunAt) {
          schedule.nextRunAt = new Date(now.getTime() + schedule.intervalMs);
        }

        const timeUntilRun = schedule.nextRunAt.getTime() - now.getTime();
        if (timeUntilRun < nearestTime && timeUntilRun > 0) {
          nearestTime = timeUntilRun;
          nearestSchedule = schedule;
        }
      }

      if (nearestSchedule && nearestTime < 60000) { // 1分钟内执行
        this.executeSchedule(nearestSchedule.id);
        
        // 设置下次运行
        nearestSchedule.nextRunAt = new Date(Date.now() + nearestSchedule.intervalMs);
      }

      // 继续调度
      this.timer = setTimeout(runNextTask, 30000); // 每30秒检查一次
    };

    this.timer = setTimeout(runNextTask, 5000);
  }

  /**
   * 执行指定调度任务
   */
  async executeSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      logger.error({ scheduleId }, '未找到调度任务');
      return;
    }

    logger.info({ schedule: schedule.name }, '开始执行调度任务');

    try {
      switch (scheduleId) {
        case 'tax_policy_sync':
        case 'labor_law_sync':
        case 'legal_policy_sync':
          await policyHarvester.syncAll();
          break;
          
        case 'knowledge_optimize':
          await improvedKnowledgeSearch.optimizeIndex();
          break;
          
        default:
          logger.warn({ scheduleId }, '未知的调度任务类型');
      }

      schedule.lastRunAt = new Date();
      schedule.runCount++;
      schedule.failureCount = 0;
      schedule.nextRunAt = new Date(Date.now() + schedule.intervalMs);
      
      logger.info({ schedule: schedule.name }, '调度任务执行成功');

    } catch (error) {
      schedule.failureCount++;
      logger.error({ err: error, schedule: schedule.name }, '调度任务执行失败');
    }
  }

  /**
   * 手动触发立即同步
   */
  async triggerImmediateSync(): Promise<any> {
    logger.info('[KnowledgeScheduler] 手动触发立即同步');
    return await policyHarvester.syncAll();
  }

  /**
   * 获取调度状态
   */
  getStatus(): {
    isRunning: boolean;
    schedules: ScheduleConfig[];
    stats: SchedulerStats;
  } {
    const schedules = Array.from(this.schedules.values());
    
    const stats: SchedulerStats = {
      totalRuns: schedules.reduce((sum, s) => sum + s.runCount, 0),
      successfulRuns: schedules.reduce((sum, s) => sum + (s.runCount - s.failureCount), 0),
      failedRuns: schedules.reduce((sum, s) => sum + s.failureCount, 0),
      lastSyncResult: null,
      nextScheduledRun: schedules
        .filter(s => s.enabled && s.nextRunAt)
        .sort((a, b) => (a.nextRunAt?.getTime() || 0) - (b.nextRunAt?.getTime() || 0))[0]?.nextRunAt || null,
    };

    return {
      isRunning: this.isRunning,
      schedules,
      stats,
    };
  }

  /**
   * 更新调度配置
   */
  updateSchedule(id: string, updates: Partial<ScheduleConfig>): void {
    const schedule = this.schedules.get(id);
    if (schedule) {
      Object.assign(schedule, updates);
      logger.info({ schedule: schedule.name, updates }, '调度配置已更新');
    }
  }

  /**
   * 启用/禁用调度
   */
  setEnabled(id: string, enabled: boolean): void {
    const schedule = this.schedules.get(id);
    if (schedule) {
      schedule.enabled = enabled;
      if (!enabled) {
        schedule.nextRunAt = null;
      } else {
        schedule.nextRunAt = new Date(Date.now() + schedule.intervalMs);
      }
      logger.info({ schedule: schedule.name, enabled }, '调度状态已更改');
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): SchedulerStats {
    const schedules = Array.from(this.schedules.values());
    return {
      totalRuns: schedules.reduce((sum, s) => sum + s.runCount, 0),
      successfulRuns: schedules.reduce((sum, s) => sum + (s.runCount - s.failureCount), 0),
      failedRuns: schedules.reduce((sum, s) => sum + s.failureCount, 0),
      lastSyncResult: null,
      nextScheduledRun: schedules
        .filter(s => s.enabled && s.nextRunAt)
        .sort((a, b) => (a.nextRunAt?.getTime() || 0) - (b.nextRunAt?.getTime() || 0))[0]?.nextRunAt || null,
    };
  }

  private logScheduleStatus(): void {
    const status = this.getStatus();
    logger.info({
      isRunning: status.isRunning,
      schedules: status.schedules.map(s => ({
        name: s.name,
        enabled: s.enabled,
        nextRunAt: s.nextRunAt?.toISOString(),
      })),
    }, '调度任务状态');
  }
}

export const knowledgeScheduler = new KnowledgeScheduler();
export default knowledgeScheduler;
