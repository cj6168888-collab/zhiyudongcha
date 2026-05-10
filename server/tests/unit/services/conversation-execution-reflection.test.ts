import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage', () => ({
  storage: {
    getEvolutionEvents: vi.fn(),
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
import { ConversationExecutionReflectionService } from '../../../services/assistant/ConversationExecutionReflectionService';

describe('ConversationExecutionReflectionService', () => {
  let service: ConversationExecutionReflectionService;

  beforeEach(() => {
    service = new ConversationExecutionReflectionService();
    vi.clearAllMocks();
  });

  it('summarizes assistant execution events for dream review', () => {
    const reflection = service.summarize([
      {
        id: 'event-1',
        sourceModule: 'HybridAssistant',
        eventType: 'ASSISTANT_EXECUTION_SUCCEEDED',
        newValue: { action: 'create_project' },
        createdAt: new Date(),
      },
      {
        id: 'event-2',
        sourceModule: 'HybridAssistant',
        eventType: 'ASSISTANT_EXECUTION_FAILED',
        newValue: { action: 'save_memory', errorMessage: 'content is empty' },
        createdAt: new Date(),
      },
    ] as any);

    expect(reflection).toMatchObject({
      total: 2,
      succeeded: 1,
      failed: 1,
      actionCounts: {
        create_project: 1,
        save_memory: 1,
      },
      failureReasons: ['content is empty'],
    });
    expect(reflection.patterns).toContain('对话执行闭环运行 2 次，成功 1 次，失败 1 次');
    expect(reflection.recommendations[0]).toContain('失败动作');
  });

  it('filters events by date and HybridAssistant source', async () => {
    const targetDate = new Date('2026-04-29T00:00:00.000Z');
    const nextDay = new Date('2026-04-30T00:00:00.000Z');

    vi.mocked(storage.getEvolutionEvents).mockResolvedValue([
      {
        id: 'event-in-range',
        sourceModule: 'HybridAssistant',
        eventType: 'ASSISTANT_EXECUTION_SUCCEEDED',
        newValue: { action: 'create_task' },
        createdAt: new Date('2026-04-29T12:00:00.000Z'),
      },
      {
        id: 'event-other-module',
        sourceModule: 'Other',
        eventType: 'ASSISTANT_EXECUTION_SUCCEEDED',
        newValue: { action: 'create_project' },
        createdAt: new Date('2026-04-29T12:00:00.000Z'),
      },
      {
        id: 'event-out-of-range',
        sourceModule: 'HybridAssistant',
        eventType: 'ASSISTANT_EXECUTION_SUCCEEDED',
        newValue: { action: 'save_memory' },
        createdAt: new Date('2026-04-30T12:00:00.000Z'),
      },
    ] as any);

    const reflection = await service.reflectForDate(targetDate, nextDay);

    expect(reflection).toMatchObject({
      total: 1,
      succeeded: 1,
      failed: 0,
      actionCounts: { create_task: 1 },
    });
  });

  it('returns an empty reflection when storage read fails', async () => {
    vi.mocked(storage.getEvolutionEvents).mockRejectedValue(new Error('db down'));

    const reflection = await service.reflectForDate(new Date('2026-04-29T00:00:00.000Z'));

    expect(reflection).toMatchObject({
      total: 0,
      succeeded: 0,
      failed: 0,
      actionCounts: {},
    });
  });
});
