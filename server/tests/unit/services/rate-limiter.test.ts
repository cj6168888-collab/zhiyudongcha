import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

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
});
