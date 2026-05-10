/**
 * DataLoader - 解决N+1查询问题
 * 用于批量加载关联数据
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('DataLoader');

export interface LoaderOptions<T> {
  batchSize?: number;
  maxBatchSize?: number;
  batchWait?: number;
  cache?: boolean;
}

export interface BatchLoadFn<K, V> {
  (keys: K[]): Promise<V[]>;
}

export class DataLoader<K, V> {
  private queue: K[] = [];
  private promises: Map<K, { resolve: (value: V) => void; reject: (error: Error) => void }> = new Map();
  private options: Required<LoaderOptions<V>>;
  private batchLoadFn: BatchLoadFn<K, V>;
  private batchScheduled: boolean = false;
  private cache: Map<K, V> = new Map();

  constructor(
    batchLoadFn: BatchLoadFn<K, V>,
    options: LoaderOptions<V> = {}
  ) {
    this.batchLoadFn = batchLoadFn;
    this.options = {
      batchSize: options.batchSize || 100,
      maxBatchSize: options.maxBatchSize || 500,
      batchWait: options.batchWait || 10,
      cache: options.cache !== false,
    };
  }

  /**
   * 加载单个key
   */
  async load(key: K): Promise<V> {
    // 检查缓存
    if (this.options.cache && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 检查是否已有待处理的请求
    if (this.promises.has(key)) {
      return new Promise<V>((resolve, reject) => {
        this.promises.get(key)!.resolve = resolve;
        this.promises.get(key)!.reject = reject;
      });
    }

    // 添加到队列
    this.queue.push(key);

    // 创建Promise
    const promise = new Promise<V>((resolve, reject) => {
      this.promises.set(key, { resolve, reject });
    });

    // 调度批量处理
    this.scheduleBatch();

    return promise;
  }

  /**
   * 批量加载多个key
   */
  async loadMany(keys: K[]): Promise<V[]> {
    return Promise.all(keys.map(key => this.load(key)));
  }

  /**
   * 调度批量处理
   */
  private scheduleBatch(): void {
    if (this.batchScheduled) return;

    this.batchScheduled = true;

    setTimeout(async () => {
      await this.dispatchBatch();
      this.batchScheduled = false;

      // 如果队列还有数据，继续处理
      if (this.queue.length > 0) {
        this.scheduleBatch();
      }
    }, this.options.batchWait);
  }

  /**
   * 执行批量加载
   */
  private async dispatchBatch(): Promise<void> {
    // 获取待处理的key
    const keys = [...this.queue];
    this.queue = [];

    if (keys.length === 0) return;

    // 限制批量大小
    const batchKeys = keys.slice(0, this.options.maxBatchSize);
    const remainingKeys = keys.slice(this.options.maxBatchSize);

    // 将剩余的key放回队列
    if (remainingKeys.length > 0) {
      this.queue.push(...remainingKeys);
    }

    try {
      logger.debug('执行批量加载', { count: batchKeys.length });

      const results = await this.batchLoadFn(batchKeys);

      // 解析Promise
      batchKeys.forEach((key, index) => {
        const promise = this.promises.get(key);
        if (promise) {
          promise.resolve(results[index]);
          this.promises.delete(key);

          // 缓存结果
          if (this.options.cache) {
            this.cache.set(key, results[index]);
          }
        }
      });
    } catch (error) {
      // 所有Promise reject
      batchKeys.forEach(key => {
        const promise = this.promises.get(key);
        if (promise) {
          promise.reject(error as Error);
          this.promises.delete(key);
        }
      });
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除单个key的缓存
   */
  clear(key: K): void {
    this.cache.delete(key);
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 获取待处理队列大小
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

/**
 * 创建用户DataLoader
 */
export function createUserLoader<T = unknown>(
  loadFn: (ids: string[]) => Promise<T[]>
): DataLoader<string, T> {
  return new DataLoader<string, T>(loadFn, {
    batchSize: 50,
    maxBatchSize: 100,
    batchWait: 5,
    cache: true,
  });
}

/**
 * 创建项目DataLoader
 */
export function createProjectLoader<T = unknown>(
  loadFn: (ids: string[]) => Promise<T[]>
): DataLoader<string, T> {
  return new DataLoader<string, T>(loadFn, {
    batchSize: 20,
    maxBatchSize: 50,
    batchWait: 10,
    cache: true,
  });
}

/**
 * 创建联系人DataLoader
 */
export function createPersonLoader<T = unknown>(
  loadFn: (ids: string[]) => Promise<T[]>
): DataLoader<string, T> {
  return new DataLoader<string, T>(loadFn, {
    batchSize: 30,
    maxBatchSize: 100,
    batchWait: 5,
    cache: true,
  });
}

export default DataLoader;
