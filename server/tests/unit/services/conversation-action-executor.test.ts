import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 外部依赖，避免真实 DB 连接
vi.mock('../../../services/task-orchestrator', () => ({
  taskOrchestrator: {
    createTask: vi.fn(),
  },
}));

vi.mock('../../../services/pc-agent/PCAgent', () => ({
  pcAgent: {
    executeTask: vi.fn(),
  },
}));

vi.mock('../../../storage/adapter', () => ({
  storageAdapter: {
    createProject: vi.fn(),
    createVaultItem: vi.fn(),
    searchVaultByIntent: vi.fn(),
    createPerson: vi.fn(),
  },
}));

vi.mock('../../../db', () => ({
  getDatabase: vi.fn(() => null),
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { ConversationActionExecutor } from '../../../services/assistant/ConversationActionExecutor';
import { storageAdapter } from '../../../storage/adapter';
import { taskOrchestrator } from '../../../services/task-orchestrator';
import { pcAgent } from '../../../services/pc-agent/PCAgent';
import { getDatabase } from '../../../db';
import type { AssistantResponse, DraftItem } from '../../../services/assistant/HybridAssistant';

const mockProject = { id: 'proj-1', title: '测试项目', status: 'PENDING_REVIEW' };
const mockTask = { id: 'task-1', name: '测试任务', status: 'PENDING' };
const mockVaultItem = { id: 'vault-1', fileName: '重要事项', semanticTags: ['测试'] };
const mockPerson = {
  id: 'person-1',
  name: '张三',
  role: '产品经理',
  organization: '星河科技',
  approvalStatus: 'PENDING',
};

interface ExecutorTestInternals {
  pending: Map<string, { action: string; actionParams: Record<string, unknown>; userId: string; expiresAt: number }>;
  drafts: Map<
    string,
    {
      items: Array<{ action: string; actionParams: Record<string, unknown> }>;
      userId: string;
      expiresAt: number;
    }
  >;
}

function makeResponse(overrides: Partial<AssistantResponse> = {}): AssistantResponse {
  return {
    id: 'resp-123',
    handler: 'ai',
    type: 'execute',
    message: '好的',
    ...overrides,
  };
}

describe('ConversationActionExecutor', () => {
  let executor: ConversationActionExecutor;

  beforeEach(() => {
    executor = new ConversationActionExecutor();
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockReturnValue(null);
    vi.mocked(storageAdapter.createProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageAdapter.createVaultItem).mockResolvedValue(mockVaultItem as any);
    vi.mocked(storageAdapter.searchVaultByIntent).mockResolvedValue([mockVaultItem as any]);
    vi.mocked(storageAdapter.createPerson).mockResolvedValue(mockPerson as any);
    vi.mocked(taskOrchestrator.createTask).mockResolvedValue(mockTask as any);
    vi.mocked(pcAgent.executeTask).mockResolvedValue({
      success: true,
      type: 'custom',
      message: 'PC task completed',
    } as any);
  });

  describe('execute()', () => {
    it('returns null when type is not execute', async () => {
      const response = makeResponse({ type: 'confirm', action: 'create_project' });
      const result = await executor.execute(response, 'user-1');
      expect(result).toBeNull();
      expect(storageAdapter.createProject).not.toHaveBeenCalled();
    });

    it('returns null when no action', async () => {
      const response = makeResponse({ type: 'execute' });
      const result = await executor.execute(response, 'user-1');
      expect(result).toBeNull();
    });

    it('creates project and returns success result', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'create_project',
        actionParams: { title: '测试项目', description: '描述' },
      });
      const result = await executor.execute(response, 'user-1');

      expect(storageAdapter.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ title: '测试项目', description: '描述' }),
      );
      expect(result).toMatchObject({
        success: true,
        action: 'create_project',
        entityType: 'project',
        entityId: 'proj-1',
      });
    });

    it('creates project with default title when title missing', async () => {
      const response = makeResponse({ type: 'execute', action: 'create_project', actionParams: {} });
      await executor.execute(response, 'user-1');
      expect(storageAdapter.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ title: '新项目' }),
      );
    });

    it('creates task and returns success result', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'create_task',
        actionParams: { name: '测试任务', triggerType: 'MANUAL' },
      });
      const result = await executor.execute(response, 'user-1');

      expect(taskOrchestrator.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: '测试任务' }),
      );
      expect(result).toMatchObject({
        success: true,
        action: 'create_task',
        entityType: 'task',
        entityId: 'task-1',
      });
    });

    it('executes a PC task and returns a phone-visible result', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'pc_execute',
        actionParams: {
          type: 'custom',
          description: '整理桌面文件',
          params: {},
        },
      });
      const result = await executor.execute(response, 'user-1');

      expect(pcAgent.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          description: '整理桌面文件',
          priority: 5,
        }),
      );
      expect(result).toMatchObject({
        success: true,
        action: 'pc_execute',
        entityType: 'pc_task',
        entityData: {
          message: 'PC task completed',
        },
      });
    });

    it('creates CRON task with expression and timezone in trigger config', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'create_task',
        actionParams: {
          name: '每周战报',
          triggerType: 'CRON',
          cronExpression: '0 9 * * 1',
          cronTimezone: 'Asia/Shanghai',
        },
      });

      const result = await executor.execute(response, 'user-1');

      expect(taskOrchestrator.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '每周战报',
          trigger: {
            type: 'CRON',
            config: {
              expression: '0 9 * * 1',
              timezone: 'Asia/Shanghai',
            },
          },
        }),
      );
      expect(result?.entityData).toMatchObject({
        triggerType: 'CRON',
        cronExpression: '0 9 * * 1',
      });
    });

    it('returns failure result when task creation throws', async () => {
      vi.mocked(taskOrchestrator.createTask).mockRejectedValue(new Error('scheduler unavailable'));
      const response = makeResponse({
        type: 'execute',
        action: 'create_task',
        actionParams: { name: '失败任务' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'create_task' });
    });

    it('saves memory to vault and returns success result', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'save_memory',
        actionParams: { content: '重要事项', tags: ['测试'] },
      });
      const result = await executor.execute(response, 'user-1');

      expect(storageAdapter.createVaultItem).toHaveBeenCalledWith({
        category: 'MEMORY',
        fileName: '重要事项',
        semanticTags: ['测试'],
        semanticIndex: '重要事项',
        privacyZone: 'ZONE_GREEN',
      });
      expect(result).toMatchObject({
        success: true,
        action: 'save_memory',
        entityType: 'memory',
        entityId: 'vault-1',
        entityData: { id: 'vault-1', fileName: '重要事项', tags: ['测试'] },
      });
    });

    it('saves memory without tags and truncates long file names for vault display', async () => {
      const longContent = 'a'.repeat(120);
      const response = makeResponse({
        type: 'execute',
        action: 'save_memory',
        actionParams: { content: longContent, tags: 'not-an-array' },
      });

      await executor.execute(response, 'user-1');

      expect(storageAdapter.createVaultItem).toHaveBeenCalledWith({
        category: 'MEMORY',
        fileName: 'a'.repeat(80),
        semanticTags: undefined,
        semanticIndex: longContent,
        privacyZone: 'ZONE_GREEN',
      });
    });

    it('returns failure result when save_memory content is empty', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'save_memory',
        actionParams: { content: '' },
      });
      const result = await executor.execute(response, 'user-1');
      expect(result).toMatchObject({ success: false, action: 'save_memory' });
      expect(storageAdapter.createVaultItem).not.toHaveBeenCalled();
    });

    it('returns failure result when memory storage throws', async () => {
      vi.mocked(storageAdapter.createVaultItem).mockRejectedValue(new Error('vault unavailable'));
      const response = makeResponse({
        type: 'execute',
        action: 'save_memory',
        actionParams: { content: '重要事项' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'save_memory' });
    });

    it('searches vault and returns a capped result list with total count', async () => {
      const items = Array.from({ length: 12 }, (_, index) => ({
        id: `vault-${index}`,
        fileName: `合同-${index}.pdf`,
        category: 'DOCUMENT',
        semanticTags: ['合同'],
        privacyZone: 'ZONE_GREEN',
        createdAt: new Date('2026-05-10T00:00:00Z'),
      }));
      vi.mocked(storageAdapter.searchVaultByIntent).mockResolvedValue(items as any);
      const response = makeResponse({
        type: 'execute',
        action: 'search_vault',
        actionParams: { query: '合同' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(storageAdapter.searchVaultByIntent).toHaveBeenCalledWith('合同');
      expect(result).toMatchObject({ success: true, action: 'search_vault' });
      expect(result?.entityData?.totalFound).toBe(12);
      expect(result?.entityData?.results).toHaveLength(10);
    });

    it('returns failure result when search_vault query is empty', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'search_vault',
        actionParams: { query: '   ' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'search_vault' });
      expect(storageAdapter.searchVaultByIntent).not.toHaveBeenCalled();
    });

    it('returns failure result when vault search throws', async () => {
      vi.mocked(storageAdapter.searchVaultByIntent).mockRejectedValue(new Error('search failed'));
      const response = makeResponse({
        type: 'execute',
        action: 'search_vault',
        actionParams: { query: '合同' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'search_vault' });
    });

    it('creates person with pending approval and blue-zone access', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'create_person',
        actionParams: { name: '张三', role: '产品经理', organization: '星河科技' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(storageAdapter.createPerson).toHaveBeenCalledWith({
        name: '张三',
        role: '产品经理',
        organization: '星河科技',
        addedBy: 'user-1',
        approvalStatus: 'PENDING',
        accessLevel: 'ZONE_BLUE',
      });
      expect(result).toMatchObject({
        success: true,
        action: 'create_person',
        entityType: 'memory',
        entityId: 'person-1',
      });
    });

    it('returns failure result when create_person name is missing', async () => {
      const response = makeResponse({
        type: 'execute',
        action: 'create_person',
        actionParams: { name: '   ' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'create_person' });
      expect(storageAdapter.createPerson).not.toHaveBeenCalled();
    });

    it('returns failure result when person creation throws', async () => {
      vi.mocked(storageAdapter.createPerson).mockRejectedValue(new Error('crm unavailable'));
      const response = makeResponse({
        type: 'execute',
        action: 'create_person',
        actionParams: { name: '张三' },
      });

      const result = await executor.execute(response, 'user-1');

      expect(result).toMatchObject({ success: false, action: 'create_person' });
    });

    it('returns failure result when storageAdapter throws', async () => {
      vi.mocked(storageAdapter.createProject).mockRejectedValue(new Error('DB error'));
      const response = makeResponse({
        type: 'execute',
        action: 'create_project',
        actionParams: { title: 'X' },
      });
      const result = await executor.execute(response, 'user-1');
      expect(result).toMatchObject({ success: false, action: 'create_project' });
    });

    it('returns null for unknown action', async () => {
      const response = makeResponse({ type: 'execute', action: 'unknown_action', actionParams: {} });
      const result = await executor.execute(response, 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('storePending() + executeByResponseId()', () => {
    it('stores confirm action and executes on approval', async () => {
      const response = makeResponse({
        type: 'confirm',
        action: 'create_project',
        actionParams: { title: '待确认项目' },
      });

      executor.storePending('resp-123', response, 'user-1');
      const result = await executor.executeByResponseId('resp-123');

      expect(result).toMatchObject({ success: true, action: 'create_project', entityType: 'project' });
      expect(storageAdapter.createProject).toHaveBeenCalled();
    });

    it('returns null for unknown responseId', async () => {
      const result = await executor.executeByResponseId('nonexistent-id');
      expect(result).toBeNull();
    });

    it('does not store execute-type response', async () => {
      const response = makeResponse({ type: 'execute', action: 'create_task', actionParams: {} });
      executor.storePending('resp-x', response, 'user-1');
      const result = await executor.executeByResponseId('resp-x');
      expect(result).toBeNull();
    });

    it('clears pending after first executeByResponseId call', async () => {
      const response = makeResponse({
        type: 'confirm',
        action: 'create_task',
        actionParams: { name: '任务A' },
      });
      executor.storePending('resp-456', response, 'user-1');
      await executor.executeByResponseId('resp-456');
      const secondCall = await executor.executeByResponseId('resp-456');
      expect(secondCall).toBeNull();
      expect(taskOrchestrator.createTask).toHaveBeenCalledTimes(1);
    });

    it('returns expired result and skips execution when pending action is stale', async () => {
      const internals = executor as unknown as ExecutorTestInternals;
      internals.pending.set('expired-pending', {
        action: 'create_project',
        actionParams: { title: '过期待办' },
        userId: 'user-1',
        expiresAt: Date.now() - 1,
      });

      const result = await executor.executeByResponseId('expired-pending');

      expect(result).toMatchObject({
        success: false,
        action: 'unknown',
        errorMessage: 'pending action expired',
      });
      expect(storageAdapter.createProject).not.toHaveBeenCalled();
      expect(internals.pending.has('expired-pending')).toBe(false);
    });
  });

  describe('storeDraft() + executeDraftByResponseId()', () => {
    it('stores draft items and executes them in order on confirmation', async () => {
      const draftItems: DraftItem[] = [
        {
          id: 'draft-project',
          action: 'create_project',
          actionParams: { title: '草案项目' },
          summary: '创建项目',
        },
        {
          id: 'draft-memory',
          action: 'save_memory',
          actionParams: { content: '草案记忆' },
          summary: '保存记忆',
        },
      ];

      await executor.storeDraft('draft-123', draftItems, 'user-1');
      const results = await executor.executeDraftByResponseId('draft-123');

      expect(results).toHaveLength(2);
      expect(results?.[0]).toMatchObject({ success: true, action: 'create_project' });
      expect(results?.[1]).toMatchObject({ success: true, action: 'save_memory' });
      expect(storageAdapter.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ title: '草案项目' }),
      );
      expect(storageAdapter.createVaultItem).toHaveBeenCalledWith(
        expect.objectContaining({ semanticIndex: '草案记忆' }),
      );
    });

    it('filters unknown draft actions while preserving valid results', async () => {
      const draftItems: DraftItem[] = [
        {
          id: 'draft-unknown',
          action: 'unsupported_action',
          actionParams: {},
          summary: '未知动作',
        },
        {
          id: 'draft-person',
          action: 'create_person',
          actionParams: { name: '张三' },
          summary: '创建联系人',
        },
      ];

      await executor.storeDraft('draft-filter', draftItems, 'user-1');
      const results = await executor.executeDraftByResponseId('draft-filter');

      expect(results).toHaveLength(1);
      expect(results?.[0]).toMatchObject({ success: true, action: 'create_person' });
    });

    it('returns null for unknown draft responseId', async () => {
      await expect(executor.executeDraftByResponseId('missing-draft')).resolves.toBeNull();
    });

    it('returns expired result and skips execution when draft is stale', async () => {
      const internals = executor as unknown as ExecutorTestInternals;
      internals.drafts.set('expired-draft', {
        items: [{ action: 'create_project', actionParams: { title: '过期草案' } }],
        userId: 'user-1',
        expiresAt: Date.now() - 1,
      });

      const results = await executor.executeDraftByResponseId('expired-draft');

      expect(results).toEqual([
        { success: false, action: 'draft', errorMessage: 'draft expired' },
      ]);
      expect(storageAdapter.createProject).not.toHaveBeenCalled();
      expect(internals.drafts.has('expired-draft')).toBe(false);
    });
  });

  describe('lifecycle helpers without DB', () => {
    it('hydrate returns safely when database is unavailable', async () => {
      await expect(executor.hydrate()).resolves.toBeUndefined();
      expect(getDatabase).toHaveBeenCalled();
    });

    it('gcExpired returns safely when database is unavailable', async () => {
      await expect(executor.gcExpired()).resolves.toBeUndefined();
      expect(getDatabase).toHaveBeenCalled();
    });
  });
});
