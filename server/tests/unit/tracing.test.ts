/**
 * 分布式追踪中间件单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTracingMiddleware } from '../../middleware/tracing';
import { Request, Response } from 'express';

describe('TracingMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      get: vi.fn(),
    };

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      send: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('应该为请求生成 trace ID', () => {
    const middleware = createTracingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-ID', expect.any(String));
  });

  it('应该使用请求中的 trace ID 如果存在', () => {
    mockReq.headers = { 'x-trace-id': 'existing-trace-id' };
    const middleware = createTracingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-ID', 'existing-trace-id');
  });

  it('应该跳过配置的路径', () => {
    mockReq.path = '/health';
    const middleware = createTracingMiddleware({
      skipPaths: ['/health'],
    });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  it('应该生成 span ID', () => {
    const middleware = createTracingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Span-ID', expect.any(String));
  });

  it('应该将 trace 上下文附加到请求对象', () => {
    const middleware = createTracingMiddleware({ skipPaths: [] });
    
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).traceContext).toBeDefined();
    expect((mockReq as any).traceId).toBeDefined();
  });
});
