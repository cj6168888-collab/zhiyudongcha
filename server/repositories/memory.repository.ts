import { eq, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  shadowMemories, 
  dreamLogs,
  type ShadowMemory, 
  type InsertShadowMemory,
  type DreamLog,
  type InsertDreamLog
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('MemoryRepository');

export class ShadowMemoryRepository extends BaseRepository<ShadowMemory, InsertShadowMemory> {
  constructor() {
    super('ShadowMemoryRepository');
  }

  protected getTable() {
    return shadowMemories;
  }

  protected getIdColumn() {
    return shadowMemories.id;
  }

  async getByField(field: string): Promise<ShadowMemory[]> {
    return await this.db.select().from(shadowMemories).where(eq(shadowMemories.field, field));
  }

  async getRecentMemories(limit: number = 50): Promise<ShadowMemory[]> {
    return await this.db.select().from(shadowMemories)
      .orderBy(desc(shadowMemories.createdAt))
      .limit(limit);
  }

  async getByMimicryWeight(minWeight: number): Promise<ShadowMemory[]> {
    return await this.db.select().from(shadowMemories).where(
      sql`${shadowMemories.mimicryWeight} >= ${minWeight}`
    );
  }
}

export class DreamLogRepository extends BaseRepository<DreamLog, InsertDreamLog> {
  constructor() {
    super('DreamLogRepository');
  }

  protected getTable() {
    return dreamLogs;
  }

  protected getIdColumn() {
    return dreamLogs.id;
  }

  async getAll(): Promise<DreamLog[]> {
    return await this.db.select().from(dreamLogs).orderBy(sql`created_at DESC`);
  }

  async getRecent(limit: number = 30): Promise<DreamLog[]> {
    return await this.db.select().from(dreamLogs)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }
}

export const shadowMemoryRepository = new ShadowMemoryRepository();
export const dreamLogRepository = new DreamLogRepository();
