export enum ServiceLifetime {
  TRANSIENT = 'transient',
  SINGLETON = 'singleton',
  SCOPED = 'scoped'
}

export interface ServiceDescriptor<T = unknown> {
  token: string;
  factory: (container: DIContainer, ...deps: unknown[]) => T;
  lifetime: ServiceLifetime;
  dependencies?: string[];
  instance?: T;
  initialized?: boolean;
}

export class CircularDependencyError extends Error {
  constructor(dependencyChain: string[]) {
    const chain = dependencyChain.join(' -> ');
    super(`Circular dependency detected: ${chain}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotRegisteredError extends Error {
  constructor(token: string) {
    super(`Service with token '${token}' is not registered`);
    this.name = 'ServiceNotRegisteredError';
  }
}

export class DIContainer {
  private services = new Map<string, ServiceDescriptor>();
  private resolving = new Set<string>();

  register<T>(
    token: string,
    factory: (container: DIContainer, ...deps: unknown[]) => T,
    options: { lifetime?: ServiceLifetime; dependencies?: string[] } = {}
  ): void {
    const descriptor: ServiceDescriptor<T> = {
      token,
      factory,
      lifetime: options.lifetime ?? ServiceLifetime.TRANSIENT,
      dependencies: options.dependencies,
      initialized: false
    };
    this.services.set(token, descriptor);
  }

  registerSingleton<T>(
    token: string,
    factory: (container: DIContainer, ...deps: unknown[]) => T,
    dependencies?: string[]
  ): void {
    this.register(token, factory, { lifetime: ServiceLifetime.SINGLETON, dependencies });
  }

  registerScoped<T>(
    token: string,
    factory: (container: DIContainer, ...deps: unknown[]) => T,
    dependencies?: string[]
  ): void {
    this.register(token, factory, { lifetime: ServiceLifetime.SCOPED, dependencies });
  }

  resolve<T = unknown>(token: string): T {
    if (this.resolving.has(token)) {
      const chain = Array.from(this.resolving);
      chain.push(token);
      throw new CircularDependencyError(chain);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new ServiceNotRegisteredError(token);
    }

    if (descriptor.lifetime === ServiceLifetime.SINGLETON && descriptor.instance) {
      return descriptor.instance as T;
    }

    this.resolving.add(token);

    try {
      const deps: unknown[] = [];
      if (descriptor.dependencies) {
        for (const dep of descriptor.dependencies) {
          deps.push(this.resolve(dep));
        }
      }

      const instance = descriptor.factory(this, ...deps);

      if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
        descriptor.instance = instance;
        descriptor.initialized = true;
      }

      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  getContainerStatus(): { totalServices: number; initializedSingletons: number } {
    let initializedCount = 0;
    for (const d of Array.from(this.services.values())) {
      if (d.initialized) initializedCount++;
    }
    return {
      totalServices: this.services.size,
      initializedSingletons: initializedCount
    };
  }
}

export function createDIContainer(): DIContainer {
  return new DIContainer();
}

export const diContainer = createDIContainer();
