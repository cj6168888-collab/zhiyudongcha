import type { Express, Router } from 'express';
import type { Server } from 'http';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('RouteRegistry');

export interface RouteModule {
  name: string;
  prefix: string;
  register: (app: Express, context: RouteContext) => void | Promise<void>;
}

export interface RouteContext {
  httpServer: Server;
  connectedUsers: Map<unknown, { deviceId?: string }>;
  storage: import('../storage').IStorage;
}

const registeredModules: RouteModule[] = [];

export function registerRouteModule(module: RouteModule): void {
  registeredModules.push(module);
  logger.debug({ module: module.name, prefix: module.prefix }, 'Route module registered');
}

export async function initializeAllRoutes(app: Express, context: RouteContext): Promise<void> {
  logger.info({ count: registeredModules.length }, 'Initializing route modules');
  
  for (const module of registeredModules) {
    try {
      await module.register(app, context);
      logger.info({ module: module.name, prefix: module.prefix }, 'Route module initialized');
    } catch (error) {
      logger.error({ error, module: module.name }, 'Failed to initialize route module');
      throw error;
    }
  }
}

export function getRegisteredModules(): readonly RouteModule[] {
  return registeredModules;
}

export function getRouteStats(): { moduleCount: number; modules: Array<{ name: string; prefix: string }> } {
  return {
    moduleCount: registeredModules.length,
    modules: registeredModules.map(m => ({ name: m.name, prefix: m.prefix })),
  };
}
