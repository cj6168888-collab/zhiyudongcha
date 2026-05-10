/**
 * 分布式追踪中间件
 * Phase 4 - 可观测性
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { createServiceLogger } from '../lib/logger';

interface TracingOptions {
  serviceName?: string;
  sampleRate?: number;
  skipPaths?: string[];
}

const defaultOptions: TracingOptions = {
  serviceName: 'sheng-yu-zhu-shou',
  sampleRate: 1.0,
  skipPaths: ['/health', '/metrics', '/api/health', '/api/metrics'],
};

export function createTracingMiddleware(options: TracingOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    if (config.skipPaths?.some(path => req.path.startsWith(path))) {
      return next();
    }

    const shouldSample = Math.random() < config.sampleRate;
    if (!shouldSample) {
      return next();
    }

    const traceId = (req.headers['x-trace-id'] as string) ||
                    randomBytes(8).toString('hex');
    const spanId = randomBytes(4).toString('hex');
    const parentSpanId = req.headers['x-span-id'] as string | undefined;

    const traceContext = {
      traceId,
      spanId,
      parentSpanId,
      operationName: `${req.method} ${req.path}`,
      startTime: Date.now(),
      userId: req.user?.id,
      tags: {
        'http.method': req.method,
        'http.url': req.path,
        'http.host': req.get('host') || '',
        'service.name': config.serviceName!,
      },
    };

    req.traceContext = traceContext;
    req.traceId = traceId;

    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Span-ID', spanId);

    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function (body: unknown) {
      const duration = Date.now() - startTime;

      res.setHeader('X-Trace-ID', traceId);

      return originalSend.call(this, body);
    };

    next();
  };
}

export const tracingMiddleware = createTracingMiddleware();
