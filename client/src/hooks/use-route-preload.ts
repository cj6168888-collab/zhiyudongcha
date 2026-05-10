/**
 * Route Preloading Hook
 *
 * Preloads routes and assets when user hovers or focuses on links
 * to improve perceived performance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useRoutePreload');

export interface PreloadOptions {
  prefetch?: boolean;
  cache?: boolean;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface UseRoutePreloadReturn {
  preload: (path: string, options?: PreloadOptions) => Promise<void>;
  preloadOnHover: (event: React.MouseEvent) => void;
  preloadOnFocus: (event: React.FocusEvent) => void;
  cancelPreload: (path: string) => void;
  clearCache: () => void;
  getPreloadStats: () => PreloadStats;
}

export interface PreloadStats {
  cached: number;
  loading: number;
  failed: number;
  totalRequests: number;
}

interface PendingPreload {
  path: string;
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
}

const DEFAULT_OPTIONS: Required<PreloadOptions> = {
  prefetch: true,
  cache: true,
  timeout: 3000,
  priority: 'normal',
};

const preloadCache = new Map<string, { timestamp: number; data?: unknown }>();
const pendingPrefetches = new Map<string, PendingPreload>();
let stats = { cached: 0, loading: 0, failed: 0, totalRequests: 0 };

export function useRoutePreload(): UseRoutePreloadReturn {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const preload = useCallback(
    async (path: string, options: PreloadOptions = {}): Promise<void> => {
      const config = { ...DEFAULT_OPTIONS, ...options };
      stats.totalRequests++;

      if (preloadCache.has(path)) {
        const cached = preloadCache.get(path)!;
        const isFresh = Date.now() - cached.timestamp < 60000;

        if (isFresh) {
          stats.cached++;
          logger.debug(`[useRoutePreload] Cache hit: ${path}`);
          return Promise.resolve();
        }
      }

      if (pendingPrefetches.has(path)) {
        logger.debug(`[useRoutePreload] Already pending: ${path}`);
        return Promise.resolve();
      }

      if (!config.prefetch) {
        return Promise.resolve();
      }

      logger.debug(`[useRoutePreload] Starting preload: ${path}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        pendingPrefetches.delete(path);
        stats.loading--;
        logger.warn(`[useRoutePreload] Preload timeout: ${path}`);
      }, config.timeout);

      pendingPrefetches.set(path, { path, controller, timeoutId });
      stats.loading++;

      try {
        const response = await fetch(path, {
          method: 'HEAD',
          signal: controller.signal,
          credentials: 'same-origin',
        });

        if (response.ok) {
          if (config.cache) {
            preloadCache.set(path, { timestamp: Date.now() });
          }

          logger.info(`[useRoutePreload] Preload successful: ${path}`);
        } else {
          stats.failed++;
          logger.warn(`[useRoutePreload] Preload failed: ${path} (${response.status})`);
        }
      } catch (error) {
        if ((error as any).name !== 'AbortError') {
          stats.failed++;
          logger.warn(`[useRoutePreload] Preload error: ${path}`, error);
        }
      } finally {
        clearTimeout(timeoutId);
        pendingPrefetches.delete(path);
        stats.loading--;
      }
    },
    []
  );

  const preloadOnHover = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>): void => {
      const target = event.currentTarget;
      const path =
        target instanceof HTMLAnchorElement
          ? target.href
          : (target as any).dataset?.preload;

      if (!path) return;

      if ((event as any).defaultPrevented) return;

      const preloadTimer = setTimeout(() => {
        preload(path);
      }, 50);

      target.addEventListener(
        'mouseleave',
        () => clearTimeout(preloadTimer),
        { once: true }
      );
    },
    [preload]
  );

  const preloadOnFocus = useCallback(
    (event: React.FocusEvent<HTMLAnchorElement | HTMLButtonElement>): void => {
      const target = event.currentTarget;
      const path =
        target instanceof HTMLAnchorElement
          ? target.href
          : (target as any).dataset?.preload;

      if (!path) return;

      const preloadTimer = setTimeout(() => {
        preload(path);
      }, 100);

      target.addEventListener(
        'blur',
        () => clearTimeout(preloadTimer),
        { once: true }
      );
    },
    [preload]
  );

  const cancelPreload = useCallback((path: string): void => {
    const pending = pendingPrefetches.get(path);
    if (pending) {
      pending.controller.abort();
      clearTimeout(pending.timeoutId);
      pendingPrefetches.delete(path);
      stats.loading--;
      logger.debug(`[useRoutePreload] Cancelled preload: ${path}`);
    }
  }, []);

  const clearCache = useCallback((): void => {
    preloadCache.clear();
    pendingPrefetches.forEach((pending) => {
      pending.controller.abort();
      clearTimeout(pending.timeoutId);
    });
    pendingPrefetches.clear();
    stats = { cached: 0, loading: 0, failed: 0, totalRequests: 0 };
    logger.info('[useRoutePreload] Cache cleared');
  }, []);

  const getPreloadStats = useCallback((): PreloadStats => {
    return { ...stats };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    preload,
    preloadOnHover: preloadOnHover as (event: React.MouseEvent) => void,
    preloadOnFocus: preloadOnFocus as (event: React.FocusEvent) => void,
    cancelPreload,
    clearCache,
    getPreloadStats,
  };
}

export function useLinkPreload(path: string): {
  onMouseEnter: React.MouseEventHandler;
  onFocus: React.FocusEventHandler;
} {
  const { preloadOnHover, preloadOnFocus } = useRoutePreload();

  return {
    onMouseEnter: preloadOnHover as React.MouseEventHandler,
    onFocus: preloadOnFocus as React.FocusEventHandler,
  };
}

export function createLinkPrefetcher(preload: (path: string) => void) {
  return {
    onMouseEnter: (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('http') || target.getAttribute('target') === '_blank') return;

      const timer = setTimeout(() => {
        preload(href);
      }, 100);

      target.addEventListener(
        'mouseleave',
        () => clearTimeout(timer),
        { once: true }
      );
    },
  };
}

export default useRoutePreload;
