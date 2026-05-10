import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../lib/logger';
import { BusinessError, ErrorCode, isBusinessError } from '../lib/errors';

const errorLogger = logger.child({ module: 'ErrorHandler' });

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncFunction): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (isBusinessError(err)) {
    if (err.statusCode >= 500) {
      errorLogger.error({ err, request: requestInfo }, err.message);
    } else {
      errorLogger.warn({ err, request: requestInfo }, err.message);
    }

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  errorLogger.error(
    { err, request: requestInfo, stack: err.stack },
    '未处理的系统错误'
  );

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: '服务暂时不可用，请稍后重试',
    code: ErrorCode.INTERNAL_ERROR,
    ...(isDevelopment && { debug: { message: err.message, stack: err.stack } }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  errorLogger.debug({ path: req.path, method: req.method }, '路由未找到');
  
  res.status(404).json({
    error: `路径 ${req.method} ${req.path} 不存在`,
    code: ErrorCode.NOT_FOUND,
  });
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    }, `${req.method} ${req.path}`);
  });
  
  next();
}
