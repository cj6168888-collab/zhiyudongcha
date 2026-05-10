import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const chrysalisOrchestratorMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  runFullCycle: vi.fn(),
  runPartialCycle: vi.fn(),
}));

const failureCollectorMock = vi.hoisted(() => ({
  getStats: vi.fn(),
  collectUnanswered: vi.fn(),
  collectExecutionError: vi.fn(),
  collectUserCorrection: vi.fn(),
  scanChatHistoryForFailures: vi.fn(),
  scanAuditLogsForFailures: vi.fn(),
}));

const retrospectionEngineMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  startRetrospection: vi.fn(),
  getRecentKnowledge: vi.fn(),
}));

const logicFinetunerMock = vi.hoisted(() => ({
  analyzeConversations: vi.fn(),
  deepAnalyzeWithQwen: vi.fn(),
  getLearnedTactics: vi.fn(),
}));

const visionEvolverMock = vi.hoisted(() => ({
  evolve: vi.fn(),
  getLearnedPatterns: vi.fn(),
  teachPattern: vi.fn(),
}));

const selfCoderMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  startSelfCodingCycle: vi.fn(),
  getDeployedPatches: vi.fn(),
  getPendingPatches: vi.fn(),
  rollbackPatch: vi.fn(),
}));

const morningGiftMock = vi.hoisted(() => ({
  getTodayGift: vi.fn(),
  generateMorningGift: vi.fn(),
  markAsRead: vi.fn(),
  getRecentGifts: vi.fn(),
}));

vi.mock('../../server/services/chrysalis-orchestrator', () => ({
  chrysalisOrchestrator: chrysalisOrchestratorMock,
}));

vi.mock('../../server/services/failure-collector', () => ({
  failureCollector: failureCollectorMock,
}));

vi.mock('../../server/services/retrospection-engine', () => ({
  retrospectionEngine: retrospectionEngineMock,
}));

vi.mock('../../server/services/logic-finetuner', () => ({
  logicFinetuner: logicFinetunerMock,
}));

vi.mock('../../server/services/vision-evolver', () => ({
  visionEvolver: visionEvolverMock,
}));

vi.mock('../../server/services/self-coder', () => ({
  selfCoder: selfCoderMock,
}));

vi.mock('../../server/services/morning-gift', () => ({
  morningGift: morningGiftMock,
}));

import chrysalisRouter from '../../server/routes/chrysalis';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/chrysalis', chrysalisRouter);
  return app;
}

describe('Chrysalis API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    chrysalisOrchestratorMock.getStatus.mockResolvedValue({ phase: 'ready' });
    chrysalisOrchestratorMock.runFullCycle.mockResolvedValue({ cycleId: 'cycle-1' });
    chrysalisOrchestratorMock.runPartialCycle.mockResolvedValue({ phases: ['logic'] });
    failureCollectorMock.getStats.mockResolvedValue({ total: 3 });
    failureCollectorMock.collectUnanswered.mockResolvedValue('failure-unanswered');
    failureCollectorMock.collectExecutionError.mockResolvedValue('failure-execution');
    failureCollectorMock.collectUserCorrection.mockResolvedValue('failure-correction');
    failureCollectorMock.scanChatHistoryForFailures.mockResolvedValue(2);
    failureCollectorMock.scanAuditLogsForFailures.mockResolvedValue(1);
    retrospectionEngineMock.getStatus.mockReturnValue({ running: false });
    retrospectionEngineMock.startRetrospection.mockResolvedValue({ sessions: 4 });
    retrospectionEngineMock.getRecentKnowledge.mockResolvedValue([{ id: 'knowledge-1' }]);
    logicFinetunerMock.analyzeConversations.mockResolvedValue({ tacticsFound: 2 });
    logicFinetunerMock.deepAnalyzeWithQwen.mockResolvedValue({ insight: 'pattern' });
    logicFinetunerMock.getLearnedTactics.mockResolvedValue([{ id: 'tactic-1' }]);
    visionEvolverMock.evolve.mockResolvedValue({ patterns: 1 });
    visionEvolverMock.getLearnedPatterns.mockResolvedValue([{ id: 'pattern-1' }]);
    visionEvolverMock.teachPattern.mockResolvedValue('pattern-new');
    selfCoderMock.getStatus.mockReturnValue({ enabled: true });
    selfCoderMock.startSelfCodingCycle.mockResolvedValue({ patches: 1 });
    selfCoderMock.getDeployedPatches.mockResolvedValue([{ id: 'deployed-1' }]);
    selfCoderMock.getPendingPatches.mockResolvedValue([{ id: 'pending-1' }]);
    selfCoderMock.rollbackPatch.mockResolvedValue(true);
    morningGiftMock.getTodayGift.mockResolvedValue({ id: 'gift-today', greeting: 'Good morning' });
    morningGiftMock.generateMorningGift.mockResolvedValue({ id: 'gift-new', greeting: 'Fresh start' });
    morningGiftMock.markAsRead.mockResolvedValue(undefined);
    morningGiftMock.getRecentGifts.mockResolvedValue([{ id: 'gift-old' }]);
  });

  it('returns orchestrator status and starts full or partial evolution cycles', async () => {
    const statusResponse = await request(app).get('/api/chrysalis/status');
    const fullResponse = await request(app).post('/api/chrysalis/cycle/start').send({});
    const partialResponse = await request(app).post('/api/chrysalis/cycle/partial').send({ phases: ['logic'] });

    expect(statusResponse.body.data).toEqual({ phase: 'ready' });
    expect(fullResponse.body.data).toEqual({ cycleId: 'cycle-1' });
    expect(partialResponse.body.data).toEqual({ phases: ['logic'] });
    expect(chrysalisOrchestratorMock.runPartialCycle).toHaveBeenCalledWith(['logic']);
  });

  it('collects failure examples by type and scans historical sources', async () => {
    const statsResponse = await request(app).get('/api/chrysalis/failures/stats');
    const unansweredResponse = await request(app).post('/api/chrysalis/failures/collect').send({
      type: 'UNANSWERED',
      query: 'unknown question',
      reason: 'no answer',
      context: { module: 'chat' },
    });
    const executionResponse = await request(app).post('/api/chrysalis/failures/collect').send({
      type: 'EXECUTION_ERROR',
      query: 'open app',
      reason: 'device offline',
    });
    const correctionResponse = await request(app).post('/api/chrysalis/failures/collect').send({
      type: 'USER_CORRECTION',
      query: 'wrong answer',
      correction: 'right answer',
    });
    const invalidResponse = await request(app).post('/api/chrysalis/failures/collect').send({ type: 'OTHER' });
    const scanResponse = await request(app).post('/api/chrysalis/failures/scan').send({});

    expect(statsResponse.body.data).toEqual({ total: 3 });
    expect(unansweredResponse.body.data).toEqual({ failureId: 'failure-unanswered' });
    expect(failureCollectorMock.collectUnanswered).toHaveBeenCalledWith(
      'unknown question',
      'no answer',
      expect.objectContaining({ module: 'chat', timestamp: expect.any(Date) }),
    );
    expect(executionResponse.body.data).toEqual({ failureId: 'failure-execution' });
    expect(failureCollectorMock.collectExecutionError).toHaveBeenCalledWith(
      'open app',
      'device offline',
      expect.objectContaining({ module: 'api', timestamp: expect.any(Date) }),
    );
    expect(correctionResponse.body.data).toEqual({ failureId: 'failure-correction' });
    expect(invalidResponse.status).toBe(400);
    expect(scanResponse.body.data).toEqual({
      chatFailuresCollected: 2,
      auditFailuresCollected: 1,
      total: 3,
    });
  });

  it('exposes retrospection and logic finetuning routes with defaults', async () => {
    const retroStatus = await request(app).get('/api/chrysalis/retrospection/status');
    const retroStart = await request(app).post('/api/chrysalis/retrospection/start').send({});
    const knowledge = await request(app).get('/api/chrysalis/retrospection/knowledge?limit=5');
    const analyze = await request(app).post('/api/chrysalis/logic/analyze').send({});
    const deepAnalyze = await request(app).post('/api/chrysalis/logic/deep-analyze').send({ context: { topic: 'risk' } });
    const tactics = await request(app).get('/api/chrysalis/logic/tactics?category=sales');

    expect(retroStatus.body.data).toEqual({ running: false });
    expect(retroStart.body.data).toEqual({ sessions: 4 });
    expect(knowledge.body.data).toEqual([{ id: 'knowledge-1' }]);
    expect(retrospectionEngineMock.getRecentKnowledge).toHaveBeenCalledWith(5);
    expect(analyze.body.data).toEqual({ tacticsFound: 2 });
    expect(logicFinetunerMock.analyzeConversations).toHaveBeenCalledWith(1);
    expect(deepAnalyze.body.data).toEqual({ insight: 'pattern' });
    expect(tactics.body.data).toEqual([{ id: 'tactic-1' }]);
    expect(logicFinetunerMock.getLearnedTactics).toHaveBeenCalledWith('sales');
  });

  it('uses default limits and accepts explicit logic analysis windows', async () => {
    const defaultKnowledge = await request(app).get('/api/chrysalis/retrospection/knowledge');
    const explicitAnalyze = await request(app).post('/api/chrysalis/logic/analyze').send({ days: 14 });
    const defaultHistory = await request(app).get('/api/chrysalis/morning-gift/history');

    expect(defaultKnowledge.status).toBe(200);
    expect(retrospectionEngineMock.getRecentKnowledge).toHaveBeenCalledWith(10);
    expect(explicitAnalyze.status).toBe(200);
    expect(logicFinetunerMock.analyzeConversations).toHaveBeenCalledWith(14);
    expect(defaultHistory.status).toBe(200);
    expect(morningGiftMock.getRecentGifts).toHaveBeenCalledWith(7);
  });

  it('exposes vision evolution and self-coding patch lifecycle routes', async () => {
    const evolve = await request(app).post('/api/chrysalis/vision/evolve').send({});
    const patterns = await request(app).get('/api/chrysalis/vision/patterns');
    const teach = await request(app)
      .post('/api/chrysalis/vision/teach')
      .send({ patternType: 'button', patternName: 'primary', rules: { color: 'blue' } });
    const selfStatus = await request(app).get('/api/chrysalis/selfcode/status');
    const selfStart = await request(app).post('/api/chrysalis/selfcode/start').send({});
    const patches = await request(app).get('/api/chrysalis/selfcode/patches');
    const rollback = await request(app).post('/api/chrysalis/selfcode/rollback/patch-1').send({});

    expect(evolve.body.data).toEqual({ patterns: 1 });
    expect(patterns.body.data).toEqual([{ id: 'pattern-1' }]);
    expect(teach.body.data).toEqual({ patternId: 'pattern-new' });
    expect(visionEvolverMock.teachPattern).toHaveBeenCalledWith('button', 'primary', { color: 'blue' });
    expect(selfStatus.body.data).toEqual({ enabled: true });
    expect(selfStart.body.data).toEqual({ patches: 1 });
    expect(patches.body.data).toEqual({
      deployed: [{ id: 'deployed-1' }],
      pending: [{ id: 'pending-1' }],
    });
    expect(rollback.body.success).toBe(true);
    expect(selfCoderMock.rollbackPatch).toHaveBeenCalledWith('patch-1');
  });

  it('surfaces unsuccessful patch rollback without converting it to an error', async () => {
    selfCoderMock.rollbackPatch.mockResolvedValueOnce(false);

    const rollback = await request(app).post('/api/chrysalis/selfcode/rollback/patch-missing').send({});

    expect(rollback.status).toBe(200);
    expect(rollback.body.success).toBe(false);
    expect(selfCoderMock.rollbackPatch).toHaveBeenCalledWith('patch-missing');
  });

  it('returns existing or generated morning gifts and tracks read/history actions', async () => {
    const todayResponse = await request(app).get('/api/chrysalis/morning-gift');

    morningGiftMock.getTodayGift.mockResolvedValueOnce(null);
    const generatedResponse = await request(app).get('/api/chrysalis/morning-gift');
    const forceGenerateResponse = await request(app).post('/api/chrysalis/morning-gift/generate').send({});
    const readResponse = await request(app).post('/api/chrysalis/morning-gift/gift-new/read').send({});
    const historyResponse = await request(app).get('/api/chrysalis/morning-gift/history?limit=3');

    expect(todayResponse.body).toMatchObject({ data: { id: 'gift-today' }, message: 'Good morning' });
    expect(generatedResponse.body).toMatchObject({ data: { id: 'gift-new' }, message: 'Fresh start' });
    expect(forceGenerateResponse.body.data).toEqual({ id: 'gift-new', greeting: 'Fresh start' });
    expect(readResponse.body.success).toBe(true);
    expect(morningGiftMock.markAsRead).toHaveBeenCalledWith('gift-new');
    expect(historyResponse.body.data).toEqual([{ id: 'gift-old' }]);
    expect(morningGiftMock.getRecentGifts).toHaveBeenCalledWith(3);
  });

  it('maps representative chrysalis service failures to 500 responses', async () => {
    chrysalisOrchestratorMock.getStatus.mockRejectedValueOnce(new Error('orchestrator unavailable'));
    const statusResponse = await request(app).get('/api/chrysalis/status');

    failureCollectorMock.scanAuditLogsForFailures.mockRejectedValueOnce(new Error('audit scan unavailable'));
    const scanResponse = await request(app).post('/api/chrysalis/failures/scan').send({});

    retrospectionEngineMock.getStatus.mockImplementationOnce(() => {
      throw new Error('retrospection unavailable');
    });
    const retroResponse = await request(app).get('/api/chrysalis/retrospection/status');

    visionEvolverMock.teachPattern.mockRejectedValueOnce(new Error('vision teach unavailable'));
    const teachResponse = await request(app)
      .post('/api/chrysalis/vision/teach')
      .send({ patternType: 'button', patternName: 'primary', rules: {} });

    selfCoderMock.getPendingPatches.mockRejectedValueOnce(new Error('patch list unavailable'));
    const patchesResponse = await request(app).get('/api/chrysalis/selfcode/patches');

    morningGiftMock.generateMorningGift.mockRejectedValueOnce(new Error('gift unavailable'));
    const giftResponse = await request(app).post('/api/chrysalis/morning-gift/generate').send({});

    expect(statusResponse.status).toBe(500);
    expect(statusResponse.body.error).toBe('orchestrator unavailable');
    expect(scanResponse.status).toBe(500);
    expect(scanResponse.body.error).toBe('audit scan unavailable');
    expect(retroResponse.status).toBe(500);
    expect(retroResponse.body.error).toBe('retrospection unavailable');
    expect(teachResponse.status).toBe(500);
    expect(teachResponse.body.error).toBe('vision teach unavailable');
    expect(patchesResponse.status).toBe(500);
    expect(patchesResponse.body.error).toBe('patch list unavailable');
    expect(giftResponse.status).toBe(500);
    expect(giftResponse.body.error).toBe('gift unavailable');
  });
});
