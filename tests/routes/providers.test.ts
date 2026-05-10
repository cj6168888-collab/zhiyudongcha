import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── service mocks ────────────────────────────────────────────────────────────

const omiProviderMock = vi.hoisted(() => ({
  connect: vi.fn(),
  getStatus: vi.fn(),
  disconnect: vi.fn(),
  importPayload: vi.fn(),
}));

vi.mock('../../server/services/providers/OmiProvider', () => ({
  omiProvider: omiProviderMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { providersRouter } from '../../server/routes/providers';

// ── fixtures ─────────────────────────────────────────────────────────────────

const SYNC_STATE = {
  id: 'sync-001',
  ownerId: 'default',
  provider: 'omi',
  accountRef: null,
  cursor: null,
  lastSyncedAt: null,
  status: 'idle',
  errorMessage: null,
  config: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const IMPORT_RESULT = {
  memoriesImported: 2,
  memoriesSkipped: 0,
  conversationsImported: 1,
  conversationsSkipped: 0,
  candidatesCreated: 3,
  errors: [],
};

const VALID_PAYLOAD = {
  memories: [
    {
      id: 'omi-mem-001',
      content: '和王总讨论了 Q2 目标',
      structured: { title: 'Q2 讨论', action_items: [{ description: '整理纪要' }] },
    },
  ],
  conversations: [
    {
      id: 'omi-conv-001',
      title: '项目启动',
      transcript: [{ speaker: 'MASTER', text: '确认范围' }],
      action_items: [{ description: '确认里程碑' }],
    },
  ],
};

// ── app factory ──────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', providersRouter);
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Provider API Routes — Omi', () => {
  let app: Express;

  beforeAll(() => { app = makeApp(); });

  beforeEach(() => {
    vi.clearAllMocks();
    omiProviderMock.connect.mockResolvedValue(SYNC_STATE);
    omiProviderMock.getStatus.mockResolvedValue(SYNC_STATE);
    omiProviderMock.disconnect.mockResolvedValue(true);
    omiProviderMock.importPayload.mockResolvedValue(IMPORT_RESULT);
  });

  // ── POST /api/providers/omi/connect ─────────────────────────────────────

  describe('POST /api/providers/omi/connect', () => {
    it('连接成功返回 sync state', async () => {
      const res = await request(app)
        .post('/api/providers/omi/connect')
        .send({ apiKey: 'sk-omi-123', accountRef: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state.provider).toBe('omi');
      expect(omiProviderMock.connect).toHaveBeenCalledWith('default', {
        apiKey: 'sk-omi-123',
        accountRef: 'user@example.com',
      });
    });

    it('不带 apiKey 也可以连接（更新 accountRef）', async () => {
      const res = await request(app)
        .post('/api/providers/omi/connect')
        .send({ accountRef: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('空 body 也可以调用（无 apiKey/accountRef）', async () => {
      const res = await request(app).post('/api/providers/omi/connect').send({});
      expect(res.status).toBe(200);
    });

    it('service 异常返回 500', async () => {
      omiProviderMock.connect.mockRejectedValue(new Error('db error'));
      const res = await request(app).post('/api/providers/omi/connect').send({});
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /api/providers/omi/import ──────────────────────────────────────

  describe('POST /api/providers/omi/import', () => {
    it('导入成功返回结果摘要', async () => {
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.memoriesImported).toBe(2);
      expect(res.body.result.candidatesCreated).toBe(3);
    });

    it('缺少 memories 和 conversations 字段返回 400', async () => {
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send({ other: 'field' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('空数组返回零计数，不调用 importPayload', async () => {
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send({ memories: [], conversations: [] });

      expect(res.status).toBe(200);
      expect(res.body.result.memoriesImported).toBe(0);
      expect(omiProviderMock.importPayload).not.toHaveBeenCalled();
    });

    it('只有 memories 字段也被接受', async () => {
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send({ memories: [{ id: 'mem-1', content: '测试' }] });

      expect(res.status).toBe(200);
      expect(omiProviderMock.importPayload).toHaveBeenCalled();
    });

    it('只有 conversations 字段也被接受', async () => {
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send({ conversations: [{ id: 'conv-1', title: '会议' }] });

      expect(res.status).toBe(200);
    });

    it('导入含 errors 时仍返回 success（错误隔离）', async () => {
      omiProviderMock.importPayload.mockResolvedValue({
        ...IMPORT_RESULT,
        memoriesImported: 1,
        errors: ['memory omi-mem-fail: DB write failed'],
      });

      const res = await request(app)
        .post('/api/providers/omi/import')
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.result.errors).toHaveLength(1);
    });

    it('service 抛出异常时返回 200 + success=false（不影响主系统）', async () => {
      omiProviderMock.importPayload.mockRejectedValue(new Error('fatal'));
      const res = await request(app)
        .post('/api/providers/omi/import')
        .send(VALID_PAYLOAD);

      // Omi 失败不影响主系统：返回 200 + 错误详情
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  // ── GET /api/providers/omi/status ───────────────────────────────────────

  describe('GET /api/providers/omi/status', () => {
    it('已连接返回 connected=true 和 state', async () => {
      const res = await request(app).get('/api/providers/omi/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connected).toBe(true);
      expect(res.body.state.provider).toBe('omi');
    });

    it('未连接时 status=null → connected=false', async () => {
      omiProviderMock.getStatus.mockResolvedValue(null);
      const res = await request(app).get('/api/providers/omi/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
      expect(res.body.state).toBeNull();
    });

    it('status=disconnected → connected=false', async () => {
      omiProviderMock.getStatus.mockResolvedValue({ ...SYNC_STATE, status: 'disconnected' });
      const res = await request(app).get('/api/providers/omi/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it('status=syncing → connected=true', async () => {
      omiProviderMock.getStatus.mockResolvedValue({ ...SYNC_STATE, status: 'syncing' });
      const res = await request(app).get('/api/providers/omi/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });

    it('service 异常返回 500', async () => {
      omiProviderMock.getStatus.mockRejectedValue(new Error('err'));
      const res = await request(app).get('/api/providers/omi/status');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/providers/omi/disconnect ──────────────────────────────────

  describe('POST /api/providers/omi/disconnect', () => {
    it('断开成功', async () => {
      const res = await request(app).post('/api/providers/omi/disconnect');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disconnected).toBe(true);
      expect(omiProviderMock.disconnect).toHaveBeenCalledWith('default');
    });

    it('未连接时 disconnect 返回 false', async () => {
      omiProviderMock.disconnect.mockResolvedValue(false);
      const res = await request(app).post('/api/providers/omi/disconnect');

      expect(res.status).toBe(200);
      expect(res.body.disconnected).toBe(false);
    });

    it('service 异常返回 500', async () => {
      omiProviderMock.disconnect.mockRejectedValue(new Error('err'));
      const res = await request(app).post('/api/providers/omi/disconnect');
      expect(res.status).toBe(500);
    });
  });
});
