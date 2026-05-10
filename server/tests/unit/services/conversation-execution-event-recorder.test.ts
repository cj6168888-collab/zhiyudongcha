import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantResponse } from '../../../services/assistant/HybridAssistant';
import type { ExecutionResult } from '../../../services/assistant/ConversationActionExecutor';

vi.mock('../../../storage', () => ({
  storage: {
    createAuditLog: vi.fn(),
    createEvolutionEvent: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { storage } from '../../../storage';
import { ConversationExecutionEventRecorder } from '../../../services/assistant/ConversationExecutionEventRecorder';

function makeResponse(overrides: Partial<AssistantResponse> = {}): AssistantResponse {
  return {
    id: 'resp-1',
    handler: 'ai',
    type: 'execute',
    message: '好的',
    action: 'create_project',
    ...overrides,
  };
}

function makeExecution(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    action: 'create_project',
    entityType: 'project',
    entityId: 'project-1',
    entityData: { id: 'project-1', title: '增长计划' },
    ...overrides,
  };
}

describe('ConversationExecutionEventRecorder', () => {
  let recorder: ConversationExecutionEventRecorder;

  beforeEach(() => {
    recorder = new ConversationExecutionEventRecorder();
    vi.clearAllMocks();
    vi.mocked(storage.createAuditLog).mockResolvedValue({ id: 'audit-1' } as any);
    vi.mocked(storage.createEvolutionEvent).mockResolvedValue({ id: 'event-1' } as any);
  });

  it('records successful assistant execution to audit and evolution streams', async () => {
    await recorder.record({
      response: makeResponse(),
      execution: makeExecution(),
      userId: 'user-1',
      source: 'assistant_chat',
    });

    expect(storage.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ASSISTANT_CREATE_PROJECT',
        actor: 'user-1',
        targetType: 'project',
        targetId: 'project-1',
        result: 'SUCCESS',
      }),
    );
    expect(storage.createEvolutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'HybridAssistant',
        eventType: 'ASSISTANT_EXECUTION_SUCCEEDED',
        triggeredBy: 'user-1',
        deltaDescription: '对话动作已执行：create_project',
      }),
    );
  });

  it('records failed assistant execution without throwing', async () => {
    await recorder.record({
      response: makeResponse({ id: 'resp-failed' }),
      execution: makeExecution({
        success: false,
        entityType: undefined,
        entityId: undefined,
        errorMessage: 'DB error',
      }),
      userId: 'user-1',
      source: 'assistant_authorize',
    });

    expect(storage.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'assistant_action',
        targetId: 'resp-failed',
        result: 'FAILURE',
      }),
    );
    expect(storage.createEvolutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ASSISTANT_EXECUTION_FAILED',
        deltaDescription: '对话动作执行失败：create_project',
      }),
    );
  });

  it('swallows logging persistence errors', async () => {
    vi.mocked(storage.createAuditLog).mockRejectedValue(new Error('audit down'));
    vi.mocked(storage.createEvolutionEvent).mockRejectedValue(new Error('event down'));

    await expect(recorder.record({
      response: makeResponse(),
      execution: makeExecution(),
      userId: 'user-1',
      source: 'assistant_chat',
    })).resolves.toBeUndefined();
  });
});
