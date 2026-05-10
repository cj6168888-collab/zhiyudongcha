import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  memories: [] as Array<{
    id: string;
    context: string | null;
    choiceMade: string | null;
    field: string | null;
    mimicryWeight: number | null;
    expPoints?: number;
    createdAt: Date | null;
  }>,
  idCounter: 0,
}));

function createInsertBuilder() {
  return {
    values: vi.fn().mockImplementation((row) => ({
      returning: vi.fn().mockImplementation(async () => {
        const id = `memory-${++dbMock.idCounter}`;
        dbMock.memories.push({
          id,
          context: row.context ?? null,
          choiceMade: row.choiceMade ?? null,
          field: row.field ?? null,
          mimicryWeight: row.mimicryWeight ?? null,
          expPoints: row.expPoints,
          createdAt: new Date(),
        });
        return [{ id }];
      }),
    })),
  };
}

function createSelectBuilder() {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async (limit: number) => dbMock.memories.slice(0, limit)),
    then: (resolve: (rows: typeof dbMock.memories) => unknown) => Promise.resolve(dbMock.memories).then(resolve),
  };
  return builder;
}

function createUpdateBuilder() {
  return {
    set: vi.fn().mockImplementation((updates) => ({
      where: vi.fn().mockImplementation(async () => {
        for (const memory of dbMock.memories) {
          Object.assign(memory, updates);
        }
        return [];
      }),
    })),
  };
}

vi.mock('../../../db', () => ({
  getDatabase: () => ({
    insert: vi.fn().mockReturnValue(createInsertBuilder()),
    select: vi.fn().mockReturnValue(createSelectBuilder()),
    update: vi.fn().mockReturnValue(createUpdateBuilder()),
  }),
}));

import {
  VectorMemoryService,
  cosineSimilarity,
  simpleTextToVector,
} from '../../../services/vector-memory';

describe('VectorMemoryService', () => {
  beforeEach(() => {
    dbMock.memories = [];
    dbMock.idCounter = 0;
  });

  it('generates normalized vectors and stable cosine similarity', () => {
    const projectVector = simpleTextToVector('project alpha launch', 16);
    const sameProjectVector = simpleTextToVector('project alpha launch', 16);
    const emptyVector = simpleTextToVector('', 16);

    expect(projectVector).toHaveLength(16);
    expect(cosineSimilarity(projectVector, sameProjectVector)).toBeCloseTo(1);
    expect(cosineSimilarity(projectVector, emptyVector)).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it('stores memories in shadow memory rows and returns the generated id', async () => {
    const service = new VectorMemoryService({ embeddingDimensions: 16 });

    const id = await service.storeMemory(
      '客户偏好周五上午开会',
      'learning',
      { source: 'chat' },
      1.4,
    );

    expect(id).toBe('memory-1');
    expect(dbMock.memories[0]).toMatchObject({
      id: 'memory-1',
      choiceMade: '客户偏好周五上午开会',
      field: 'learning',
      mimicryWeight: 1.4,
      context: JSON.stringify({ source: 'chat' }),
      expPoints: 0,
    });
  });

  it('searches similar memories and ranks by relevance score', async () => {
    const service = new VectorMemoryService({
      embeddingDimensions: 32,
      similarityThreshold: 0.1,
      maxResults: 5,
    });
    await service.storeMemory('alpha project launch decision', 'decision', { result: 'success' }, 0.5);
    await service.storeMemory('alpha project launch decision', 'decision', { result: 'repeat-success' }, 1.5);
    await service.storeMemory('unrelated finance note', 'learning', undefined, 2);

    const results = await service.searchSimilar('alpha project launch decision', 'decision', 2);

    expect(results).toHaveLength(2);
    expect(results[0].entry.id).toBe('memory-2');
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    expect(results[0].entry.context).toEqual({ result: 'repeat-success' });
  });

  it('updates cached weight through reinforcement and clamps the lower bound', async () => {
    const service = new VectorMemoryService({ embeddingDimensions: 16 });
    const id = await service.storeMemory('decision pattern', 'decision', undefined, 0.15);

    await service.reinforce(id, false);
    await service.reinforce(id, false);

    const [result] = await service.searchSimilar('decision pattern', 'decision', 1);
    expect(result.entry.weight).toBe(0.1);
  });

  it('reinforces positive memories and clamps the upper bound', async () => {
    const service = new VectorMemoryService({ embeddingDimensions: 16 });
    const id = await service.storeMemory('winning pattern', 'decision', undefined, 1.95);

    await service.reinforce(id, true);
    await service.reinforce(id, true);

    const [result] = await service.searchSimilar('winning pattern', 'decision', 1);
    expect(result.entry.weight).toBe(2);
  });

  it('applies decay to memories above the floor and returns the affected count', async () => {
    const service = new VectorMemoryService({
      embeddingDimensions: 16,
      decayFactor: 0.5,
    });
    await service.storeMemory('decay me', 'learning', undefined, 1);

    const decayed = await service.applyDecay();

    expect(decayed).toBe(1);
    expect(dbMock.memories[0].mimicryWeight).toBe(0.5);
  });

  it('records decision patterns with outcome-based weights', async () => {
    const service = new VectorMemoryService({ embeddingDimensions: 16 });

    const successId = await service.recordDecisionPattern('报价谈判', '先给范围再给底线', 'success');
    const failureId = await service.recordDecisionPattern('交付延期', '延后通知客户', 'failure');
    const neutralId = await service.recordDecisionPattern(
      '客户复盘',
      '先收集事实再给建议',
      'neutral',
      { owner: 'user-1' },
    );

    expect(successId).toBe('memory-1');
    expect(failureId).toBe('memory-2');
    expect(neutralId).toBe('memory-3');
    expect(dbMock.memories[0].mimicryWeight).toBe(1.2);
    expect(dbMock.memories[1].mimicryWeight).toBe(0.5);
    expect(dbMock.memories[2].mimicryWeight).toBe(1);
    expect(JSON.parse(dbMock.memories[2].context ?? '{}')).toMatchObject({
      owner: 'user-1',
      outcome: 'neutral',
    });
  });

  it('returns decision DNA by delegating to decision-category similarity search', async () => {
    const service = new VectorMemoryService({
      embeddingDimensions: 16,
      similarityThreshold: 0.8,
    });
    await service.storeMemory('pricing negotiation decision', 'decision', undefined, 1);
    await service.storeMemory('unrelated operations note', 'learning', undefined, 2);

    const results = await service.getDecisionDNA('pricing negotiation decision');

    expect(results).toHaveLength(1);
    expect(results[0].entry.category).toBe('decision');
  });

  it('falls back to raw context when stored JSON is malformed', async () => {
    const service = new VectorMemoryService({
      embeddingDimensions: 16,
      similarityThreshold: 0.1,
    });
    dbMock.memories.push({
      id: 'memory-bad-json',
      context: '{not-valid-json',
      choiceMade: 'broken context pattern',
      field: 'learning',
      mimicryWeight: 1,
      expPoints: 0,
      createdAt: new Date(),
    });

    const [result] = await service.searchSimilar('broken context pattern', 'learning', 1);

    expect(result.entry.context).toEqual({ raw: '{not-valid-json' });
  });

  it('summarizes memory stats by category and average weight', async () => {
    const service = new VectorMemoryService({ embeddingDimensions: 16 });
    await service.storeMemory('decision one', 'decision', undefined, 1.5);
    await service.storeMemory('learning one', 'learning', undefined, 0.5);
    dbMock.memories.push({
      id: 'memory-unknown',
      context: null,
      choiceMade: 'unknown category',
      field: null,
      mimicryWeight: null,
      expPoints: 0,
      createdAt: new Date(),
    });

    const stats = await service.getStats();

    expect(stats.totalMemories).toBe(3);
    expect(stats.byCategory).toEqual({
      decision: 1,
      learning: 1,
      unknown: 1,
    });
    expect(stats.avgWeight).toBe(1);
  });
});
