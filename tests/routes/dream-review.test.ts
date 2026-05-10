import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── service mocks ────────────────────────────────────────────────────────────

const dreamReviewServiceMock = vi.hoisted(() => ({
  getLatestReview: vi.fn(),
  getReviewHistory: vi.fn(),
  runReview: vi.fn(),
}));

const morningBriefingServiceMock = vi.hoisted(() => ({
  generateBriefing: vi.fn(),
}));

vi.mock('../../server/services/reflection/DreamReviewService', () => ({
  dreamReviewService: dreamReviewServiceMock,
}));

vi.mock('../../server/services/reflection/MorningBriefingService', () => ({
  morningBriefingService: morningBriefingServiceMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { dreamReviewRouter } from '../../server/routes/dream-review';

// ── fixtures ─────────────────────────────────────────────────────────────────

const REVIEW_ROW = {
  id: 'conv-dream-001',
  title: '梦境复盘 — 2026-05-01',
  summary: '今日复盘一句话摘要',
  started_at: '2026-05-01T23:00:00.000Z',
  created_at: '2026-05-01T23:00:01.000Z',
};

const REVIEW_RESULT = {
  conversationId: 'conv-dream-001',
  summary: '今日共 5 条对话，发现 2 个遗漏任务',
  missedTaskCount: 2,
  projectRiskCount: 1,
  relationshipSignalCount: 0,
  memoryConflictCount: 0,
  totalCandidates: 3,
  sourcedFrom: 5,
};

// ── app factory ──────────────────────────────────────────────────────────────

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/dream-review', dreamReviewRouter);
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Dream Review API Routes — P5', () => {
  let app: Express;

  beforeAll(() => { app = makeApp(); });

  beforeEach(() => {
    vi.clearAllMocks();
    dreamReviewServiceMock.getLatestReview.mockResolvedValue(REVIEW_ROW);
    dreamReviewServiceMock.getReviewHistory.mockResolvedValue([REVIEW_ROW]);
    dreamReviewServiceMock.runReview.mockResolvedValue(REVIEW_RESULT);
    morningBriefingServiceMock.generateBriefing.mockResolvedValue(null);
  });

  // ── GET /latest ──────────────────────────────────────────────────────────

  describe('GET /latest', () => {
    it('有复盘记录时返回最新复盘', async () => {
      const res = await request(app).get('/api/dream-review/latest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.review.id).toBe('conv-dream-001');
      expect(res.body.review.title).toBe('梦境复盘 — 2026-05-01');
    });

    it('无复盘记录时返回 review=null', async () => {
      dreamReviewServiceMock.getLatestReview.mockResolvedValue(null);
      const res = await request(app).get('/api/dream-review/latest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.review).toBeNull();
    });

    it('service 异常返回 500', async () => {
      dreamReviewServiceMock.getLatestReview.mockRejectedValue(new Error('db error'));
      const res = await request(app).get('/api/dream-review/latest');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /history ─────────────────────────────────────────────────────────

  describe('GET /history', () => {
    it('返回复盘历史列表', async () => {
      const res = await request(app).get('/api/dream-review/history');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.history).toHaveLength(1);
      expect(dreamReviewServiceMock.getReviewHistory).toHaveBeenCalledWith('default', 10);
    });

    it('limit 参数透传给 service（最大 50）', async () => {
      await request(app).get('/api/dream-review/history?limit=20');
      expect(dreamReviewServiceMock.getReviewHistory).toHaveBeenCalledWith('default', 20);
    });

    it('limit 超出上限时截断为 50', async () => {
      await request(app).get('/api/dream-review/history?limit=999');
      expect(dreamReviewServiceMock.getReviewHistory).toHaveBeenCalledWith('default', 50);
    });

    it('无历史时返回空数组', async () => {
      dreamReviewServiceMock.getReviewHistory.mockResolvedValue([]);
      const res = await request(app).get('/api/dream-review/history');

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(0);
    });

    it('service 异常返回 500', async () => {
      dreamReviewServiceMock.getReviewHistory.mockRejectedValue(new Error('db error'));
      const res = await request(app).get('/api/dream-review/history');

      expect(res.status).toBe(500);
    });
  });

  // ── GET /morning ─────────────────────────────────────────────────────────

  describe('GET /morning', () => {
    const BRIEFING = {
      ownerId: 'default',
      reviewDate: '2026-04-30',
      generatedAt: '2026-05-01T06:00:00.000Z',
      reviewSummary: '今日 3 条对话，发现遗漏任务 2 个',
      topItems: [
        { type: 'task', title: '整理会议纪要', description: '讨论中提到' },
        { type: 'project_risk', title: '交付风险', description: 'Q2 可能延期' },
      ],
      suggestedActions: ['处理遗漏任务：整理会议纪要', '关注项目风险：交付风险'],
      totalPending: 3,
    };

    it('有晨间建议时返回 briefing 对象', async () => {
      morningBriefingServiceMock.generateBriefing.mockResolvedValue(BRIEFING);
      const res = await request(app).get('/api/dream-review/morning');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.briefing.reviewDate).toBe('2026-04-30');
      expect(res.body.briefing.topItems).toHaveLength(2);
      expect(res.body.briefing.suggestedActions[0]).toContain('整理会议纪要');
    });

    it('无建议时返回 briefing=null', async () => {
      morningBriefingServiceMock.generateBriefing.mockResolvedValue(null);
      const res = await request(app).get('/api/dream-review/morning');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.briefing).toBeNull();
    });

    it('service 异常返回 500', async () => {
      morningBriefingServiceMock.generateBriefing.mockRejectedValue(new Error('db error'));
      const res = await request(app).get('/api/dream-review/morning');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /run ────────────────────────────────────────────────────────────

  describe('POST /run', () => {
    it('触发复盘成功返回 result', async () => {
      const res = await request(app).post('/api/dream-review/run').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.skipped).toBe(false);
      expect(res.body.result.missedTaskCount).toBe(2);
      expect(res.body.result.totalCandidates).toBe(3);
      expect(dreamReviewServiceMock.runReview).toHaveBeenCalledWith('default', undefined);
    });

    it('指定 date 参数时透传给 service', async () => {
      const res = await request(app)
        .post('/api/dream-review/run')
        .send({ date: '2026-04-30' });

      expect(res.status).toBe(200);
      expect(dreamReviewServiceMock.runReview).toHaveBeenCalledWith('default', '2026-04-30');
    });

    it('date 格式非法返回 400', async () => {
      const res = await request(app)
        .post('/api/dream-review/run')
        .send({ date: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('当天无对话时返回 skipped=true', async () => {
      dreamReviewServiceMock.runReview.mockResolvedValue(null);
      const res = await request(app).post('/api/dream-review/run').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.skipped).toBe(true);
      expect(res.body.reason).toBeDefined();
    });

    it('service 异常返回 500', async () => {
      dreamReviewServiceMock.runReview.mockRejectedValue(new Error('ai error'));
      const res = await request(app).post('/api/dream-review/run').send({});

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
