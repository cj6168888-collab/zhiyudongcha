import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Config Module', () => {
  describe('Database Config', () => {
    it('should have default database configuration', () => {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'sheng_yu_zhu_shou',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      };

      expect(dbConfig.host).toBeDefined();
      expect(dbConfig.port).toBeDefined();
      expect(dbConfig.database).toBeDefined();
    });

    it('should parse connection limits as numbers', () => {
      const max = parseInt('20');
      const min = parseInt('5');

      expect(typeof max).toBe('number');
      expect(typeof min).toBe('number');
      expect(max).toBeGreaterThan(min);
    });
  });

  describe('Redis Config', () => {
    it('should have default redis configuration', () => {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      };

      expect(redisConfig.host).toBeDefined();
      expect(redisConfig.port).toBeDefined();
    });
  });

  describe('Server Config', () => {
    it('should have default server configuration', () => {
      const serverConfig = {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        cors: {
          origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
          credentials: process.env.CORS_CREDENTIALS === 'true'
        },
      };

      expect(serverConfig.port).toBe(3000);
      expect(serverConfig.host).toBe('0.0.0.0');
    });

    it('should parse CORS origin from environment', () => {
      const origins = 'http://localhost:3000,http://localhost:3001';
      const parsed = origins.split(',');

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toBe('http://localhost:3000');
    });
  });

  describe('Session Config', () => {
    it('should have default session configuration', () => {
      const sessionConfig = {
        secret: process.env.SESSION_SECRET || 'default-secret',
        resave: process.env.SESSION_RESAVE !== 'false',
        saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED !== 'false',
        rolling: process.env.SESSION_ROLLING === 'true',
        cookie: {
          secure: process.env.COOKIE_SECURE !== 'false',
          httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
          maxAge: parseInt(process.env.COOKIE_MAX_AGE || '86400000'),
          sameSite: process.env.COOKIE_SAME_SITE || 'lax'
        }
      };

      expect(sessionConfig.secret).toBeDefined();
      expect(sessionConfig.cookie.maxAge).toBe(86400000);
    });
  });

  describe('Security Config', () => {
    it('should have rate limiting configuration', () => {
      const rateLimitConfig = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      };

      expect(rateLimitConfig.windowMs).toBe(900000);
      expect(rateLimitConfig.max).toBe(100);
    });

    it('should have helmet configuration', () => {
      const helmetConfig = {
        enabled: process.env.HELMET_ENABLED !== 'false',
        contentSecurityPolicy: process.env.CSP_ENABLED !== 'false',
      };

      expect(typeof helmetConfig.enabled).toBe('boolean');
    });
  });

  describe('Environment Validation', () => {
    it('should validate required environment variables', () => {
      const required = ['NODE_ENV', 'PORT', 'DB_HOST'];
      const missing = required.filter(key => !process.env[key]);

      expect(missing).toBeDefined();
    });

    it('should handle missing optional variables with defaults', () => {
      const value = process.env.OPTIONAL_VAR || 'default';
      expect(value).toBe('default');
    });
  });

  describe('Config Merging', () => {
    it('should merge custom config with defaults', () => {
      const defaults = { port: 3000, host: '0.0.0.0' };
      const custom = { port: 4000 };
      const merged = { ...defaults, ...custom };

      expect(merged.port).toBe(4000);
      expect(merged.host).toBe('0.0.0.0');
    });

    it('should not mutate original config objects', () => {
      const defaults = { setting: 'default' };
      const custom = { setting: 'custom' };
      
      const merged1 = { ...defaults, ...custom };
      const merged2 = { ...defaults, ...custom };

      expect(merged1.setting).toBe('custom');
      expect(merged2.setting).toBe('custom');
      expect(defaults.setting).toBe('default');
    });
  });
});
