import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../repositories/memory.repository', () => ({
  shadowMemoryRepository: {
    findAll: vi.fn(),
    create: vi.fn(),
    getByField: vi.fn(),
    getRecentMemories: vi.fn(),
    getByMimicryWeight: vi.fn(),
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
import { MemoryService } from '../../../services/MemoryService';

const baseMemory = {
  id: 'memory-1',
  context: '完成发布前覆盖率复核',
  choiceMade: 'ADD_COVERAGE',
  field: 'engineering',
  expPoints: 10,
  mimicryWeight: 0.8,
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    service = new MemoryService();
    vi.clearAllMocks();

    vi.mocked(shadowMemoryRepository.findAll).mockResolvedValue([baseMemory] as any);
    vi.mocked(shadowMemoryRepository.create).mockResolvedValue(baseMemory as any);
    vi.mocked(shadowMemoryRepository.getByField).mockResolvedValue([baseMemory] as any);
    vi.mocked(shadowMemoryRepository.getRecentMemories).mockResolvedValue([baseMemory] as any);
    vi.mocked(shadowMemoryRepository.getByMimicryWeight).mockResolvedValue([baseMemory] as any);
  });

  it('delegates basic memory reads and writes to the repository', async () => {
    await expect(service.getAllMemories()).resolves.toEqual([baseMemory]);
    await expect(service.createMemory({ context: '完成发布前覆盖率复核' } as any)).resolves.toEqual(
      baseMemory,
    );
    await expect(service.getMemoriesByField('engineering')).resolves.toEqual([baseMemory]);
    await expect(service.getMemoriesByMimicryWeight(0.7)).resolves.toEqual([baseMemory]);

    expect(shadowMemoryRepository.findAll).toHaveBeenCalledWith();
    expect(shadowMemoryRepository.create).toHaveBeenCalledWith({
      context: '完成发布前覆盖率复核',
    });
    expect(shadowMemoryRepository.getByField).toHaveBeenCalledWith('engineering');
    expect(shadowMemoryRepository.getByMimicryWeight).toHaveBeenCalledWith(0.7);
  });

  it('uses a default recent-memory limit and forwards explicit limits', async () => {
    await service.getRecentMemories();
    await service.getRecentMemories(12);

    expect(shadowMemoryRepository.getRecentMemories).toHaveBeenNthCalledWith(1, 50);
    expect(shadowMemoryRepository.getRecentMemories).toHaveBeenNthCalledWith(2, 12);
  });

  it('summarizes memory stats by field and total experience points', async () => {
    vi.mocked(shadowMemoryRepository.findAll).mockResolvedValue([
      baseMemory,
      { ...baseMemory, id: 'memory-2', field: 'engineering', expPoints: 4 },
      { ...baseMemory, id: 'memory-3', field: 'relationship', expPoints: null },
      { ...baseMemory, id: 'memory-4', field: null, expPoints: 3 },
    ] as any);

    const stats = await service.getMemoryStats();

    expect(stats).toEqual({
      totalMemories: 4,
      byField: {
        engineering: 2,
        relationship: 1,
        unknown: 1,
      },
      totalExpPoints: 17,
    });
  });
});
