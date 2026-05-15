import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const modelSyncServiceMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  startSync: vi.fn(),
}));

const aiProviderMock = vi.hoisted(() => ({
  getProviderStatus: vi.fn(),
  getAvailableProviders: vi.fn(),
}));

vi.mock('../../server/services/system/ModelSyncService', () => ({
  modelSyncService: modelSyncServiceMock,
}));

vi.mock('../../server/lib/ai-provider', () => ({
  aiProvider: aiProviderMock,
}));

import modelRouter from '../../server/routes/model.routes';
import { attachRole } from '../../server/middleware/auth';

const masterHeaders = {
  'x-avatar-role': 'MASTER',
  'x-avatar-secret': 'unit-test-master-secret',
};

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(attachRole);
  app.use('/api/models', modelRouter);
  return app;
}

describe('Model API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_MASTER_SECRET = 'unit-test-master-secret';
    vi.clearAllMocks();
    modelSyncServiceMock.getStatus.mockReturnValue({
      progress: 35,
      isUpdating: true,
      fileCount: 12,
      totalSize: '4.2GB',
      ready: false,
    });
    modelSyncServiceMock.startSync.mockResolvedValue(undefined);
    aiProviderMock.getProviderStatus.mockReturnValue({
      dashscope: { configured: true, available: true },
      deepseek: { configured: false, available: false },
    });
    aiProviderMock.getAvailableProviders.mockReturnValue(['dashscope']);
  });

  it('returns model sync status combined with cloud provider availability', async () => {
    const response = await request(app).get('/api/models/status').set(masterHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      progress: 35,
      isUpdating: true,
      fileCount: 12,
      totalSize: '4.2GB',
      ready: false,
      cloud: {
        ready: true,
        availableProviders: ['dashscope'],
        providers: {
          dashscope: { configured: true, available: true },
          deepseek: { configured: false, available: false },
        },
      },
    });
    expect(modelSyncServiceMock.getStatus).toHaveBeenCalledTimes(1);
    expect(aiProviderMock.getProviderStatus).toHaveBeenCalledTimes(1);
    expect(aiProviderMock.getAvailableProviders).toHaveBeenCalledTimes(1);
  });

  it('reports cloud status as not ready when no cloud providers are available', async () => {
    aiProviderMock.getAvailableProviders.mockReturnValue([]);

    const response = await request(app).get('/api/models/cloud-status').set(masterHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      ready: false,
      availableProviders: [],
      providers: {
        dashscope: { configured: true, available: true },
      },
    });
    expect(modelSyncServiceMock.getStatus).not.toHaveBeenCalled();
  });

  it('triggers model sync without waiting for background completion', async () => {
    const response = await request(app).post('/api/models/sync').set(masterHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBeTruthy();
    expect(modelSyncServiceMock.startSync).toHaveBeenCalledTimes(1);
  });

  it('logs background sync rejection while keeping the trigger response stable', async () => {
    modelSyncServiceMock.startSync.mockRejectedValueOnce(new Error('sync failed after response'));

    const response = await request(app).post('/api/models/sync').set(masterHeaders);

    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(modelSyncServiceMock.startSync).toHaveBeenCalledTimes(1);
  });

  it('maps synchronous sync start failures to 500 responses', async () => {
    modelSyncServiceMock.startSync.mockImplementationOnce(() => {
      throw new Error('sync bootstrap failed');
    });

    const response = await request(app).post('/api/models/sync').set(masterHeaders);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'sync bootstrap failed',
    });
  });
});
