/**
 * 错误处理单元测试 - Vitest格式
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  BusinessError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  AIServiceError,
  DatabaseError,
  TimeoutError,
  DuplicateEntryError,
  ResourceLockedError,
  SessionExpiredError,
  InvalidTokenError,
  isBusinessError,
  isRetryableError,
  createErrorResponse,
  createValidationErrorResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createInternalErrorResponse,
  type ApiErrorResponse,
} from '../../lib/errors';

describe('错误处理系统', () => {
  describe('ErrorCode 枚举', () => {
    it('应该包含所有定义的错误码', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
      expect(ErrorCode.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCode.AI_SERVICE_ERROR).toBe('AI_SERVICE_ERROR');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    });
  });

  describe('BusinessError 基类', () => {
    it('应该正确设置错误属性', () => {
      const error = new BusinessError(
        '测试错误',
        ErrorCode.VALIDATION_ERROR,
        400,
        { field: 'test' }
      );

      expect(error.message).toBe('测试错误');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('BusinessError');
    });

    it('应该正确序列化JSON', () => {
      const error = new BusinessError(
        '测试错误',
        ErrorCode.VALIDATION_ERROR,
        400,
        { field: 'test' }
      );

      const json = error.toJSON();
      expect(json).toEqual({
        error: '测试错误',
        code: ErrorCode.VALIDATION_ERROR,
        details: { field: 'test' },
      });
    });
  });

  describe('ValidationError', () => {
    it('应该创建验证错误', () => {
      const error = new ValidationError('字段不能为空', { field: 'email' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('字段不能为空');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('AuthenticationError', () => {
    it('应该创建认证错误', () => {
      const error = new AuthenticationError();
      expect(error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      expect(error.statusCode).toBe(401);
    });

    it('应该支持自定义消息', () => {
      const error = new AuthenticationError('令牌无效');
      expect(error.message).toBe('令牌无效');
    });
  });

  describe('AuthorizationError', () => {
    it('应该创建授权错误', () => {
      const error = new AuthorizationError();
      expect(error.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('应该创建404错误', () => {
      const error = new NotFoundError('用户', '123');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('用户');
      expect(error.message).toContain('123');
    });

    it('应该支持不带ID的创建', () => {
      const error = new NotFoundError('资源');
      expect(error.message).toBe('资源 不存在');
    });
  });

  describe('ConflictError', () => {
    it('应该创建409冲突错误', () => {
      const error = new ConflictError('资源已存在');
      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RateLimitError', () => {
    it('应该创建429限流错误', () => {
      const error = new RateLimitError();
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(429);
    });
  });

  describe('AIServiceError', () => {
    it('应该创建AI服务错误', () => {
      const error = new AIServiceError('API调用失败', 'openai', true);
      expect(error.code).toBe(ErrorCode.AI_SERVICE_ERROR);
      expect(error.statusCode).toBe(503);
      expect(error.provider).toBe('openai');
      expect(error.retryable).toBe(true);
    });

    it('不可重试时应该返回不同的错误码', () => {
      const error = new AIServiceError('API不可用', 'openai', false);
      expect(error.code).toBe(ErrorCode.AI_SERVICE_UNAVAILABLE);
    });
  });

  describe('DatabaseError', () => {
    it('应该创建数据库错误', () => {
      const error = new DatabaseError('连接失败', { host: 'localhost' });
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('TimeoutError', () => {
    it('应该创建超时错误', () => {
      const error = new TimeoutError('数据库查询', 5000);
      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(error.statusCode).toBe(504);
      expect(error.details).toEqual({ operation: '数据库查询', timeoutMs: 5000 });
    });
  });

  describe('DuplicateEntryError', () => {
    it('应该创建重复条目错误', () => {
      const error = new DuplicateEntryError('email', 'test@example.com');
      expect(error.code).toBe(ErrorCode.DUPLICATE_ENTRY);
      expect(error.statusCode).toBe(409);
      expect(error.field).toBe('email');
      expect(error.value).toBe('test@example.com');
    });
  });

  describe('ResourceLockedError', () => {
    it('应该创建资源锁定错误', () => {
      const error = new ResourceLockedError('doc-123', 'user-456');
      expect(error.code).toBe(ErrorCode.RESOURCE_LOCKED);
      expect(error.statusCode).toBe(423);
      expect(error.resourceId).toBe('doc-123');
      expect(error.lockOwner).toBe('user-456');
    });
  });

  describe('SessionExpiredError', () => {
    it('应该创建会话过期错误', () => {
      const error = new SessionExpiredError();
      expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('InvalidTokenError', () => {
    it('应该创建令牌无效错误', () => {
      const error = new InvalidTokenError();
      expect(error.code).toBe(ErrorCode.INVALID_TOKEN);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('isBusinessError 工具函数', () => {
    it('应该正确识别BusinessError', () => {
      const error = new ValidationError('test');
      expect(isBusinessError(error)).toBe(true);
    });

    it('应该正确识别非BusinessError', () => {
      const error = new Error('normal error');
      expect(isBusinessError(error)).toBe(false);
    });

    it('应该正确识别非Error对象', () => {
      expect(isBusinessError('string error')).toBe(false);
      expect(isBusinessError(null)).toBe(false);
      expect(isBusinessError(undefined)).toBe(false);
    });
  });

  describe('isRetryableError 工具函数', () => {
    it('应该识别可重试的AI服务错误', () => {
      const error = new AIServiceError('timeout', 'openai', true);
      expect(isRetryableError(error)).toBe(true);
    });

    it('应该识别不可重试的AI服务错误', () => {
      const error = new AIServiceError('unavailable', 'openai', false);
      expect(isRetryableError(error)).toBe(false);
    });

    it('应该识别超时错误为可重试', () => {
      const error = new TimeoutError('operation', 5000);
      expect(isRetryableError(error)).toBe(true);
    });

    it('应该识别其他错误为不可重试', () => {
      const error = new ValidationError('test');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('错误响应创建函数', () => {
    describe('createErrorResponse', () => {
      it('应该创建标准错误响应', () => {
        const error = new ValidationError('验证失败', { field: 'name' });
        const response = createErrorResponse(error, 'req-123', '/api/users');

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toBe('验证失败');
        expect(response.error.details).toEqual({ field: 'name' });
        expect(response.error.timestamp).toBeDefined();
        expect(response.error.requestId).toBe('req-123');
        expect(response.error.path).toBe('/api/users');
      });
    });

    describe('createValidationErrorResponse', () => {
      it('应该创建验证错误响应', () => {
        const response = createValidationErrorResponse('参数错误', { issues: [] });

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toBe('参数错误');
      });
    });

    describe('createUnauthorizedResponse', () => {
      it('应该创建未认证错误响应', () => {
        const response = createUnauthorizedResponse();

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      });

      it('应该支持自定义消息', () => {
        const response = createUnauthorizedResponse('请先登录');
        expect(response.error.message).toBe('请先登录');
      });
    });

    describe('createForbiddenResponse', () => {
      it('应该创建禁止访问错误响应', () => {
        const response = createForbiddenResponse();

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
      });
    });

    describe('createNotFoundResponse', () => {
      it('应该创建资源不存在错误响应', () => {
        const response = createNotFoundResponse('用户');

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
        expect(response.error.message).toBe('用户不存在');
      });
    });

    describe('createInternalErrorResponse', () => {
      it('生产环境应该隐藏错误详情', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const response = createInternalErrorResponse('详细错误信息', 'req-123');

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(response.error.message).toBe('服务器内部错误');

        process.env.NODE_ENV = originalEnv;
      });

      it('开发环境应该显示详细错误', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const response = createInternalErrorResponse('详细错误信息', 'req-123');

        expect(response.error.message).toBe('详细错误信息');

        process.env.NODE_ENV = originalEnv;
      });
    });
  });
});
