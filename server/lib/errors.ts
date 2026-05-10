export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INVALID_STATE = 'INVALID_STATE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  CACHE_MISS = 'CACHE_MISS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PARSING_ERROR = 'PARSING_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ENCRYPTION_ERROR = 'DECRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
}

export class BusinessError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean = true;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

export class ValidationError extends BusinessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends BusinessError {
  constructor(message: string = '身份验证失败') {
    super(message, ErrorCode.AUTHENTICATION_ERROR, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends BusinessError {
  constructor(message: string = '权限不足') {
    super(message, ErrorCode.AUTHORIZATION_ERROR, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends BusinessError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} (${id}) 不存在` : `${resource} 不存在`;
    super(message, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends BusinessError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends BusinessError {
  constructor(message: string = '请求过于频繁，请稍后重试') {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    this.name = 'RateLimitError';
  }
}

export class AIServiceError extends BusinessError {
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: string,
    retryable: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      retryable ? ErrorCode.AI_SERVICE_ERROR : ErrorCode.AI_SERVICE_UNAVAILABLE,
      503,
      details
    );
    this.name = 'AIServiceError';
    this.provider = provider;
    this.retryable = retryable;
  }
}

export class DatabaseError extends BusinessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.DATABASE_ERROR, 500, details);
    this.name = 'DatabaseError';
  }
}

export class TimeoutError extends BusinessError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `操作 "${operation}" 超时 (${timeoutMs}ms)`,
      ErrorCode.TIMEOUT_ERROR,
      504,
      { operation, timeoutMs }
    );
    this.name = 'TimeoutError';
  }
}

export class InvalidStateError extends BusinessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.INVALID_STATE, 422, details);
    this.name = 'InvalidStateError';
  }
}

export class FileTooLargeError extends BusinessError {
  public readonly maxSize: number;
  public readonly actualSize: number;

  constructor(maxSize: number, actualSize: number) {
    super(
      `文件大小超出限制 (最大 ${maxSize} 字节)`,
      ErrorCode.FILE_TOO_LARGE,
      413,
      { maxSize, actualSize }
    );
    this.name = 'FileTooLargeError';
    this.maxSize = maxSize;
    this.actualSize = actualSize;
  }
}

export class UnsupportedMediaTypeError extends BusinessError {
  public readonly supportedTypes: string[];
  public readonly actualType: string;

  constructor(supportedTypes: string[], actualType: string) {
    super(
      `不支持的文件类型: ${actualType}`,
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      415,
      { supportedTypes, actualType }
    );
    this.name = 'UnsupportedMediaTypeError';
    this.supportedTypes = supportedTypes;
    this.actualType = actualType;
  }
}

export class QuotaExceededError extends BusinessError {
  public readonly quotaType: string;
  public readonly used: number;
  public readonly limit: number;

  constructor(quotaType: string, used: number, limit: number) {
    super(
      `${quotaType}配额已用完 (已用 ${used}/${limit})`,
      ErrorCode.QUOTA_EXCEEDED,
      403,
      { quotaType, used, limit }
    );
    this.name = 'QuotaExceededError';
    this.quotaType = quotaType;
    this.used = used;
    this.limit = limit;
  }
}

export class DuplicateEntryError extends BusinessError {
  public readonly field: string;
  public readonly value: unknown;

  constructor(field: string, value: unknown) {
    super(
      `${field} "${value}" 已存在`,
      ErrorCode.DUPLICATE_ENTRY,
      409,
      { field, value }
    );
    this.name = 'DuplicateEntryError';
    this.field = field;
    this.value = value;
  }
}

export class ResourceLockedError extends BusinessError {
  public readonly resourceId: string;
  public readonly lockOwner: string;

  constructor(resourceId: string, lockOwner: string) {
    super(
      `资源 ${resourceId} 已被 ${lockOwner} 锁定`,
      ErrorCode.RESOURCE_LOCKED,
      423,
      { resourceId, lockOwner }
    );
    this.name = 'ResourceLockedError';
    this.resourceId = resourceId;
    this.lockOwner = lockOwner;
  }
}

export class CircuitBreakerError extends BusinessError {
  public readonly serviceName: string;

  constructor(serviceName: string) {
    super(
      `服务 ${serviceName} 熔断器已开启，请稍后重试`,
      ErrorCode.CIRCUIT_BREAKER_OPEN,
      503,
      { serviceName }
    );
    this.name = 'CircuitBreakerError';
    this.serviceName = serviceName;
  }
}

export class SessionExpiredError extends BusinessError {
  constructor(message = '会话已过期，请重新登录') {
    super(message, ErrorCode.SESSION_EXPIRED, 401);
    this.name = 'SessionExpiredError';
  }
}

export class InvalidTokenError extends BusinessError {
  constructor(message = '无效的令牌') {
    super(message, ErrorCode.INVALID_TOKEN, 401);
    this.name = 'InvalidTokenError';
  }
}

export class TokenExpiredError extends BusinessError {
  constructor(message = '令牌已过期') {
    super(message, ErrorCode.TOKEN_EXPIRED, 401);
    this.name = 'TokenExpiredError';
  }
}

export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AIServiceError) {
    return error.retryable;
  }
  if (error instanceof BusinessError) {
    return [ErrorCode.AI_SERVICE_ERROR, ErrorCode.TIMEOUT_ERROR].includes(error.code);
  }
  return false;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
    path?: string;
  };
}

export function createErrorResponse(
  error: BusinessError,
  requestId?: string,
  path?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId,
      path,
    },
  };
}

export function createValidationErrorResponse(
  message: string,
  details?: unknown,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

export function createUnauthorizedResponse(message = '请先登录'): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.AUTHENTICATION_ERROR,
      message,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createForbiddenResponse(message = '权限不足'): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.AUTHORIZATION_ERROR,
      message,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createNotFoundResponse(resource: string): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `${resource}不存在`,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createInternalErrorResponse(
  message = '服务器内部错误',
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}
