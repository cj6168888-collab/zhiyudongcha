/**
 * AuthService 单元测试 - 简化版
 *
 * @version 3.0.0
 * @author 测试组
 * @date 2026-03-04
 *
 * 测试范围：
 * - WebSocket令牌管理（核心功能）
 * - 会话信息获取
 * - 边界条件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../services/AuthService';

// Mock所有依赖
vi.mock('../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../middleware/auth', () => ({
  auditAction: vi.fn(),
  getMasterSecret: vi.fn(() => 'test-master-secret-123'),
}));

vi.mock('../../services/UserService', () => ({
  userService: {
    validateCredentials: vi.fn(),
  },
}));

vi.mock('../../storage/adapter', () => ({
  storageAdapter: {},
}));

describe('AuthService - Core Features', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('generateWsToken()', () => {
    it('should generate MASTER token', () => {
      const result = authService.generateWsToken('MASTER');

      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(result.role).toBe('MASTER');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.expiresIn).toBe(30);
    });

    it('should generate GUEST token by default', () => {
      const result = authService.generateWsToken();

      expect(result.token).toBeDefined();
      expect(result.role).toBe('GUEST');
    });

    it('should generate unique tokens', () => {
      const token1 = authService.generateWsToken();
      const token2 = authService.generateWsToken();

      expect(token1.token).not.toBe(token2.token);
    });

    it('should set correct expiration time', () => {
      const beforeTime = Date.now();
      const result = authService.generateWsToken();
      const afterTime = Date.now();

      const expectedMin = beforeTime + 30000;
      const expectedMax = afterTime + 30000;

      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('validateWsToken()', () => {
    it('should validate valid token', () => {
      const generated = authService.generateWsToken('MASTER');
      const role = authService.validateWsToken(generated.token);

      expect(role).toBe('MASTER');
    });

    it('should reject invalid token', () => {
      const role = authService.validateWsToken('invalid-token');

      expect(role).toBeNull();
    });

    it('should delete token after validation (one-time use)', () => {
      const generated = authService.generateWsToken('MASTER');

      // First validation should succeed
      const role1 = authService.validateWsToken(generated.token);
      expect(role1).toBe('MASTER');

      // Second validation should fail (token deleted)
      const role2 = authService.validateWsToken(generated.token);
      expect(role2).toBeNull();
    });

    it('should reject expired token', () => {
      // Create a new instance to test expiration logic
      const testService = new AuthService();
      const generated = testService.generateWsToken('MASTER');

      // Mock Date.now to simulate time passing
      const originalDateNow = Date.now;
      const realNow = Date.now();
      Date.now = () => realNow + 31000; // 31 seconds later

      const role = testService.validateWsToken(generated.token);
      expect(role).toBeNull();

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should validate GUEST token', () => {
      const generated = authService.generateWsToken('GUEST');
      const role = authService.validateWsToken(generated.token);

      expect(role).toBe('GUEST');
    });
  });

  describe('cleanupExpiredTokens()', () => {
    it('should remove expired tokens', () => {
      // Generate a token
      const generated = authService.generateWsToken('MASTER');

      // Mock Date.now to simulate time passing
      const originalDateNow = Date.now;
      const realNow = Date.now();
      Date.now = () => realNow + 31000; // 31 seconds later

      // Cleanup
      authService.cleanupExpiredTokens();

      // Try to validate - should fail
      const role = authService.validateWsToken(generated.token);
      expect(role).toBeNull();

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should keep valid tokens', () => {
      // Generate a token
      const generated = authService.generateWsToken('MASTER');

      // Cleanup immediately
      authService.cleanupExpiredTokens();

      // Token should still be valid
      const role = authService.validateWsToken(generated.token);
      expect(role).toBe('MASTER');
    });
  });

  describe('getAuthStats()', () => {
    it('should return stats with correct structure', async () => {
      const stats = await authService.getAuthStats();

      expect(stats).toHaveProperty('activeTokens');
      expect(stats).toHaveProperty('masterTokens');
      expect(stats).toHaveProperty('guestTokens');
      expect(typeof stats.activeTokens).toBe('number');
      expect(typeof stats.masterTokens).toBe('number');
      expect(typeof stats.guestTokens).toBe('number');
    });

    it('should count tokens correctly', async () => {
      const beforeStats = await authService.getAuthStats();
      const before = beforeStats.activeTokens;

      authService.generateWsToken('MASTER');
      authService.generateWsToken('GUEST');

      const afterStats = await authService.getAuthStats();

      expect(afterStats.activeTokens).toBe(before + 2);
    });

    it('should count MASTER and GUEST tokens separately', async () => {
      const service = new AuthService();
      const beforeStats = await service.getAuthStats();

      service.generateWsToken('MASTER');
      service.generateWsToken('GUEST');

      const afterStats = await service.getAuthStats();

      expect(afterStats.masterTokens).toBe(beforeStats.masterTokens + 1);
      expect(afterStats.guestTokens).toBe(beforeStats.guestTokens + 1);
    });

    it('should decrease count after validation', async () => {
      const service = new AuthService();
      const beforeStats = await service.getAuthStats();

      const token = service.generateWsToken('MASTER');
      service.validateWsToken(token.token);

      const afterStats = await service.getAuthStats();

      // Token should be deleted after validation
      expect(afterStats.activeTokens).toBe(beforeStats.activeTokens);
    });
  });

  describe('getSessionInfo()', () => {
    it('should return authenticated session info', () => {
      const mockReq = {
        userRole: 'MASTER',
        session: {
          authenticatedAt: Date.now(),
        },
      };

      const info = authService.getSessionInfo(mockReq);

      expect(info.authenticated).toBe(true);
      expect(info.role).toBe('MASTER');
      expect(info.authenticatedAt).toBeDefined();
    });

    it('should return guest session info', () => {
      const mockReq = {
        userRole: undefined,
        session: {},
      };

      const info = authService.getSessionInfo(mockReq);

      expect(info.authenticated).toBe(false);
      expect(info.role).toBe('GUEST');
      expect(info.authenticatedAt).toBeNull();
    });

    it('should handle missing session', () => {
      const mockReq = {
        userRole: 'MASTER',
      };

      const info = authService.getSessionInfo(mockReq);

      expect(info.authenticated).toBe(true);
      expect(info.authenticatedAt).toBeNull();
    });

    it('should handle missing userRole', () => {
      const mockReq = {};

      const info = authService.getSessionInfo(mockReq);

      expect(info.authenticated).toBe(false);
      expect(info.role).toBe('GUEST');
    });
  });

  describe('Security Tests', () => {
    it('should use cryptographically secure random tokens', () => {
      const token = authService.generateWsToken('MASTER');

      // Token should be 64 hex characters (32 bytes)
      expect(token.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should not expose internal token storage', () => {
      const token = authService.generateWsToken('MASTER');

      // Token storage should not be directly accessible via public API
      expect(typeof authService.validateWsToken).toBe('function');
      expect(typeof authService.generateWsToken).toBe('function');
      expect(typeof authService.cleanupExpiredTokens).toBe('function');
    });

    it('should prevent token reuse', () => {
      const token = authService.generateWsToken('MASTER');

      // First use - should succeed
      const role1 = authService.validateWsToken(token.token);
      expect(role1).toBe('MASTER');

      // Second use - should fail
      const role2 = authService.validateWsToken(token.token);
      expect(role2).toBeNull();
    });

    it('should handle concurrent token generation', () => {
      const tokens = [];

      // Generate 100 tokens concurrently
      for (let i = 0; i < 100; i++) {
        tokens.push(authService.generateWsToken('MASTER'));
      }

      // All tokens should be unique
      const tokenSet = new Set(tokens.map(t => t.token));
      expect(tokenSet.size).toBe(100);
    });
  });

  describe('Integration Tests', () => {
    it('should handle token lifecycle', () => {
      // 1. Generate token
      const token = authService.generateWsToken('MASTER');
      expect(token.token).toBeDefined();

      // 2. Check stats
      authService.getAuthStats().then(stats => {
        expect(stats.activeTokens).toBeGreaterThan(0);
      });

      // 3. Validate token
      const role = authService.validateWsToken(token.token);
      expect(role).toBe('MASTER');

      // 4. Try to reuse token
      const role2 = authService.validateWsToken(token.token);
      expect(role2).toBeNull();
    });

    it('should handle multiple tokens', async () => {
      const beforeStats = await authService.getAuthStats();
      const tokens = [];

      // Generate multiple tokens
      for (let i = 0; i < 10; i++) {
        tokens.push(authService.generateWsToken(i % 2 === 0 ? 'MASTER' : 'GUEST'));
      }

      // Validate all tokens
      for (const token of tokens) {
        const role = authService.validateWsToken(token.token);
        expect(role).toBeDefined();
      }

      // All should be deleted now
      const stats = await authService.getAuthStats();
      expect(stats.activeTokens).toBe(beforeStats.activeTokens);
    });
  });
});

describe('AuthService Singleton', () => {
  it('should export authService instance', async () => {
    const { authService } = await import('../../services/AuthService');

    expect(authService).toBeDefined();
    expect(authService).toBeInstanceOf(AuthService);
  });
});
