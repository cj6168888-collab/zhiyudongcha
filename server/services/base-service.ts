import { Injectable, Inject, DIContainer, diContainer } from '../lib/di-container';
import { createServiceLogger } from '../lib/logger';
import { ServiceTokens } from '../lib/di-container';

// 基础服务接口
export interface BaseService {
  initialize?(): Promise<void>;
  dispose?(): void;
  health?(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

// 服务健康检查结果
export interface ServiceHealthResult {
  healthy: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

// 服务容器接口
export interface ServiceContainer {
  resolve<T>(token: string): T;
  register<T>(token: string, instance: T): void;
}

// 服务基类
export abstract class AbstractService implements BaseService {
  protected readonly logger = createServiceLogger(this.constructor.name);
  protected initialized = false;
  protected disposed = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('服务已初始化');
      return;
    }

    this.logger.info('初始化服务');
    await this.onInitialize();
    this.initialized = true;
    this.logger.info('服务初始化完成');
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.logger.info('清理服务');
    await this.onDispose();
    this.disposed = true;
    this.initialized = false;
    this.logger.info('服务清理完成');
  }

  async health(): Promise<ServiceHealthResult> {
    return {
      healthy: this.initialized && !this.disposed,
      message: this.initialized ? '服务正常' : '服务未初始化',
    };
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
}

// 服务生命周期管理器
@Injectable()
export class ServiceLifecycleManager {
  private services: Map<string, BaseService> = new Map();
  private logger = createServiceLogger('ServiceLifecycleManager');

  constructor(
    @Inject(ServiceTokens.CONTAINER) private container: ServiceContainer
  ) {}

  // 注册服务
  registerService(token: string, service: BaseService): void {
    this.services.set(token, service);
    this.logger.debug('注册服务', { token });
  }

  // 初始化所有服务
  async initializeAll(): Promise<void> {
    this.logger.info('初始化所有服务');
    
    const initPromises: Promise<void>[] = [];
    
    for (const [token, service] of this.services.entries()) {
      initPromises.push(
        service.initialize()
          .then(() => {
            this.logger.debug('服务初始化成功', { token });
          })
          .catch((error) => {
            this.logger.error('服务初始化失败', { token, error });
            throw error;
          })
      );
    }
    
    await Promise.all(initPromises);
    this.logger.info('所有服务初始化完成');
  }

  // 清理所有服务
  async disposeAll(): Promise<void> {
    this.logger.info('清理所有服务');
    
    const disposePromises: Promise<void>[] = [];
    
    for (const [token, service] of this.services.entries()) {
      disposePromises.push(
        service.dispose()
          .then(() => {
            this.logger.debug('服务清理成功', { token });
          })
          .catch((error) => {
            this.logger.error('服务清理失败', { token, error });
          })
      );
    }
    
    await Promise.all(disposePromises);
    this.services.clear();
    this.logger.info('所有服务清理完成');
  }

  // 获取服务健康状态
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'degraded';
    services: Record<string, ServiceHealthResult>;
  }> {
    const healthChecks: Promise<{ token: string; result: ServiceHealthResult }>[] = [];
    
    for (const [token, service] of this.services.entries()) {
      healthChecks.push(
        service.health()
          .then(result => ({ token, result }))
          .catch(error => ({ 
            token, 
            result: { 
              healthy: false, 
              message: error.message 
            } 
          }))
      );
    }
    
    const results = await Promise.all(healthChecks);
    const services: Record<string, ServiceHealthResult> = {};
    let healthyCount = 0;
    let totalCount = results.length;
    
    for (const { token, result } of results) {
      services[token] = result;
      if (result.healthy) healthyCount++;
    }
    
    let overall: 'healthy' | 'unhealthy' | 'degraded';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount === 0) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }
    
    return { overall, services };
  }

  // 重启服务
  async restartService(token: string): Promise<void> {
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`服务未找到: ${token}`);
    }
    
    this.logger.info('重启服务', { token });
    await service.dispose();
    await service.initialize();
    this.logger.info('服务重启完成', { token });
  }

  // 获取服务统计信息
  getStats(): {
    total: number;
    initialized: number;
    disposed: number;
    services: Array<{ token: string; initialized: boolean; disposed: boolean }>;
  } {
    const services = Array.from(this.services.entries()).map(([token, service]) => ({
      token,
      initialized: service['initialized'] || false,
      disposed: service['disposed'] || false,
    }));
    
    const initialized = services.filter(s => s.initialized).length;
    const disposed = services.filter(s => s.disposed).length;
    
    return {
      total: services.length,
      initialized,
      disposed,
      services,
    };
  }
}

// 服务代理
export class ServiceProxy<T extends BaseService> implements BaseService {
  private service: T | null = null;
  private token: string;
  private container: DIContainer;
  private logger = createServiceLogger('ServiceProxy');

  constructor(token: string, container: DIContainer) {
    this.token = token;
    this.container = container;
  }

  private getService(): T {
    if (!this.service) {
      this.service = this.container.resolve(this.token);
    }
    return this.service;
  }

  async initialize(): Promise<void> {
    await this.getService().initialize();
  }

  async dispose(): Promise<void> {
    if (this.service) {
      await this.service.dispose();
      this.service = null;
    }
  }

  async health(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    try {
      return await this.getService().health();
    } catch (error) {
      this.logger.error('健康检查失败', { token: this.token, error });
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 代理方法调用
  async callMethod<K extends keyof T>(
    methodName: K,
    ...args: Parameters<T[K]>
  ): Promise<ReturnType<T[K]>> {
    const service = this.getService();
    const method = service[methodName] as Function;
    
    if (typeof method !== 'function') {
      throw new Error(`方法不存在: ${String(methodName)}`);
    }
    
    return method.apply(service, args);
  }
}

// 服务装饰器工厂
export function createServiceDecorator(
  token: string,
  options: {
    singleton?: boolean;
    lazy?: boolean;
    dependencies?: string[];
  } = {}
) {
  return function <T extends new (...args: unknown[]) => BaseService>(constructor: T) {
    const serviceToken = token || constructor.name;
    
    // 注册到容器
    diContainer.register(serviceToken, () => {
      return new constructor();
    }, {
      singleton: options.singleton !== false, // 默认为单例
      dependencies: options.dependencies || [],
    });
    
    // 添加服务元数据
    interface ServiceMetadata {
      token: string;
      singleton: boolean;
      lazy: boolean;
      dependencies: string[];
    }
    
    (constructor as unknown as { __service__: ServiceMetadata }).__service__ = {
      token: serviceToken,
      singleton: options.singleton !== false,
      lazy: options.lazy || false,
      dependencies: options.dependencies || [],
    };
    
    return constructor;
  };
}

// 服务管理器
export class ServiceManager {
  private static instance: ServiceManager;
  private container: DIContainer;
  private lifecycleManager: ServiceLifecycleManager;

  private constructor() {
    this.container = diContainer;
    this.lifecycleManager = new ServiceLifecycleManager(this.container);
  }

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  // 注册服务
  registerService<T extends BaseService>(
    token: string,
    serviceClass: new (...args: unknown[]) => T,
    options: {
      singleton?: boolean;
      dependencies?: string[];
    } = {}
  ): void {
    this.container.register(token, () => new serviceClass(), options);
    
    // 如果已实例化，注册到生命周期管理器
    try {
      const service = this.container.resolve(token);
      this.lifecycleManager.registerService(token, service);
    } catch (error) {
      // 服务尚未实例化，等待初始化时再注册
    }
  }

  // 获取服务
  getService<T>(token: string): T {
    return this.container.resolve(token);
  }

  // 创建服务代理
  createProxy<T extends BaseService>(token: string): ServiceProxy<T> {
    return new ServiceProxy<T>(token, this.container);
  }

  // 初始化所有服务
  async initializeAll(): Promise<void> {
    await this.lifecycleManager.initializeAll();
  }

  // 清理所有服务
  async disposeAll(): Promise<void> {
    await this.lifecycleManager.disposeAll();
  }

  // 获取健康状态
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'degraded';
    services: Record<string, ServiceHealthResult>;
  }> {
    return this.lifecycleManager.getHealthStatus();
  }

  // 获取服务统计
  getStats(): {
    total: number;
    initialized: number;
    disposed: number;
    services: Array<{ token: string; initialized: boolean; disposed: boolean }>;
  } {
    return this.lifecycleManager.getStats();
  }
}

// 导出全局服务管理器实例
export const serviceManager = ServiceManager.getInstance();