import { createServiceLogger } from '../lib/logger';
import { AbstractService } from './base-service';
import { getDatabase } from '../db';
import { eq, and, desc, asc, ilike, gte, lte } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';

type QueryOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'ilike' | 'in' | 'between';

interface QueryCondition<T> {
  column: keyof T;
  operator: QueryOperator;
  value: unknown;
}

type TableSchema<T> = PgTable & Record<string, unknown>;
type InsertData<T> = Partial<T>;

// 基础仓储接口
export interface IRepository<T, ID = string> {
  create(data: Partial<T>): Promise<T>;
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
  count(filter?: Partial<T>): Promise<number>;
  exists(id: ID): Promise<boolean>;
}

// 分页参数接口
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 分页结果接口
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 查询构建器
export class QueryBuilder<T> {
  private conditions: QueryCondition<T>[] = [];
  private orderBy: Array<{ column: string; direction: 'asc' | 'desc' }> = [];
  private limitValue?: number;
  private offsetValue?: number;

  where(column: keyof T, operator: QueryOperator, value: unknown): this {
    this.conditions.push({ column, operator, value });
    return this;
  }

  whereIn(column: keyof T, values: unknown[]): this {
    this.conditions.push({ column, operator: 'in', value: values });
    return this;
  }

  whereBetween(column: keyof T, min: unknown, max: unknown): this {
    this.conditions.push({ column, operator: 'between', value: [min, max] });
    return this;
  }

  orderByAsc(column: keyof T): this {
    this.orderBy.push({ column: String(column), direction: 'asc' });
    return this;
  }

  orderByDesc(column: keyof T): this {
    this.orderBy.push({ column: String(column), direction: 'desc' });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  build(): {
    conditions: QueryCondition<T>[];
    orderBy: Array<{ column: string; direction: 'asc' | 'desc' }>;
    limit?: number;
    offset?: number;
  } {
    return {
      conditions: this.conditions,
      orderBy: this.orderBy,
      limit: this.limitValue,
      offset: this.offsetValue,
    };
  }

  reset(): this {
    this.conditions = [];
    this.orderBy = [];
    this.limitValue = undefined;
    this.offsetValue = undefined;
    return this;
  }
}

// 基础仓储实现
export abstract class BaseRepository<T extends { id: string }, ID = string>
  implements IRepository<T, ID> {
  protected logger = createServiceLogger(`${this.constructor.name}`);
  protected abstract tableName: string;
  protected abstract schema: TableSchema<T>;

  constructor() {}

  async create(data: Partial<T>): Promise<T> {
    this.logger.debug('创建记录', { data });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db.insert(this.schema).values(data as InsertData<T>).returning();
      const created = result[0];

      if (!created) {
        throw new Error('创建记录失败: 未返回结果');
      }

      this.logger.info('记录创建成功', { id: (created as { id: string }).id });
      return created as T;
    } catch (error) {
      this.logger.error('记录创建失败', { data, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async findById(id: ID): Promise<T | null> {
    this.logger.debug('根据ID查找记录', { id });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db
        .select()
        .from(this.schema)
        .where(eq(this.schema.id, id as string))
        .limit(1);

      return (result[0] as T) || null;
    } catch (error: unknown) {
      this.logger.error('记录查找失败', { id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async findAll(filter?: Partial<T>): Promise<T[]> {
    this.logger.debug('查找所有记录', { filter });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      let query = db.select().from(this.schema).$dynamic();

      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          eq(this.schema[key as keyof typeof this.schema], value as unknown)
        );
        query = query.where(and(...conditions));
      }

      const results = await query;
      return results as T[];
    } catch (error: unknown) {
      this.logger.error('查找记录失败', { filter, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async findWithQueryBuilder(queryBuilder: QueryBuilder<T>): Promise<T[]> {
    const query = queryBuilder.build();

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      let dbQuery = db.select().from(this.schema).$dynamic();

      // 应用条件
      if (query.conditions.length > 0) {
        const conditions = query.conditions.map(cond => {
          switch (cond.operator) {
            case 'like':
              return ilike(this.schema[cond.column as keyof typeof this.schema], `%${cond.value}%`);
            case 'ilike':
              return ilike(this.schema[cond.column as keyof typeof this.schema], `%${cond.value}%`);
            case 'in':
              // @ts-ignore
              return this.schema[cond.column].in(cond.value);
            case 'between':
              // @ts-ignore
              return and(
                gte(this.schema[cond.column], cond.value[0]),
                lte(this.schema[cond.column], cond.value[1])
              );
            default:
              return eq(this.schema[cond.column as keyof typeof this.schema], cond.value);
          }
        });
        dbQuery = dbQuery.where(and(...conditions));
      }

      // 应用排序
      for (const order of query.orderBy) {
        const column = this.schema[order.column as keyof typeof this.schema];
        dbQuery = dbQuery.orderBy(order.direction === 'asc' ? asc(column) : desc(column));
      }

      // 应用分页
      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.offset(query.offset);
      }

      const results = await dbQuery;
      return results as T[];
    } catch (error: unknown) {
      this.logger.error('查询失败', { query, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async findWithPagination(
    options: PaginationOptions,
    filter?: Partial<T>
  ): Promise<PaginatedResult<T>> {
    this.logger.debug('分页查找记录', { options, filter });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const { page, limit, sortBy, sortOrder } = options;
      const offset = (page - 1) * limit;

      // 构建查询
      let query = db.select().from(this.schema).$dynamic();

      // 应用过滤条件
      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          eq(this.schema[key as keyof typeof this.schema], value as unknown)
        );
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      // 获取总数
      let countQuery = db.select({ count: this.schema.id }).from(this.schema).$dynamic();
      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          eq(this.schema[key as keyof typeof this.schema], value as unknown)
        );
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
      }
      const countResult = await countQuery;
      const total = countResult.length;

      // 应用排序
      if (sortBy) {
        const column = this.schema[sortBy as keyof typeof this.schema];
        query = query.orderBy(
          sortOrder === 'asc' ? asc(column) : desc(column)
        );
      }

      // 应用分页
      query = query.limit(limit).offset(offset);

      const items = await query;
      const totalPages = Math.ceil(total / limit);

      return {
        items: items as T[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error: unknown) {
      this.logger.error('分页查找失败', { options, filter, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async update(id: ID, data: Partial<T>): Promise<T | null> {
    this.logger.debug('更新记录', { id, data });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db
        .update(this.schema)
        .set(data as InsertData<T>)
        .where(eq(this.schema.id, id as string))
        .returning();

      const updated = result[0];
      if (updated) {
        this.logger.info('记录更新成功', { id });
        return updated as T;
      }

      this.logger.warn('记录未找到', { id });
      return null;
    } catch (error: unknown) {
      this.logger.error('记录更新失败', { id, data, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async delete(id: ID): Promise<boolean> {
    this.logger.debug('删除记录', { id });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db
        .delete(this.schema)
        .where(eq(this.schema.id, id as string))
        .returning({ id: this.schema.id });

      const deleted = result.length > 0;
      if (deleted) {
        this.logger.info('记录删除成功', { id });
      } else {
        this.logger.warn('记录未找到', { id });
      }

      return deleted;
    } catch (error: unknown) {
      this.logger.error('记录删除失败', { id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async count(filter?: Partial<T>): Promise<number> {
    this.logger.debug('统计记录数', { filter });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      let query = db.select({ count: this.schema.id }).from(this.schema).$dynamic();

      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          eq(this.schema[key as keyof typeof this.schema], value as unknown)
        );
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query;
      return result.length;
    } catch (error: unknown) {
      this.logger.error('记录统计失败', { filter, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async exists(id: ID): Promise<boolean> {
    this.logger.debug('检查记录是否存在', { id });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db
        .select({ id: this.schema.id })
        .from(this.schema)
        .where(eq(this.schema.id, id as string))
        .limit(1);

      return result.length > 0;
    } catch (error: unknown) {
      this.logger.error('记录存在性检查失败', { id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // 批量操作
  async createMany(data: Partial<T>[]): Promise<T[]> {
    this.logger.debug('批量创建记录', { count: data.length });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const result = await db.insert(this.schema).values(data as InsertData<T>[]).returning();
      this.logger.info('批量创建成功', { count: result.length });
      return result as T[];
    } catch (error: unknown) {
      this.logger.error('批量创建失败', { count: data.length, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async updateMany(filter: Partial<T>, data: Partial<T>): Promise<number> {
    this.logger.debug('批量更新记录', { filter, data });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const conditions = Object.entries(filter).map(([key, value]) =>
        eq(this.schema[key as keyof typeof this.schema], value as unknown)
      );

      const result = await db
        .update(this.schema)
        .set(data as InsertData<T>)
        .where(and(...conditions))
        .returning({ id: this.schema.id });

      const count = result.length;
      this.logger.info('批量更新成功', { count });
      return count;
    } catch (error: unknown) {
      this.logger.error('批量更新失败', { filter, data, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async deleteMany(filter: Partial<T>): Promise<number> {
    this.logger.debug('批量删除记录', { filter });

    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const conditions = Object.entries(filter).map(([key, value]) =>
        eq(this.schema[key as keyof typeof this.schema], value as unknown)
      );

      const result = await db
        .delete(this.schema)
        .where(and(...conditions))
        .returning({ id: this.schema.id });

      const count = result.length;
      this.logger.info('批量删除成功', { count });
      return count;
    } catch (error: unknown) {
      this.logger.error('批量删除失败', { filter, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}

// 基础服务类
export abstract class BaseService<T extends { id: string }, ID = string>
  extends AbstractService {
  protected repository: IRepository<T, ID>;

  constructor(repository: IRepository<T, ID>) {
    super();
    this.repository = repository;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.repository.create(data);
  }

  async findById(id: ID): Promise<T | null> {
    return this.repository.findById(id);
  }

  async findAll(filter?: Partial<T>): Promise<T[]> {
    return this.repository.findAll(filter);
  }

  async findWithPagination(
    options: PaginationOptions,
    filter?: Partial<T>
  ): Promise<PaginatedResult<T>> {
    return this.repository.findWithPagination(options, filter);
  }

  async update(id: ID, data: Partial<T>): Promise<T | null> {
    return this.repository.update(id, data);
  }

  async delete(id: ID): Promise<boolean> {
    return this.repository.delete(id);
  }

  async count(filter?: Partial<T>): Promise<number> {
    return this.repository.count(filter);
  }

  async exists(id: ID): Promise<boolean> {
    return this.repository.exists(id);
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
}
