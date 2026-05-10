/**
 * 请求速率限制中间件 - 技术债务清理
 *
 * 功能：
 * 1. 基于IP/用户的请求限流
 * 2. 滑动窗口算法
 * 3. 动态阈值（VIP用户更高限额）
 * 4. 端点级别的自定义限制
 * 5. 限流指标统计
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createServiceLogger } from '../lib/logger';
import { cacheManager, timerManager } from '../lib';

const logger = createServiceLogger('RateLimiter');

export interface RateLimitConfig {
  windowMs: number;        // 时间窗口（毫秒）
  maxRequests: number;     // 最大请求数
  keyGenerator?: (req: Request) => string;
  skipPaths?: string[];    // 跳过的路径
  skipRoles?: string[];    // 跳过的角色
  message?: string;
  statusCode?: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  requests: number[];  // 请求时间戳（滑动窗口）
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000,       // 1分钟
  maxRequests: 100,      // 100次/分钟
  statusCode: 429,
  message: '请求过于频繁，请稍后再试',
};

class RateLimiterStore {
  private entries: Map<string, RateLimitEntry>;

  constructor() {
    this.entries = cacheManager.createCache<RateLimitEntry>('rate-limiter', {
      maxSize: 10000,
      ttlMs: 5 * 60 * 1000,
    }) as unknown as Map<string, RateLimitEntry>;

    this.startCleanup();
  }

  private startCleanup(): void {
    timerManager.setInterval('rate-limiter-cleanup', () => {
      const now = Date.now();
      const entries = Array.from(this.entries.entries());
      for (const [key, entry] of entries) {
        if (entry.resetAt < now) {
          this.entries.delete(key);
        }
      }
    }, 60000);
  }

  get(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    let entry = this.entries.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
        requests: [],
      };
      this.entries.set(key, entry);
    }

    // 滑动窗口：移除过期的请求
    entry.requests = entry.requests.filter(t => t > now - windowMs);
    entry.count = entry.requests.length;

    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const entry = this.get(key, windowMs);
    entry.requests.push(Date.now());
    entry.count = entry.requests.length;
    return entry;
  }

  getStats(): { totalKeys: number; totalRequests: number } {
    let totalRequests = 0;
    const values = Array.from(this.entries.values());
    for (const entry of values) {
      totalRequests += entry.count;
    }
    return {
      totalKeys: this.entries.size,
      totalRequests,
    };
  }

  stop(): void {
    timerManager.clearInterval('rate-limiter-cleanup');
  }
}

const globalStore = new RateLimiterStore();

function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  type ReqWithUser = Request & { user?: { id?: string } };
  const userId = ((req as unknown) as ReqWithUser).user?.id ?? '';
  return userId ? `user:${userId}` : `ip:${ip}`;
}

export function createRateLimiter(config: Partial<RateLimitConfig> = {}): RequestHandler {
  const finalConfig: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };
  const keyGenerator = finalConfig.keyGenerator || defaultKeyGenerator;

  return (req: Request, res: Response, next: NextFunction) => {
    // 检查跳过路径
    if (finalConfig.skipPaths?.some(path => req.path.startsWith(path))) {
      return next();
    }

    // 检查跳过角色
  type ReqWithRole = Request & { user?: { role?: string } };
  const role = ((req as unknown) as ReqWithRole).user?.role ?? (req.headers['x-user-role'] as string | undefined);
    if (finalConfig.skipRoles?.includes(role as string)) {
      return next();
    }

    const key = keyGenerator(req);
    const entry = globalStore.increment(key, finalConfig.windowMs);

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > finalConfig.maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - Date.now()) / 1000));

      logger.warn({ key, count: entry.count, limit: finalConfig.maxRequests }, '限流触发');

      return res.status(finalConfig.statusCode!).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: finalConfig.message,
        retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000),
        limit: finalConfig.maxRequests,
        current: entry.count,
      });
    }

    next();
  };
}

// 预设限流器
export const standardLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

export const strictLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  message: '此接口请求过于频繁',
});

export const aiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  message: 'AI接口调用次数已达上限',
});

export const authLimiter = createRateLimiter({
  windowMs: 300000,  // 5分钟
  maxRequests: 10,
  message: '登录尝试过多，请5分钟后再试',
});

export const uploadLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  message: '上传频率过高',
});

// VIP用户限流器
export function createVipLimiter(vipMultiplier = 5): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.role || req.headers['x-user-role'];
    const isVip = role === 'MASTER';

    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: isVip ? 500 : 100,
    });

    return limiter(req, res, next);
  };
}

// 统计端点
export function getRateLimitStats() {
  return globalStore.getStats();
}

logger.info('速率限制中间件已加载');
