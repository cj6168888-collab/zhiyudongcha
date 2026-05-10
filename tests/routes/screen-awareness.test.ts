import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── service mocks ────────────────────────────────────────────────────────────

const bridgeMock = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  processCapture: vi.fn(),
}));

vi.mock('../../server/services/screen/ScreenAwarenessBridge', () => ({
  screenAwarenessBridge: bridgeMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { screenAwarenessRouter } from '../../server/routes/screen-awareness';

// ── app factory ──────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/screen-awareness', screenAwarenessRouter);
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Screen Awareness API Routes — P4', () => {
  let app: Express;

  beforeAll(() => { app = makeApp(); });

  beforeEach(() => {
    vi.clearAllMocks();
    bridgeMock.isEnabled.mockReturnValue(false);
    bridgeMock.enable.mockReturnValue(undefined);
    bridgeMock.disable.mockReturnValue(undefined);
    bridgeMock.processCapture.mockResolvedValue({ stored: true, blocked: false, conversationId: 'conv-001' });
  });

  // ── GET /status ──────────────────────────────────────────────────────────

  describe('GET /status', () => {
    it('默认返回 enabled=false（屏幕感知默认关闭）', async () => {
      const res = await request(app).get('/api/screen-awareness/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enabled).toBe(false);
    });

    it('开启后返回 enabled=true', async () => {
      bridgeMock.isEnabled.mockReturnValue(true);
      const res = await request(app).get('/api/screen-awareness/status');

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });
  });

  // ── POST /enable ─────────────────────────────────────────────────────────

  describe('POST /enable', () => {
    it('开启屏幕感知返回 enabled=true', async () => {
      const res = await request(app).post('/api/screen-awareness/enable');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enabled).toBe(true);
      expect(bridgeMock.enable).toHaveBeenCalledWith('default');
    });
  });

  // ── POST /disable ────────────────────────────────────────────────────────

  describe('POST /disable', () => {
    it('关闭屏幕感知返回 enabled=false', async () => {
      const res = await request(app).post('/api/screen-awareness/disable');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enabled).toBe(false);
      expect(bridgeMock.disable).toHaveBeenCalledWith('default');
    });
  });

  // ── POST /capture ────────────────────────────────────────────────────────

  describe('POST /capture', () => {
    it('提交合法文本，存储成功返回 stored=true + conversationId', async () => {
      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: '这是屏幕上的文字内容', appContext: 'VSCode' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stored).toBe(true);
      expect(res.body.conversationId).toBe('conv-001');
      expect(bridgeMock.processCapture).toHaveBeenCalledWith('default', {
        text: '这是屏幕上的文字内容',
        appContext: 'VSCode',
        source: undefined,
      });
    });

    it('缺少 text 字段返回 400', async () => {
      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ appContext: 'Chrome' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('text 为空字符串返回 400', async () => {
      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('敏感内容被阻断时返回 blocked=true，stored=false', async () => {
      bridgeMock.processCapture.mockResolvedValue({
        stored: false,
        blocked: true,
        blockReason: 'password_field',
      });

      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: 'password: 123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stored).toBe(false);
      expect(res.body.blocked).toBe(true);
      expect(res.body.blockReason).toBe('password_field');
    });

    it('屏幕感知未开启时 stored=false，blocked=false（静默忽略）', async () => {
      bridgeMock.processCapture.mockResolvedValue({ stored: false, blocked: false });

      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: '正常内容' });

      expect(res.status).toBe(200);
      expect(res.body.stored).toBe(false);
      expect(res.body.blocked).toBe(false);
    });

    it('传入 source 字段透传给 bridge', async () => {
      await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: '正常内容', source: 'ocr' });

      expect(bridgeMock.processCapture).toHaveBeenCalledWith('default', {
        text: '正常内容',
        appContext: undefined,
        source: 'ocr',
      });
    });

    it('bridge 异常时返回 500', async () => {
      bridgeMock.processCapture.mockRejectedValue(new Error('db error'));
      const res = await request(app)
        .post('/api/screen-awareness/capture')
        .send({ text: '正常内容' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
