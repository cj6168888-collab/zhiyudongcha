/**
 * Navigator-X Database Instance Export
 *
 * 优化的数据库连接池配置，支持懒加载和自动恢复
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { logger } from "./lib/logger";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let dbInitialized = false;

function createPool(): pg.Pool {
  const sslMode = process.env['DATABASE_SSL'] || process.env['PGSSLMODE'];
  const useSsl = sslMode === 'true' || sslMode === 'require';

  return new Pool({
    connectionString: process.env['DATABASE_URL'],
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: useSsl ? { rejectUnauthorized: process.env['DATABASE_SSL_REJECT_UNAUTHORIZED'] !== 'false' } : false,
  });
}

export function initializeDatabase(): void {
  if (dbInitialized) return;

  const hasDatabaseUrl = !!process.env['DATABASE_URL'];

  if (hasDatabaseUrl) {
    try {
      pool = createPool();
      _db = drizzle(pool);
      dbInitialized = true;
      logger.info('[Database] 连接池已初始化');

      pool.on('error', (err) => {
        console.error('[Database] 连接池错误:', err.message);
      });
    } catch (error) {
      console.error('[Database] 连接池初始化失败:', error);
      dbInitialized = false;
    }
  } else {
    console.warn('[Database] 未设置DATABASE_URL，数据库功能将不可用');
    dbInitialized = true;
  }
}

export const getDatabase = (): typeof _db => {
  if (!dbInitialized) {
    initializeDatabase();
  }
  return _db;
};

export const isDatabaseAvailable = (): boolean => {
  if (!dbInitialized) {
    initializeDatabase();
  }
  return !!pool;
};

export { pool };
