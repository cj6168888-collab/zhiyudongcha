/**
 * 服务注册表
 * 统一管理所有服务，提供服务发现和生命周期管理
 */

export interface ServiceMetadata {
  name: string;
  version: string;
  status: 'starting' | 'ready' | 'stopping' | 'stopped';
  dependencies: string[];
  startTime?: number;
}

export interface ServiceRegistry {
  register(name: string, service: unknown, metadata?: Partial<ServiceMetadata>): void;
  get<T>(name: string): T | null;
  has(name: string): boolean;
  list(): ServiceMetadata[];
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
}

import { createServiceLogger } from './logger';
const log = createServiceLogger('ServiceRegistry');

class ServiceRegistryImpl implements ServiceRegistry {
  private services: Map<string, { instance: unknown; metadata: ServiceMetadata }> = new Map();

  register(name: string, service: unknown, metadata: Partial<ServiceMetadata> = {}): void {
    const fullMetadata: ServiceMetadata = {
      name,
      version: '1.0.0',
      status: 'starting',
      dependencies: [],
      ...metadata
    };

    this.services.set(name, { instance: service, metadata: fullMetadata });
    log.info(`服务已注册: ${name} v${fullMetadata.version}`);
  }

  get<T>(name: string): T | null {
    const service = this.services.get(name);
    return service ? (service.instance as T) : null;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  list(): ServiceMetadata[] {
    return Array.from(this.services.values()).map(s => s.metadata);
  }

  async startAll(): Promise<void> {
    log.info(`启动所有服务: ${this.services.size} 个`);

    for (const [name, service] of this.services.entries()) {
      try {
        service.metadata.status = 'ready';
        service.metadata.startTime = Date.now();
        log.info(`服务已启动: ${name}`);
      } catch (error) {
        console.error(`[ServiceRegistry] 服务启动失败: ${name}`, error);
      }
    }
  }

  async stopAll(): Promise<void> {
    log.info(`停止所有服务: ${this.services.size} 个`);

    for (const [name, service] of this.services.entries()) {
      try {
        service.metadata.status = 'stopped';
        log.info(`服务已停止: ${name}`);
      } catch (error) {
        console.error(`[ServiceRegistry] 服务停止失败: ${name}`, error);
      }
    }
  }

  getStatus(): { healthy: number; total: number } {
    const ready = Array.from(this.services.values())
      .filter(s => s.metadata.status === 'ready').length;
    return { healthy: ready, total: this.services.size };
  }
}

export const serviceRegistry = new ServiceRegistryImpl();
export default serviceRegistry;
