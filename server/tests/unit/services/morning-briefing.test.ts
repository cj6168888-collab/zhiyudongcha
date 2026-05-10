import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetLatestReview = vi.hoisted(() => vi.fn());
const mockGetCandidates = vi.hoisted(() => vi.fn());

vi.mock('../../../services/reflection/DreamReviewService', () => ({
  dreamReviewService: { getLatestReview: mockGetLatestReview },
}));
vi.mock('../../../services/conversation/ConversationService', () => ({
  conversationService: { getCandidates: mockGetCandidates },
}));
vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { morningBriefingService } from '../../../services/reflection/MorningBriefingService';

const OWNER = 'user-001';

const REVIEW_ROW = {
  id: 'review-conv-1',
  title: '梦境复盘 — 2026-04-30',
  summary: '今日 3 条对话，发现遗漏任务 2 个',
  started_at: '2026-04-30T22:00:00.000Z',
  created_at: '2026-04-30T22:00:00.000Z',
};

function makeCandidates(overrides: any[] = []) {
  const defaults = [
    {
      id: 'c1', conversationId: 'review-conv-1', candidateType: 'task',
      status: 'pending', content: { title: '整理会议纪要', description: '讨论中提到', sourceHint: '' },
      confidence: '0.7', riskLevel: 'low', createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'c2', conversationId: 'review-conv-1', candidateType: 'task',
      status: 'pending', content: { title: '发送报价单', description: '客户等待', sourceHint: '' },
      confidence: '0.7', riskLevel: 'low', createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'c3', conversationId: 'review-conv-1', candidateType: 'project_risk',
      status: 'pending', content: { title: '交付风险', description: 'Q2 里程碑可能延期', sourceHint: '' },
      confidence: '0.7', riskLevel: 'medium', createdAt: new Date(), updatedAt: new Date(),
    },
  ];
  return [...defaults, ...overrides];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 无复盘记录 ────────────────────────────────────────────

describe('MorningBriefingService — 无复盘记录', () => {
  it('没有复盘时返回 null', async () => {
    mockGetLatestReview.mockResolvedValue(null);

    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result).toBeNull();
    expect(mockGetCandidates).not.toHaveBeenCalled();
  });

  it('复盘没有 pending 候选项时返回 null', async () => {
    mockGetLatestReview.mockResolvedValue(REVIEW_ROW);
    mockGetCandidates.mockResolvedValue([
      { ...makeCandidates()[0], status: 'accepted' },
      { ...makeCandidates()[1], status: 'rejected' },
    ]);

    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result).toBeNull();
  });
});

// ── 正常生成 ─────────────────────────────────────────────

describe('MorningBriefingService — 正常生成', () => {
  beforeEach(() => {
    mockGetLatestReview.mockResolvedValue(REVIEW_ROW);
    mockGetCandidates.mockResolvedValue(makeCandidates());
  });

  it('返回正确的 ownerId 和 reviewDate', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result).not.toBeNull();
    expect(result!.ownerId).toBe(OWNER);
    expect(result!.reviewDate).toBe('2026-04-30');
  });

  it('reviewSummary 来自复盘 conversation.summary', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result!.reviewSummary).toBe('今日 3 条对话，发现遗漏任务 2 个');
  });

  it('topItems 包含 task 和 project_risk', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    const tasks = result!.topItems.filter((i) => i.type === 'task');
    const risks = result!.topItems.filter((i) => i.type === 'project_risk');

    expect(tasks).toHaveLength(2);
    expect(risks).toHaveLength(1);
    expect(tasks[0].title).toBe('整理会议纪要');
    expect(risks[0].title).toBe('交付风险');
  });

  it('suggestedActions 包含正确的前缀', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result!.suggestedActions[0]).toContain('处理遗漏任务');
    expect(result!.suggestedActions.some((a) => a.includes('关注项目风险'))).toBe(true);
  });

  it('totalPending 等于所有 pending 候选项数量', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result!.totalPending).toBe(3);
  });

  it('generatedAt 是有效的 ISO 字符串', async () => {
    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(() => new Date(result!.generatedAt)).not.toThrow();
  });
});

// ── 数据边界 ─────────────────────────────────────────────

describe('MorningBriefingService — 数据边界', () => {
  it('无 summary 时用日期作为 reviewSummary 备用', async () => {
    mockGetLatestReview.mockResolvedValue({ ...REVIEW_ROW, summary: null });
    mockGetCandidates.mockResolvedValue(makeCandidates());

    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result!.reviewSummary).toContain('2026-04-30');
  });

  it('每种类型最多取 3 条', async () => {
    const manyCandidates = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, conversationId: 'review-conv-1', candidateType: 'task',
      status: 'pending', content: { title: `任务 ${i}`, description: '', sourceHint: '' },
      confidence: '0.7', riskLevel: 'low', createdAt: new Date(), updatedAt: new Date(),
    }));
    mockGetLatestReview.mockResolvedValue(REVIEW_ROW);
    mockGetCandidates.mockResolvedValue(manyCandidates);

    const result = await morningBriefingService.generateBriefing(OWNER);

    const tasks = result!.topItems.filter((i) => i.type === 'task');
    expect(tasks).toHaveLength(3);
  });

  it('getCandidates 抛出异常时返回 null（容错）', async () => {
    mockGetLatestReview.mockResolvedValue(REVIEW_ROW);
    mockGetCandidates.mockRejectedValue(new Error('db error'));

    const result = await morningBriefingService.generateBriefing(OWNER);

    expect(result).toBeNull();
  });
});
