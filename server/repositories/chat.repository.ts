import { and, eq, sql, type SQL } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  avatarChatHistory, avatarUserPreferences,
  type AvatarChatHistory, type InsertAvatarChatHistory,
  type AvatarUserPreferences, type InsertAvatarUserPreferences
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ChatRepository');

export interface AvatarChatHistoryScope {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
}

function buildScopeWhere(scope?: AvatarChatHistoryScope): SQL | undefined {
  const filters: SQL[] = [];
  if (scope?.userId) filters.push(eq(avatarChatHistory.userId, scope.userId));
  if (scope?.sessionId) filters.push(eq(avatarChatHistory.sessionId, scope.sessionId));
  if (scope?.deviceId) filters.push(eq(avatarChatHistory.deviceId, scope.deviceId));
  return filters.length > 0 ? and(...filters) : undefined;
}

export class AvatarChatHistoryRepository extends BaseRepository<AvatarChatHistory, InsertAvatarChatHistory> {
  constructor() {
    super('AvatarChatHistory');
  }

  protected getTable() {
    return avatarChatHistory;
  }

  protected getIdColumn() {
    return avatarChatHistory.id;
  }

  async getHistory(limit: number = 100, scope?: AvatarChatHistoryScope): Promise<AvatarChatHistory[]> {
    try {
      const where = buildScopeWhere(scope);
      let query = this.db.select().from(avatarChatHistory).$dynamic();
      if (where) query = query.where(where);
      return await query.orderBy(sql`created_at DESC`).limit(limit);
    } catch (error) {
      logger.error({ err: error, limit, scope }, 'getHistory failed');
      throw error;
    }
  }

  async getRecentContext(limit: number = 10, scope?: AvatarChatHistoryScope): Promise<AvatarChatHistory[]> {
    try {
      const where = buildScopeWhere(scope);
      let query = this.db.select().from(avatarChatHistory).$dynamic();
      if (where) query = query.where(where);
      const messages = await query.orderBy(sql`created_at DESC`).limit(limit);
      return messages.reverse();
    } catch (error) {
      logger.error({ err: error, limit, scope }, 'getRecentContext failed');
      throw error;
    }
  }

  async updateFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined> {
    try {
      const updateData: Partial<InsertAvatarChatHistory> = { feedback };
      if (note !== undefined) {
        updateData.feedbackNote = note;
      }
      if (feedback === 1) {
        updateData.isMemorized = 1;
        updateData.memoryWeight = 0.8;
      }
      const [updated] = await this.db.update(avatarChatHistory)
        .set(updateData)
        .where(eq(avatarChatHistory.id, id))
        .returning();
      return updated;
    } catch (error) {
      logger.error({ err: error, id, feedback }, 'updateFeedback failed');
      throw error;
    }
  }

  async getMemorized(): Promise<AvatarChatHistory[]> {
    try {
      return await this.db.select().from(avatarChatHistory)
        .where(eq(avatarChatHistory.isMemorized, 1))
        .orderBy(sql`memory_weight DESC, created_at DESC`)
        .limit(20);
    } catch (error) {
      logger.error({ err: error }, 'getMemorized failed');
      throw error;
    }
  }
}

export class AvatarUserPreferencesRepository {
  private readonly entityName = 'AvatarUserPreferences';
  private readonly singletonId = 'singleton';

  async get(): Promise<AvatarUserPreferences | undefined> {
    try {
      const [prefs] = await this.db.select().from(avatarUserPreferences)
        .where(eq(avatarUserPreferences.id, this.singletonId));
      return prefs;
    } catch (error) {
      logger.error({ err: error }, 'get failed');
      throw error;
    }
  }

  async upsert(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined> {
    try {
      const existing = await this.get();
      const updateData = { ...updates, updatedAt: new Date() };
      
      if (existing) {
        const [updated] = await this.db.update(avatarUserPreferences)
          .set(updateData)
          .where(eq(avatarUserPreferences.id, this.singletonId))
          .returning();
        return updated;
      } else {
        const [created] = await this.db.insert(avatarUserPreferences)
          .values({ ...updateData, id: this.singletonId } as InsertAvatarUserPreferences)
          .returning();
        return created;
      }
    } catch (error) {
      logger.error({ err: error }, 'upsert failed');
      throw error;
    }
  }
}

export const avatarChatHistoryRepository = new AvatarChatHistoryRepository();
export const avatarUserPreferencesRepository = new AvatarUserPreferencesRepository();
