/**
 * Data Cache Hook
 *
 * Provides caching for API responses with LRU cache strategy,
 * automatic expiration, and cache invalidation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useDataCache');

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
  size: number;
}

export interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  storage?: 'memory' | 'localStorage';
  prefix?: string;
}

export interface UseDataCacheReturn<T> {
  get: (key: string) => CacheEntry<T> | null;
  set: (key: string, data: T, ttl?: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  invalidate: (pattern: string) => void;
  getStats: () => CacheStats;
  isCached: (key: string) => boolean;
  isExpired: (key: string) => boolean;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  totalHits: number;
  memoryUsage: number;
}

const DEFAULT_CONFIG: Required<CacheConfig> = {
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000,
  storage: 'memory',
  prefix: 'app_cache_',
};

export function useDataCache<T = unknown>(config: CacheConfig = {}): UseDataCacheReturn<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const statsRef = useRef({ totalHits: 0, memoryUsage: 0 });

  useEffect(() => {
    if (mergedConfig.storage === 'localStorage') {
      try {
        const saved = localStorage.getItem(`${mergedConfig.prefix}data`);
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.entries(parsed).forEach(([key, entry]: [string, any]) => {
            if (entry.expiresAt > Date.now()) {
              cacheRef.current.set(key, entry);
            }
          });
          logger.info('[useDataCache] Loaded cache from localStorage');
        }
      } catch (e) {
        logger.warn('[useDataCache] Failed to load cache from localStorage:', e);
      }
    }
  }, [mergedConfig.storage, mergedConfig.prefix]);

  const persistCache = useCallback(() => {
    if (mergedConfig.storage === 'localStorage') {
      try {
        const toSave: Record<string, CacheEntry<T>> = {};
        cacheRef.current.forEach((entry, key) => {
          if (entry.expiresAt > Date.now()) {
            toSave[key] = entry;
          }
        });

        const serialized = JSON.stringify(toSave);
        localStorage.setItem(`${mergedConfig.prefix}data`, serialized);
        statsRef.current.memoryUsage = new Blob([serialized]).size;
      } catch (e) {
        logger.warn('[useDataCache] Failed to persist cache:', e);
      }
    }
  }, [mergedConfig.storage, mergedConfig.prefix]);

  const pruneCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= mergedConfig.maxSize) return;

    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].hits - b[1].hits)
      .slice(0, Math.floor(mergedConfig.maxSize * 0.2));

    entries.forEach(([key]) => cache.delete(key));
    logger.debug(`[useDataCache] Pruned ${entries.length} entries`);
  }, [mergedConfig.maxSize]);

  const calculateSize = useCallback((data: T): number => {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }, []);

  const get = useCallback((key: string): CacheEntry<T> | null => {
    const entry = cacheRef.current.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      cacheRef.current.delete(key);
      return null;
    }

    entry.hits++;
    statsRef.current.totalHits++;

    persistCache();
    return entry;
  }, [persistCache]);

  const set = useCallback((key: string, data: T, ttl?: number): void => {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + (ttl ?? mergedConfig.defaultTTL),
      hits: 0,
      size: calculateSize(data),
    };

    cacheRef.current.set(key, entry);
    statsRef.current.memoryUsage += entry.size;

    pruneCache();
    persistCache();

    logger.debug(`[useDataCache] Set cache: ${key}`);
  }, [mergedConfig.defaultTTL, calculateSize, pruneCache, persistCache]);

  const remove = useCallback((key: string): void => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      statsRef.current.memoryUsage -= entry.size;
    }
    cacheRef.current.delete(key);
    persistCache();
    logger.debug(`[useDataCache] Removed cache: ${key}`);
  }, [persistCache]);

  const clear = useCallback((): void => {
    cacheRef.current.clear();
    statsRef.current.memoryUsage = 0;

    if (mergedConfig.storage === 'localStorage') {
      localStorage.removeItem(`${mergedConfig.prefix}data`);
    }

    logger.info('[useDataCache] Cache cleared');
  }, [mergedConfig.storage, mergedConfig.prefix]);

  const invalidate = useCallback((pattern: string): void => {
    const regex = new RegExp(pattern);
    let count = 0;

    cacheRef.current.forEach((_, key) => {
      if (regex.test(key)) {
        cacheRef.current.delete(key);
        count++;
      }
    });

    persistCache();
    logger.info(`[useDataCache] Invalidated ${count} entries matching: ${pattern}`);
  }, [persistCache]);

  const getStats = useCallback((): CacheStats => {
    return {
      size: cacheRef.current.size,
      maxSize: mergedConfig.maxSize,
      totalHits: statsRef.current.totalHits,
      memoryUsage: statsRef.current.memoryUsage,
    };
  }, [mergedConfig.maxSize]);

  const isCached = useCallback((key: string): boolean => {
    return get(key) !== null;
  }, [get]);

  const isExpired = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key);
    return entry ? entry.expiresAt < Date.now() : true;
  }, []);

  return {
    get,
    set,
    remove,
    clear,
    invalidate,
    getStats,
    isCached,
    isExpired,
  };
}

export function createCachedApi<T>(
  fetchFn: () => Promise<T>,
  cache: ReturnType<typeof useDataCache<T>>,
  key: string,
  ttl?: number
): () => Promise<T> {
  return async () => {
    const cached = cache.get(key);
    if (cached) {
      return cached.data;
    }

    const data = await fetchFn();
    cache.set(key, data, ttl);
    return data;
  };
}

export default useDataCache;
