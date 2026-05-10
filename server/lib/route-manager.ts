/**
 * 路由管理器
 * 统一管理所有路由注册和分组
 */

import { Express, Router } from 'express';

export interface RouteMetadata {
  path: string;
  method: string;
  handler: string;
  middleware?: string[];
}

export interface RouteGroup {
  name: string;
  prefix: string;
  routes: RouteMetadata[];
}

class RouteManager {
  private groups: Map<string, RouteGroup> = new Map();
  private router: Router;

  constructor() {
    this.router = Router();
    this.initializeDefaultGroups();
  }

  private initializeDefaultGroups(): void {
    const defaultGroups = [
      { name: 'auth', prefix: '/api/auth' },
      { name: 'chat', prefix: '/api/chat' },
      { name: 'memory', prefix: '/api/memory' },
      { name: 'voice', prefix: '/api/voice' },
      { name: 'vision', prefix: '/api/vision' },
      { name: 'knowledge', prefix: '/api/knowledge' },
      { name: 'device', prefix: '/api/device' },
      { name: 'security', prefix: '/api/security' },
      { name: 'monitor', prefix: '/api/monitor' },
      { name: 'system', prefix: '/api/system' },
    ];

    defaultGroups.forEach(group => {
      this.groups.set(group.name, {
        name: group.name,
        prefix: group.prefix,
        routes: []
      });
    });
  }

  register(groupName: string, metadata: RouteMetadata): void {
    const group = this.groups.get(groupName);
    if (group) {
      group.routes.push(metadata);
    }
  }

  getGroup(name: string): RouteGroup | undefined {
    return this.groups.get(name);
  }

  getAllGroups(): RouteGroup[] {
    return Array.from(this.groups.values());
  }

  getRouter(): Router {
    return this.router;
  }

  listRoutes(): RouteMetadata[] {
    const allRoutes: RouteMetadata[] = [];
    for (const group of this.groups.values()) {
      allRoutes.push(...group.routes);
    }
    return allRoutes;
  }

  getStatistics(): { groups: number; totalRoutes: number } {
    let totalRoutes = 0;
    for (const group of this.groups.values()) {
      totalRoutes += group.routes.length;
    }
    return {
      groups: this.groups.size,
      totalRoutes
    };
  }
}

export const routeManager = new RouteManager();
export default routeManager;
