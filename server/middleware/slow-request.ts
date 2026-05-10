/**
 * 慢请求检测中间件
 * Phase 4 - 可观测性
 */

import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../lib/logger';

interface SlowRequestOptions {
  thresholdMs?: number;
  warnOnStartup?: boolean;
}

const defaultOptions: SlowRequestOptions = {
  thresholdMs: 3000,
  warnOnStartup: false,
};

export function createSlowRequestMiddleware(options: SlowRequestOptions = {}) {
  const config = { ...defaultOptions, ...options };
  const logger = createServiceLogger('SlowRequest');

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 15);

    const checkDuration = () => {
      const duration = Date.now() - startTime;
      
      if (duration > config.thresholdMs!) {
        logger.warn({
          requestId,
          method: req.method,
          path: req.path,
          duration,
          threshold: config.thresholdMs,
        }, `Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
    };

    res.on('finish', checkDuration);
    res.on('close', checkDuration);

    next();
  };
}

export const slowRequestMiddleware = createSlowRequestMiddleware();
