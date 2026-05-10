import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const userServiceMock = vi.hoisted(() => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  getAllUserSettings: vi.fn(),
}));

const cozeApiMock = vi.hoisted(() => ({
  updateFromSettings: vi.fn(),
}));

vi.mock('../../server/services/UserService', () => ({
  userService: userServiceMock,
}));

vi.mock('../../server/lib/coze-api', () => ({
  cozeAPI: cozeApiMock,
}));

vi.mock('../../server/storage', () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

import { registerUserSettingsRoutes } from '../../server/routes/user-settings';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userRole = (req.headers['x-test-role'] as 'MASTER' | 'GUEST' | undefined) ?? 'GUEST';
    req.sessionId = 'test-session';
    next();
  });
  registerUserSettingsRoutes(app, {} as never);
  return app;
}

const masterSettings = {
  userId: 'master',
  avatarName: 'Xiao Zhi',
  wakeWordSensitivity: 0.8,
};

describe('User Settings API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    userServiceMock.getUserSettings.mockResolvedValue(masterSettings);
    userServiceMock.updateUserSettings.mockResolvedValue(masterSettings);
    userServiceMock.getAllUserSettings.mockResolvedValue([masterSettings]);
  });

  it('rejects invalid user ids and prevents guests from reading master settings', async () => {
    const invalidResponse = await request(app)
      .get('/api/user-settings/not-a-user')
      .set('x-test-role', 'MASTER');
    const guestMasterResponse = await request(app)
      .get('/api/user-settings/master')
      .set('x-test-role', 'GUEST');

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(guestMasterResponse.status).toBe(403);
    expect(guestMasterResponse.body.error.code).toBe('FORBIDDEN');
    expect(userServiceMock.getUserSettings).not.toHaveBeenCalled();
  });

  it('returns user settings and falls back to creating defaults when reads fail', async () => {
    const guestResponse = await request(app)
      .get('/api/user-settings/guest')
      .set('x-test-role', 'GUEST');

    expect(guestResponse.status).toBe(200);
    expect(guestResponse.body).toMatchObject({ success: true, data: masterSettings });
    expect(userServiceMock.getUserSettings).toHaveBeenCalledWith('guest');

    userServiceMock.getUserSettings.mockRejectedValueOnce(new Error('missing settings'));
    userServiceMock.updateUserSettings.mockResolvedValueOnce({ userId: 'guest', avatarName: 'Default' });

    const fallbackResponse = await request(app)
      .get('/api/user-settings/guest')
      .set('x-test-role', 'GUEST');

    expect(fallbackResponse.status).toBe(200);
    expect(fallbackResponse.body.data).toMatchObject({ userId: 'guest', avatarName: 'Default' });
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith('guest', {});
  });

  it('validates and updates master settings while syncing Coze config fields', async () => {
    const forbiddenResponse = await request(app)
      .patch('/api/user-settings/guest')
      .set('x-test-role', 'MASTER')
      .send({ avatarName: 'Nope' });
    const invalidResponse = await request(app)
      .patch('/api/user-settings/master')
      .set('x-test-role', 'MASTER')
      .send({ wakeWordSensitivity: 2 });
    const response = await request(app)
      .patch('/api/user-settings/master')
      .set('x-test-role', 'MASTER')
      .send({
        avatarName: 'New Name',
        voiceSpeed: 1.2,
        cozeApiKey: 'pat-test',
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(cozeApiMock.updateFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({ cozeApiKey: 'pat-test' }),
    );
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith(
      'master',
      expect.objectContaining({
        avatarName: 'New Name',
        voiceSpeed: 1.2,
        cozeApiKey: 'pat-test',
      }),
    );
  });

  it('does not sync Coze config when regular settings are updated', async () => {
    const response = await request(app)
      .patch('/api/user-settings/master')
      .set('x-test-role', 'MASTER')
      .send({
        avatarName: 'Only Name',
        voiceSpeed: 1.1,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(cozeApiMock.updateFromSettings).not.toHaveBeenCalled();
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith(
      'master',
      expect.objectContaining({
        avatarName: 'Only Name',
        voiceSpeed: 1.1,
      }),
    );
  });

  it('requires master role for the all-settings endpoint', async () => {
    const forbiddenResponse = await request(app)
      .get('/api/user-settings')
      .set('x-test-role', 'GUEST');
    const response = await request(app)
      .get('/api/user-settings')
      .set('x-test-role', 'MASTER');

    expect(forbiddenResponse.status).toBe(403);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: [masterSettings] });
    expect(userServiceMock.getAllUserSettings).toHaveBeenCalledOnce();
  });

  it('maps settings service failures to server errors', async () => {
    userServiceMock.getUserSettings.mockRejectedValueOnce(new Error('read failed'));
    userServiceMock.updateUserSettings.mockRejectedValueOnce(new Error('fallback failed'));
    userServiceMock.updateUserSettings.mockRejectedValueOnce(new Error('update failed'));
    userServiceMock.getAllUserSettings.mockRejectedValueOnce(new Error('list failed'));

    const getResponse = await request(app)
      .get('/api/user-settings/guest')
      .set('x-test-role', 'GUEST');
    const patchResponse = await request(app)
      .patch('/api/user-settings/master')
      .set('x-test-role', 'MASTER')
      .send({ avatarName: 'New Name' });
    const allResponse = await request(app)
      .get('/api/user-settings')
      .set('x-test-role', 'MASTER');

    expect(getResponse.status).toBe(500);
    expect(getResponse.body.error.code).toBe('SERVER_ERROR');
    expect(patchResponse.status).toBe(500);
    expect(patchResponse.body.error.code).toBe('SERVER_ERROR');
    expect(allResponse.status).toBe(500);
    expect(allResponse.body.error.code).toBe('SERVER_ERROR');
  });

  it('maps Coze sync failures during settings updates to server errors', async () => {
    cozeApiMock.updateFromSettings.mockImplementationOnce(() => {
      throw new Error('coze sync failed');
    });

    const response = await request(app)
      .patch('/api/user-settings/master')
      .set('x-test-role', 'MASTER')
      .send({ cozeApiKey: 'pat-test' });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('SERVER_ERROR');
    expect(userServiceMock.updateUserSettings).not.toHaveBeenCalled();
  });
});
