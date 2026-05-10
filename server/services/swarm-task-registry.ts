/**
 * SwarmTaskRegistry
 *
 * 蜂群任务注册表：追踪蜂王广播的任务和节点回传的状态。
 * 运行时使用内存 Map 作为主存（最快），同时写穿到 PostgreSQL（重启恢复）。
 * DB 不可用时自动降级为纯内存模式。
 */

import { randomUUID } from 'crypto';
import { createServiceLogger } from '../lib/logger';
import { getDatabase } from '../db';
import { swarmTasks } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';

const logger = createServiceLogger('SwarmTaskRegistry');

export type NodeReportStatus = 'running' | 'completed' | 'failed';

export interface NodeReport {
  nodeId: string;
  status: NodeReportStatus;
  result?: unknown;
  error?: string;
  reportedAt: string;
}

export interface SwarmTaskRecord {
  id: string;
  taskName: string;
  payload: Record<string, unknown>;
  targetNodes: string;
  deliveredCount: number;
  broadcastedAt: string;
  reports: NodeReport[];
}

export class SwarmTaskRegistry {
  private tasks = new Map<string, SwarmTaskRecord>();

  /** 从 DB 恢复任务列表到内存（服务启动时调用一次）*/
  async hydrate(): Promise<void> {
    const db = getDatabase();
    if (!db) return;
    try {
      const rows = await db.select().from(swarmTasks);
      for (const row of rows) {
        const record: SwarmTaskRecord = {
          id: row.id,
          taskName: row.taskName,
          payload: (row.payload as Record<string, unknown>) ?? {},
          targetNodes: row.targetNodes,
          deliveredCount: row.deliveredCount,
          broadcastedAt: row.broadcastedAt instanceof Date
            ? row.broadcastedAt.toISOString()
            : String(row.broadcastedAt),
          reports: (row.reports as NodeReport[]) ?? [],
        };
        this.tasks.set(record.id, record);
      }
      logger.info({ count: rows.length }, 'SwarmTaskRegistry hydrated from DB');
    } catch (err) {
      logger.warn({ err }, 'SwarmTaskRegistry hydration failed — using empty in-memory state');
    }
  }

  async createTask(opts: {
    taskName: string;
    payload: Record<string, unknown>;
    targetNodes: string;
    deliveredCount: number;
  }): Promise<SwarmTaskRecord> {
    const task: SwarmTaskRecord = {
      id: randomUUID(),
      taskName: opts.taskName,
      payload: opts.payload,
      targetNodes: opts.targetNodes,
      deliveredCount: opts.deliveredCount,
      broadcastedAt: new Date().toISOString(),
      reports: [],
    };
    this.tasks.set(task.id, task);
    logger.info({ taskId: task.id, taskName: task.taskName }, 'Swarm task registered');

    const db = getDatabase();
    if (db) {
      try {
        await db.insert(swarmTasks).values({
          id: task.id,
          taskName: task.taskName,
          payload: task.payload,
          targetNodes: task.targetNodes,
          deliveredCount: task.deliveredCount,
          broadcastedAt: new Date(task.broadcastedAt),
          reports: task.reports,
        });
      } catch (err) {
        logger.warn({ err, taskId: task.id }, 'Failed to persist swarm task to DB');
      }
    }

    return task;
  }

  async addReport(taskId: string, report: Omit<NodeReport, 'reportedAt'>): Promise<NodeReport | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const full: NodeReport = { ...report, reportedAt: new Date().toISOString() };

    // 同一节点的旧报告被新报告覆盖（保留最新状态）
    const existingIdx = task.reports.findIndex(r => r.nodeId === report.nodeId);
    if (existingIdx >= 0) {
      task.reports[existingIdx] = full;
    } else {
      task.reports.push(full);
    }

    logger.info({ taskId, nodeId: report.nodeId, status: report.status }, 'Node report received');

    const db = getDatabase();
    if (db) {
      try {
        await db.update(swarmTasks)
          .set({ reports: task.reports, deliveredCount: task.deliveredCount })
          .where(eq(swarmTasks.id, taskId));
      } catch (err) {
        logger.warn({ err, taskId }, 'Failed to persist swarm report to DB');
      }
    }

    return full;
  }

  getTask(taskId: string): SwarmTaskRecord | null {
    return this.tasks.get(taskId) ?? null;
  }

  listTasks(): SwarmTaskRecord[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.broadcastedAt).getTime() - new Date(a.broadcastedAt).getTime(),
    );
  }

  /** 清理超过 N 小时的旧任务（内存 + DB）*/
  async gc(maxAgeHours = 24): Promise<number> {
    const cutoff = Date.now() - maxAgeHours * 3_600_000;
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (new Date(task.broadcastedAt).getTime() < cutoff) {
        this.tasks.delete(id);
        removed++;
      }
    }

    const db = getDatabase();
    if (db && removed > 0) {
      try {
        await db.delete(swarmTasks).where(lt(swarmTasks.broadcastedAt, new Date(cutoff)));
      } catch (err) {
        logger.warn({ err }, 'Failed to GC swarm tasks in DB');
      }
    }

    if (removed > 0) logger.info({ removed }, 'Swarm task GC completed');
    return removed;
  }
}

export const swarmTaskRegistry = new SwarmTaskRegistry();
