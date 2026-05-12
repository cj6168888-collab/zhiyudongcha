/**
 * ConversationActionExecutor
 *
 * 将 HybridAssistant 解析出的意图动作（action + actionParams）
 * 转化为对 storageAdapter / taskOrchestrator 的真实写入。
 *
 * 设计原则：
 * - 只在此处依赖 storage，不修改 HybridAssistant 核心逻辑
 * - 幂等性由调用方保证（每条用户消息只执行一次）
 * - 所有写入失败均记录日志并返回 success=false，不抛出
 * - pending/draft 写穿到 DB（重启恢复），DB 不可用时降级为纯内存
 */

import { createServiceLogger } from '../../lib/logger';
import { storageAdapter } from '../../storage/adapter';
import { taskOrchestrator } from '../task-orchestrator';
import { getDatabase } from '../../db';
import { pendingActions } from '@shared/schema';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { AssistantResponse, DraftItem } from './HybridAssistant';

const logger = createServiceLogger('ConversationActionExecutor');

const PENDING_TTL_MS = 10 * 60 * 1000; // 10分钟

interface PendingEntry {
  action: string;
  actionParams: Record<string, unknown>;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

interface DraftEntry {
  items: Array<{ action: string; label?: string; actionParams: Record<string, unknown> }>;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

type StoredDraftItem = { action: string; label?: string; actionParams: Record<string, unknown> };

export interface ExecutionResult {
  success: boolean;
  action: string;
  entityType?: 'project' | 'task' | 'memory';
  entityId?: string;
  entityData?: Record<string, unknown>;
  errorMessage?: string;
}

export interface PendingActionSnapshot {
  id: string;
  entryType: 'pending' | 'draft';
  action: string | null;
  actionParams?: Record<string, unknown>;
  items?: Array<{ action: string; label?: string; actionParams: Record<string, unknown> }>;
  expiresAt: Date;
  createdAt: Date;
}

export class ConversationActionExecutor {
  private pending = new Map<string, PendingEntry>();
  private drafts = new Map<string, DraftEntry>();

  /** 从 DB 恢复未过期的 pending/draft 条目（服务启动时调用一次）*/
  async hydrate(): Promise<void> {
    const db = getDatabase();
    if (!db) return;
    try {
      // 只加载还未过期的条目（expiresAt > now）
      const rows = await db.select().from(pendingActions).where(
        gt(pendingActions.expiresAt, new Date()),
      );
      let loaded = 0;
      for (const row of rows) {
        const expiresAt = row.expiresAt instanceof Date
          ? row.expiresAt.getTime()
          : new Date(String(row.expiresAt)).getTime();

        if (row.entryType === 'pending' && row.action) {
          this.pending.set(row.id, {
            action: row.action,
            actionParams: (row.actionParams as Record<string, unknown>) ?? {},
            userId: row.userId,
            expiresAt,
            createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(String(row.createdAt)).getTime(),
          });
          loaded++;
        } else if (row.entryType === 'draft' && row.items) {
          this.drafts.set(row.id, {
            items: row.items as Array<{ action: string; label?: string; actionParams: Record<string, unknown> }>,
            userId: row.userId,
            expiresAt,
            createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(String(row.createdAt)).getTime(),
          });
          loaded++;
        }
      }
      logger.info({ loaded }, 'ConversationActionExecutor hydrated from DB');
    } catch (err) {
      logger.warn({ err }, 'ConversationActionExecutor hydration failed');
    }
  }

  /**
   * 当 AI 返回 type=confirm 时，将待执行动作暂存；
   * 等用户通过 /authorize 确认后调用 executeByResponseId 消费。
   */
  async storePending(responseId: string, response: AssistantResponse, userId: string): Promise<void> {
    if (!response.action || response.type !== 'confirm') return;
    const expiresAt = Date.now() + PENDING_TTL_MS;
    this.pending.set(responseId, {
      action: response.action,
      actionParams: response.actionParams ?? {},
      userId,
      expiresAt,
      createdAt: Date.now(),
    });
    logger.debug({ responseId, action: response.action }, 'Pending action stored');

    const db = getDatabase();
    if (db) {
      try {
        await db.insert(pendingActions).values({
          id: responseId,
          entryType: 'pending',
          action: response.action,
          actionParams: response.actionParams ?? {},
          userId,
          expiresAt: new Date(expiresAt),
        }).onConflictDoUpdate({
          target: pendingActions.id,
          set: { action: response.action, actionParams: response.actionParams ?? {}, expiresAt: new Date(expiresAt) },
        });
      } catch (err) {
        logger.warn({ err, responseId }, 'Failed to persist pending action to DB');
      }
    }
  }

  /**
   * 草案（多实体）暂存：当 AI 返回 type=draft 时将条目列表暂存，
   * 等用户通过 /draft/confirm 确认后调用 executeDraftByResponseId 消费。
   */
  async storeDraft(responseId: string, items: DraftItem[], userId: string): Promise<void> {
    const expiresAt = Date.now() + PENDING_TTL_MS;
    const createdAt = Date.now();
    const itemData = this.normalizeDraftItems(items);
    this.drafts.set(responseId, { items: itemData, userId, expiresAt, createdAt });
    logger.debug({ responseId, count: items.length }, 'Draft stored');

    const db = getDatabase();
    if (db) {
      try {
        await db.insert(pendingActions).values({
          id: responseId,
          entryType: 'draft',
          items: itemData,
          userId,
          expiresAt: new Date(expiresAt),
        }).onConflictDoUpdate({
          target: pendingActions.id,
          set: { items: itemData, expiresAt: new Date(expiresAt) },
        });
      } catch (err) {
        logger.warn({ err, responseId }, 'Failed to persist draft to DB');
      }
    }
  }

  /**
   * 用户确认草案后，按 responseId 取出并顺序执行所有条目。
   * 执行完成后从 pending_actions 中删除（无论成功失败）。
   */
  async executeDraftByResponseId(responseId: string, userId?: string): Promise<ExecutionResult[] | null> {
    const entry = this.drafts.get(responseId);
    if (!entry) return null;
    if (userId && entry.userId !== userId) return null;
    if (Date.now() > entry.expiresAt) {
      this.drafts.delete(responseId);
      void this.dbDelete(responseId);
      return [{ success: false, action: 'draft', errorMessage: 'draft expired' }];
    }
    this.drafts.delete(responseId);
    void this.dbDelete(responseId);
    const results: ExecutionResult[] = [];
    for (const { action, actionParams } of entry.items) {
      const result = await this.dispatch(action, actionParams, entry.userId);
      if (result) results.push(result);
    }
    return results;
  }

  async updateDraftByResponseId(
    responseId: string,
    items: StoredDraftItem[],
    userId?: string,
  ): Promise<PendingActionSnapshot | null> {
    const entry = this.drafts.get(responseId);
    if (!entry) return null;
    if (userId && entry.userId !== userId) return null;
    if (Date.now() > entry.expiresAt) {
      this.drafts.delete(responseId);
      void this.dbDelete(responseId);
      return null;
    }

    const itemData = this.normalizeDraftItems(items);
    if (itemData.length === 0) return null;
    const updatedEntry = { ...entry, items: itemData };
    this.drafts.set(responseId, updatedEntry);
    await this.dbUpdateDraft(responseId, itemData, userId);

    return {
      id: responseId,
      entryType: 'draft',
      action: null,
      items: itemData,
      expiresAt: new Date(updatedEntry.expiresAt),
      createdAt: new Date(updatedEntry.createdAt),
    };
  }

  /**
   * 用户确认后，按 responseId 取出并执行挂起的动作。
   * 执行完成后从 pending 中删除（无论成功失败）。
   */
  async executeByResponseId(responseId: string, userId?: string): Promise<ExecutionResult | null> {
    const entry = this.pending.get(responseId);
    if (!entry) return null;
    if (userId && entry.userId !== userId) return null;
    if (Date.now() > entry.expiresAt) {
      this.pending.delete(responseId);
      void this.dbDelete(responseId);
      return { success: false, action: 'unknown', errorMessage: 'pending action expired' };
    }
    this.pending.delete(responseId);
    void this.dbDelete(responseId);
    return this.dispatch(entry.action, entry.actionParams, entry.userId);
  }

  async discardByResponseId(responseId: string, userId?: string): Promise<boolean> {
    let discarded = false;
    const pendingEntry = this.pending.get(responseId);
    if (pendingEntry && (!userId || pendingEntry.userId === userId)) {
      this.pending.delete(responseId);
      discarded = true;
    }

    const draftEntry = this.drafts.get(responseId);
    if (draftEntry && (!userId || draftEntry.userId === userId)) {
      this.drafts.delete(responseId);
      discarded = true;
    }

    discarded = await this.dbDelete(responseId, userId) || discarded;
    return discarded;
  }

  async execute(
    response: AssistantResponse,
    userId: string,
  ): Promise<ExecutionResult | null> {
    const { action, actionParams } = response;

    if (!action || response.type !== 'execute') return null;
    return this.dispatch(action, actionParams ?? {}, userId);
  }

  /** 清理 DB 中已过期的条目（可定期调用）*/
  async gcExpired(): Promise<void> {
    const db = getDatabase();
    if (!db) return;
    try {
      await db.delete(pendingActions).where(lt(pendingActions.expiresAt, new Date()));
    } catch (err) {
      logger.warn({ err }, 'Failed to GC expired pending actions');
    }
  }

  listActive(userId: string): PendingActionSnapshot[] {
    const now = Date.now();
    const rows: PendingActionSnapshot[] = [];

    for (const [id, entry] of this.pending.entries()) {
      if (entry.expiresAt <= now) {
        this.pending.delete(id);
        void this.dbDelete(id);
        continue;
      }
      if (entry.userId !== userId) continue;
      rows.push({
        id,
        entryType: 'pending',
        action: entry.action,
        actionParams: entry.actionParams,
        expiresAt: new Date(entry.expiresAt),
        createdAt: new Date(entry.createdAt),
      });
    }

    for (const [id, entry] of this.drafts.entries()) {
      if (entry.expiresAt <= now) {
        this.drafts.delete(id);
        void this.dbDelete(id);
        continue;
      }
      if (entry.userId !== userId) continue;
      rows.push({
        id,
        entryType: 'draft',
        action: null,
        items: entry.items,
        expiresAt: new Date(entry.expiresAt),
        createdAt: new Date(entry.createdAt),
      });
    }

    return rows;
  }

  private async dbDelete(id: string, userId?: string): Promise<boolean> {
    const db = getDatabase();
    if (!db) return false;
    try {
      await db.delete(pendingActions).where(
        userId
          ? and(eq(pendingActions.id, id), eq(pendingActions.userId, userId))
          : eq(pendingActions.id, id),
      );
      return true;
    } catch (err) {
      logger.warn({ err, id }, 'Failed to delete pending action from DB');
      return false;
    }
  }

  private async dbUpdateDraft(id: string, items: StoredDraftItem[], userId?: string): Promise<boolean> {
    const db = getDatabase();
    if (!db) return false;
    try {
      await db.update(pendingActions)
        .set({ items })
        .where(
          userId
            ? and(eq(pendingActions.id, id), eq(pendingActions.userId, userId))
            : eq(pendingActions.id, id),
        );
      return true;
    } catch (err) {
      logger.warn({ err, id }, 'Failed to update draft in DB');
      return false;
    }
  }

  private normalizeDraftItems(items: StoredDraftItem[]): StoredDraftItem[] {
    return items
      .filter((item) => item && typeof item.action === 'string' && item.actionParams && typeof item.actionParams === 'object')
      .map((item) => ({
        action: item.action,
        label: typeof item.label === 'string' ? item.label.trim() : undefined,
        actionParams: item.actionParams ?? {},
      }));
  }

  private async dispatch(
    action: string,
    params: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutionResult | null> {
    switch (action) {
      case 'create_project':
        return this.createProject(params, userId);

      case 'create_task':
        return this.createTask(params, userId);

      case 'save_memory':
        return this.saveMemory(params, userId);

      case 'search_vault':
        return this.searchVault(params);

      case 'create_person':
        return this.createPerson(params, userId);

      default:
        logger.debug({ action }, 'Unknown action — skipping execution');
        return null;
    }
  }

  private async createProject(
    params: Record<string, unknown>,
    _userId: string,
  ): Promise<ExecutionResult> {
    const title = String(params.title ?? '新项目');
    const description = params.description ? String(params.description) : undefined;

    try {
      const project = await storageAdapter.createProject({
        title,
        description,
        category: 'BUSINESS',
        status: 'PENDING_REVIEW',
        priority: 5,
      });

      logger.info({ projectId: project.id, title }, 'Project created from conversation');

      return {
        success: true,
        action: 'create_project',
        entityType: 'project',
        entityId: project.id,
        entityData: { id: project.id, title: project.title, status: project.status },
      };
    } catch (err) {
      logger.error({ err, title }, 'Failed to create project from conversation');
      return { success: false, action: 'create_project', errorMessage: String(err) };
    }
  }

  private async createTask(
    params: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutionResult> {
    const name = String(params.name ?? '新任务');
    const description = params.description ? String(params.description) : undefined;
    const triggerType = (params.triggerType as string) || 'MANUAL';

    const triggerConfig: Record<string, unknown> =
      triggerType === 'CRON' && params.cronExpression
        ? {
            expression: String(params.cronExpression),
            timezone: String(params.cronTimezone ?? 'Asia/Shanghai'),
          }
        : {};

    try {
      const task = await taskOrchestrator.createTask({
        name,
        description,
        trigger: { type: triggerType as 'MANUAL' | 'CRON', config: triggerConfig },
        actions: [],
        options: {},
        enabled: true,
        createdBy: userId,
      });

      logger.info({ taskId: task.id, name }, 'Task created from conversation');

      return {
        success: true,
        action: 'create_task',
        entityType: 'task',
        entityId: task.id,
        entityData: {
          id: task.id,
          name: task.name,
          status: task.status,
          triggerType,
          ...(triggerType === 'CRON' ? { cronExpression: params.cronExpression } : {}),
        },
      };
    } catch (err) {
      logger.error({ err, name }, 'Failed to create task from conversation');
      return { success: false, action: 'create_task', errorMessage: String(err) };
    }
  }

  private async searchVault(
    params: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const query = String(params.query ?? '').trim();
    if (!query) {
      return { success: false, action: 'search_vault', errorMessage: 'query is empty' };
    }

    try {
      const results = await storageAdapter.searchVaultByIntent(query);
      logger.info({ query, count: results.length }, 'Vault search completed');

      return {
        success: true,
        action: 'search_vault',
        entityData: {
          query,
          results: results.slice(0, 10).map((item) => ({
            id: item.id,
            fileName: item.fileName,
            category: item.category,
            semanticTags: item.semanticTags,
            privacyZone: item.privacyZone,
            createdAt: item.createdAt,
          })),
          totalFound: results.length,
        },
      };
    } catch (err) {
      logger.error({ err, query }, 'Vault search failed');
      return { success: false, action: 'search_vault', errorMessage: String(err) };
    }
  }

  private async createPerson(
    params: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutionResult> {
    const name = String(params.name ?? '').trim();
    if (!name) {
      return { success: false, action: 'create_person', errorMessage: 'name is required' };
    }

    try {
      const person = await storageAdapter.createPerson({
        name,
        role: params.role ? String(params.role) : undefined,
        organization: params.organization ? String(params.organization) : undefined,
        addedBy: userId,
        approvalStatus: 'PENDING',
        accessLevel: 'ZONE_BLUE',
      });

      logger.info({ personId: person.id, name }, 'Person created from conversation');

      return {
        success: true,
        action: 'create_person',
        entityType: 'memory',
        entityId: person.id,
        entityData: {
          id: person.id,
          name: person.name,
          role: person.role ?? null,
          organization: person.organization ?? null,
          approvalStatus: person.approvalStatus,
        },
      };
    } catch (err) {
      logger.error({ err, name }, 'Failed to create person from conversation');
      return { success: false, action: 'create_person', errorMessage: String(err) };
    }
  }

  private async saveMemory(
    params: Record<string, unknown>,
    _userId: string,
  ): Promise<ExecutionResult> {
    const content = String(params.content ?? '');
    const tags = Array.isArray(params.tags)
      ? (params.tags as string[])
      : [];

    if (!content) {
      return { success: false, action: 'save_memory', errorMessage: 'content is empty' };
    }

    try {
      const item = await storageAdapter.createVaultItem({
        category: 'MEMORY',
        fileName: content.slice(0, 80),
        semanticTags: tags.length > 0 ? tags : undefined,
        semanticIndex: content,
        privacyZone: 'ZONE_GREEN',
      });

      logger.info({ vaultItemId: item.id }, 'Memory saved from conversation');

      return {
        success: true,
        action: 'save_memory',
        entityType: 'memory',
        entityId: item.id,
        entityData: { id: item.id, fileName: item.fileName, tags: item.semanticTags },
      };
    } catch (err) {
      logger.error({ err }, 'Failed to save memory from conversation');
      return { success: false, action: 'save_memory', errorMessage: String(err) };
    }
  }
}

export const conversationActionExecutor = new ConversationActionExecutor();
