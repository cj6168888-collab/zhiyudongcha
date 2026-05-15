import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditMock = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const secretVaultMock = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ initialized: true, cachedKeys: [] })),
  verifySecret: vi.fn().mockResolvedValue(false),
}));

const omiProviderMock = vi.hoisted(() => ({
  getStatus: vi.fn().mockResolvedValue(null),
  connect: vi.fn(),
  importPayload: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../../../storage', () => ({
  storage: auditMock,
}));

vi.mock('../../../services/secret-vault', () => ({
  secretVault: secretVaultMock,
  getDashScopeApiKey: vi.fn(),
  getDeepSeekApiKey: vi.fn(),
  getDoubaoApiKey: vi.fn(),
}));

vi.mock('../../../services/providers/OmiProvider', () => ({
  omiProvider: omiProviderMock,
}));

vi.mock('../../../services/avatar-tools', () => ({
  registerAvatarTools: vi.fn(),
}));

vi.mock('../../../services/smart-conversation', () => ({
  processUserInput: vi.fn(),
  processVoiceCommand: vi.fn(),
  clearConversationHistory: vi.fn(),
  getConversationHistory: vi.fn(() => []),
  getConversationStats: vi.fn(() => ({ activeConversations: 0, totalMessages: 0 })),
}));

import { attachRole } from '../../../middleware/auth';
import modelRouter from '../../../routes/model.routes';
import { providersRouter } from '../../../routes/providers';
import secretVaultRouter from '../../../routes/secret-vault';
import { registerConversationRoutes } from '../../../routes/conversation';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(attachRole);
  app.use('/api/models', modelRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/secret-vault', secretVaultRouter);
  registerConversationRoutes(app, {} as never, {} as never);
  return app;
}

describe('privacy auth hardening', () => {
  let app: Express;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_MASTER_SECRET = 'unit-test-master-secret';
    auditMock.createAuditLog.mockClear();
    app = createApp();
  });

  it.each([
    ['GET', '/api/conversation/history/default'],
    ['DELETE', '/api/conversation/history/default'],
    ['GET', '/api/conversation/stats'],
    ['GET', '/api/models/cloud-status'],
    ['POST', '/api/models/sync'],
    ['GET', '/api/providers/omi/status'],
    ['POST', '/api/providers/omi/connect'],
    ['GET', '/api/secret-vault/status'],
    ['GET', '/api/secret-vault/list'],
  ])('rejects non-master access to %s %s', async (method, path) => {
    const response = method === 'GET'
      ? await request(app).get(path)
      : method === 'DELETE'
        ? await request(app).delete(path)
        : await request(app).post(path).send({});

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows master access to read-only model and secret status endpoints', async () => {
    const headers = {
      'x-avatar-role': 'MASTER',
      'x-avatar-secret': 'unit-test-master-secret',
    };

    const modelStatus = await request(app).get('/api/models/cloud-status').set(headers);
    const vaultStatus = await request(app).get('/api/secret-vault/status').set(headers);

    expect(modelStatus.status).toBe(200);
    expect(modelStatus.body.success).toBe(true);
    expect(vaultStatus.status).toBe(200);
    expect(vaultStatus.body.success).toBe(true);
  });
});
