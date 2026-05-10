/**
 * 任务编排系统 Repository
 *
 * 提供任务和执行历史的数据库操作
 */

import { eq, desc, and, sql } from "drizzle-orm";
import { getDatabase } from "../db";
import { createServiceLogger } from '../lib/logger';
import {
  tasks,
  taskExecutions,
  pcDevices,
  pcSessions,
  taskAlerts,
  type Task,
  type InsertTask,
  type TaskExecution,
  type InsertTaskExecution,
  type PcDevice,
  type InsertPcDevice,
  type PcSession,
  type InsertPcSession,
  type TaskAlert,
  type InsertTaskAlert
} from "../../shared/schema";

const logger = createServiceLogger('TaskRepository');

// ============================================
// 任务 Repository
// ============================================

export class TaskRepository {
  private db = getDatabase();

  async create(data: InsertTask): Promise<Task> {
    const result = await this.db
      .insert(tasks)
      .values(data)
      .returning();
    return result[0]!;
  }

  async findById(id: string): Promise<Task | undefined> {
    const result = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return result[0];
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<Task[]> {
    return await this.db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findEnabled(): Promise<Task[]> {
    return await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.enabled, true));
  }

  async findByStatus(status: string): Promise<Task[]> {
    return await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, status));
  }

  async update(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await this.db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async updateStatus(id: string, status: string): Promise<Task | undefined> {
    return await this.update(id, { status: status as Task['status'] });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();
    return result.length > 0;
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks);
    return Number(result[0]?.count || 0);
  }

  async updateLastRunAt(id: string): Promise<void> {
    await this.db
      .update(tasks)
      .set({ lastRunAt: new Date() })
      .where(eq(tasks.id, id));
  }

  async updateNextRunAt(id: string, nextRunAt: Date): Promise<void> {
    await this.db
      .update(tasks)
      .set({ nextRunAt })
      .where(eq(tasks.id, id));
  }
}

export const taskRepository = new TaskRepository();

// ============================================
// 任务执行历史 Repository
// ============================================

export class TaskExecutionRepository {
  private db = getDatabase();

  async create(data: InsertTaskExecution): Promise<TaskExecution> {
    const result = await this.db
      .insert(taskExecutions)
      .values(data)
      .returning();
    return result[0]!;
  }

  async findById(id: string): Promise<TaskExecution | undefined> {
    const result = await this.db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.id, id))
      .limit(1);
    return result[0];
  }

  async findByTaskId(taskId: string, limit: number = 50): Promise<TaskExecution[]> {
    return await this.db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit);
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<TaskExecution[]> {
    return await this.db
      .select()
      .from(taskExecutions)
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit)
      .offset(offset);
  }

  async findFailed(limit: number = 50): Promise<TaskExecution[]> {
    return await this.db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.status, 'FAILED'))
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit);
  }

  async update(id: string, data: Partial<InsertTaskExecution>): Promise<TaskExecution | undefined> {
    const result = await this.db
      .update(taskExecutions)
      .set(data)
      .where(eq(taskExecutions.id, id))
      .returning();
    return result[0];
  }

  async complete(id: string, result: TaskExecution['result']): Promise<TaskExecution | undefined> {
    return await this.update(id, {
      status: result.success ? 'COMPLETED' : 'FAILED',
      completedAt: new Date(),
      result,
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(taskExecutions)
      .where(eq(taskExecutions.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .delete(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .returning();
    return result.length;
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(taskExecutions);
    return Number(result[0]?.count || 0);
  }

  async getTaskStats(taskId: string): Promise<{
    totalRuns: number;
    successCount: number;
    failedCount: number;
    avgDuration: number;
    lastRun: Date | null;
  }> {
    const stats = await this.db
      .select({
        totalRuns: sql<number>`count(*)`,
        successCount: sql<number>`count(*) FILTER (WHERE status = 'COMPLETED')`,
        failedCount: sql<number>`count(*) FILTER (WHERE status = 'FAILED')`,
        avgDuration: sql<number>`avg(extract(epoch from (completedAt - startedAt)) * 1000)`,
        lastRun: sql<Date>`max(startedAt)`,
      })
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId));

    return {
      totalRuns: Number(stats[0]?.totalRuns || 0),
      successCount: Number(stats[0]?.successCount || 0),
      failedCount: Number(stats[0]?.failedCount || 0),
      avgDuration: Number(stats[0]?.avgDuration || 0),
      lastRun: stats[0]?.lastRun || null,
    };
  }
}

export const taskExecutionRepository = new TaskExecutionRepository();

// ============================================
// PC设备 Repository
// ============================================

export class PcDeviceRepository {
  private db = getDatabase();

  async create(data: InsertPcDevice): Promise<PcDevice> {
    const result = await this.db
      .insert(pcDevices)
      .values(data)
      .returning();
    return result[0]!;
  }

  async findById(id: string): Promise<PcDevice | undefined> {
    const result = await this.db
      .select()
      .from(pcDevices)
      .where(eq(pcDevices.id, id))
      .limit(1);
    return result[0];
  }

  async findAll(): Promise<PcDevice[]> {
    return await this.db
      .select()
      .from(pcDevices)
      .orderBy(desc(pcDevices.registeredAt));
  }

  async findOnline(): Promise<PcDevice[]> {
    return await this.db
      .select()
      .from(pcDevices)
      .where(eq(pcDevices.status, 'ONLINE'));
  }

  async update(id: string, data: Partial<InsertPcDevice>): Promise<PcDevice | undefined> {
    const result = await this.db
      .update(pcDevices)
      .set(data)
      .where(eq(pcDevices.id, id))
      .returning();
    return result[0];
  }

  async updateStatus(id: string, status: PcDevice['status']): Promise<PcDevice | undefined> {
    return await this.update(id, {
      status,
      lastSeen: new Date()
    });
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.db
      .update(pcDevices)
      .set({ lastSeen: new Date() })
      .where(eq(pcDevices.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(pcDevices)
      .where(eq(pcDevices.id, id))
      .returning();
    return result.length > 0;
  }
}

export const pcDeviceRepository = new PcDeviceRepository();

// ============================================
// PC会话 Repository
// ============================================

export class PcSessionRepository {
  private db = getDatabase();

  async create(data: InsertPcSession): Promise<PcSession> {
    const result = await this.db
      .insert(pcSessions)
      .values(data)
      .returning();
    return result[0]!;
  }

  async findById(id: string): Promise<PcSession | undefined> {
    const result = await this.db
      .select()
      .from(pcSessions)
      .where(eq(pcSessions.id, id))
      .limit(1);
    return result[0];
  }

  async findByDeviceId(deviceId: string): Promise<PcSession[]> {
    return await this.db
      .select()
      .from(pcSessions)
      .where(eq(pcSessions.deviceId, deviceId));
  }

  async findActive(deviceId: string): Promise<PcSession | undefined> {
    const result = await this.db
      .select()
      .from(pcSessions)
      .where(
        and(
          eq(pcSessions.deviceId, deviceId),
          eq(pcSessions.status, 'CONNECTED')
        )
      )
      .limit(1);
    return result[0];
  }

  async findAllActive(): Promise<PcSession[]> {
    return await this.db
      .select()
      .from(pcSessions)
      .where(eq(pcSessions.status, 'CONNECTED'));
  }

  async update(id: string, data: Partial<InsertPcSession>): Promise<PcSession | undefined> {
    const result = await this.db
      .update(pcSessions)
      .set(data)
      .where(eq(pcSessions.id, id))
      .returning();
    return result[0];
  }

  async updateLastActivity(id: string): Promise<void> {
    await this.db
      .update(pcSessions)
      .set({ lastActivity: new Date() })
      .where(eq(pcSessions.id, id));
  }

  async close(id: string): Promise<PcSession | undefined> {
    return await this.update(id, { status: 'DISCONNECTED' });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(pcSessions)
      .where(eq(pcSessions.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteByDeviceId(deviceId: string): Promise<number> {
    const result = await this.db
      .delete(pcSessions)
      .where(eq(pcSessions.deviceId, deviceId))
      .returning();
    return result.length;
  }
}

export const pcSessionRepository = new PcSessionRepository();

// ============================================
// 任务告警 Repository
// ============================================

export class TaskAlertRepository {
  private db = getDatabase();

  async create(data: InsertTaskAlert): Promise<TaskAlert> {
    const result = await this.db
      .insert(taskAlerts)
      .values(data)
      .returning();
    return result[0]!;
  }

  async findById(id: string): Promise<TaskAlert | undefined> {
    const result = await this.db
      .select()
      .from(taskAlerts)
      .where(eq(taskAlerts.id, id))
      .limit(1);
    return result[0];
  }

  async findByTaskId(taskId: string, limit: number = 50): Promise<TaskAlert[]> {
    return await this.db
      .select()
      .from(taskAlerts)
      .where(eq(taskAlerts.taskId, taskId))
      .orderBy(desc(taskAlerts.createdAt))
      .limit(limit);
  }

  async findPending(limit: number = 100): Promise<TaskAlert[]> {
    return await this.db
      .select()
      .from(taskAlerts)
      .where(eq(taskAlerts.status, 'PENDING'))
      .orderBy(desc(taskAlerts.createdAt))
      .limit(limit);
  }

  async findBySeverity(severity: TaskAlert['severity'], limit: number = 50): Promise<TaskAlert[]> {
    return await this.db
      .select()
      .from(taskAlerts)
      .where(eq(taskAlerts.severity, severity))
      .orderBy(desc(taskAlerts.createdAt))
      .limit(limit);
  }

  async update(id: string, data: Partial<InsertTaskAlert>): Promise<TaskAlert | undefined> {
    const result = await this.db
      .update(taskAlerts)
      .set(data)
      .where(eq(taskAlerts.id, id))
      .returning();
    return result[0];
  }

  async markAsSent(id: string): Promise<TaskAlert | undefined> {
    return await this.update(id, {
      status: 'SENT',
      sentAt: new Date(),
    });
  }

  async markAsRead(id: string): Promise<TaskAlert | undefined> {
    return await this.update(id, {
      status: 'READ',
      readAt: new Date(),
    });
  }

  async markAsDismissed(id: string): Promise<TaskAlert | undefined> {
    return await this.update(id, { status: 'DISMISSED' });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(taskAlerts)
      .where(eq(taskAlerts.id, id))
      .returning();
    return result.length > 0;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        status: taskAlerts.status,
        count: sql<number>`count(*)`,
      })
      .from(taskAlerts)
      .groupBy(taskAlerts.status);

    return result.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  }
}

export const taskAlertRepository = new TaskAlertRepository();
