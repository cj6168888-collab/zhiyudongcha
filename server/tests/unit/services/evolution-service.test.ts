import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBroadcast = vi.hoisted(() => vi.fn());
const mockStorage = vi.hoisted(() => ({
  getEvolutionState: vi.fn(),
  updateEvolutionState: vi.fn(),
  createEvolutionEvent: vi.fn(),
  getEvolutionEvents: vi.fn(),
  getSkillCapsules: vi.fn(),
  getAllMemories: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../../websocket', () => ({
  webSocketManager: { broadcast: mockBroadcast },
}));
vi.mock('../../../storage', () => ({ storage: mockStorage }));

import { EvolutionService } from '../../../services/EvolutionService';

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'singleton',
    academicLevel: 'BACHELOR',
    academicXp: 0,
    nextLevelXp: 1000,
    hpBalance: 1000,
    hpMaxBalance: 1000,
    hpTotalConsumed: 0,
    hpTotalRecharged: 0,
    ...overrides,
  };
}

describe('EvolutionService.gainXp', () => {
  let svc: EvolutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new EvolutionService();
    mockStorage.updateEvolutionState.mockImplementation(async (updates: Record<string, unknown>) => ({
      ...makeState(),
      ...updates,
    }));
    mockStorage.createEvolutionEvent.mockResolvedValue({ id: 'evt-1' });
  });

  it('忽略 xp <= 0', async () => {
    await svc.gainXp(0, 'test');
    expect(mockStorage.getEvolutionState).not.toHaveBeenCalled();
  });

  it('普通 XP 增长，不触发升级', async () => {
    mockStorage.getEvolutionState.mockResolvedValue(makeState({ academicXp: 100 }));

    await svc.gainXp(50, 'HP_CONSUME:INTEL_DEEP_SCAN');

    expect(mockStorage.updateEvolutionState).toHaveBeenCalledWith(
      expect.objectContaining({ academicXp: 150, academicLevel: 'BACHELOR' }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith('EVOLUTION_UPDATE', expect.objectContaining({
      levelUp: null,
      xpGained: 50,
      totalXp: 150,
    }));
  });

  it('XP 达到阈值时触发 BACHELOR→MASTER 升级', async () => {
    mockStorage.getEvolutionState.mockResolvedValue(makeState({ academicXp: 980 }));

    await svc.gainXp(30, 'HP_CONSUME:INTEL_DEEP_SCAN');

    expect(mockStorage.updateEvolutionState).toHaveBeenCalledWith(
      expect.objectContaining({ academicLevel: 'MASTER', academicXp: 1010 }),
    );
    // 应记录两个事件：XP_GAINED + LEVEL_UP
    expect(mockStorage.createEvolutionEvent).toHaveBeenCalledTimes(2);
    expect(mockStorage.createEvolutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'LEVEL_UP' }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith('EVOLUTION_UPDATE', expect.objectContaining({
      levelUp: { from: 'BACHELOR', to: 'MASTER' },
    }));
  });

  it('XP 达到阈值时触发 MASTER→PHD 升级', async () => {
    mockStorage.getEvolutionState.mockResolvedValue(makeState({
      academicLevel: 'MASTER',
      academicXp: 4990,
      nextLevelXp: 5000,
    }));

    await svc.gainXp(20, 'test');

    expect(mockStorage.updateEvolutionState).toHaveBeenCalledWith(
      expect.objectContaining({ academicLevel: 'PHD', academicXp: 5010 }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith('EVOLUTION_UPDATE', expect.objectContaining({
      levelUp: { from: 'MASTER', to: 'PHD' },
    }));
  });

  it('POSTDOC 级别不再升级', async () => {
    mockStorage.getEvolutionState.mockResolvedValue(makeState({
      academicLevel: 'POSTDOC',
      academicXp: 99999,
      nextLevelXp: 15000,
    }));

    await svc.gainXp(100, 'test');

    expect(mockStorage.updateEvolutionState).toHaveBeenCalledWith(
      expect.objectContaining({ academicLevel: 'POSTDOC', academicXp: 100099 }),
    );
    // 只有 XP_GAINED 事件，没有 LEVEL_UP
    expect(mockStorage.createEvolutionEvent).toHaveBeenCalledTimes(1);
    expect(mockStorage.createEvolutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'XP_GAINED' }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith('EVOLUTION_UPDATE', expect.objectContaining({
      levelUp: null,
    }));
  });

  it('storage 报错时不抛出，静默记录', async () => {
    mockStorage.getEvolutionState.mockRejectedValue(new Error('DB down'));
    await expect(svc.gainXp(10, 'test')).resolves.toBeUndefined();
  });

  it('记录 XP_GAINED 事件，previousValue/newValue 正确', async () => {
    mockStorage.getEvolutionState.mockResolvedValue(makeState({ academicXp: 200 }));

    await svc.gainXp(50, 'HP_CONSUME:DEFAULT');

    expect(mockStorage.createEvolutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'XP_GAINED',
        sourceModule: 'HP_CONSUME:DEFAULT',
        previousValue: { xp: 200, level: 'BACHELOR' },
        newValue: { xp: 250, level: 'BACHELOR' },
      }),
    );
  });
});
