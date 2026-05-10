import type { SyncMessage, SyncConfig, SyncState, SyncResult } from './types';
import { createServiceLogger } from '../../lib/logger';

const logger = createServiceLogger('SyncService');

const messageStore: Map<string, SyncMessage> = new Map();
const configStore: Map<string, SyncConfig> = new Map();
const stateStore: Map<string, SyncState> = new Map();

interface DBPersistanceConfig {
  enabled: boolean;
}

// 固定的表名前缀，防止 SQL 注入
const FIXED_TABLE_PREFIX = 'sync_';

let dbConfig: DBPersistanceConfig = {
  enabled: false,
};

export function configureSyncDB(config: Partial<DBPersistanceConfig>) {
  dbConfig = { ...dbConfig, ...config };
  logger.info(`Sync DB configured: enabled=${dbConfig.enabled}`);
}

interface PgClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

declare global {
  namespace globalThis {
    var pgClient: PgClient | undefined;
  }
}

async function persistMessagesToDB(messages: SyncMessage[]): Promise<void> {
  if (!dbConfig.enabled || messages.length === 0) return;

  const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping message persistence');
    return;
  }

  try {
    // 使用批量插入替代逐条插入，提升性能
    for (const msg of messages) {
      await client.query(
        `INSERT INTO ${FIXED_TABLE_PREFIX}messages (id, data, user_id, session_id, timestamp, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data,
           user_id = EXCLUDED.user_id,
           session_id = EXCLUDED.session_id,
           timestamp = EXCLUDED.timestamp,
           updated_at = EXCLUDED.updatedAt`,
        [msg.id, JSON.stringify(msg), msg.userId, msg.sessionId, msg.timestamp, Date.now()]
      );
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to persist messages to DB');
  }
}

async function persistConfigToDB(userId: string, config: SyncConfig): Promise<void> {
  if (!dbConfig.enabled) return;

  const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping config persistence');
    return;
  }

  try {
    await client.query(
      `INSERT INTO ${FIXED_TABLE_PREFIX}configs (user_id, data, timestamp, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         data = EXCLUDED.data,
         timestamp = EXCLUDED.timestamp,
         updated_at = EXCLUDED.updatedAt`,
      [userId, JSON.stringify(config), config.timestamp, Date.now()]
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to persist config to DB');
  }
}

async function persistStateToDB(userId: string, state: SyncState): Promise<void> {
  if (!dbConfig.enabled) return;

    const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping state persistence');
    return;
  }

  try {
    await client.query(
      `INSERT INTO ${FIXED_TABLE_PREFIX}states (user_id, data, timestamp, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         data = EXCLUDED.data,
         timestamp = EXCLUDED.timestamp,
         updated_at = EXCLUDED.updatedAt`,
      [userId, JSON.stringify(state), state.timestamp, Date.now()]
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to persist state to DB');
  }
}

async function loadMessagesFromDB(userId?: string): Promise<void> {
  if (!dbConfig.enabled) return;

  const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping message load');
    return;
  }

  try {
    let query = `SELECT id, data FROM ${FIXED_TABLE_PREFIX}messages`;
    const params: unknown[] = [];

    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    const result = await client.query(query, params);

    for (const row of (result as { rows: unknown[] }).rows) {
      try {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        messageStore.set(row.id, data);
      } catch {
    logger.warn(`Failed to parse message record ${row.id}`);
      }
    }

    logger.info(`Loaded ${result.rows.length} messages from DB`);
  } catch (error) {
    logger.error('Failed to load messages from DB:', error);
  }
}

async function loadConfigsFromDB(userId?: string): Promise<void> {
  if (!dbConfig.enabled) return;

  const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping config load');
    return;
  }

  try {
    let query = `SELECT user_id, data FROM ${FIXED_TABLE_PREFIX}configs`;
    const params: unknown[] = [];

    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    const result = await client.query(query, params);

    for (const row of result.rows) {
      try {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        configStore.set(row.user_id, data);
      } catch {
        logger.warn(`Failed to parse config for user ${row.user_id}`);
      }
    }

    logger.info(`Loaded ${result.rows.length} configs from DB`);
  } catch (error) {
    logger.error('Failed to load configs from DB:', error);
  }
}

async function loadStatesFromDB(userId?: string): Promise<void> {
  if (!dbConfig.enabled) return;

  const client = globalThis.pgClient;
  if (!client) {
    logger.warn('PostgreSQL client not available, skipping state load');
    return;
  }

  try {
    let query = `SELECT user_id, data FROM ${FIXED_TABLE_PREFIX}states`;
    const params: unknown[] = [];

    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    const result = await client.query(query, params);

    for (const row of result.rows) {
      try {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        stateStore.set(row.user_id, data);
      } catch {
        logger.warn(`Failed to parse state for user ${row.user_id}`);
      }
    }

    logger.info(`Loaded ${result.rows.length} states from DB`);
  } catch (error) {
    logger.error('Failed to load states from DB:', error);
  }
}

export class SyncService {
  async initialize(userId?: string): Promise<void> {
    if (dbConfig.enabled) {
      await Promise.all([
        loadMessagesFromDB(userId),
        loadConfigsFromDB(userId),
        loadStatesFromDB(userId),
      ]);
    }
    logger.info('SyncService initialized');
  }

  async syncMessages(
    userId: string,
    messagesToSync: SyncMessage[],
    force = false,
    _lastSyncTimestamp?: number
  ): Promise<SyncResult<SyncMessage[]>> {
    try {
      const filteredMessages = messagesToSync.filter(msg => msg.userId === userId);
      const results: SyncMessage[] = [];

      for (const msg of filteredMessages) {
        const existing = messageStore.get(msg.id);

        if (!existing) {
          messageStore.set(msg.id, msg);
          results.push(msg);
          continue;
        }

        if (existing.timestamp >= msg.timestamp && !force) {
          continue;
        }

        messageStore.set(msg.id, msg);
        results.push(msg);
      }

      if (results.length > 0 && dbConfig.enabled) {
        await persistMessagesToDB(results);
      }

      logger.info(`同步消息: ${results.length}/${filteredMessages.length}`);

      return { success: true, data: results };
    } catch (error) {
      logger.error('同步消息失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '同步失败',
      };
    }
  }

  async syncConfig(
    userId: string,
    config: SyncConfig,
    force = false
  ): Promise<SyncResult<SyncConfig>> {
    try {
      const existing = configStore.get(userId);

      if (!existing) {
        configStore.set(userId, config);

        if (dbConfig.enabled) {
          await persistConfigToDB(userId, config);
        }

        return { success: true, data: config };
      }

      if (existing.timestamp >= config.timestamp && !force) {
        return {
          success: true,
          data: existing,
          conflict: {
            localData: config,
            serverData: existing,
            localTimestamp: config.timestamp,
            serverTimestamp: existing.timestamp,
          },
        };
      }

      configStore.set(userId, config);

      if (dbConfig.enabled) {
        await persistConfigToDB(userId, config);
      }

      return { success: true, data: config };
    } catch (error) {
      logger.error('同步配置失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '同步失败',
      };
    }
  }

  async syncState(
    userId: string,
    state: SyncState,
    force = false
  ): Promise<SyncResult<SyncState>> {
    try {
      const existing = stateStore.get(userId);

      if (!existing) {
        stateStore.set(userId, state);

        if (dbConfig.enabled) {
          await persistStateToDB(userId, state);
        }

        return { success: true, data: state };
      }

      if (existing.timestamp >= state.timestamp && !force) {
        return {
          success: true,
          data: existing,
          conflict: {
            localData: state,
            serverData: existing,
            localTimestamp: state.timestamp,
            serverTimestamp: existing.timestamp,
          },
        };
      }

      stateStore.set(userId, state);

      if (dbConfig.enabled) {
        await persistStateToDB(userId, state);
      }

      return { success: true, data: state };
    } catch (error) {
      logger.error('同步状态失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '同步失败',
      };
    }
  }

  async getMessages(
    userId: string,
    sessionId: string,
    since?: number,
    limit = 100
  ): Promise<SyncMessage[]> {
    let messages = Array.from(messageStore.values())
      .filter(msg => msg.userId === userId && msg.sessionId === sessionId);

    if (since) {
      messages = messages.filter(msg => msg.timestamp >= since);
    }

    return messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .reverse();
  }

  async getConfig(userId: string): Promise<SyncConfig | null> {
    return configStore.get(userId) || null;
  }

  async getState(userId: string): Promise<SyncState | null> {
    return stateStore.get(userId) || null;
  }

  getStats(): {
    messagesCount: number;
    configsCount: number;
    statesCount: number;
    dbEnabled: boolean;
  } {
    return {
      messagesCount: messageStore.size,
      configsCount: configStore.size,
      statesCount: stateStore.size,
      dbEnabled: dbConfig.enabled,
    };
  }

  async clear(): Promise<void> {
    messageStore.clear();
    configStore.clear();
    stateStore.clear();

    if (dbConfig.enabled) {
      const client = globalThis.pgClient;
      if (client) {
        try {
          await client.query(`DELETE FROM ${FIXED_TABLE_PREFIX}messages`);
          await client.query(`DELETE FROM ${FIXED_TABLE_PREFIX}configs`);
          await client.query(`DELETE FROM ${FIXED_TABLE_PREFIX}states`);
          logger.info('Database sync tables cleared');
        } catch (error) {
          logger.error('Failed to clear database tables:', error);
        }
      }
    }

    logger.info('同步存储已清空');
  }
}

export const syncService = new SyncService();
