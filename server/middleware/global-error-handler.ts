/**
 * 全局错误处理工具
 * 减少 try-catch 块的使用
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../lib/logger';

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  
  private constructor() {}

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  safeAsync<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
    return promise
      .then((data): [T, null] => [data, null])
      .catch((err): [null, Error] => [null, err]);
  }

  getErrorHandler(): ErrorRequestHandler {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const statusCode = (err as { statusCode?: number }).statusCode || 500;
      
      logger.error({ 
        err: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode 
      }, '请求处理错误');

      if (res.headersSent) {
        return next(err);
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: err.name || 'INTERNAL_ERROR',
          message: err.message || '服务器内部错误'
        },
        timestamp: new Date().toISOString()
      });
    };
  }

  notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `路径 ${req.path} 不存在`
      },
      timestamp: new Date().toISOString()
    });
  }
}

export const errorHandler = GlobalErrorHandler.getInstance();
export default errorHandler;
