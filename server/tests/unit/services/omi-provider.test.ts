import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../db', () => ({ getDatabase: vi.fn() }));
vi.mock('../../../services/conversation/ConversationService', () => ({
  conversationService: {
    appendSegment: vi.fn().mockResolvedValue({ id: 'seg-001' }),
    addCandidate: vi.fn().mockResolvedValue({ id: 'cand-001' }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

import { getDatabase } from '../../../db';
import { omiProvider, OmiExportPayload } from '../../../services/providers/OmiProvider';
import { conversationService } from '../../../services/conversation/ConversationService';

const OWNER = 'user-001';

// 辅助：mock 私有方法 setSyncStatus 为 no-op，existsByExternalId 为 false
function stubInternals(existsResult = false) {
  vi.spyOn(omiProvider as any, 'setSyncStatus').mockResolvedValue(undefined);
  vi.spyOn(omiProvider as any, 'existsByExternalId').mockResolvedValue(existsResult);
}

// DB mock：INSERT conversations 返回 id
function makeInsertDb() {
  return { execute: vi.fn().mockResolvedValue({ rows: [{ id: 'conv-001' }], rowCount: 1 }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Memory 导入 ──────────────────────────────────────

describe('OmiProvider — Memory 导入', () => {
  it('导入单条 memory：生成 Conversation + MemoryCandidate + TaskCandidate', async () => {
    stubInternals(false); // 未存在，可以导入
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      memories: [{
        id: 'omi-mem-001',
        content: '和王总讨论了Q2目标',
        created_at: '2026-04-01T10:00:00Z',
        structured: {
          title: 'Q2 目标讨论',
          overview: '主要讨论销售增长',
          action_items: [{ description: '整理会议纪要' }],
        },
      }],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.memoriesImported).toBe(1);
    expect(result.memoriesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const candidateCalls = vi.mocked(conversationService.addCandidate).mock.calls;
    expect(candidateCalls).toHaveLength(2);
    expect(candidateCalls[0][0].candidateType).toBe('memory');
    expect(candidateCalls[1][0].candidateType).toBe('task');
    expect(candidateCalls[1][0].content.title).toBe('整理会议纪要');
  });

  it('memory 无 action_items：只生成 MemoryCandidate', async () => {
    stubInternals(false);
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      memories: [{ id: 'omi-mem-002', content: '一段简单的思考' }],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.memoriesImported).toBe(1);
    expect(vi.mocked(conversationService.addCandidate)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(conversationService.addCandidate).mock.calls[0][0].candidateType).toBe('memory');
  });

  it('memory source 标记为 omi，remoteId 保存在 content 中', async () => {
    stubInternals(false);
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      memories: [{ id: 'omi-remote-123', content: '测试内容' }],
    };

    await omiProvider.importPayload(OWNER, payload);

    const call = vi.mocked(conversationService.addCandidate).mock.calls[0][0];
    expect(call.content.source).toBe('omi');
    expect(call.content.remoteId).toBe('omi-remote-123');
  });
});

// ── Conversation 导入 ────────────────────────────────

describe('OmiProvider — Conversation 导入', () => {
  it('导入含 transcript 和 action_items 的对话', async () => {
    stubInternals(false);
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      conversations: [{
        id: 'omi-conv-001',
        started_at: '2026-04-05T14:00:00Z',
        title: '项目启动会',
        summary: '讨论了项目范围',
        transcript: [
          { speaker: 'MASTER', text: '确认范围', start: 0, end: 5 },
          { speaker: 'GUEST_1', text: '整理需求文档', start: 5.1, end: 9 },
        ],
        action_items: [
          { description: '整理需求文档', completed: false },
          { description: '确认里程碑', completed: false },
        ],
      }],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.conversationsImported).toBe(1);
    expect(result.conversationsSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    // 2 个 segment（来自 transcript）
    expect(vi.mocked(conversationService.appendSegment)).toHaveBeenCalledTimes(2);

    // 2 个 task 候选（action_items）
    const candidateCalls = vi.mocked(conversationService.addCandidate).mock.calls;
    expect(candidateCalls).toHaveLength(2);
    expect(candidateCalls.every(c => c[0].candidateType === 'task')).toBe(true);
    const titles = candidateCalls.map(c => c[0].content.title);
    expect(titles).toContain('整理需求文档');
    expect(titles).toContain('确认里程碑');
  });

  it('空 transcript 不写入 segment', async () => {
    stubInternals(false);
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      conversations: [{ id: 'omi-conv-no-transcript', title: '无转写对话', transcript: [] }],
    };

    await omiProvider.importPayload(OWNER, payload);

    expect(vi.mocked(conversationService.appendSegment)).not.toHaveBeenCalled();
  });
});

// ── 幂等性 ────────────────────────────────────────────

describe('OmiProvider — 幂等性', () => {
  it('memory 已存在时 skip，不写 DB', async () => {
    stubInternals(true); // existsByExternalId 返回 true
    const db = makeInsertDb();
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const payload: OmiExportPayload = {
      memories: [{ id: 'omi-mem-dup', content: '重复内容' }],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.memoriesSkipped).toBe(1);
    expect(result.memoriesImported).toBe(0);
    expect(vi.mocked(conversationService.addCandidate)).not.toHaveBeenCalled();
    // INSERT 不被调用（existsByExternalId 被 stub 拦截，db.execute 不应被调用）
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('conversation 已存在时 skip', async () => {
    stubInternals(true);
    const db = makeInsertDb();
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const payload: OmiExportPayload = {
      conversations: [{ id: 'omi-conv-dup', title: '重复对话' }],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.conversationsSkipped).toBe(1);
    expect(result.conversationsImported).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('混合：部分已存在、部分新增', async () => {
    // 第 1 次调用 existsByExternalId 返回 true（skip），第 2 次返回 false（import）
    let callCount = 0;
    vi.spyOn(omiProvider as any, 'setSyncStatus').mockResolvedValue(undefined);
    vi.spyOn(omiProvider as any, 'existsByExternalId').mockImplementation(async () => {
      callCount++;
      return callCount === 1; // 第一条已存在，第二条不存在
    });
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const payload: OmiExportPayload = {
      memories: [
        { id: 'omi-mem-old', content: '旧记忆' },
        { id: 'omi-mem-new', content: '新记忆' },
      ],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.memoriesSkipped).toBe(1);
    expect(result.memoriesImported).toBe(1);
  });
});

// ── 错误隔离 ──────────────────────────────────────────

describe('OmiProvider — 错误隔离', () => {
  it('单条 memory DB 写入失败，其余正常继续', async () => {
    vi.spyOn(omiProvider as any, 'setSyncStatus').mockResolvedValue(undefined);

    let existsCallCount = 0;
    vi.spyOn(omiProvider as any, 'existsByExternalId').mockResolvedValue(false);

    let insertCallCount = 0;
    vi.mocked(getDatabase).mockReturnValue({
      execute: vi.fn().mockImplementation(async () => {
        insertCallCount++;
        if (insertCallCount === 1) throw new Error('DB write failed');
        return { rows: [{ id: 'conv-ok' }], rowCount: 1 };
      }),
    } as any);

    const payload: OmiExportPayload = {
      memories: [
        { id: 'omi-mem-fail', content: '失败的记忆' },
        { id: 'omi-mem-ok', content: '正常的记忆' },
      ],
    };

    const result = await omiProvider.importPayload(OWNER, payload);

    expect(result.memoriesImported).toBe(1);
    expect(result.memoriesSkipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('omi-mem-fail');
  });

  it('Omi 不可用时：importPayload 不 throw，返回 errors', async () => {
    vi.spyOn(omiProvider as any, 'setSyncStatus').mockResolvedValue(undefined);
    vi.spyOn(omiProvider as any, 'existsByExternalId').mockRejectedValue(new Error('network error'));

    const payload: OmiExportPayload = {
      memories: [{ id: 'omi-x', content: '测试' }],
    };

    await expect(omiProvider.importPayload(OWNER, payload)).resolves.not.toThrow();
    const result = await omiProvider.importPayload(OWNER, payload);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ── 空 payload ────────────────────────────────────────

describe('OmiProvider — 空 payload', () => {
  it('空 memories/conversations 返回零计数，无错误', async () => {
    stubInternals(false);
    vi.mocked(getDatabase).mockReturnValue(makeInsertDb() as any);

    const result = await omiProvider.importPayload(OWNER, { memories: [], conversations: [] });

    expect(result.memoriesImported).toBe(0);
    expect(result.conversationsImported).toBe(0);
    expect(result.candidatesCreated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
