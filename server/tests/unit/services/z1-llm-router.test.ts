import { beforeEach, describe, expect, it, vi } from 'vitest';

const providerMock = vi.hoisted(() => {
  const makeProvider = (name: string) => ({
    name,
    isAvailable: vi.fn().mockResolvedValue(false),
    chat: vi.fn().mockResolvedValue(null),
  });

  return {
    DEEPSEEK: makeProvider('DEEPSEEK'),
    TONGYI: makeProvider('TONGYI'),
    DOUBAO: makeProvider('DOUBAO'),
    LOCAL_OLLAMA: makeProvider('LOCAL_OLLAMA'),
  };
});

const dbMock = vi.hoisted(() => ({
  preferences: [] as Array<Record<string, unknown>>,
  routingLogs: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../services/llm-providers', () => ({
  providerRegistry: providerMock,
  getAvailableProviders: async () => {
    const entries = await Promise.all(
      Object.entries(providerMock).map(async ([name, provider]) => [
        name,
        await provider.isAvailable(),
      ] as const),
    );
    return entries.filter(([, available]) => available).map(([name]) => name);
  },
}));

vi.mock('../../../db', () => ({
  getDatabase: () => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(dbMock.preferences),
      orderBy: vi.fn().mockResolvedValue(dbMock.routingLogs),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((row) => ({
        returning: vi.fn().mockImplementation(async () => {
          const id = `routing-log-${dbMock.routingLogs.length + 1}`;
          dbMock.routingLogs.push({ id, ...row });
          return [{ id }];
        }),
      })),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
}));

import {
  configureZ1Router,
  getZ1Status,
  routeZ1,
} from '../../../services/z1-llm-router';

function resetProviders() {
  for (const provider of Object.values(providerMock)) {
    provider.isAvailable.mockReset().mockResolvedValue(false);
    provider.chat.mockReset().mockResolvedValue(null);
  }
}

describe('Z1 LLM router', () => {
  beforeEach(() => {
    resetProviders();
    dbMock.preferences = [];
    dbMock.routingLogs = [];
    configureZ1Router({
      primaryBrain: 'TONGYI',
      visionBrain: 'TONGYI',
      fastBrain: 'DOUBAO',
      offlineBrain: 'LOCAL_OLLAMA',
      models: {
        tongyi: 'qwen-max-test',
        doubao: 'doubao-fast-test',
        ollama: 'qwen-local-test',
      },
    });
  });

  it('short-circuits when HP is insufficient and does not call providers', async () => {
    const result = await routeZ1([], '请帮我分析这份合同风险', {
      hpBalance: 0,
      enableLogging: false,
    });

    expect(result.provider).toBe('LOCAL_OLLAMA');
    expect(result.hpCost).toBe(0);
    expect(result.response?.model).toBe('hp-guard');
    expect(providerMock.TONGYI.chat).not.toHaveBeenCalled();
    expect(providerMock.DOUBAO.chat).not.toHaveBeenCalled();
    expect(providerMock.LOCAL_OLLAMA.chat).not.toHaveBeenCalled();
  });

  it('routes critical sensitive content to the offline provider', async () => {
    providerMock.LOCAL_OLLAMA.isAvailable.mockResolvedValue(true);
    providerMock.LOCAL_OLLAMA.chat.mockResolvedValue({
      content: 'local private answer',
      model: 'qwen-local-test',
    });

    const result = await routeZ1([], '我的身份证和银行卡账号应该怎么保存？', {
      enableLogging: true,
    });

    expect(result.provider).toBe('LOCAL_OLLAMA');
    expect(result.fallbackUsed).toBe(false);
    expect(result.classification?.shouldForceLocal).toBe(true);
    expect(result.classification?.sensitiveCategories).toEqual(
      expect.arrayContaining(['PERSONAL_ID', 'FINANCIAL']),
    );
    expect(providerMock.LOCAL_OLLAMA.chat).toHaveBeenCalledWith(
      [{ role: 'user', content: '我的身份证和银行卡账号应该怎么保存？' }],
      { model: 'qwen-local-test' },
    );
    expect(dbMock.routingLogs[0]).toMatchObject({
      selectedProvider: 'LOCAL_OLLAMA',
      selectedModel: 'qwen-local-test',
    });
  });

  it('falls back from unavailable primary provider to fast provider', async () => {
    providerMock.TONGYI.isAvailable.mockResolvedValue(false);
    providerMock.DOUBAO.isAvailable.mockResolvedValue(true);
    providerMock.DOUBAO.chat.mockResolvedValue({
      content: 'fast fallback answer',
      model: 'doubao-fast-test',
    });

    const result = await routeZ1([], '帮我分析市场策略并生成报告', {
      enableLogging: false,
    });

    expect(result.provider).toBe('DOUBAO');
    expect(result.fallbackUsed).toBe(true);
    expect(result.response?.content).toBe('fast fallback answer');
    expect(providerMock.TONGYI.chat).not.toHaveBeenCalled();
    expect(providerMock.DOUBAO.chat).toHaveBeenCalledOnce();
  });

  it('honors SPEED_FIRST routing by choosing the fast brain first', async () => {
    providerMock.DOUBAO.isAvailable.mockResolvedValue(true);
    providerMock.DOUBAO.chat.mockResolvedValue({
      content: 'speed answer',
      model: 'doubao-fast-test',
    });

    const result = await routeZ1([], '写一段 TypeScript 函数', {
      routingMode: 'SPEED_FIRST',
      enableLogging: false,
    });

    expect(result.provider).toBe('DOUBAO');
    expect(result.fallbackUsed).toBe(false);
    expect(providerMock.DOUBAO.chat).toHaveBeenCalledWith(
      [{ role: 'user', content: '写一段 TypeScript 函数' }],
      { model: 'doubao-fast-test' },
    );
  });

  it('recommends the highest priority available provider in status', async () => {
    providerMock.DEEPSEEK.isAvailable.mockResolvedValue(true);
    providerMock.LOCAL_OLLAMA.isAvailable.mockResolvedValue(true);

    const status = await getZ1Status();

    expect(status.providers.DEEPSEEK.available).toBe(true);
    expect(status.providers.LOCAL_OLLAMA.available).toBe(true);
    expect(status.recommended).toBe('DEEPSEEK');
    expect(status.sensitiveCategories).toEqual(
      expect.arrayContaining(['FINANCIAL', 'LEGAL', 'HEALTH']),
    );
  });
});
