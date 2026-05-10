import type { Express } from "express";
import type { IStorage } from "../../storage";
import type { RouteContext } from "../types";
import { createServiceLogger } from '../../lib/logger';
import { registerProjectCrudRoutes } from './crud';
import { registerProjectNotesRoutes } from './notes';
import { registerProjectFilesRoutes } from './files';
import { registerProjectDashboardRoutes } from './dashboard';
import { registerProjectSwotRoutes } from './swot';
import { registerProjectEngineRoutes } from './engine';

const logger = createServiceLogger('ProjectRoutes');

export function registerProjectRoutes(
  app: Express,
  storage: IStorage,
  context: RouteContext
): void {
  registerProjectDashboardRoutes(app, storage);
  registerProjectCrudRoutes(app, storage);
  registerProjectNotesRoutes(app, storage);
  registerProjectFilesRoutes(app, storage);
  registerProjectSwotRoutes(app, storage);
  registerProjectEngineRoutes(app, storage);

  logger.info('[Projects] All routes registered at /api/projects/*');
}

export * from './types';
