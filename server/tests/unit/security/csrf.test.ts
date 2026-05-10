import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  generateCSRFToken,
  attachCSRFToken,
  csrfProtection,
  CSRF_HEADER_NAME
} from '../../../middleware/csrf-protection';

describe('CSRF Protection', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      headers: {},
      body: {},
      session: {} as any,
      ip: '127.0.0.1',
      path: '/test'
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      locals: {}
    };

    nextFunction = vi.fn();
  });

  describe('generateCSRFToken', () => {
    it('should generate a token with correct length', () => {
      const token = generateCSRFToken();
      expect(token).toHaveLength(64); // 32 bytes * 2 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('attachCSRFToken', () => {
    it('should generate token if session exists but no token', async () => {
      await attachCSRFToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.session?.csrfToken).toBeDefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reuse existing token in session', async () => {
      const existingToken = 'existing-token';
      mockRequest.session = { csrfToken: existingToken } as any;

      await attachCSRFToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.session?.csrfToken).toBe(existingToken);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('csrfProtection', () => {
    it('should allow GET requests without token', async () => {
      mockRequest.method = 'GET';

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests without token', async () => {
      mockRequest.method = 'HEAD';

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without token', async () => {
      mockRequest.method = 'OPTIONS';

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject POST without token', async () => {
      mockRequest.method = 'POST';

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CSRF_TOKEN_MISSING'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept POST with valid token in header', async () => {
      const validToken = 'valid-token';
      mockRequest.session = { csrfToken: validToken } as any;
      mockRequest.headers = { [CSRF_HEADER_NAME]: validToken } as any;

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should accept POST with valid token in body', async () => {
      const validToken = 'valid-token';
      mockRequest.session = { csrfToken: validToken } as any;
      mockRequest.body = { _csrf: validToken };

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject POST with invalid token', async () => {
      mockRequest.session = { csrfToken: 'valid-token' } as any;
      mockRequest.headers = { [CSRF_HEADER_NAME]: 'invalid-token' } as any;

      await csrfProtection(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CSRF_TOKEN_MISMATCH'
        })
      );
    });
  });
});
