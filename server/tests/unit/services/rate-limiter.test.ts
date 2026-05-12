import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getAllowedCorsOrigins, shouldSkipRateLimit } from '../../../middleware/security-middleware';

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  const originalEnv = {
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  };
  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
      return;
    }
    process.env[name] = value;
  };

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      method: 'GET',
      url: '/test'
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn()
    };

    nextFunction = vi.fn();
  });

  afterEach(() => {
    restoreEnv('ALLOWED_ORIGINS', originalEnv.ALLOWED_ORIGINS);
    restoreEnv('CORS_ORIGIN', originalEnv.CORS_ORIGIN);
    restoreEnv('NODE_ENV', originalEnv.NODE_ENV);
    restoreEnv('PORT', originalEnv.PORT);
  });

  describe('RateLimitConfig', () => {
    it('should have default configuration', () => {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
      });

      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should allow custom windowMs', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10
      });

      expect(limiter).toBeDefined();
    });

    it('should allow custom max requests', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 5
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('IP-based rate limiting', () => {
    it('should track requests by IP', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown')
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('Custom key generator', () => {
    it('should use custom key generator', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: (req) => (req.headers['x-user-id'] as string) || ipKeyGenerator(req.ip || 'unknown')
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('Skip successful requests', () => {
    it('should skip successful requests when configured', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        skipSuccessfulRequests: true
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('Skip failed requests', () => {
    it('should skip failed requests when configured', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        skipFailedRequests: true
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('Custom handler', () => {
    it('should use custom handler when provided', () => {
      const customHandler = (req: Request, res: Response) => {
        res.status(429).json({ error: 'Too many requests' });
      };

      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        handler: customHandler
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('Custom skip function', () => {
    it('should skip rate limiting when skip returns true', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 10,
        skip: (req) => req.headers['x-skip-rate-limit'] === 'true'
      });

      expect(limiter).toBeDefined();
    });

    it('should skip passive mobile home polling but keep assistant commands limited', () => {
      expect(shouldSkipRateLimit('GET', '/api/hp/balance')).toBe(true);
      expect(shouldSkipRateLimit('GET', '/api/models/status')).toBe(true);
      expect(shouldSkipRateLimit('GET', '/api/assistant/pending')).toBe(true);
      expect(shouldSkipRateLimit('POST', '/api/assistant')).toBe(false);
      expect(shouldSkipRateLimit('POST', '/api/assistant/pending')).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should accept a positive windowMs', () => {
      expect(() => {
        rateLimit({
          windowMs: 1,
          max: 10
        });
      }).not.toThrow();
    });

    it('should accept a positive max', () => {
      expect(() => {
        rateLimit({
          windowMs: 60000,
          max: 1
        });
      }).not.toThrow();
    });
  });

  describe('CORS origin defaults', () => {
    it('should allow the Vite mobile development origin on 127.0.0.1', () => {
      delete process.env.ALLOWED_ORIGINS;
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      expect(getAllowedCorsOrigins()).toContain('http://127.0.0.1:5001');
    });

    it('should not add dev client origins in production when origins are explicitly configured', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      const origins = getAllowedCorsOrigins();

      expect(origins).toContain('https://example.com');
      expect(origins).toContain('http://127.0.0.1:3000');
      expect(origins).not.toContain('http://127.0.0.1:5001');
    });
  });
});
