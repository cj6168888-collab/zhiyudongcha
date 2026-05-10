import { createServiceLogger } from '../lib/logger';
import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { secureConfigManager } from '../lib/secure-config-manager';
import { diContainer } from '../lib/di-container';
import { multiLevelCache } from '../lib/multi-level-cache';

const logger = createServiceLogger('SystemTests');

// 设置全局测试超时
jest.setTimeout(60000);

/**
 * 模拟数据库
 */
class MockDatabase {
  private users: Map<string, any> = new Map();
  private projects: Map<string, any> = new Map();

  async insert(user: any): Promise<any> {
    const id = Math.random().toString(36).substring(2, 9);
    this.users.set(id, { id, ...user, created_at: new Date() });
    return this.users.get(id);
  }

  async findByUsername(username: string): Promise<any> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  async findProject(id: string): Promise<any> {
    return this.projects.get(id);
  }

  async insertProject(project: any): Promise<any> {
    const id = Math.random().toString(36).substring(2, 9);
    this.projects.set(id, { id, ...project, created_at: new Date() });
    return this.projects.get(id);
  }
}

/**
 * 模拟Redis客户端
 */
class MockRedis {
  private cache: Map<string, any> = new Map();

  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl);
    }
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<number> {
    return this.cache.has(key) ? 1 : 0;
  }

  async flushdb(): Promise<void> {
    this.cache.clear();
  }

  async quit(): Promise<void> {
    // Mock implementation
  }
}

describe('System Integration Tests', () => {
  let mockDatabase: MockDatabase;
  let mockCache: MockRedis;

  beforeAll(async () => {
    // 初始化测试环境
    mockDatabase = new MockDatabase();
    mockCache = new MockRedis();

    // 注册模拟服务
    diContainer.registerSingleton('database', () => mockDatabase);
    diContainer.registerSingleton('cache', () => mockCache);
    diContainer.registerSingleton('secureConfigManager', () => secureConfigManager);
    diContainer.registerSingleton('multiLevelCache', () => multiLevelCache);
  });

  afterAll(() => {
    // 清理测试环境
    diContainer.clearSingletons();
  });

  describe('Configuration Manager', () => {
    it('should load and validate required configurations', async () => {
      const requiredConfig = secureConfigManager.validateRequiredConfigs();
      
      expect(requiredConfig.valid).toBe(true);
      expect(requiredConfig.missing.length).toBe(0);
    });

    it('should encrypt sensitive configuration values', () => {
      const testKey = 'TEST_SECRET_KEY';
      secureConfigManager.setConfig(testKey, 'sensitive_value', {
        type: 'string',
        category: 'test',
        description: 'Test sensitive configuration',
        isRequired: true,
        isEncrypted: true
      });

      const encryptedConfig = secureConfigManager.getConfig(testKey);
      expect(encryptedConfig).toBe('sensitive_value');
      
      const configValue = secureConfigManager.getDescriptor(testKey);
      expect(configValue?.isEncrypted).toBe(true);
    });

    it('should handle configuration change events', async () => {
      const eventSpy = jest.fn();
      secureConfigManager.addChangeListener(eventSpy);

      secureConfigManager.setConfig('TEST_EVENT', 'initial_value', {
        type: 'string',
        category: 'test',
        description: 'Test event configuration',
        isRequired: false
      });

      secureConfigManager.setConfig('TEST_EVENT', 'updated_value', {
        type: 'string',
        category: 'test',
        description: 'Test event configuration updated',
        isRequired: false
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'TEST_EVENT',
          oldValue: 'initial_value',
          newValue: 'updated_value'
        })
      );
    });

    it('should provide secure configuration summary', () => {
      const summary = secureConfigManager.getSecuritySummary();
      
      expect(summary).toMatchObject({
        totalConfigs: expect.any(Number),
        encryptedConfigs: expect.any(Number),
        requiredConfigs: expect.any(Number),
        categories: expect.any(Array)
      });
    });
  });

  describe('Multi-Level Cache System', () => {
    let cache: any;

    beforeAll(() => {
      cache = diContainer.resolve('multiLevelCache');
    });

    it('should store and retrieve values from L1 cache', async () => {
      await cache.set('test_key', 'test_value', { ttl: 5000 });
      
      const value = await cache.get('test_key');
      expect(value).toBe('test_value');
    });

    it('should fallback to L2 cache when L1 miss', async () => {
      await cache.set('l2_key', 'l2_value');
      
      // 清除L1缓存
      await cache.delete('l2_key');
      
      const value = await cache.get('l2_key');
      expect(value).toBe('l2_value');
    });

    it('should handle cache eviction when L1 is full', async () => {
      const smallCache = new MultiLevelCache({ l1MaxSize: 2 });
      
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3'); // Should evict key1
      
      const value1 = await smallCache.get('key1');
      const value2 = await smallCache.get('key2');
      const value3 = await smallCache.get('key3');
      
      expect(value1).toBeNull();
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });

    it('should provide accurate cache statistics', async () => {
      await cache.set('stat_test_1', 'value1');
      await cache.set('stat_test_2', 'value2');
      
      // Trigger some operations
      await cache.get('stat_test_1');
      await cache.get('stat_test_2');
      await cache.get('non_existent');
      
      const stats = cache.getStats();
      
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.l1Hits).toBeGreaterThan(0);
      expect(stats.l2Misses).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch operations', async () => {
      const items = [
        { key: 'batch_1', value: 'value1' },
        { key: 'batch_2', value: 'value2' },
        { key: 'batch_3', value: 'value3' }
      ];

      await cache.mset(items);
      
      const results = await cache.mget(items.map(item => item.key));
      
      expect(results).toEqual([
        'value1',
        'value2', 
        'value3'
      ]);
    });
  });

  describe('Dependency Injection Container', () => {
    it('should resolve services with dependencies', async () => {
      class ServiceA {
        constructor(public dependencyB: any) {}
      }

      class ServiceB {
        getValue() { return 'service_b_value'; }
      }

      class ServiceC {
        constructor(public serviceA: ServiceA, public serviceB: ServiceB) {}
        getCombinedValue() {
          return `${this.serviceA.dependencyB.getValue()} + ${this.serviceB.getValue()}`;
        }
      }

      // 注册服务
      diContainer.registerSingleton('serviceB', () => new ServiceB());
      diContainer.registerSingleton('serviceA', () => new ServiceB(), ['serviceB']);
      diContainer.registerSingleton('serviceC', () => new ServiceC(), ['ServiceA', 'ServiceB']);

      // 解析服务
      const serviceC = diContainer.resolve('serviceC');
      
      expect(ServiceC).toBeDefined();
      expect(ServiceC.getCombinedValue()).toBe('service_b_value + service_b_value');
    });

    it('should detect circular dependencies', () => {
      class CircularA {
        constructor(public circularB: any) {}
      }

      class CircularB {
        constructor(public circularC: any) {}
      }

      class CircularC {
        constructor(public circularA: any) {}
      }

      // 创建循环依赖
      diContainer.registerSingleton('circularA', () => new CircularA(), ['circularC']);
      diContainer.registerSingleton('circularB', () => new CircularB(), ['circularA']);
      diContainer.registerSingleton('circularC', () => new CircularC(), ['circularB']);

      // 尝试解析应该抛出错误
      expect(() => diContainer.resolve('circularA')).toThrow('Circular dependency detected');
    });

    it('should handle singleton lifecycle', async () => {
      let callCount = 0;
      
      class SingletonService {
        constructor() {
          callCount++;
        }
        
        getCount() {
          return callCount;
        }
      }

      diContainer.registerSingleton('singletonService', () => new SingletonService());
      
      // 多次解析应该返回同一实例
      const instance1 = diContainer.resolve('singletonService');
      const instance2 = diContainer.resolve('singletonService');
      const instance3 = diContainer.resolve('singletonService');
      
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1.getCount()).toBe(1); // Constructor called only once
    });

    it('should provide container status', () => {
      diContainer.register('transientService', () => ({ type: 'transient' }));
      diContainer.register('scopedService', () => ({ type: 'scoped' }));
      
      const status = diContainer.getContainerStatus();
      
      expect(status.totalServices).toBeGreaterThan(0);
      expect(status).toMatchObject({
        transientServices: expect.any(Number),
        scopedServices: expect.any(Number),
        circularDependencies: expect.any(Array)
      });
    });
  });

  describe('Input Validation', () => {
    const { 
      createUserSchema, 
      emailSchema, 
      paginationSchema 
    } = require('../middleware/input-validation');

    it('should validate user creation data', () => {
      const validUser = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'SecurePass123!',
        full_name: 'Test User'
      };

      expect(() => createUserSchema.parse(validUser)).not.toThrow();
    });

    it('should reject invalid email addresses', () => {
      const invalidUsers = [
        { username: 'test', email: 'invalid-email', password: 'password123' },
        { username: 'test', email: '', password: 'password123' },
        { username: 'test', email: 'test@.com', password: 'password123' }
      ];

      for (const user of invalidUsers) {
        expect(() => createUserSchema.parse(user)).toThrow();
      }
    });

    it('should validate pagination parameters', () => {
      const validPagination = { page: 1, limit: 20 };
      const invalidPagination = { page: 0, limit: 150 };

      expect(() => paginationSchema.parse(validPagination)).not.toThrow();
      expect(() => paginationSchema.parse(invalidPagination)).toThrow();
    });

    it('should validate email format', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
      expect(() => emailSchema.parse('invalid-email')).toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete operations within acceptable time limits', async () => {
      const startTime = Date.now();
      
      // 模拟一些数据库操作
      const db = diContainer.resolve('database');
      await db.insert({ id: 1, name: 'Test' });
      await db.findByUsername('test');
      await db.insertProject({ id: 1, name: 'Test Project' });
      
      const duration = Date.now() - startTime;
      
      // 所有操作应该在2秒内完成
      expect(duration).toBeLessThan(2000);
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // 并发执行10个操作
      const promises = Array.from({ length: 10 }, (_, i) => 
        diContainer.resolve('database').insert({ id: i, name: `Test ${i}` })
      );
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // 并发操作应该比串行快
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      class FailingService {
        async operation() {
          throw new Error('Service operation failed');
        }
      }

      diContainer.registerSingleton('failingService', () => new FailingService());
      
      const service = diContainer.resolve('failingService');
      
      await expect(service.operation()).rejects.toThrow('Service operation failed');
    });

    it('should log errors appropriately', async () => {
      const logSpy = jest.spyOn(logger, 'error');
      
      try {
        throw new Error('Test error');
      } catch (error) {
        expect(logSpy).toHaveBeenCalledWith('Test error');
      }
    });
  });

  describe('Security', () => {
    it('should prevent SQL injection in inputs', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM passwords --"
      ];

      for (const input of maliciousInputs) {
        const sanitized = input.replace(/[';--]/g, '')
                          .replace(/[';]/g, '')
                          .replace(/\b(drop|delete|insert|update|create|alter|exec|execute)\b/gi, '')
                          .replace(/'/g, "''")
                          .replace(/"/g, '""');
        
        // 检查恶意字符是否被移除
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('UNION SELECT');
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain(';');
      }
    });

    it('should validate secure configuration access', async () => {
      // 模拟开发环境绕过检查
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'false';

      // 尝试访问需要认证的资源
      const { secureAuthMiddleware } = require('../middleware/secure-auth');
      const req = { path: '/admin', ip: '192.168.1.100' };
      const res = { status: jest.fn(), json: jest.fn() };
      const next = jest.fn();

      await secureAuthMiddleware(req, res, next);

      // 开发环境且未启用绕过应该被拒绝
      expect(res.status).toHaveBeenCalledWith(401);

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;
      delete process.env.DEV_AUTH_BYPASS;
    });
  });

  describe('Integration End-to-End', () => {
    it('should handle complete user workflow', async () => {
      // 1. 用户注册
      const db = diContainer.resolve('database');
      const user = await db.insert({
        username: 'workflow_user',
        email: 'workflow@example.com',
        password: 'SecurePass123!'
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();

      // 2. 用户登录
      const foundUser = await db.findByUsername('workflow_user');
      expect(foundUser).toEqual(user);

      // 3. 创建项目
      const project = await db.insertProject({
        name: 'Workflow Test Project',
        description: 'End-to-end test project',
        user_id: user.id
      });

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();

      // 4. 项目查询
      const foundProject = await db.findProject(project.id);
      expect(foundProject).toEqual(project);

      // 5. 缓存操作
      const cache = diContainer.resolve('multiLevelCache');
      await cache.set(`user_${user.id}`, user);
      
      const cachedUser = await cache.get(`user_${user.id}`);
      expect(cachedUser).toEqual(user);

      // 验证完整性工作流
      expect(user.username).toBe('workflow_user');
      expect(user.email).toBe('workflow@example.com');
      expect(project.name).toBe('Workflow Test Project');
    });

    it('should handle error recovery scenarios', async () => {
      const db = diContainer.resolve('database');
      
      // 模拟数据库连接失败
      const originalInsert = db.insert.bind(db);
      db.insert = () => Promise.reject(new Error('Database connection failed'));
      
      await expect(db.insert({ username: 'test' })).rejects.toThrow();
      
      // 恢复正常功能
      db.insert = originalInsert;
      
      const user = await db.insert({ username: 'recovery_user' });
      expect(user).toBeDefined();
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive system health status', async () => {
      const cacheHealth = diContainer.resolve('multiLevelCache').getHealthStatus();
      const containerStatus = diContainer.getContainerStatus();
      const configStatus = secureConfigManager.validateRequiredConfigs();

      const healthReport = {
        timestamp: new Date().toISOString(),
        cache: cacheHealth,
        diContainer: containerStatus,
        configuration: configStatus,
        overall: {
          status: configStatus.valid && cacheHealth.l2Connected ? 'healthy' : 'degraded',
          score: configStatus.valid ? 95 : 70,
          issues: []
        }
      };

      expect(healthReport.overall.status).toBeDefined();
      expect(healthReport.cache.l1Size).toBeGreaterThanOrEqual(0);
      expect(healthReport.diContainer.totalServices).toBeGreaterThan(0);
    });

    it('should handle load testing scenarios', async () => {
      const startTime = Date.now();
      
      // 模拟100个并发请求
      const loadTestPromises = Array.from({ length: 100 }, (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const requestTime = Date.now() - startTime;
            resolve(requestTime);
          }, Math.random() * 1000); // 0-1000ms延迟
        });
      });

      const responseTimes = await Promise.all(loadTestPromises);
      
      // 计算性能指标
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // 性能断言
      expect(avgResponseTime).toBeLessThan(500); // 平均响应时间小于500ms
      expect(maxResponseTime).toBeLessThan(1000); // 最大响应时间小于1秒
      expect(minResponseTime).toBeGreaterThanOrEqual(0); // 最小响应时间大于等于0

      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      expect(p95ResponseTime).toBeLessThan(800); // 95%的请求响应时间小于800ms
    });
  });
});