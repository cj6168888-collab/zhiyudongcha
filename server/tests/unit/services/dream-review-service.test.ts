import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../db', () => ({ getDatabase: vi.fn() }));
const mockComplete = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/ai-provider', () => ({
  AIProviderChain: vi.fn().mockImplementation(function (this: any) {
    this.complete = mockComplete;
  }),
}));
vi.mock('../../../services/conversation/ConversationService', () => ({
  conversationService: {
    create: vi.fn(),
    appendSegment: vi.fn(),
    finish: vi.fn(),
    getSegments: vi.fn(),
    addCandidate: vi.fn(),
    updateStatus: vi.fn(),
  },
}));
vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { getDatabase } from '../../../db';
import { conversationService } from '../../../services/conversation/ConversationService';
import { dreamReviewService } from '../../../services/reflection/DreamReviewService';

const OWNER = 'user-p5-001';
const TARGET_DATE = '2026-05-01';

function makeDb(queryRows: any[] = []) {
  return {
    execute: vi.fn().mockResolvedValue({ rows: queryRows }),
  };
}

const AI_RESPONSE = JSON.stringify({
  summary: '今日 3 条对话，发现遗漏任务 2 个',
  missed_tasks: [
    { title: '整理会议纪要', description: '讨论中提到要整理但未建任务', sourceHint: '项目启动会' },
    { title: '发送报价单', description: '客户等待报价', sourceHint: '与客户通话' },
  ],
  project_risks: [
    { title: '交付风险', description: 'Q2 里程碑可能延期' },
  ],
  relationship_signals: [],
  memory_conflicts: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationService.create).mockResolvedValue({ id: 'conv-review-001' } as any);
  vi.mocked(conversationService.appendSegment).mockResolvedValue(undefined as any);
  vi.mocked(conversationService.finish).mockResolvedValue(undefined as any);
  vi.mocked(conversationService.getSegments).mockResolvedValue([]);
  vi.mocked(conversationService.addCandidate).mockResolvedValue({ id: 'cand-001' } as any);
});

// ── 无对话时跳过 ──────────────────────────────────────────

describe('DreamReviewService — 无对话', () => {
  it('当天无对话时返回 null', async () => {
    vi.mocked(getDatabase).mockReturnValue(makeDb([]) as any);

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).toBeNull();
    expect(conversationService.create).not.toHaveBeenCalled();
  });

  it('DB 不可用时返回 null', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).toBeNull();
  });
});

// ── 正常复盘流程 ──────────────────────────────────────────

describe('DreamReviewService — 正常复盘', () => {
  beforeEach(() => {
    const db = makeDb([
      { id: 'c1', title: '项目启动会', summary: '讨论了项目范围', mode: 'conversation_record', source: 'mobile' },
      { id: 'c2', title: '与客户通话', summary: null, mode: 'record_note', source: 'mobile' },
      { id: 'c3', title: null, summary: null, mode: 'casual_chat', source: 'xiaozhi_device' },
    ]);
    // 第二次 execute 是 UPDATE summary，也要 mock
    db.execute
      .mockResolvedValueOnce({ rows: [
        { id: 'c1', title: '项目启动会', summary: '讨论了项目范围', mode: 'conversation_record', source: 'mobile' },
        { id: 'c2', title: '与客户通话', summary: null, mode: 'record_note', source: 'mobile' },
        { id: 'c3', title: null, summary: null, mode: 'casual_chat', source: 'xiaozhi_device' },
      ]})
      .mockResolvedValue({ rows: [] });
    vi.mocked(getDatabase).mockReturnValue(db as any);

    vi.mocked(conversationService.getSegments)
      .mockResolvedValueOnce([{ text: '确认项目范围', speaker: 'MASTER', speakerType: 'user' }] as any)
      .mockResolvedValue([]);

    mockComplete.mockResolvedValue({ content: AI_RESPONSE });
  });

  it('聚合对话并调用 AI', async () => {
    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).not.toBeNull();
    expect(result!.sourcedFrom).toBe(3);
  });

  it('创建 dream_review Conversation', async () => {
    await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(conversationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER,
        source: 'dream_review',
        mode: 'reflection',
      }),
    );
  });

  it('写入 appendSegment 和 finish', async () => {
    await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(conversationService.appendSegment).toHaveBeenCalled();
    expect(conversationService.finish).toHaveBeenCalledWith('conv-review-001', OWNER);
  });
});

// ── AI 响应解析 ───────────────────────────────────────────

describe('DreamReviewService — AI 响应解析', () => {
  beforeEach(() => {
    const db = makeDb([
      { id: 'c1', title: '测试对话', summary: '内容', mode: 'record_note', source: 'mobile' },
    ]);
    db.execute
      .mockResolvedValueOnce({ rows: [{ id: 'c1', title: '测试对话', summary: '内容', mode: 'record_note', source: 'mobile' }] })
      .mockResolvedValue({ rows: [] });
    vi.mocked(getDatabase).mockReturnValue(db as any);
    vi.mocked(conversationService.getSegments).mockResolvedValue([
      { text: '一些对话内容', speaker: 'MASTER', speakerType: 'user' },
    ] as any);
  });

  it('AI 返回有效 JSON 时创建对应候选项', async () => {
    mockComplete.mockResolvedValue({ content: AI_RESPONSE });

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).not.toBeNull();
    // missed_tasks 2 + project_risks 1 = 3 候选
    expect(result!.missedTaskCount).toBe(2);
    expect(result!.projectRiskCount).toBe(1);
    expect(result!.relationshipSignalCount).toBe(0);
    expect(result!.memoryConflictCount).toBe(0);
    expect(result!.totalCandidates).toBe(3);
  });

  it('AI 返回非 JSON 时仍完成复盘（候选项为空）', async () => {
    mockComplete.mockResolvedValue({ content: '无法解析的内容' });

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).not.toBeNull();
    expect(result!.totalCandidates).toBe(0);
  });

  it('AI 调用抛出异常时仍完成复盘（容错）', async () => {
    mockComplete.mockRejectedValue(new Error('timeout'));

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    expect(result).not.toBeNull();
    expect(result!.totalCandidates).toBe(0);
  });

  it('候选项写入失败时其余正常继续', async () => {
    mockComplete.mockResolvedValue({ content: AI_RESPONSE });
    vi.mocked(conversationService.addCandidate)
      .mockRejectedValueOnce(new Error('db fail'))
      .mockResolvedValue({ id: 'cand-ok' } as any);

    const result = await dreamReviewService.runReview(OWNER, TARGET_DATE);

    // 第 1 条失败，第 2、3 条成功
    expect(result!.totalCandidates).toBe(2);
  });
});

// ── getLatestReview / getReviewHistory ────────────────────

describe('DreamReviewService — 查询', () => {
  it('getLatestReview 返回最新记录', async () => {
    const row = { id: 'conv-r-001', title: '梦境复盘 — 2026-05-01', summary: 'x', started_at: new Date().toISOString(), created_at: new Date().toISOString() };
    vi.mocked(getDatabase).mockReturnValue(makeDb([row]) as any);

    const result = await dreamReviewService.getLatestReview(OWNER);

    expect(result).toEqual(row);
  });

  it('getLatestReview 无记录返回 null', async () => {
    vi.mocked(getDatabase).mockReturnValue(makeDb([]) as any);

    const result = await dreamReviewService.getLatestReview(OWNER);

    expect(result).toBeNull();
  });

  it('getReviewHistory 返回列表', async () => {
    const rows = [
      { id: 'r1', title: '复盘1', summary: 's1', started_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: 'r2', title: '复盘2', summary: 's2', started_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ];
    vi.mocked(getDatabase).mockReturnValue(makeDb(rows) as any);

    const result = await dreamReviewService.getReviewHistory(OWNER, 5);

    expect(result).toHaveLength(2);
  });

  it('DB 不可用时 getLatestReview 返回 null', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await dreamReviewService.getLatestReview(OWNER);
    expect(result).toBeNull();
  });

  it('DB 不可用时 getReviewHistory 返回空数组', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await dreamReviewService.getReviewHistory(OWNER);
    expect(result).toEqual([]);
  });
});
