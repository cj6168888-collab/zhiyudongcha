import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const remoteControlServiceMock = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getDevice: vi.fn(),
  takeScreenshot: vi.fn(),
  sendCommand: vi.fn(),
  getSessions: vi.fn(),
  healthCheck: vi.fn(),
}));

vi.mock('../../server/services/remote-control', () => ({
  remoteControlService: remoteControlServiceMock,
}));

import { remoteControlRouter } from '../../server/routes/remote-control';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/remote', remoteControlRouter);
  return app;
}

function deviceFixture() {
  return {
    id: 'pc-1',
    name: 'Studio PC',
    platform: 'WINDOWS',
    osVersion: '11',
    status: 'ONLINE',
    lastSeen: 1,
    registeredAt: 1,
    capabilities: {
      screenCapture: true,
      mouseControl: true,
      keyboardControl: true,
      fileSystem: true,
      clipboard: true,
      notifications: true,
      maxResolution: { width: 1920, height: 1080 },
    },
  };
}

describe('Remote Control API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    remoteControlServiceMock.getDevices.mockResolvedValue([]);
    remoteControlServiceMock.getDevice.mockResolvedValue(undefined);
    remoteControlServiceMock.takeScreenshot.mockResolvedValue({ success: false, error: 'Device not found', duration: 0 });
    remoteControlServiceMock.sendCommand.mockResolvedValue({ success: true, data: { accepted: true }, duration: 5 });
    remoteControlServiceMock.getSessions.mockReturnValue([]);
    remoteControlServiceMock.healthCheck.mockResolvedValue({
      status: 'healthy',
      details: {
        serverInitialized: true,
        deviceCount: 0,
        sessionCount: 0,
        onlineDevices: 0,
      },
    });
  });

  it('returns device lists and details with resource counts', async () => {
    const device = deviceFixture();
    remoteControlServiceMock.getDevices.mockResolvedValue([device]);
    remoteControlServiceMock.getDevice.mockResolvedValue(device);

    const listResponse = await request(app).get('/api/remote/devices');
    const detailResponse = await request(app).get('/api/remote/devices/pc-1');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({ success: true, count: 1 });
    expect(listResponse.body.data[0]).toMatchObject({ id: 'pc-1', status: 'ONLINE' });
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({ id: 'pc-1', name: 'Studio PC' });
  });

  it('maps missing device detail and failed screenshots to useful HTTP statuses', async () => {
    const missingResponse = await request(app).get('/api/remote/devices/missing-pc');
    const screenshotResponse = await request(app).get('/api/remote/screenshot/missing-pc');

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toMatchObject({ success: false, error: 'Device not found' });
    expect(screenshotResponse.status).toBe(400);
    expect(screenshotResponse.body).toMatchObject({ success: false, error: 'Device not found' });
  });

  it('returns screenshot payloads without leaking service internals', async () => {
    remoteControlServiceMock.takeScreenshot.mockResolvedValue({
      success: true,
      data: { width: 1280, height: 720, data: 'base64-image' },
      duration: 12,
    });

    const response = await request(app).get('/api/remote/screenshot/pc-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      width: 1280,
      height: 720,
      image: 'base64-image',
    });
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).not.toHaveProperty('duration');
  });

  it('validates control commands before forwarding them to the service', async () => {
    const invalidResponse = await request(app).post('/api/remote/control/pc-1').send({
      type: 'POWER_TOASTER',
      action: 'OPEN',
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(remoteControlServiceMock.sendCommand).not.toHaveBeenCalled();

    const validResponse = await request(app).post('/api/remote/control/pc-1').send({
      type: 'APP',
      action: 'OPEN',
      params: { appName: 'notepad' },
    });

    expect(validResponse.status).toBe(200);
    expect(validResponse.body).toMatchObject({
      success: true,
      data: { accepted: true },
      duration: 5,
    });
    expect(remoteControlServiceMock.sendCommand).toHaveBeenCalledWith('pc-1', {
      type: 'APP',
      action: 'OPEN',
      params: { appName: 'notepad' },
    });
  });

  it('sanitizes active sessions and reports service health', async () => {
    remoteControlServiceMock.getSessions.mockReturnValue([
      {
        id: 'session-1',
        deviceId: 'pc-1',
        userId: 'user-1',
        status: 'CONNECTED',
        ws: { secret: 'do-not-leak' },
        createdAt: 1,
        lastActivity: 2,
      },
    ]);
    remoteControlServiceMock.healthCheck.mockResolvedValue({
      status: 'degraded',
      details: {
        serverInitialized: false,
        deviceCount: 1,
        sessionCount: 1,
        onlineDevices: 0,
      },
    });

    const sessionsResponse = await request(app).get('/api/remote/sessions');
    const statusResponse = await request(app).get('/api/remote/status');

    expect(sessionsResponse.status).toBe(200);
    expect(sessionsResponse.body).toMatchObject({ success: true, count: 1 });
    expect(sessionsResponse.body.data[0]).toEqual({
      id: 'session-1',
      deviceId: 'pc-1',
      userId: 'user-1',
      status: 'CONNECTED',
      createdAt: 1,
      lastActivity: 2,
    });
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data).toMatchObject({
      status: 'degraded',
      details: { deviceCount: 1, sessionCount: 1 },
    });
  });

  it('maps service exceptions to 500 responses', async () => {
    remoteControlServiceMock.getDevices.mockRejectedValueOnce(new Error('database offline'));
    remoteControlServiceMock.healthCheck.mockRejectedValueOnce(new Error('health probe failed'));

    const devicesResponse = await request(app).get('/api/remote/devices');
    const statusResponse = await request(app).get('/api/remote/status');

    expect(devicesResponse.status).toBe(500);
    expect(devicesResponse.body).toMatchObject({ success: false, error: 'database offline' });
    expect(statusResponse.status).toBe(500);
    expect(statusResponse.body).toMatchObject({ success: false, error: 'health probe failed' });
  });
});
