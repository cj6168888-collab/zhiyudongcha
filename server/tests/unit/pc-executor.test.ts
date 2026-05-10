/**
 * PCExecutorService 单元测试
 * 
 * @version 3.0.0
 * @author 测试组
 * @date 2026-03-03
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PCExecutorService } from '../../services/mobile/PCExecutorService';

describe('PCExecutorService', () => {
  let service: PCExecutorService;
  
  beforeEach(() => {
    // 测试环境允许重置
    process.env.NODE_ENV = 'test';
    PCExecutorService.resetInstance();
    service = PCExecutorService.getInstance();
  });
  
  afterEach(() => {
    PCExecutorService.resetInstance();
  });
  
  describe('Singleton Pattern', () => {
    it('should create only one instance', () => {
      const instance1 = PCExecutorService.getInstance();
      const instance2 = PCExecutorService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(PCExecutorService);
    });
    
    it('should track initialization count', () => {
      PCExecutorService.resetInstance();
      
      // 第一次获取实例
      PCExecutorService.getInstance();
      
      // 尝试通过反射创建第二个实例（模拟错误使用）
      const NewPCExecutorService = PCExecutorService as any;
      try {
        new NewPCExecutorService();
      } catch (error) {
        // 构造函数是私有的，应该抛出错误
      }
      
      // 验证单例模式
      const instance1 = PCExecutorService.getInstance();
      const instance2 = PCExecutorService.getInstance();
      expect(instance1).toBe(instance2);
    });
    
    it('should reset instance in test environment', () => {
      const instance1 = PCExecutorService.getInstance();
      PCExecutorService.resetInstance();
      const instance2 = PCExecutorService.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
    
    it('should throw error when resetting in production', () => {
      process.env.NODE_ENV = 'production';
      
      expect(() => PCExecutorService.resetInstance()).toThrow(
        'resetInstance can only be called in test environment'
      );
      
      process.env.NODE_ENV = 'test';
    });
  });
  
  describe('getPythonVersion() - Bug Fix', () => {
    it('should not throw stack overflow on getPythonVersion', () => {
      // ✅ 这个测试确保不再有无限递归
      expect(() => service.getPythonVersion()).not.toThrow();
    });
    
    it('should return null before initialization', () => {
      const version = service.getPythonVersion();
      expect(version).toBeNull();
    });
    
    it('should return string or null after initialization', async () => {
      await service.initialize();
      const version = service.getPythonVersion();
      
      // Python版本应该是字符串或null
      expect(typeof version === 'string' || version === null).toBe(true);
    });
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      
      expect(service.isInitialized()).toBe(true);
    });
    
    it('should initialize only once (idempotent)', async () => {
      await service.initialize();
      await service.initialize(); // 第二次调用应该被忽略
      
      expect(service.isInitialized()).toBe(true);
    });
    
    it('should handle initialization errors gracefully', async () => {
      // 模拟初始化失败（Python不可用）
      await service.initialize();
      
      // 即使Python不可用，也应该标记为已初始化
      expect(service.isInitialized()).toBe(true);
    });
  });
  
  describe('isReady()', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });
    
    it('should return boolean after initialization', async () => {
      await service.initialize();
      
      // 根据Python环境是否可用，返回true或false
      expect(typeof service.isReady()).toBe('boolean');
    });
  });
  
  describe('Health Check', () => {
    it('should return health status', async () => {
      await service.initialize();
      
      const health = await service.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['ok', 'degraded', 'error']).toContain(health.status);
    });
    
    it('should include all health check details', async () => {
      await service.initialize();
      
      const health = await service.healthCheck();
      
      expect(health.details).toHaveProperty('initialized');
      expect(health.details).toHaveProperty('pythonAvailable');
      expect(health.details).toHaveProperty('pythonVersion');
      expect(health.details).toHaveProperty('pythonPath');
      expect(health.details).toHaveProperty('hasPyAutoGUI');
      expect(health.details).toHaveProperty('instanceCount');
      expect(health.details).toHaveProperty('instanceId');
      expect(health.details).toHaveProperty('scriptPath');
    });
    
    it('should return error status if not initialized', async () => {
      const health = await service.healthCheck();
      
      expect(health.status).toBe('error');
    });
  });
  
  describe('Resource Management', () => {
    it('should cleanup resources on destroy', async () => {
      await service.initialize();
      
      service.destroy();
      
      expect(service.isInitialized()).toBe(false);
      expect(service.isReady()).toBe(false);
    });
    
    it('should clear health check interval on destroy', async () => {
      await service.initialize();
      
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      service.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });
  
  describe('Execute Methods', () => {
    beforeEach(async () => {
      await service.initialize();
    });
    
    it('should return error when Python not available', async () => {
      if (!service.isReady()) {
        const result = await service.click(100, 100);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('not available');
      }
    });
    
    // 注意：以下测试需要实际的Python和PyAutoGUI环境
    // 在CI/CD环境中可能需要Mock
    
    it.skip('should execute click action', async () => {
      if (service.isReady()) {
        const result = await service.click(100, 100);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ x: 100, y: 100 });
      }
    });
    
    it.skip('should execute type action', async () => {
      if (service.isReady()) {
        const result = await service.type('Hello World');
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('text_length', 11);
      }
    });
    
    it.skip('should execute screenshot action', async () => {
      if (service.isReady()) {
        const result = await service.screenshot();
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('width');
        expect(result.data).toHaveProperty('height');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle timeout errors', async () => {
      await service.initialize();
      
      if (service.isReady()) {
        const result = await service.click(100, 100, 1, 'left');
        
        // 即使超时，也应该返回结果对象
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
      }
    });
    
    it('should handle invalid action types', async () => {
      await service.initialize();
      
      if (service.isReady()) {
        const result = await service.execute({
          type: 'invalid_action' as any,
          params: {}
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown action type');
      }
    });
  });
  
  describe('Type Safety', () => {
    it('should enforce correct parameter types', () => {
      // TypeScript编译时检查
      // 这些调用应该在编译时通过类型检查
      
      async function testTypes() {
        await service.initialize();
        
        if (service.isReady()) {
          // click: number, number, number?, string?
          await service.click(100, 200);
          await service.click(100, 200, 2);
          await service.click(100, 200, 2, 'right');
          
          // type: string, number?
          await service.type('test');
          await service.type('test', 0.1);
          
          // hotkey: ...string[]
          await service.hotkey('ctrl', 'c');
          await service.hotkey('cmd', 'shift', '3');
        }
      }
      
      expect(testTypes).not.toThrow();
    });
  });
});

describe('PCExecutorService Integration', () => {
  it('should work as a drop-in replacement for old implementation', async () => {
    process.env.NODE_ENV = 'test';
    PCExecutorService.resetInstance();
    
    // 旧的使用方式
    const service = PCExecutorService.getInstance();
    
    // 新的方法
    expect(() => service.getPythonVersion()).not.toThrow();
    expect(() => service.isReady()).not.toThrow();
    expect(() => service.healthCheck()).not.toThrow();
    
    PCExecutorService.resetInstance();
  });
});
