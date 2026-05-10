 
import { createServiceLogger } from '../lib/logger';
interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  flushdb(): Promise<void>;
  quit(): Promise<void>;
  status?: string;
}
type Redis = RedisLike;

const logger = createServiceLogger('MultiLevelCache');

/**
 * 缓存项接口
 */
export interface CacheItem<T = unknown> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: Record<string, unknown>;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  totalRequests: number;
  hitRate: number;
  memoryUsage: number;
  l1Size: number;
}

/**
 * 缓存策略
 */
export enum CacheStrategy {
  WRITE_THROUGH = 'write-through',
  WRITE_BACK = 'write-back',
  WRITE_AROUND = 'write-around',
  REFRESH_AHEAD = 'refresh-ahead'
}

/**
 * 多级缓存系统
 * L1: 内存缓存（快速访问）
 * L2: Redis缓存（持久化存储）
 */
export class MultiLevelCache {
  private l1Cache: Map<string, CacheItem<unknown>> = new Map();
  private l2Cache: Redis | null = null;
  private strategy: CacheStrategy;
  private l1MaxSize: number;
  private l1TTL: number;
  private l2TTL: number;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    redis?: Redis;
    strategy?: CacheStrategy;
    l1MaxSize?: number;
    l1TTL?: number;
    l2TTL?: number;
    cleanupInterval?: number;
  } = {}) {
    this.l2Cache = options.redis || null;
    this.strategy = options.strategy || CacheStrategy.WRITE_THROUGH;
    this.l1MaxSize = options.l1MaxSize || 1000;
    this.l1TTL = options.l1TTL || 300000; // 5分钟
    this.l2TTL = options.l2TTL || 3600000; // 1小时

    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalRequests: 0,
      hitRate: 0,
      memoryUsage: 0,
      l1Size: 0
    };

    // 启动清理定时器
    const cleanupInterval = options.cleanupInterval || 60000; // 1分钟
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupInterval);

    logger.info('多级缓存系统初始化');
  }

  /**
   * 获取缓存值
   */
  public async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;
    
    // L1缓存检查
    const l1Item = this.l1Cache.get(key);
    if (l1Item) {
      const now = Date.now();
      
      // 检查是否过期
      if (now - l1Item.timestamp < l1Item.ttl) {
        this.l1Cache.delete(key);
        this.stats.l1Misses++;
      } else {
        l1Item.lastAccessed = now;
        l1Item.accessCount++;
        this.stats.l1Hits++;
        
        logger.debug('L1缓存命中');
        return l1Item.value as unknown as T;
      }
    }

    // L1未命中，检查L2
    this.stats.l1Misses++;
    
    if (this.l2Cache) {
      try {
        const l2Value = (await this.l2Cache.get(key)) as string | null;
        
        if (l2Value !== null) {
          // L2命中，提升到L1
          const parsed = JSON.parse(l2Value as string);
          const l1Item: CacheItem<T> = {
            value: parsed,
            timestamp: Date.now(),
            ttl: this.l1TTL,
            accessCount: 1,
            lastAccessed: Date.now()
          };
          
          this.setL1WithEviction(key, l1Item);
          this.stats.l2Hits++;
          
          logger.debug('L2缓存命中');
          return parsed as unknown as T;
        } else {
          this.stats.l2Misses++;
          
        logger.debug('L2缓存未命中');
          return null;
        }
      } catch (error) {
        logger.error('L2缓存访问失败');
        this.stats.l2Misses++;
        return null;
      }
    }

    return null;
  }

  /**
   * 设置缓存值
   */
  public async set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      metadata?: Record<string, unknown>;
      bypassL1?: boolean;
    } = {}
  ): Promise<void> {
    const now = Date.now();
    const ttl = options.ttl || this.l1TTL;

    // L2缓存设置
    if (this.l2Cache && !options.bypassL1) {
      try {
        const serialized = JSON.stringify(value);
        await this.l2Cache.setex(key, ttl, serialized);
        
        logger.debug('L2缓存设置');
      } catch (error) {
        logger.error('L2缓存设置失败');
      }
    }

    // L1缓存设置
    const l1Item: CacheItem<T> = {
      value,
      timestamp: now,
      ttl: now + ttl,
      accessCount: 1,
      lastAccessed: now,
      metadata: options.metadata
    };

    if (!options.bypassL1) {
      await this.setL1WithEviction(key, l1Item);
    }
  }

  /**
   * 设置L1缓存（带淘汰策略）
   */
  private async setL1WithEviction<T>(key: string, item: CacheItem<T>): Promise<void> {
    // 如果缓存满了，使用LRU策略淘汰
    if (this.l1Cache.size >= this.l1MaxSize) {
      const evictedKey = this.findLRUKey();
      if (evictedKey) {
        const evictedItem = this.l1Cache.get(evictedKey);
        this.l1Cache.delete(evictedKey);
        
        // 根据策略决定是否将淘汰项提升到L2
        if (this.strategy === CacheStrategy.WRITE_BACK && this.l2Cache && evictedItem) {
          try {
            const serialized = JSON.stringify(evictedItem.value);
            await this.l2Cache.setex(
              evictedKey, 
              evictedItem.ttl - evictedItem.timestamp, 
              serialized
            );
          logger.debug('L1淘汰项提升到L2');
          } catch (error) {
            logger.error('L1淘汰项提升到L2失败');
          }
        }
        
        logger.debug('L1缓存淘汰');
      }
    }

    this.l1Cache.set(key, item);
    this.updateMemoryUsage();
  }

  /**
   * 查找LRU淘汰项
   */
  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.l1Cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 删除缓存值
   */
  public async delete(key: string): Promise<void> {
    // 从L1删除
    if (this.l1Cache.has(key)) {
      this.l1Cache.delete(key);
      logger.debug('L1缓存删除');
    }

    // 从L2删除
        if (this.l2Cache) {
      try {
        await this.l2Cache.del(key);
        logger.debug('L2缓存删除');
      } catch (error) {
        logger.error('L2缓存删除失败');
      }
    }
  }

  /**
   * 检查缓存是否存在
   */
  public async exists(key: string): Promise<boolean> {
    // 先检查L1
    if (this.l1Cache.has(key)) {
      const item = this.l1Cache.get(key);
      if (item && Date.now() - item.timestamp < item.ttl) {
        return false; // 已过期
      }
      return true;
    }

    // 检查L2
    if (this.l2Cache) {
      try {
        const exists = await this.l2Cache.exists(key);
        return exists === 1;
      } catch (error) {
      logger.error('L2存在性检查失败');
        return false;
      }
    }

    return false;
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // 清理L1过期项
    for (const [key, item] of this.l1Cache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.l1Cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug('L1缓存清理');
    }

    // 清理L2过期项（如果Redis配置了自动清理，这里可以跳过）
    this.updateMemoryUsage();
  }

  /**
   * 更新内存使用统计
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    
    for (const item of this.l1Cache.values()) {
      // 粗略估算内存使用
      totalSize += this.estimateItemSize(item);
    }
    
    this.stats.memoryUsage = totalSize;
    this.stats.l1Size = this.l1Cache.size;
  }

  /**
   * 估算缓存项大小
   */
  private estimateItemSize(item: CacheItem<unknown>): number {
    const baseSize = 50; // 基础开销
    const valueSize = JSON.stringify(item.value).length * 2; // 字符串大小 * 2
    const metadataSize = item.metadata ? JSON.stringify(item.metadata).length : 0;
    
    return baseSize + valueSize + metadataSize;
  }

  /**
   * 获取缓存统计
   */
  public getStats(): CacheStats {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalMisses = this.stats.l1Misses + this.stats.l2Misses;
    const totalRequests = totalHits + totalMisses;
    
    this.stats.hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    return { ...this.stats };
  }

  /**
   * 批量获取
   */
  public async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];
    
    // 并行获取
    const promises = keys.map(key => this.get<T>(key));
    const resolved = await Promise.all(promises);
    
    return resolved;
  }

  /**
   * 批量设置
   */
  public async mset<T>(
    items: Array<{ key: string; value: T; options?: unknown }>
  ): Promise<void> {
    const promises = items.map(item => 
      this.set(item.key, item.value, item.options || {})
    );
    
    await Promise.all(promises);
  }

  /**
   * 原子操作：检查并设置
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: {
      ttl?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    // 先尝试获取
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，调用工厂函数
    const value = await factory();
    
    // 设置缓存
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * 预热缓存
   */
  public async warmup<T>(
    items: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    logger.info('开始缓存预热');
    
    const promises = items.map(item => 
      this.set(item.key, item.value, { ttl: item.ttl })
    );
    
    await Promise.all(promises);
    
      logger.info('缓存预热完成');
  }

  /**
   * 清空所有缓存
   */
  public async clear(): Promise<void> {
    // 清空L1
    this.l1Cache.clear();
    
    // 清空L2
    if (this.l2Cache) {
      try {
        await this.l2Cache.flushdb();
        logger.info('所有缓存已清空');
      } catch (error) {
        logger.error('L2缓存清空失败');
      }
    }
    
    // 重置统计
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalRequests: 0,
      hitRate: 0,
      memoryUsage: 0,
      l1Size: 0
    };
  }

  /**
   * 销毁缓存系统
   */
  public async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this.clear();
    
    if (this.l2Cache) {
      try {
        await this.l2Cache.quit();
        logger.info('Redis连接已关闭');
      } catch (error) {
        logger.error('关闭Redis连接失败');
      }
    }
    
    logger.info('多级缓存系统已销毁');
  }

  /**
   * 获取缓存健康状态
   */
  public getHealthStatus(): {
    l1CacheSize: number;
    l2Connected: boolean;
    hitRate: number;
    memoryUsage: number;
    strategy: CacheStrategy;
  } {
    return {
      l1CacheSize: this.l1Cache.size,
      l2Connected: !!this.l2Cache && this.l2Cache.status === 'ready',
      hitRate: this.stats.hitRate,
      memoryUsage: this.stats.memoryUsage,
      strategy: this.strategy
    };
  }
}

/**
 * 创建多级缓存实例
 */
export function createMultiLevelCache(options?: {
  redis?: Redis;
  strategy?: CacheStrategy;
  l1MaxSize?: number;
  l1TTL?: number;
  l2TTL?: number;
  cleanupInterval?: number;
}): MultiLevelCache {
  return new MultiLevelCache(options);
}

/**
 * 全局缓存实例
 */
export const multiLevelCache = createMultiLevelCache();
