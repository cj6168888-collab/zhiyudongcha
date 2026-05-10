/**
 * 安全相关单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEnhancedSecurityMiddleware,
  createIPWhitelistMiddleware,
  createSecurityLogMiddleware,
  defaultSecurityConfig,
} from '../../middleware/enhanced-security';
import type { Request, Response, NextFunction } from 'express';

describe('增强安全中间件', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    mockRes = {
      setHeader: vi.fn(),
      removeHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('createEnhancedSecurityMiddleware', () => {
    const security = createEnhancedSecurityMiddleware(defaultSecurityConfig);

    describe('csp', () => {
      it('应该设置Content-Security-Policy头', () => {
        security.csp(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Security-Policy',
          expect.stringContaining("default-src 'self'")
        );
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('hsts', () => {
      it('应该在安全连接时设置HSTS头', () => {
        (mockReq as any).secure = true;
        security.hsts(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Strict-Transport-Security',
          expect.stringContaining('max-age=')
        );
      });
    });

    describe('xssFilter', () => {
      it('应该设置X-XSS-Protection头', () => {
        security.xssFilter(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'X-XSS-Protection',
          '1; mode=block'
        );
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('frameGuard', () => {
      it('应该设置X-Frame-Options头', () => {
        security.frameGuard(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'X-Frame-Options',
          'DENY'
        );
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('createIPWhitelistMiddleware', () => {
      it('应该允许白名单IP', () => {
        const whitelist = ['127.0.0.1', '192.168.1.0/24'];
        const middleware = createIPWhitelistMiddleware(whitelist);
        
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('应该阻止非白名单IP', () => {
        const whitelist = ['192.168.1.0/24'];
        (mockReq as any).ip = '10.0.0.1';
        const middleware = createIPWhitelistMiddleware(whitelist);
        
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });
});
