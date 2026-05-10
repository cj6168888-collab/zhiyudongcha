import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../lib/logger';
import { z } from 'zod';
import { ErrorCode, BusinessError as BaseBusinessError } from '../lib/errors';

const logger = createServiceLogger('UnifiedErrorHandler');

// Re-export ErrorCode from lib/errors for backward compatibility
export { ErrorCode };

// 应用错误类 - 扩展 lib/errors 中的 BusinessError
export class AppError extends BaseBusinessError {
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, details);
    this.name = 'AppError';
    this.context = context;
    this.isOperational = true;
  }
}

// 业务错误类
export class BusinessError extends AppError {
  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>) {
    super(message, code, 400, details);
    this.name = 'BusinessError';
  }
}

// 验证错误类
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

// 认证错误类
export class AuthenticationError extends AppError {
  constructor(message: string = '认证失败') {
    super(message, ErrorCode.AUTHENTICATION_ERROR, 401);
    this.name = 'AuthenticationError';
  }
}

// 授权错误类
export class AuthorizationError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, ErrorCode.AUTHORIZATION_ERROR, 403);
    this.name = 'AuthorizationError';
  }
}

// 资源未找到错误类
export class NotFoundError extends AppError {
  constructor(resource: string = '资源') {
    super(`${resource}不存在`, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

// 并发冲突错误类
export class ConcurrencyError extends AppError {
  constructor(message: string = '并发操作冲突', details?: Record<string, unknown>) {
    super(message, ErrorCode.CONFLICT, 409, details);
    this.name = 'ConcurrencyError';
  }
}

// 外部服务错误类
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(`${service}服务错误: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, 502, {
      service,
      originalMessage: message,
      ...details
    });
    this.name = 'ExternalServiceError';
  }
}

// 数据库错误类
export class DatabaseError extends AppError {
  constructor(operation: string, message: string, details?: Record<string, unknown>) {
    super(`数据库操作失败: ${operation} - ${message}`, ErrorCode.DATABASE_ERROR, 500, {
      operation,
      originalMessage: message,
      ...details
    });
    this.name = 'DatabaseError';
  }
}

// 错误响应Schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    context: z.unknown().optional(),
    timestamp: z.string(),
    requestId: z.string().optional(),
  }),
  timestamp: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// 统一错误处理中间件
export function createUnifiedErrorHandler() {
  return (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // 记录错误详情
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      requestId: req.headers['x-request-id'],
      userId: req.session?.user?.id,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    // 如果错误已经被处理过，直接传递给下一个中间件
    if (res.headersSent) {
      return next(error);
    }

    let appError: AppError;
    let response: ErrorResponse;

    // 将普通错误转换为AppError
    if (!(error instanceof AppError)) {
      appError = new AppError(
        error.message || '服务器内部错误',
        ErrorCode.INTERNAL_ERROR,
        500,
        { originalError: error.name }
      );
    } else {
      appError = error;
    }

    // 根据错误类型确定响应状态码
    const statusCode = appError.statusCode || 500;

    // 记录错误日志
    if (appError.statusCode >= 500) {
      logger.error('服务器错误', {
        ...errorInfo,
        errorCode: appError.code,
        statusCode,
        details: appError.details,
      });
    } else {
      logger.warn('客户端错误', {
        ...errorInfo,
        errorCode: appError.code,
        statusCode,
        details: appError.details,
      });
    }

    // 构建错误响应
    response = {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        context: appError.context,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string,
      },
      timestamp: new Date().toISOString(),
    };

    // 在开发环境中包含堆栈信息
    if (process.env.NODE_ENV === 'development') {
      (response.error as Record<string, unknown>).stack = appError.stack;
    }

    // 添加安全响应头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    res.status(statusCode).json(response);
  };
}

// 异步错误处理包装器
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 错误边界工厂
export function createErrorBoundary(serviceName: string) {
  return (error: Error): AppError => {
    if (error instanceof AppError) {
      return error;
    }

    // 根据服务名称和错误类型创建相应的AppError
    if (error.name === 'ValidationError') {
      return new ValidationError(`${serviceName}验证错误: ${error.message}`);
    }

    if (error.name === 'MongoError' || error.name === 'PostgresError') {
      return new DatabaseError(serviceName, error.message, { databaseError: error.name });
    }

    if (error.message?.includes('timeout')) {
      return new AppError(`${serviceName}操作超时`, ErrorCode.TIMEOUT_ERROR, 408);
    }

    return new AppError(`${serviceName}未知错误: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500, {
      serviceName,
      originalError: error.name
    });
  };
}

// 错误恢复工具
export class ErrorRecovery {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1秒

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      delay?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.MAX_RETRIES;
    const delay = options.delay ?? this.RETRY_DELAY;
    const shouldRetry = options.shouldRetry ?? ((error: Error) => error.name === 'TimeoutError');

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        if (!shouldRetry(lastError)) {
          break;
        }

        logger.warn(`操作失败，${delay}ms后重试 (${attempt + 1}/${maxRetries + 1})`, {
          error: (error as Error).message,
          attempt: attempt + 1,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      logger.warn(`主操作失败，使用备用方案`, {
        operation: operationName,
        error: (error as Error).message,
      });

      return await fallbackOperation();
    }
  }

  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      failureThreshold?: number;
      timeout?: number;
    } = {}
  ) {
    const failureThreshold = options.failureThreshold ?? 5;
    const timeout = options.timeout ?? 30000;
    let failureCount = 0;

    return async (): Promise<T> => {
      if (failureCount >= failureThreshold) {
        throw new AppError('服务暂时不可用，请稍后重试', ErrorCode.RATE_LIMIT_EXCEEDED, 503);
      }

      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('操作超时')), timeout)
          )
        ]);

        failureCount = 0; // 重置失败计数
        return result;
      } catch (error) {
        failureCount++;
        throw error;
      }
    };
  }
}

// 错误通知服务
interface ErrorContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

export class ErrorNotificationService {
  private static readonly CRITICAL_ERRORS = [
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.EXTERNAL_SERVICE_ERROR,
  ];

  static shouldNotify(error: AppError): boolean {
    return this.CRITICAL_ERRORS.includes(error.code) && error.statusCode >= 500;
  }

  static async notifyError(error: AppError, context: ErrorContext): Promise<void> {
    if (!this.shouldNotify(error)) {
      return;
    }

    try {
      await Promise.all([
        this.notifyWebhook(error, context),
        this.notifyLogAggregator(error, context),
        this.notifyEmail(error, context),
      ]);
    } catch (notificationError) {
      logger.error('发送错误通知失败', { notificationError });
    }
  }

  private static async notifyWebhook(error: AppError, context: ErrorContext): Promise<void> {
    const webhookUrl = process.env.ERROR_WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    // 发送到webhook
    logger.info('发送错误webhook通知', { webhookUrl, payload });
  }

  private static async notifyLogAggregator(error: AppError, context: ErrorContext): Promise<void> {
    // 集成日志聚合服务（如Sentry、LogRocket等）
    logger.error('错误聚合通知', {
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack,
        details: error.details,
      },
      context,
    });
  }

  private static async notifyEmail(error: AppError, context: ErrorContext): Promise<void> {
    // 发送邮件通知（仅用于严重错误）
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    logger.info('发送错误邮件通知', { adminEmail, error: error.message, context });
  }
}

// 导出默认的统一错误处理中间件
export const unifiedErrorHandler = createUnifiedErrorHandler();
