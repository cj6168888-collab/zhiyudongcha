import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── service mocks ────────────────────────────────────────────────────────────

const convServiceMock = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  updateStatus: vi.fn(),
  finish: vi.fn(),
  delete: vi.fn(),
  appendSegment: vi.fn(),
  getSegments: vi.fn(),
  getCandidates: vi.fn(),
  addCandidate: vi.fn(),
  reviewCandidate: vi.fn(),
  markCandidateApplied: vi.fn(),
  getInbox: vi.fn(),
  getInboxCounts: vi.fn(),
}));

const convProcessorMock = vi.hoisted(() => ({
  process: vi.fn(),
}));

const storageAdapterMock = vi.hoisted(() => ({
  createProject: vi.fn(),
  createVaultItem: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('../../server/services/conversation/ConversationService', () => ({
  conversationService: convServiceMock,
}));

vi.mock('../../server/services/conversation/ConversationProcessor', () => ({
  conversationProcessor: convProcessorMock,
}));

vi.mock('../../server/storage/adapter', () => ({
  storageAdapter: storageAdapterMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../server/db', () => ({ getDatabase: vi.fn(() => dbMock) }));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: any, ...values: any[]) => ({ strings, values, __tagged: true }),
    { raw: vi.fn() }
  ),
}));

import {
  conversationRouter,
  conversationInboxRouter,
  conversationCandidateRouter,
} from '../../server/routes/conversations';

// ── fixtures ─────────────────────────────────────────────────────────────────

const CONV = {
  id: 'conv-001',
  ownerId: 'default',
  source: 'manual',
  mode: 'casual_chat',
  status: 'in_progress',
  startedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  keyPoints: [],
};

const SEGMENT = {
  id: 'seg-001',
  conversationId: 'conv-001',
  sequence: 1,
  segmentType: 'transcript',
  text: 'hello',
  source: 'manual',
  createdAt: new Date(),
};

const CANDIDATE = {
  id: 'cand-001',
  conversationId: 'conv-001',
  candidateType: 'memory',
  status: 'pending',
  content: { content: 'remember this', tags: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── app factories ─────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/conversations', conversationRouter);
  app.use('/api/conversation-inbox', conversationInboxRouter);
  app.use('/api/conversation-candidates', conversationCandidateRouter);
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Conversation API Routes', () => {
  let app: Express;

  beforeAll(() => { app = makeApp(); });

  beforeEach(() => {
    vi.clearAllMocks();
    convServiceMock.list.mockResolvedValue([CONV]);
    convServiceMock.create.mockResolvedValue(CONV);
    convServiceMock.get.mockResolvedValue(CONV);
    convServiceMock.updateStatus.mockResolvedValue(undefined);
    convServiceMock.finish.mockResolvedValue(CONV);
    convServiceMock.delete.mockResolvedValue(true);
    convServiceMock.appendSegment.mockResolvedValue(SEGMENT);
    convServiceMock.getSegments.mockResolvedValue([SEGMENT]);
    convServiceMock.getCandidates.mockResolvedValue([CANDIDATE]);
    convServiceMock.reviewCandidate.mockResolvedValue(CANDIDATE);
    convServiceMock.markCandidateApplied.mockResolvedValue(undefined);
    convServiceMock.getInbox.mockResolvedValue({ conversations: [CONV], total: 1 });
    convServiceMock.getInboxCounts.mockResolvedValue({ total: 2, memory: 1, task: 1 });
    convProcessorMock.process.mockResolvedValue({ summary: 'ok', taskCount: 0, memoryCount: 1, eventCount: 0 });
    storageAdapterMock.createProject.mockResolvedValue({ id: 'proj-001' });
    storageAdapterMock.createVaultItem.mockResolvedValue({ id: 'vault-001' });
  });

  // ── GET /api/conversations ───────────────────────────────────────────────

  describe('GET /api/conversations', () => {
    it('返回 conversation 列表', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.conversations).toHaveLength(1);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.list.mockRejectedValue(new Error('db down'));
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversations ──────────────────────────────────────────────

  describe('POST /api/conversations', () => {
    it('合法 source 创建成功', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({ source: 'mobile', mode: 'record_note', title: '测试' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(convServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'mobile' }));
    });

    it('所有合法 source 都被接受', async () => {
      const sources = ['mobile', 'desktop', 'xiaozhi_device', 'omi', 'browser', 'file', 'manual', 'import'];
      for (const source of sources) {
        const res = await request(app).post('/api/conversations').send({ source });
        expect(res.status).toBe(201);
      }
    });

    it('非法 source 返回 400', async () => {
      const res = await request(app).post('/api/conversations').send({ source: 'unknown_device' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('默认 source 为 manual', async () => {
      await request(app).post('/api/conversations').send({});
      expect(convServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual' }));
    });
  });

  // ── GET /api/conversations/:id ───────────────────────────────────────────

  describe('GET /api/conversations/:id', () => {
    it('返回 conversation + segments + candidates', async () => {
      const res = await request(app).get('/api/conversations/conv-001');
      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe('conv-001');
      expect(res.body.segments).toHaveLength(1);
      expect(res.body.candidates).toHaveLength(1);
    });

    it('不存在返回 404', async () => {
      convServiceMock.get.mockResolvedValue(null);
      const res = await request(app).get('/api/conversations/no-such');
      expect(res.status).toBe(404);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.get.mockRejectedValue(new Error('boom'));
      const res = await request(app).get('/api/conversations/conv-001');
      expect(res.status).toBe(500);
    });
  });

  // ── PATCH /api/conversations/:id ─────────────────────────────────────────

  describe('PATCH /api/conversations/:id', () => {
    it('更新状态成功', async () => {
      const res = await request(app)
        .patch('/api/conversations/conv-001')
        .send({ status: 'completed', summary: '完成了' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(convServiceMock.updateStatus).toHaveBeenCalled();
    });

    it('service 异常返回 500', async () => {
      convServiceMock.updateStatus.mockRejectedValue(new Error('err'));
      const res = await request(app).patch('/api/conversations/conv-001').send({ status: 'completed' });
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversations/:id/segments ─────────────────────────────────

  describe('POST /api/conversations/:id/segments', () => {
    it('追加 segment 成功', async () => {
      const res = await request(app)
        .post('/api/conversations/conv-001/segments')
        .send({ sequence: 1, text: '你好', speaker: 'user', source: 'manual' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.segment.id).toBe('seg-001');
    });

    it('缺少 sequence 返回 400', async () => {
      const res = await request(app)
        .post('/api/conversations/conv-001/segments')
        .send({ text: '你好' });
      expect(res.status).toBe(400);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.appendSegment.mockRejectedValue(new Error('err'));
      const res = await request(app)
        .post('/api/conversations/conv-001/segments')
        .send({ sequence: 1, text: 'x' });
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversations/:id/finish ───────────────────────────────────

  describe('POST /api/conversations/:id/finish', () => {
    it('finish 成功', async () => {
      const res = await request(app).post('/api/conversations/conv-001/finish');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(convServiceMock.finish).toHaveBeenCalledWith('conv-001', 'default');
    });

    it('service 异常返回 500', async () => {
      convServiceMock.finish.mockRejectedValue(new Error('err'));
      const res = await request(app).post('/api/conversations/conv-001/finish');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversations/:id/process ──────────────────────────────────

  describe('POST /api/conversations/:id/process', () => {
    it('process 返回提取结果', async () => {
      const res = await request(app).post('/api/conversations/conv-001/process');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(convProcessorMock.process).toHaveBeenCalledWith('conv-001', 'default');
    });

    it('processor 返回 null（已处理或不存在）返回 404', async () => {
      convProcessorMock.process.mockResolvedValue(null);
      const res = await request(app).post('/api/conversations/conv-001/process');
      expect(res.status).toBe(404);
    });

    it('processor 异常返回 500', async () => {
      convProcessorMock.process.mockRejectedValue(new Error('ai failed'));
      const res = await request(app).post('/api/conversations/conv-001/process');
      expect(res.status).toBe(500);
    });
  });

  // ── DELETE /api/conversations/:id ────────────────────────────────────────

  describe('DELETE /api/conversations/:id', () => {
    it('删除成功返回 200', async () => {
      const res = await request(app).delete('/api/conversations/conv-001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('不存在返回 404', async () => {
      convServiceMock.delete.mockResolvedValue(false);
      const res = await request(app).delete('/api/conversations/no-such');
      expect(res.status).toBe(404);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.delete.mockRejectedValue(new Error('err'));
      const res = await request(app).delete('/api/conversations/conv-001');
      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/conversation-inbox ──────────────────────────────────────────

  describe('GET /api/conversation-inbox', () => {
    it('返回收件箱列表和 total', async () => {
      const res = await request(app).get('/api/conversation-inbox');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('默认 limit/offset', async () => {
      await request(app).get('/api/conversation-inbox');
      expect(convServiceMock.getInbox).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });

    it('自定义 limit/offset', async () => {
      await request(app).get('/api/conversation-inbox?limit=5&offset=10');
      expect(convServiceMock.getInbox).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 10 })
      );
    });

    it('service 异常返回 500', async () => {
      convServiceMock.getInbox.mockRejectedValue(new Error('err'));
      const res = await request(app).get('/api/conversation-inbox');
      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/conversation-inbox/counts ───────────────────────────────────

  describe('GET /api/conversation-inbox/counts', () => {
    it('返回各类型候选数量', async () => {
      const res = await request(app).get('/api/conversation-inbox/counts');
      expect(res.status).toBe(200);
      expect(res.body.counts.total).toBe(2);
      expect(res.body.counts.memory).toBe(1);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.getInboxCounts.mockRejectedValue(new Error('err'));
      const res = await request(app).get('/api/conversation-inbox/counts');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversation-candidates/:id/accept ─────────────────────────

  describe('POST /api/conversation-candidates/:id/accept', () => {
    it('接受候选项成功', async () => {
      const res = await request(app).post('/api/conversation-candidates/cand-001/accept');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(convServiceMock.reviewCandidate).toHaveBeenCalledWith('cand-001', 'accept', 'default');
    });

    it('候选不存在返回 404', async () => {
      convServiceMock.reviewCandidate.mockResolvedValue(null);
      const res = await request(app).post('/api/conversation-candidates/no-such/accept');
      expect(res.status).toBe(404);
    });

    it('service 异常返回 500', async () => {
      convServiceMock.reviewCandidate.mockRejectedValue(new Error('err'));
      const res = await request(app).post('/api/conversation-candidates/cand-001/accept');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/conversation-candidates/:id/edit ───────────────────────────

  describe('POST /api/conversation-candidates/:id/edit', () => {
    it('编辑候选项成功', async () => {
      const res = await request(app)
        .post('/api/conversation-candidates/cand-001/edit')
        .send({ content: { content: '修改后的内容', tags: ['edited'] } });
      expect(res.status).toBe(200);
      expect(convServiceMock.reviewCandidate).toHaveBeenCalledWith(
        'cand-001', 'edit', 'default', expect.objectContaining({ content: '修改后的内容' })
      );
    });

    it('缺少 content 返回 400', async () => {
      const res = await request(app)
        .post('/api/conversation-candidates/cand-001/edit')
        .send({});
      expect(res.status).toBe(400);
    });

    it('content 不是对象返回 400', async () => {
      const res = await request(app)
        .post('/api/conversation-candidates/cand-001/edit')
        .send({ content: 'string content' });
      expect(res.status).toBe(400);
    });

    it('候选不存在返回 404', async () => {
      convServiceMock.reviewCandidate.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/conversation-candidates/no-such/edit')
        .send({ content: { content: 'x' } });
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/conversation-candidates/:id/reject ─────────────────────────

  describe('POST /api/conversation-candidates/:id/reject', () => {
    it('拒绝候选项成功', async () => {
      const res = await request(app).post('/api/conversation-candidates/cand-001/reject');
      expect(res.status).toBe(200);
      expect(convServiceMock.reviewCandidate).toHaveBeenCalledWith('cand-001', 'reject', 'default');
    });

    it('候选不存在返回 404', async () => {
      convServiceMock.reviewCandidate.mockResolvedValue(null);
      const res = await request(app).post('/api/conversation-candidates/no-such/reject');
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/conversation-candidates/:id/apply ──────────────────────────

  describe('POST /api/conversation-candidates/:id/apply', () => {
    function makeDbWithCandidate(overrides: Partial<typeof CANDIDATE> = {}) {
      const row = { ...CANDIDATE, ...overrides, candidate_type: (overrides as any).candidateType ?? CANDIDATE.candidateType, linked_entity_id: null };
      return { execute: vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }) };
    }

    it('apply task 候选 → 创建 project 并标记 applied', async () => {
      dbMock.execute.mockResolvedValue({ rows: [{ ...CANDIDATE, candidate_type: 'task', linked_entity_id: null, status: 'pending', content: { title: '测试任务' } }], rowCount: 1 });

      const res = await request(app).post('/api/conversation-candidates/cand-001/apply');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('apply memory 候选 → 创建 vault_item', async () => {
      dbMock.execute.mockResolvedValue({ rows: [{ ...CANDIDATE, candidate_type: 'memory', linked_entity_id: null, status: 'pending', content: { content: '记忆内容' } }], rowCount: 1 });

      const res = await request(app).post('/api/conversation-candidates/cand-001/apply');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('已 applied 的候选直接返回 linkedEntityId', async () => {
      dbMock.execute.mockResolvedValue({ rows: [{ ...CANDIDATE, candidate_type: 'memory', linked_entity_id: 'vault-999', status: 'applied' }], rowCount: 1 });

      const res = await request(app).post('/api/conversation-candidates/cand-001/apply');
      expect(res.status).toBe(200);
      expect(res.body.linkedEntityId).toBe('vault-999');
    });

    it('候选不存在返回 404', async () => {
      dbMock.execute.mockResolvedValue({ rows: [], rowCount: 0 });
      const res = await request(app).post('/api/conversation-candidates/no-such/apply');
      expect(res.status).toBe(404);
    });

    it('DB 不可用返回 503', async () => {
      const { getDatabase } = await import('../../server/db');
      vi.mocked(getDatabase).mockReturnValueOnce(null as any);
      const res = await request(app).post('/api/conversation-candidates/cand-001/apply');
      expect(res.status).toBe(503);
    });

    it('service 异常返回 500', async () => {
      dbMock.execute.mockRejectedValue(new Error('db failed'));
      const res = await request(app).post('/api/conversation-candidates/cand-001/apply');
      expect(res.status).toBe(500);
    });
  });
});
