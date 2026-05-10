/**
 * 小智 Database Instance Export
 * 
 * 统一的数据库实例导出，供各服务模块使用
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
export { pool };
