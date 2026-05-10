import { sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ConversationRepository');

export interface ConversationData {
  id: string;
  userId: string;
  messages: unknown[];
  state: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

class ConversationRepository {
  async save(conversationId: string, data: ConversationData): Promise<void> {
    const db = getDatabase();
    if (!db) throw new Error('Database not available');
    try {
      await db.execute(sql`
        INSERT INTO conversations (id, user_id, messages, state, metadata, created_at, updated_at)
        VALUES (
          ${conversationId},
          ${data.userId},
          ${JSON.stringify(data.messages)}::jsonb,
          ${data.state ?? ''},
          ${JSON.stringify(data.metadata ?? {})}::jsonb,
          ${data.createdAt ?? new Date()},
          ${data.updatedAt ?? new Date()}
        )
        ON CONFLICT (id) DO UPDATE SET
          messages = EXCLUDED.messages,
          state = EXCLUDED.state,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `);
    } catch (error) {
      logger.error({ conversationId, error: (error as Error).message }, '保存对话失败');
      throw error;
    }
  }

  async get(conversationId: string): Promise<ConversationData | undefined> {
    const db = getDatabase();
    if (!db) throw new Error('Database not available');
    try {
      const result = await db.execute(sql`SELECT * FROM conversations WHERE id = ${conversationId}`);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return this.rowToData(row);
    } catch (error) {
      logger.error({ conversationId, error: (error as Error).message }, '获取对话失败');
      throw error;
    }
  }

  async delete(conversationId: string): Promise<void> {
    const db = getDatabase();
    if (!db) throw new Error('Database not available');
    try {
      await db.execute(sql`DELETE FROM conversations WHERE id = ${conversationId}`);
      logger.info({ conversationId }, '删除对话');
    } catch (error) {
      logger.error({ conversationId, error: (error as Error).message }, '删除对话失败');
      throw error;
    }
  }

  async getByUser(userId: string, limit = 50): Promise<ConversationData[]> {
    const db = getDatabase();
    if (!db) throw new Error('Database not available');
    try {
      const result = await db.execute(sql`
        SELECT * FROM conversations
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `);
      return result.rows.map(row => this.rowToData(row as Record<string, unknown>));
    } catch (error) {
      logger.error({ userId, error: (error as Error).message }, '获取用户对话失败');
      throw error;
    }
  }

  private rowToData(row: Record<string, unknown>): ConversationData {
    const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
    return {
      id: row.id as string,
      userId: row.user_id as string,
      messages: (parse(row.messages) ?? []) as unknown[],
      state: (row.state ?? '') as string,
      metadata: (parse(row.metadata) ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at as string | number | Date),
      updatedAt: new Date(row.updated_at as string | number | Date),
    };
  }
}

export const conversationRepository = new ConversationRepository();
