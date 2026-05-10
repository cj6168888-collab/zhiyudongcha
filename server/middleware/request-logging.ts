/**
 * 请求日志中间件
 * Phase 4 - 可观测性
 */

import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('RequestLog');

interface RequestLogOptions {
  skipPaths?: string[];
  includeBody?: boolean;
  includeHeaders?: string[];
}

const defaultOptions: RequestLogOptions = {
  skipPaths: ['/health', '/metrics', '/api/health', '/api/metrics'],
  includeBody: false,
  includeHeaders: ['content-type', 'authorization'],
};

export function createRequestLoggingMiddleware(options: RequestLogOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || 
                       Math.random().toString(36).substring(2, 15);

    if (config.skipPaths?.some(path => req.path.startsWith(path))) {
      return next();
    }

    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    logger.info(logData, `[${req.method}] ${req.path} - Started`);

    const originalSend = res.send;
    res.send = function (body: unknown) {
      const duration = Date.now() - startTime;
      
      logger.info({
        ...logData,
        statusCode: res.statusCode,
        duration,
        responseSize: res.get('content-length'),
      }, `[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);

      return originalSend.call(this, body);
    };

    next();
  };
}

export const requestLoggingMiddleware = createRequestLoggingMiddleware();
