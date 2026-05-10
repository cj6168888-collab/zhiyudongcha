import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage/domains', () => ({
  personStorage: {
    getAllPersons: vi.fn(),
    getPerson: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    deletePerson: vi.fn(),
    searchPersonsByWeakness: vi.fn(),
    findConflictingRelationships: vi.fn(),
    getRelationshipInsight: vi.fn(),
    getPersonsByApprovalStatus: vi.fn(),
    getPersonsByOrganization: vi.fn(),
  },
}));

vi.mock('../../../repositories/memory.repository', () => ({
  shadowMemoryRepository: {
    create: vi.fn(),
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

import { shadowMemoryRepository } from '../../../repositories/memory.repository';
import { PersonService } from '../../../services/PersonService';
import { personStorage } from '../../../storage/domains';

const basePerson = {
  id: 'person-1',
  name: '张三',
  role: '产品经理',
  organization: '星河科技',
  approvalStatus: 'PENDING',
  bondStrength: 50,
};

describe('PersonService', () => {
  let service: PersonService;

  beforeEach(() => {
    service = new PersonService();
    vi.clearAllMocks();

    vi.mocked(personStorage.createPerson).mockResolvedValue(basePerson as any);
    vi.mocked(personStorage.updatePerson).mockResolvedValue(basePerson as any);
    vi.mocked(personStorage.deletePerson).mockResolvedValue(true);
    vi.mocked(shadowMemoryRepository.create).mockResolvedValue({ id: 'memory-1' } as any);
  });

  it('creates a person, records relationship memory, and broadcasts the new entity', async () => {
    const broadcastDataChange = vi.fn();

    const result = await service.createPerson(
      { name: '张三', role: '产品经理', organization: '星河科技' } as any,
      { broadcastDataChange },
    );

    expect(result).toEqual(basePerson);
    expect(personStorage.createPerson).toHaveBeenCalledWith({
      name: '张三',
      role: '产品经理',
      organization: '星河科技',
    });
    expect(shadowMemoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        context: '添加新联系人：张三，角色：产品经理，组织：星河科技',
        choiceMade: 'CREATE_PERSON',
        field: 'relationship_management',
        expPoints: 5,
        mimicryWeight: 0.6,
      }),
    );
    expect(broadcastDataChange).toHaveBeenCalledWith('person', 'CREATE', {
      id: 'person-1',
      name: '张三',
    });
  });

  it('skips relationship memory creation when createMemory is disabled', async () => {
    await service.createPerson({ name: '李四' } as any, { createMemory: false });

    expect(personStorage.createPerson).toHaveBeenCalledWith({ name: '李四' });
    expect(shadowMemoryRepository.create).not.toHaveBeenCalled();
  });

  it('returns undefined on missing update target without broadcasting', async () => {
    const broadcastDataChange = vi.fn();
    vi.mocked(personStorage.updatePerson).mockResolvedValue(undefined);

    const result = await service.updatePerson('missing', { role: '顾问' } as any, {
      broadcastDataChange,
    });

    expect(result).toBeUndefined();
    expect(broadcastDataChange).not.toHaveBeenCalled();
  });

  it('broadcasts person updates after a successful update', async () => {
    const broadcastDataChange = vi.fn();

    const result = await service.updatePerson('person-1', { role: '顾问' } as any, {
      broadcastDataChange,
    });

    expect(result).toEqual(basePerson);
    expect(personStorage.updatePerson).toHaveBeenCalledWith('person-1', { role: '顾问' });
    expect(broadcastDataChange).toHaveBeenCalledWith('person', 'UPDATE', {
      id: 'person-1',
      name: '张三',
    });
  });

  it('only broadcasts deletes when storage reports success', async () => {
    const broadcastDataChange = vi.fn();

    await expect(service.deletePerson('person-1', { broadcastDataChange })).resolves.toBe(true);
    expect(broadcastDataChange).toHaveBeenCalledWith('person', 'DELETE', { id: 'person-1' });

    broadcastDataChange.mockClear();
    vi.mocked(personStorage.deletePerson).mockResolvedValue(false);

    await expect(service.deletePerson('missing', { broadcastDataChange })).resolves.toBe(false);
    expect(broadcastDataChange).not.toHaveBeenCalled();
  });

  it('updates approval with memory, audit, and persons broadcast side effects', async () => {
    const auditAction = vi.fn().mockResolvedValue(undefined);
    const broadcastDataChange = vi.fn();

    const result = await service.updatePersonApproval('person-1', 'CONFIRMED', {
      auditAction,
      broadcastDataChange,
      userRole: 'ADMIN',
      request: { requestId: 'req-1' },
    });

    expect(result).toEqual(basePerson);
    expect(personStorage.updatePerson).toHaveBeenCalledWith('person-1', {
      approvalStatus: 'CONFIRMED',
    });
    expect(shadowMemoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        context: '审批联系人张三：CONFIRMED',
        choiceMade: 'APPROVE_CONFIRMED',
        rejectedOptions: ['ON_HOLD', 'DELETED', 'PENDING'],
        field: 'approval_decision',
        expPoints: 10,
        mimicryWeight: 0.8,
      }),
    );
    expect(auditAction).toHaveBeenCalledWith(
      'anchor_approval',
      'ADMIN',
      'person',
      'person-1',
      { newStatus: 'CONFIRMED' },
      'SUCCESS',
      { requestId: 'req-1' },
    );
    expect(broadcastDataChange).toHaveBeenCalledWith('persons', 'UPDATE', {
      id: 'person-1',
      approvalStatus: 'CONFIRMED',
    });
  });

  it('does not write approval side effects when the person is missing', async () => {
    const auditAction = vi.fn();
    const broadcastDataChange = vi.fn();
    vi.mocked(personStorage.updatePerson).mockResolvedValue(undefined);

    const result = await service.updatePersonApproval('missing', 'DELETED', {
      auditAction,
      broadcastDataChange,
    });

    expect(result).toBeUndefined();
    expect(shadowMemoryRepository.create).not.toHaveBeenCalled();
    expect(auditAction).not.toHaveBeenCalled();
    expect(broadcastDataChange).not.toHaveBeenCalled();
  });

  it('delegates filtered reads and small update helpers to person storage', async () => {
    vi.mocked(personStorage.getPersonsByApprovalStatus).mockResolvedValue([basePerson] as any);
    vi.mocked(personStorage.getPersonsByOrganization).mockResolvedValue([basePerson] as any);

    await expect(service.getPersonsByApprovalStatus('PENDING')).resolves.toEqual([basePerson]);
    await expect(service.getPersonsByOrganization('星河科技')).resolves.toEqual([basePerson]);
    await service.updateBondStrength('person-1', 88);
    await service.updateLastInteraction('person-1');

    expect(personStorage.getPersonsByApprovalStatus).toHaveBeenCalledWith('PENDING');
    expect(personStorage.getPersonsByOrganization).toHaveBeenCalledWith('星河科技');
    expect(personStorage.updatePerson).toHaveBeenCalledWith('person-1', { bondStrength: 88 });
    expect(personStorage.updatePerson).toHaveBeenCalledWith('person-1', {
      lastInteraction: expect.any(Date),
    });
  });
});
