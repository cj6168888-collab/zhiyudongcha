import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const evolutionServiceMock = vi.hoisted(() => ({
  getEvolutionState: vi.fn(),
  getEvolutionEvents: vi.fn(),
  getSkillCapsules: vi.fn(),
  getAllMemories: vi.fn(),
  getGrowthReport: vi.fn(),
}));

vi.mock('../../server/services/EvolutionService', () => ({
  evolutionService: evolutionServiceMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  requireMaster: (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).userRole !== 'MASTER') {
      res.status(403).json({ error: 'MASTER required' });
      return;
    }
    next();
  },
}));

import { registerEvolutionRoutes } from '../../server/routes/evolution';

function createTestApp(role: 'MASTER' | 'GUEST' = 'MASTER'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userRole = role;
    next();
  });
  registerEvolutionRoutes(app, { storage: {} } as any);
  return app;
}

describe('Evolution API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    evolutionServiceMock.getEvolutionState.mockResolvedValue({
      id: 'evo-1',
      academicLevel: 'MASTER',
      academicXp: 500,
      nextLevelXp: 1000,
      externalCallCount: 3,
      localCallCount: 1,
      distilledKnowledgeSize: 8,
      distillationCount: 4,
      totalDreamSessions: 2,
      totalInsightsDiscovered: 5,
      totalSkillCapsules: 6,
      activeSkillCapsules: 2,
      updatedAt: '2026-04-30T00:00:00Z',
    });
    evolutionServiceMock.getEvolutionEvents.mockResolvedValue([
      { id: 'event-1', eventType: 'SKILL_LEARNED', deltaDescription: 'Learned routing' },
    ]);
    evolutionServiceMock.getSkillCapsules.mockResolvedValue([{ id: 'capsule-1', isActive: 1 }]);
    evolutionServiceMock.getAllMemories.mockResolvedValue([
      { id: 'memory-1', field: 'routing', expPoints: 10 },
      { id: 'memory-2', field: 'routing', expPoints: 5 },
      { id: 'memory-3', field: 'testing', expPoints: 7 },
    ]);
    evolutionServiceMock.getGrowthReport.mockResolvedValue({
      currentLevel: 'MASTER',
      totalXp: 500,
      totalSkills: 1,
    });
  });

  it('returns default evolution state when no state exists', async () => {
    evolutionServiceMock.getEvolutionState.mockResolvedValueOnce(undefined);

    const response = await request(app).get('/api/evolution-state');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      academicLadder: 'BACHELOR',
      academicProgress: 0,
      externalLlmRatio: 100,
      localModelRatio: 0,
      evolutionScore: 0,
    });
  });

  it('returns normalized evolution state metrics', async () => {
    const response = await request(app).get('/api/evolution-state');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'evo-1',
      academicLadder: 'MASTER',
      academicProgress: 50,
      academicXp: 500,
      nextLevelXp: 1000,
      externalLlmRatio: 75,
      localModelRatio: 25,
      knowledgeDistilled: 8,
      totalDecisions: 4,
      dreamSimulations: 2,
      totalInsights: 5,
      totalSkillCapsules: 6,
      activeSkillCapsules: 2,
      evolutionScore: 50,
    });
  });

  it('returns events, capsules, and growth reports with limit forwarding', async () => {
    const events = await request(app).get('/api/evolution?limit=7');
    const capsules = await request(app).get('/api/skill-capsules');
    const report = await request(app).get('/api/evolution/growth-report');

    expect(events.body).toEqual([{ id: 'event-1', eventType: 'SKILL_LEARNED', deltaDescription: 'Learned routing' }]);
    expect(evolutionServiceMock.getEvolutionEvents).toHaveBeenCalledWith(7);
    expect(capsules.body).toEqual([{ id: 'capsule-1', isActive: 1 }]);
    expect(report.body).toEqual({ currentLevel: 'MASTER', totalXp: 500, totalSkills: 1 });
  });

  it('groups shadow memories for master users and blocks non-master access', async () => {
    const response = await request(app).get('/api/shadow-memories');
    const guestApp = createTestApp('GUEST');
    const forbidden = await request(guestApp).get('/api/shadow-memories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalMemories: 3,
      totalExp: 22,
      byField: [
        { field: 'routing', count: 2, totalExp: 15 },
        { field: 'testing', count: 1, totalExp: 7 },
      ],
    });
    expect(forbidden.status).toBe(403);
  });

  it('returns 500 when evolution services fail', async () => {
    evolutionServiceMock.getEvolutionState.mockRejectedValueOnce(new Error('evolution offline'));
    evolutionServiceMock.getGrowthReport.mockRejectedValueOnce(new Error('report offline'));

    const state = await request(app).get('/api/evolution-state');
    const report = await request(app).get('/api/evolution/growth-report');

    expect(state.status).toBe(500);
    expect(report.status).toBe(500);
  });
});
