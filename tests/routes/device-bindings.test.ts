import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── service mocks ────────────────────────────────────────────────────────────

const deviceBindingServiceMock = vi.hoisted(() => ({
  isAwakeningComplete: vi.fn(),
  generateBindCode: vi.fn(),
  confirmBinding: vi.fn(),
  listDevices: vi.fn(),
  getDevice: vi.fn(),
  updateDevice: vi.fn(),
  revokeDevice: vi.fn(),
}));

vi.mock('../../server/services/devices/DeviceBindingService', () => ({
  deviceBindingService: deviceBindingServiceMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { deviceBindingsRouter } from '../../server/routes/device-bindings';

// ── fixtures ─────────────────────────────────────────────────────────────────

const DEVICE: any = {
  id: 'dev-001',
  ownerId: 'default',
  identityId: 'default',
  deviceId: 'esp32-abc',
  deviceType: 'esp32_voice',
  provider: 'xiaozhi',
  displayName: '书房小智',
  status: 'active',
  capabilities: {},
  allowedModes: ['casual_chat', 'record_note', 'task_request'],
  riskPolicy: {},
  lastSeenAt: null,
  boundAt: new Date('2026-04-01T00:00:00Z'),
  revokedAt: null,
};

const BIND_CODE_ENTRY: any = {
  code: '123456',
  ownerId: 'default',
  identityId: 'default',
  createdAt: Date.now(),
  expiresAt: Date.now() + 600_000,
};

// ── app factory ──────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/device-bindings', deviceBindingsRouter);
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Device Bindings API Routes — P1', () => {
  let app: Express;

  beforeAll(() => { app = makeApp(); });

  beforeEach(() => {
    vi.clearAllMocks();
    deviceBindingServiceMock.isAwakeningComplete.mockResolvedValue(true);
    deviceBindingServiceMock.generateBindCode.mockResolvedValue(BIND_CODE_ENTRY);
    deviceBindingServiceMock.confirmBinding.mockResolvedValue(DEVICE);
    deviceBindingServiceMock.listDevices.mockResolvedValue([DEVICE]);
    deviceBindingServiceMock.getDevice.mockResolvedValue(DEVICE);
    deviceBindingServiceMock.updateDevice.mockResolvedValue(DEVICE);
    deviceBindingServiceMock.revokeDevice.mockResolvedValue(true);
  });

  // ── GET /api/device-bindings/awakening-status ───────────────────────────

  describe('GET /awakening-status', () => {
    it('觉醒已完成返回 complete=true', async () => {
      const res = await request(app).get('/api/device-bindings/awakening-status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.complete).toBe(true);
    });

    it('觉醒未完成返回 complete=false', async () => {
      deviceBindingServiceMock.isAwakeningComplete.mockResolvedValue(false);
      const res = await request(app).get('/api/device-bindings/awakening-status');

      expect(res.status).toBe(200);
      expect(res.body.complete).toBe(false);
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.isAwakeningComplete.mockRejectedValue(new Error('db error'));
      const res = await request(app).get('/api/device-bindings/awakening-status');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /api/device-bindings/bind-code ────────────────────────────────

  describe('POST /bind-code', () => {
    it('生成绑定码成功，返回 code 和过期时间', async () => {
      const res = await request(app).post('/api/device-bindings/bind-code').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('123456');
      expect(res.body.expiresAt).toBeDefined();
      expect(res.body.expiresInSec).toBeGreaterThan(0);
    });

    it('传入 identityId 会透传给 service', async () => {
      await request(app)
        .post('/api/device-bindings/bind-code')
        .send({ identityId: 'identity-007' });

      expect(deviceBindingServiceMock.generateBindCode).toHaveBeenCalledWith(
        'default',
        'identity-007',
      );
    });

    it('觉醒未完成时 service 抛出 AWAKENING_REQUIRED → 403', async () => {
      deviceBindingServiceMock.generateBindCode.mockRejectedValue(
        new Error('AWAKENING_REQUIRED'),
      );
      const res = await request(app).post('/api/device-bindings/bind-code').send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('AWAKENING_REQUIRED');
    });

    it('其他异常返回 500', async () => {
      deviceBindingServiceMock.generateBindCode.mockRejectedValue(new Error('db error'));
      const res = await request(app).post('/api/device-bindings/bind-code').send({});

      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/device-bindings/bind ─────────────────────────────────────

  describe('POST /bind', () => {
    const VALID_BODY = {
      code: '123456',
      deviceId: 'esp32-abc',
      deviceType: 'esp32_voice',
      provider: 'xiaozhi',
      displayName: '书房小智',
    };

    it('绑定成功返回 201 + device', async () => {
      const res = await request(app).post('/api/device-bindings/bind').send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.device.deviceId).toBe('esp32-abc');
    });

    it('缺少必填字段返回 400', async () => {
      const res = await request(app)
        .post('/api/device-bindings/bind')
        .send({ code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('绑定码无效时 service 抛出 INVALID_OR_EXPIRED_CODE → 400', async () => {
      deviceBindingServiceMock.confirmBinding.mockRejectedValue(
        new Error('INVALID_OR_EXPIRED_CODE'),
      );
      const res = await request(app).post('/api/device-bindings/bind').send(VALID_BODY);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_OR_EXPIRED_CODE');
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.confirmBinding.mockRejectedValue(new Error('db error'));
      const res = await request(app).post('/api/device-bindings/bind').send(VALID_BODY);

      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/device-bindings ────────────────────────────────────────────

  describe('GET /', () => {
    it('返回设备列表', async () => {
      const res = await request(app).get('/api/device-bindings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.devices).toHaveLength(1);
      expect(res.body.devices[0].deviceId).toBe('esp32-abc');
    });

    it('无设备时返回空数组', async () => {
      deviceBindingServiceMock.listDevices.mockResolvedValue([]);
      const res = await request(app).get('/api/device-bindings');

      expect(res.status).toBe(200);
      expect(res.body.devices).toHaveLength(0);
    });

    it('service 异常时返回安全空列表', async () => {
      deviceBindingServiceMock.listDevices.mockRejectedValue(new Error('db error'));
      const res = await request(app).get('/api/device-bindings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        devices: [],
      });
    });
  });

  // ── GET /api/device-bindings/:deviceId ─────────────────────────────────

  describe('GET /:deviceId', () => {
    it('存在时返回设备详情', async () => {
      const res = await request(app).get('/api/device-bindings/dev-001');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.device.id).toBe('dev-001');
    });

    it('不存在时返回 404', async () => {
      deviceBindingServiceMock.getDevice.mockResolvedValue(null);
      const res = await request(app).get('/api/device-bindings/no-such');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.getDevice.mockRejectedValue(new Error('err'));
      const res = await request(app).get('/api/device-bindings/dev-001');

      expect(res.status).toBe(500);
    });
  });

  // ── PATCH /api/device-bindings/:deviceId ───────────────────────────────

  describe('PATCH /:deviceId', () => {
    it('更新显示名称成功', async () => {
      const res = await request(app)
        .patch('/api/device-bindings/dev-001')
        .send({ displayName: '新名字' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deviceBindingServiceMock.updateDevice).toHaveBeenCalledWith(
        'dev-001',
        'default',
        { displayName: '新名字', allowedModes: undefined },
      );
    });

    it('更新允许模式', async () => {
      const modes = ['casual_chat'];
      const res = await request(app)
        .patch('/api/device-bindings/dev-001')
        .send({ allowedModes: modes });

      expect(res.status).toBe(200);
      expect(deviceBindingServiceMock.updateDevice).toHaveBeenCalledWith(
        'dev-001',
        'default',
        { displayName: undefined, allowedModes: modes },
      );
    });

    it('设备不存在时 service 返回 null → 404', async () => {
      deviceBindingServiceMock.updateDevice.mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/device-bindings/no-such')
        .send({ displayName: 'x' });

      expect(res.status).toBe(404);
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.updateDevice.mockRejectedValue(new Error('err'));
      const res = await request(app)
        .patch('/api/device-bindings/dev-001')
        .send({ displayName: 'x' });

      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/device-bindings/:deviceId/revoke ─────────────────────────

  describe('POST /:deviceId/revoke', () => {
    it('撤销成功返回 200', async () => {
      const res = await request(app).post('/api/device-bindings/dev-001/revoke');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deviceBindingServiceMock.revokeDevice).toHaveBeenCalledWith('dev-001', 'default');
    });

    it('设备不存在时 service 返回 false → 404', async () => {
      deviceBindingServiceMock.revokeDevice.mockResolvedValue(false);
      const res = await request(app).post('/api/device-bindings/no-such/revoke');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.revokeDevice.mockRejectedValue(new Error('err'));
      const res = await request(app).post('/api/device-bindings/dev-001/revoke');

      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/device-bindings/:deviceId/status ──────────────────────────

  describe('GET /:deviceId/status', () => {
    it('存在且离线返回 online=false', async () => {
      const res = await request(app).get('/api/device-bindings/dev-001/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.online).toBe(false);
      expect(res.body.status).toBe('active');
      expect(res.body.allowedModes).toEqual(['casual_chat', 'record_note', 'task_request']);
    });

    it('lastSeenAt 在 60 秒内视为在线', async () => {
      deviceBindingServiceMock.getDevice.mockResolvedValue({
        ...DEVICE,
        lastSeenAt: new Date(Date.now() - 10_000),
      });
      const res = await request(app).get('/api/device-bindings/dev-001/status');

      expect(res.status).toBe(200);
      expect(res.body.online).toBe(true);
    });

    it('lastSeenAt 超过 60 秒视为离线', async () => {
      deviceBindingServiceMock.getDevice.mockResolvedValue({
        ...DEVICE,
        lastSeenAt: new Date(Date.now() - 90_000),
      });
      const res = await request(app).get('/api/device-bindings/dev-001/status');

      expect(res.status).toBe(200);
      expect(res.body.online).toBe(false);
    });

    it('设备不存在时返回 404', async () => {
      deviceBindingServiceMock.getDevice.mockResolvedValue(null);
      const res = await request(app).get('/api/device-bindings/no-such/status');

      expect(res.status).toBe(404);
    });

    it('service 异常返回 500', async () => {
      deviceBindingServiceMock.getDevice.mockRejectedValue(new Error('err'));
      const res = await request(app).get('/api/device-bindings/dev-001/status');

      expect(res.status).toBe(500);
    });
  });
});
