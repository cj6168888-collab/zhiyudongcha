import { beforeEach, describe, expect, it, vi } from 'vitest';

// AI Provider must be mocked before importing HybridAssistant
const mockChat = vi.hoisted(() => vi.fn());
const mockChatWithMetadata = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/ai-provider', () => ({
  AIProviderChain: function (this: any) {
    this.chat = mockChat;
    this.chatWithMetadata = mockChatWithMetadata;
  },
}));

import { hybridAssistant, type UserMessage } from '../../../services/assistant/HybridAssistant';

function message(content: string): UserMessage {
  return {
    id: `msg-${Math.random()}`,
    content,
    type: 'text',
    source: 'app',
    timestamp: new Date(),
  };
}

function draftJson(items: Array<{ action: string; label: string; params: Record<string, unknown> }>) {
  return JSON.stringify(items);
}

function mockFallbackAiResponse(content: string) {
  mockChatWithMetadata.mockResolvedValue({
    content,
    provider: 'deepseek',
    model: 'deepseek-chat',
    latencyMs: 10,
  });
}

describe('HybridAssistant structured draft (阶段一)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 多实体检测 ─────────────────────────────────────────────────────────────

  it('returns type=draft for project + task combination', async () => {
    mockChat.mockResolvedValue(
      draftJson([
        { action: 'create_project', label: '创建项目：智能客服系统', params: { title: '智能客服系统', description: '3个月完成' } },
        { action: 'create_task', label: '创建任务：需求文档', params: { name: '需求文档', description: '输出PRD', triggerType: 'MANUAL' } },
      ]),
    );

    const response = await hybridAssistant.processMessage(
      message('帮我创建一个项目，名字叫智能客服系统，同时创建一个任务叫需求文档'),
    );

    expect(response.type).toBe('draft');
    expect(response.draftItems).toHaveLength(2);
    expect(response.draftItems![0].action).toBe('create_project');
    expect(response.draftItems![1].action).toBe('create_task');
  });

  it('returns type=draft for project + person combination', async () => {
    mockChat.mockResolvedValue(
      draftJson([
        { action: 'create_project', label: '创建项目：增长平台', params: { title: '增长平台', description: '' } },
        { action: 'create_person', label: '添加联系人：张总', params: { name: '张总', role: '总裁', organization: 'ABC公司' } },
      ]),
    );

    const response = await hybridAssistant.processMessage(
      message('帮我创建项目增长平台，并把张总添加到联系人，他是ABC公司总裁'),
    );

    expect(response.type).toBe('draft');
    expect(response.draftItems).toHaveLength(2);
    const person = response.draftItems!.find(i => i.action === 'create_person');
    expect(person?.actionParams.name).toBe('张总');
  });

  it('returns type=draft for task + memory combination', async () => {
    mockChat.mockResolvedValue(
      draftJson([
        { action: 'create_task', label: '创建任务：整理发布清单', params: { name: '整理发布清单', description: '核对所有条目', triggerType: 'MANUAL' } },
        { action: 'save_memory', label: '记住：客户更关注交付确定性', params: { content: '客户更关注交付确定性' } },
      ]),
    );

    const response = await hybridAssistant.processMessage(
      message('创建一个任务整理发布清单，记住客户更关注交付确定性'),
    );

    expect(response.type).toBe('draft');
    expect(response.draftItems).toHaveLength(2);
  });

  it('draft message includes item count', async () => {
    mockChat.mockResolvedValue(
      draftJson([
        { action: 'create_project', label: '创建项目：P1', params: { title: 'P1', description: '' } },
        { action: 'create_task', label: '创建任务：T1', params: { name: 'T1', description: '', triggerType: 'MANUAL' } },
      ]),
    );

    const response = await hybridAssistant.processMessage(
      message('新建项目P1，同时添加任务T1'),
    );

    expect(response.message).toContain('2');
  });

  // ── 单实体不触发草案 ───────────────────────────────────────────────────────

  it('does NOT return type=draft for single project creation', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我创建一个项目，名字叫R1验收项目'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_project');
    // AI should not have been called for this single-entity direct match
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('does NOT return type=draft for single task creation', async () => {
    const response = await hybridAssistant.processMessage(
      message('创建一个任务，名字叫跟进合同盖章'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_task');
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('does NOT return type=draft for single person creation', async () => {
    const response = await hybridAssistant.processMessage(
      message('添加联系人张三，职位是产品经理'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_person');
    expect(mockChat).not.toHaveBeenCalled();
  });

  // ── AI 解析失败回退 ───────────────────────────────────────────────────────

  it('falls back to AI text response when extraction returns empty array', async () => {
    mockChat.mockResolvedValue('[]');
    mockFallbackAiResponse('[]');

    const response = await hybridAssistant.processMessage(
      message('新建项目X，同时创建任务Y'),
    );

    // Empty array → no valid items → falls back to handleByAI, which also uses mockChat
    // The second call returns '[]' again → falls through to report
    expect(response.type).not.toBe('draft');
  });

  it('falls back gracefully when AI returns invalid JSON', async () => {
    mockChat.mockResolvedValue('这不是JSON');
    mockFallbackAiResponse('这不是JSON');

    const response = await hybridAssistant.processMessage(
      message('新建项目A，并添加任务B'),
    );

    expect(response.type).not.toBe('draft');
    expect(response.id).toBeTruthy();
  });

  // ── 草案条目上限 ───────────────────────────────────────────────────────────

  it('caps draft items at 5 even when AI returns more', async () => {
    mockChat.mockResolvedValue(
      draftJson([
        { action: 'create_project', label: '项目1', params: { title: 'P1', description: '' } },
        { action: 'create_task', label: '任务1', params: { name: 'T1', description: '', triggerType: 'MANUAL' } },
        { action: 'create_task', label: '任务2', params: { name: 'T2', description: '', triggerType: 'MANUAL' } },
        { action: 'create_person', label: '联系人1', params: { name: '甲' } },
        { action: 'save_memory', label: '记忆1', params: { content: 'C1' } },
        { action: 'save_memory', label: '记忆2', params: { content: 'C2' } },
      ]),
    );

    const response = await hybridAssistant.processMessage(
      message('新建项目P1，添加任务T1、T2，联系人甲，记忆C1、C2'),
    );

    if (response.type === 'draft') {
      expect(response.draftItems!.length).toBeLessThanOrEqual(5);
    }
  });
});
