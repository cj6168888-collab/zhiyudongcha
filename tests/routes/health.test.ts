import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageAdapterMock = vi.hoisted(() => ({
  getHPBalance: vi.fn(),
}));

const webSocketManagerMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  context: {
    connectedUsers: new Map<string, { latency?: number }>(),
  },
}));

const remoteControlServiceMock = vi.hoisted(() => ({
  initialize: vi.fn(),
}));

const userServiceMock = vi.hoisted(() => ({
  syncCozeFromSettings: vi.fn(),
}));

const schedulerServiceMock = vi.hoisted(() => ({
  initialize: vi.fn(),
}));

const taskOrchestratorMock = vi.hoisted(() => ({
  initialize: vi.fn(),
}));

vi.mock('../../server/storage/adapter', () => ({
  storageAdapter: storageAdapterMock,
}));

vi.mock('../../server/websocket', () => ({
  webSocketManager: webSocketManagerMock,
}));

vi.mock('../../server/routes/realtime-voice', () => ({
  initRealtimeVoiceWebSocket: vi.fn(),
  registerRealtimeVoiceRoutes: vi.fn(),
}));

vi.mock('../../server/services/devices/NavigatorDeviceRuntime', () => ({
  initDeviceWebSocket: vi.fn(),
}));

vi.mock('../../server/services/remote-control', () => ({
  remoteControlService: remoteControlServiceMock,
}));

vi.mock('../../server/services/UserService', () => ({
  userService: userServiceMock,
}));

vi.mock('../../server/services/scheduler', () => ({
  schedulerService: schedulerServiceMock,
}));

vi.mock('../../server/services/task-orchestrator/TaskOrchestrator', () => ({
  taskOrchestrator: taskOrchestratorMock,
}));

vi.mock('../../server/middleware/auth', async () => {
  const passthrough = (req: Request, _res: Response, next: NextFunction) => {
    (req as any).userRole = 'MASTER';
    next();
  };
  return {
    attachRole: passthrough,
    requireAuth: passthrough,
    requireMaster: passthrough,
    optionalAuth: passthrough,
    auditAction: vi.fn(),
  };
});

vi.mock('../../server/middleware/authorization', () => ({
  attachAuthzContext: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../server/routes/auth', () => ({ registerAuthRoutes: vi.fn() }));
vi.mock('../../server/routes/authz', () => ({ registerAuthzRoutes: vi.fn() }));
vi.mock('../../server/routes/projects', () => ({ registerProjectRoutes: vi.fn() }));
vi.mock('../../server/routes/vault', () => ({ registerVaultRoutes: vi.fn() }));
vi.mock('../../server/routes/persons', () => ({ registerPersonsRoutes: vi.fn() }));
vi.mock('../../server/routes/navigator-core', () => ({ registerNavigatorRoutes: vi.fn() }));
vi.mock('../../server/routes/battle-report', () => ({ registerBattleReportRoutes: vi.fn() }));

import { registerRoutes } from '../../server/routes';

const openServers: ReturnType<typeof createServer>[] = [];

async function createRegisteredApp() {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  openServers.push(server);
  await registerRoutes(server, app);
  return app;
}

describe('Active Health API Route', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    webSocketManagerMock.context.connectedUsers = new Map();
    storageAdapterMock.getHPBalance.mockResolvedValue({ balance: 123 });
    userServiceMock.syncCozeFromSettings.mockResolvedValue(undefined);
    schedulerServiceMock.initialize.mockResolvedValue(undefined);
    taskOrchestratorMock.initialize.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    consoleWarnSpy.mockRestore();
    await Promise.all(
      openServers.splice(0).map((server) =>
        new Promise<void>((resolve, reject) => {
          server.removeAllListeners();

          if (!server.listening) {
            resolve();
            return;
          }

          server.close((error) => (error ? reject(error) : resolve()));
        }),
      ),
    );
  });

  it('returns active health status with HP, node count, and latency', async () => {
    webSocketManagerMock.context.connectedUsers = new Map([
      ['node-1', { latency: 25 }],
      ['node-2', { latency: 35 }],
    ]);

    const app = await createRegisteredApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      hp: '12.3',
      status: 'Active',
      database: 'ok',
      nodes: 2,
      latency: 25,
      load: 'OPTIMAL',
    });
    expect(webSocketManagerMock.initialize).toHaveBeenCalledOnce();
    expect(remoteControlServiceMock.initialize).toHaveBeenCalledOnce();
    expect(userServiceMock.syncCozeFromSettings).toHaveBeenCalledOnce();
  });

  it('returns degraded health when HP storage lookup fails', async () => {
    storageAdapterMock.getHPBalance.mockRejectedValueOnce(new Error('database offline'));

    const app = await createRegisteredApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      hp: '0.0',
      status: 'Degraded',
      database: 'degraded',
      nodes: 0,
      latency: 12,
      load: 'OPTIMAL',
    });
  });

  it('reports medium load when more than five nodes are connected', async () => {
    webSocketManagerMock.context.connectedUsers = new Map(
      Array.from({ length: 6 }, (_, index) => [`node-${index + 1}`, { latency: 10 + index }]),
    );

    const app = await createRegisteredApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      status: 'Active',
      database: 'ok',
      nodes: 6,
      latency: 10,
      load: 'MEDIUM',
    });
  });

  it('keeps health route available when startup Coze settings sync fails', async () => {
    userServiceMock.syncCozeFromSettings.mockRejectedValueOnce(new Error('coze settings unavailable'));

    const app = await createRegisteredApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      status: 'Active',
      database: 'ok',
    });
    expect(userServiceMock.syncCozeFromSettings).toHaveBeenCalledOnce();
  });
});
