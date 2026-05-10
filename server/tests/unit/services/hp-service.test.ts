import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/EvolutionService', () => ({
  evolutionService: {
    getEvolutionState: vi.fn(),
    updateEvolutionState: vi.fn(),
  },
}));

vi.mock('../../../services/AuditService', () => ({
  auditService: {
    logHPConsumption: vi.fn(),
    logHPRecharge: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { auditService } from '../../../services/AuditService';
import { evolutionService } from '../../../services/EvolutionService';
import { HPService } from '../../../services/HPService';

const baseState = {
  academicXp: 600,
  academicLevel: 'MASTER',
  hpLastRechargeAt: new Date('2026-05-10T00:00:00.000Z'),
};

describe('HPService', () => {
  let service: HPService;

  beforeEach(() => {
    service = new HPService();
    vi.clearAllMocks();

    vi.mocked(evolutionService.getEvolutionState).mockResolvedValue(baseState as any);
    vi.mocked(evolutionService.updateEvolutionState).mockResolvedValue(undefined as any);
    vi.mocked(auditService.logHPConsumption).mockResolvedValue({ id: 'audit-consume' } as any);
    vi.mocked(auditService.logHPRecharge).mockResolvedValue({ id: 'audit-recharge' } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ id: 'audit-service' } as any);
  });

  it('returns HP status with defaults when evolution state is missing', async () => {
    vi.mocked(evolutionService.getEvolutionState).mockResolvedValueOnce(null as any);

    await expect(service.getHPStatus()).resolves.toEqual({
      hp: 1000,
      maxHp: 1000,
      academicLevel: 'BACHELOR',
    });
  });

  it('returns HP balance with academic-level bonus multipliers', async () => {
    await expect(service.getHPBalance()).resolves.toMatchObject({
      current: 600,
      maximum: 1000,
      rechargeRate: 10,
      lastRecharge: baseState.hpLastRechargeAt,
      academicLevel: 'MASTER',
      bonusMultiplier: 1.2,
      pendingBonus: 0,
    });

    vi.mocked(evolutionService.getEvolutionState).mockResolvedValueOnce({
      ...baseState,
      academicLevel: 'PHD',
    } as any);
    await expect(service.getHPBalance()).resolves.toMatchObject({ bonusMultiplier: 1.5 });

    vi.mocked(evolutionService.getEvolutionState).mockResolvedValueOnce({
      ...baseState,
      academicLevel: 'POSTDOC',
    } as any);
    await expect(service.getHPBalance()).resolves.toMatchObject({ bonusMultiplier: 2 });
  });

  it('consumes HP, updates evolution state, and writes HP consumption audit', async () => {
    const result = await service.consumeHP(120, 'run model', 'USER');

    expect(evolutionService.updateEvolutionState).toHaveBeenCalledWith({ academicXp: 480 });
    expect(auditService.logHPConsumption).toHaveBeenCalledWith('USER', 120, 'run model', 600, 480);
    expect(result).toEqual({
      success: true,
      previousHp: 600,
      currentHp: 480,
      consumed: 120,
    });
  });

  it('rejects invalid or over-budget HP consumption', async () => {
    await expect(service.consumeHP(0, 'bad')).rejects.toThrow('无效的HP消耗量');
    await expect(service.consumeHP(-1, 'bad')).rejects.toThrow('无效的HP消耗量');
    await expect(service.consumeHP(700, 'too much')).rejects.toThrow('HP不足: 需要 700, 当前 600');

    expect(evolutionService.updateEvolutionState).not.toHaveBeenCalled();
  });

  it('restores HP without exceeding the maximum balance', async () => {
    const result = await service.restoreHP(500, 'MASTER');

    expect(evolutionService.updateEvolutionState).toHaveBeenCalledWith({ academicXp: 1000 });
    expect(result).toEqual({
      success: true,
      previousHp: 600,
      currentHp: 1000,
      restored: 400,
    });
  });

  it('recharges HP, audits actual recharge amount, and reports overflow', async () => {
    const result = await service.rechargeHP(500, 'daily_bonus', 'Daily recharge', 'MASTER');

    expect(evolutionService.updateEvolutionState).toHaveBeenCalledWith({ academicXp: 1000 });
    expect(auditService.logHPRecharge).toHaveBeenCalledWith('MASTER', 400, 'daily_bonus', 600, 1000);
    expect(result).toMatchObject({
      success: true,
      currentBalance: 1000,
      message: 'HP已达上限，实际充值400点',
    });
    expect(result.transaction).toMatchObject({
      type: 'RECHARGE',
      amount: 400,
      balanceAfter: 1000,
      source: 'daily_bonus',
      description: 'Daily recharge',
      overflow: 100,
    });
  });

  it('consumes HP for a named service and records transaction details in audit logs', async () => {
    const result = await service.consumeHPForService(
      80,
      'vision',
      undefined,
      { route: '/scan' },
      'SYSTEM',
    );

    expect(evolutionService.updateEvolutionState).toHaveBeenCalledWith({ academicXp: 520 });
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HP_CONSUMED',
        actor: 'SYSTEM',
        targetType: 'hp',
        targetId: 'singleton',
        result: 'SUCCESS',
        details: expect.objectContaining({
          amount: 80,
          serviceType: 'vision',
          oldBalance: 600,
          newBalance: 520,
        }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      currentBalance: 520,
      transaction: {
        type: 'CONSUME',
        amount: -80,
        balanceAfter: 520,
        serviceType: 'vision',
        description: 'vision service consumption',
        metadata: { route: '/scan' },
      },
    });
  });

  it('rejects invalid service consumption requests before mutating state', async () => {
    await expect(service.consumeHPForService(0, 'vision')).rejects.toThrow('无效的HP消耗量');
    await expect(service.consumeHPForService(10, '')).rejects.toThrow('必须指定服务类型');
    await expect(service.consumeHPForService(700, 'vision')).rejects.toThrow('HP不足: 需要 700, 当前 600');

    expect(evolutionService.updateEvolutionState).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });
});
