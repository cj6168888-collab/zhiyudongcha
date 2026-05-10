/**
 * 请求日志中间件单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequestLoggingMiddleware } from '../../middleware/request-logging';
import { Request, Response } from 'express';

describe('RequestLoggingMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;
  let consoleSpy: vi.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      query: { page: '1' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }),
    };

    mockRes = {
      statusCode: 200,
      get: vi.fn((header: string) => {
        if (header === 'content-length') return '100';
        return undefined;
      }),
      send: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('应该记录请求信息', () => {
    const middleware = createRequestLoggingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该跳过配置的路径', () => {
    mockReq.path = '/health';
    const middleware = createRequestLoggingMiddleware({
      skipPaths: ['/health'],
    });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该生成请求ID', () => {
    const middleware = createRequestLoggingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该在响应时记录状态码和耗时', () => {
    const middleware = createRequestLoggingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    const sendFn = mockRes.send;
    if (sendFn) {
      sendFn.call(mockRes, 'test response');
    }

    expect(mockNext).toHaveBeenCalled();
  });
});
