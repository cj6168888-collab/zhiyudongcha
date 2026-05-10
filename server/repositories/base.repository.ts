import { eq, sql, type SQL, type Table, type AnyColumn } from "drizzle-orm";
import { getDatabase } from "../db";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('Repository');

export interface FindOptions {
  limit?: number;
  offset?: number;
  where?: SQL;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TableSchema {
  [key: string]: unknown;
}

export type TableColumn = AnyColumn;
export type QueryResult<T> = T[];

export abstract class BaseRepository<TSelect, TInsert> {
  protected readonly repositoryName: string;

  constructor(name: string) {
    this.repositoryName = name;
  }

  protected get db() {
    const db = getDatabase();
    if (!db) {
      throw new Error(`Database not available for repository: ${this.repositoryName}`);
    }
    return db;
  }

  protected abstract getTable(): Table;
  protected abstract getIdColumn(): TableColumn;

  async findById(id: string | number): Promise<TSelect | undefined> {
    try {
      const results = await this.db
        .select()
        .from(this.getTable())
        .where(eq(this.getIdColumn(), id))
        .limit(1);
      return results[0] as TSelect | undefined;
    } catch (error) {
      logger.error({ err: error, id, repository: this.repositoryName }, 'findById failed');
      throw error;
    }
  }

  async findAll(options?: FindOptions): Promise<TSelect[]> {
    try {
      let query = this.db.select().from(this.getTable());
      
      if (options?.where) {
        query = query.where(options.where);
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.offset(options.offset);
      }
      
      const results = await query;
      return results as TSelect[];
    } catch (error) {
      logger.error({ err: error, options, repository: this.repositoryName }, 'findAll failed');
      throw error;
    }
  }

  async create(data: TInsert): Promise<TSelect> {
    try {
      const result = await this.db
        .insert(this.getTable())
        .values(data as unknown as Record<string, unknown>)
        .returning();
      return result[0]! as TSelect;
    } catch (error) {
      logger.error({ err: error, data, repository: this.repositoryName }, 'create failed');
      throw error;
    }
  }

  async update(id: string | number, data: Partial<TInsert>): Promise<TSelect | undefined> {
    try {
      const result = await this.db
        .update(this.getTable())
        .set(data as unknown as Record<string, unknown>)
        .where(eq(this.getIdColumn(), id))
        .returning();
      return result[0] as TSelect | undefined;
    } catch (error) {
      logger.error({ err: error, id, data, repository: this.repositoryName }, 'update failed');
      throw error;
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(this.getTable())
        .where(eq(this.getIdColumn(), id))
        .returning();
      return result.length > 0;
    } catch (error) {
      logger.error({ err: error, id, repository: this.repositoryName }, 'delete failed');
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.getTable());
      return Number(result[0]?.count || 0);
    } catch (error) {
      logger.error({ err: error, repository: this.repositoryName }, 'count failed');
      throw error;
    }
  }

  async exists(id: string | number): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.getTable())
        .where(eq(this.getIdColumn(), id));
      return Number(result[0]?.count || 0) > 0;
    } catch (error) {
      logger.error({ err: error, id, repository: this.repositoryName }, 'exists failed');
      throw error;
    }
  }

  async upsert(id: string | number, data: TInsert): Promise<TSelect> {
    try {
      const exists = await this.exists(id);
      if (exists) {
        return await this.update(id, data) as TSelect;
      }
      return await this.create({ ...data, id } as unknown as TInsert) as TSelect;
    } catch (error) {
      logger.error({ err: error, id, data, repository: this.repositoryName }, 'upsert failed');
      throw error;
    }
  }

  async findByIds(ids: (string | number)[]): Promise<TSelect[]> {
    try {
      const results = await this.db
        .select()
        .from(this.getTable())
        .where(sql`${this.getIdColumn()} IN ${ids}`);
      return results as TSelect[];
    } catch (error) {
      logger.error({ err: error, ids, repository: this.repositoryName }, 'findByIds failed');
      throw error;
    }
  }

  async bulkCreate(data: TInsert[]): Promise<TSelect[]> {
    try {
      const result = await this.db
        .insert(this.getTable())
        .values(data as unknown as Record<string, unknown>[])
        .returning();
      return result as TSelect[];
    } catch (error) {
      logger.error({ err: error, count: data.length, repository: this.repositoryName }, 'bulkCreate failed');
      throw error;
    }
  }

  async bulkUpdate(ids: (string | number)[], data: Partial<TInsert>): Promise<TSelect[]> {
    try {
      const query = this.db
        .update(this.getTable())
        .set(data as unknown as Record<string, unknown>)
        .where(sql`${this.getIdColumn()} IN ${ids}`);
      const result = await query.returning();
      return result as TSelect[];
    } catch (error) {
      logger.error({ err: error, count: ids.length, repository: this.repositoryName }, 'bulkUpdate failed');
      throw error;
    }
  }
}
