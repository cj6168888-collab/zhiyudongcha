import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage', () => ({
  storage: {
    createAuditLog: vi.fn(),
    getAuditLogs: vi.fn(),
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

import { AuditService } from '../../../services/AuditService';
import { storage } from '../../../storage';

const baseAuditLog = {
  id: 'audit-1',
  action: 'TEST_ACTION',
  actor: 'SYSTEM',
  targetType: 'test',
  targetId: 'target-1',
  details: { ok: true },
  result: 'SUCCESS',
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService();
    vi.clearAllMocks();

    vi.mocked(storage.createAuditLog).mockResolvedValue(baseAuditLog as any);
    vi.mocked(storage.getAuditLogs).mockResolvedValue([baseAuditLog] as any);
  });

  it('creates audit logs through storage and returns the persisted log', async () => {
    const input = {
      action: 'TEST_ACTION',
      actor: 'SYSTEM',
      targetType: 'test',
      targetId: 'target-1',
      details: { ok: true },
      result: 'SUCCESS',
    };

    await expect(service.createAuditLog(input as any)).resolves.toEqual(baseAuditLog);
    expect(storage.createAuditLog).toHaveBeenCalledWith(input);
  });

  it('passes only the requested limit when reading audit logs', async () => {
    await expect(
      service.getAuditLogs({
        action: 'IGNORED_BY_CURRENT_STORAGE_CONTRACT',
        actor: 'MASTER',
        targetType: 'hp',
        targetId: 'singleton',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-05-10T00:00:00.000Z'),
        limit: 25,
      }),
    ).resolves.toEqual([baseAuditLog]);

    expect(storage.getAuditLogs).toHaveBeenCalledWith(25);
  });

  it('creates HP consumption audit logs with canonical target and details', async () => {
    await service.logHPConsumption('USER', 120, 'run model', 600, 480);

    expect(storage.createAuditLog).toHaveBeenCalledWith({
      action: 'HP_CONSUMED',
      actor: 'USER',
      targetType: 'hp',
      targetId: 'singleton',
      details: {
        amount: 120,
        reason: 'run model',
        oldHp: 600,
        newHp: 480,
      },
      result: 'SUCCESS',
    });
  });

  it('creates HP recharge audit logs with canonical target and details', async () => {
    await service.logHPRecharge('MASTER', 300, 'daily_bonus', 500, 800);

    expect(storage.createAuditLog).toHaveBeenCalledWith({
      action: 'HP_RECHARGED',
      actor: 'MASTER',
      targetType: 'hp',
      targetId: 'singleton',
      details: {
        amount: 300,
        source: 'daily_bonus',
        oldHp: 500,
        newHp: 800,
      },
      result: 'SUCCESS',
    });
  });
});
