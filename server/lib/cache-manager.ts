import { LRUCache } from 'lru-cache';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('CacheManager');

export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
  updateAgeOnGet?: boolean;
  allowStale?: boolean;
}

export interface CacheStats {
  name: string;
  size: number;
  maxSize: number;
  ttlMs: number;
  hitRate: number;
  hits: number;
  misses: number;
}

export class CacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private stats: Map<string, { hits: number; misses: number }> = new Map();
  private isShutdown = false;

  createCache<T extends {}>(name: string, options: CacheOptions = {}): LRUCache<string, T> {
    if (this.caches.has(name)) {
      logger.warn({ cache: name }, 'Cache already exists, returning existing instance');
      return this.caches.get(name)!;
    }

    const maxSize = options.maxSize || 1000;
    const ttlMs = options.ttlMs || 5 * 60 * 1000;

    const cache = new LRUCache<string, T>({
      max: maxSize,
      ttl: ttlMs,
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      allowStale: options.allowStale ?? false,
      dispose: (value, key, reason) => {
        logger.debug({ cache: name, key, reason }, 'Cache entry disposed');
      },
    });

    this.caches.set(name, cache);
    this.stats.set(name, { hits: 0, misses: 0 });
    
    logger.info({ cache: name, maxSize, ttlMs }, 'Cache created');
    return cache;
  }

  getCache<T extends {}>(name: string): LRUCache<string, T> | undefined {
    return this.caches.get(name);
  }

  get<T>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      logger.warn({ cache: cacheName }, 'Cache not found');
      return undefined;
    }

    const stats = this.stats.get(cacheName)!;
    const value = cache.get(key) as T | undefined;
    
    if (value !== undefined) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    return value;
  }

  set<T>(cacheName: string, key: string, value: T, ttlMs?: number): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      logger.warn({ cache: cacheName }, 'Cache not found');
      return false;
    }

    if (ttlMs) {
      cache.set(key, value, { ttl: ttlMs });
    } else {
      cache.set(key, value);
    }
    return true;
  }

  delete(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) return false;
    return cache.delete(key);
  }

  clearCache(name: string): void {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      const stats = this.stats.get(name);
      if (stats) {
        stats.hits = 0;
        stats.misses = 0;
      }
      logger.info({ cache: name }, 'Cache cleared');
    }
  }

  clearAll(): void {
    this.caches.forEach((cache, name) => {
      cache.clear();
      logger.debug({ cache: name }, 'Cache cleared');
    });
    this.stats.forEach((stats) => {
      stats.hits = 0;
      stats.misses = 0;
    });
    logger.info({ count: this.caches.size }, 'All caches cleared');
  }

  deleteCache(name: string): void {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      this.caches.delete(name);
      this.stats.delete(name);
      logger.info({ cache: name }, 'Cache deleted');
    }
  }

  getStats(): CacheStats[] {
    const result: CacheStats[] = [];
    
    this.caches.forEach((cache, name) => {
      const stats = this.stats.get(name) || { hits: 0, misses: 0 };
      const total = stats.hits + stats.misses;
      
      result.push({
        name,
        size: cache.size,
        maxSize: cache.max,
        ttlMs: cache.ttl,
        hitRate: total > 0 ? stats.hits / total : 0,
        hits: stats.hits,
        misses: stats.misses,
      });
    });
    
    return result;
  }

  getTotalMemoryUsage(): { cacheCount: number; totalEntries: number } {
    let totalEntries = 0;
    this.caches.forEach((cache) => {
      totalEntries += cache.size;
    });
    
    return {
      cacheCount: this.caches.size,
      totalEntries,
    };
  }

  shutdown(): void {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.clearAll();
    this.caches.clear();
    this.stats.clear();
    
    logger.info('CacheManager shutdown complete');
  }
}

export const cacheManager = new CacheManager();

process.on('SIGTERM', () => {
  cacheManager.shutdown();
});

process.on('SIGINT', () => {
  cacheManager.shutdown();
});
