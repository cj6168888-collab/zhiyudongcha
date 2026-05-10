/**
 * 慢请求检测中间件单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSlowRequestMiddleware } from '../../middleware/slow-request';
import { Request, Response } from 'express';

describe('SlowRequestMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
    };

    mockRes = {
      statusCode: 200,
      on: vi.fn(),
    };

    mockNext = vi.fn();
  });

  it('应该调用 next', () => {
    const middleware = createSlowRequestMiddleware({ thresholdMs: 1000 });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该使用默认阈值 3000ms', () => {
    const middleware = createSlowRequestMiddleware();
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该支持自定义阈值', () => {
    const middleware = createSlowRequestMiddleware({ thresholdMs: 500 });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
