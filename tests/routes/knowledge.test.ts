import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const knowledgeMocks = vi.hoisted(() => ({
  programKnowledgeBase: {
    getAllPrograms: vi.fn(),
    searchPrograms: vi.fn(),
    getProgram: vi.fn(),
    matchIntent: vi.fn(),
    learnProgram: vi.fn(),
    updateProgram: vi.fn(),
    addOperation: vi.fn(),
    getCategoryStats: vi.fn(),
    getPlatformStats: vi.fn(),
    exportDatabase: vi.fn(),
    importDatabase: vi.fn(),
  },
  programDiscoveryService: {
    discoverProgram: vi.fn(),
    batchDiscover: vi.fn(),
    getDiscoveredPrograms: vi.fn(),
    generateDiscoveryReport: vi.fn(),
  },
  programLearner: {
    logExecution: vi.fn(),
    recordFeedback: vi.fn(),
    generateLearningReport: vi.fn(),
    exportLogs: vi.fn(),
    clearOldLogs: vi.fn(),
  },
}));

vi.mock('../../server/services/knowledge', () => knowledgeMocks);

import knowledgeRouter from '../../server/routes/knowledge';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/knowledge', knowledgeRouter);
  return app;
}

const browserProgram = {
  id: 'chrome',
  name: 'Chrome',
  category: 'browser',
  platforms: ['windows', 'mac'],
  operations: [{ id: 'open-tab', name: 'Open tab' }],
};

const editorProgram = {
  id: 'vscode',
  name: 'VS Code',
  category: 'editor',
  platforms: ['windows'],
  operations: [{ id: 'open-file', name: 'Open file' }],
};

describe('Knowledge API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeMocks.programKnowledgeBase.getAllPrograms.mockReturnValue([browserProgram, editorProgram]);
    knowledgeMocks.programKnowledgeBase.searchPrograms.mockReturnValue([browserProgram]);
    knowledgeMocks.programKnowledgeBase.getProgram.mockImplementation((id: string) =>
      id === browserProgram.id ? browserProgram : undefined,
    );
    knowledgeMocks.programKnowledgeBase.matchIntent.mockReturnValue([
      { program: browserProgram, score: 0.9 },
      { program: editorProgram, score: 0.5 },
    ]);
    knowledgeMocks.programKnowledgeBase.updateProgram.mockReturnValue(true);
    knowledgeMocks.programKnowledgeBase.addOperation.mockReturnValue(true);
    knowledgeMocks.programKnowledgeBase.getCategoryStats.mockReturnValue({ browser: 1, editor: 1 });
    knowledgeMocks.programKnowledgeBase.getPlatformStats.mockReturnValue({ windows: 2, mac: 1 });
    knowledgeMocks.programKnowledgeBase.exportDatabase.mockReturnValue(JSON.stringify({ programs: [browserProgram] }));
    knowledgeMocks.programKnowledgeBase.importDatabase.mockReturnValue(1);
    knowledgeMocks.programDiscoveryService.discoverProgram.mockResolvedValue({ packageName: 'pkg', confidence: 0.8 });
    knowledgeMocks.programDiscoveryService.batchDiscover.mockResolvedValue(
      new Map([
        ['pkg-a', { packageName: 'pkg-a', confidence: 0.9 }],
        ['pkg-b', { packageName: 'pkg-b', confidence: 0.7 }],
      ]),
    );
    knowledgeMocks.programDiscoveryService.getDiscoveredPrograms.mockReturnValue([{ packageName: 'pkg-a' }]);
    knowledgeMocks.programDiscoveryService.generateDiscoveryReport.mockReturnValue({ discovered: 1 });
    knowledgeMocks.programLearner.generateLearningReport.mockReturnValue({ totalExecutions: 1 });
    knowledgeMocks.programLearner.exportLogs.mockReturnValue(JSON.stringify([{ programId: 'chrome' }]));
    knowledgeMocks.programLearner.clearOldLogs.mockReturnValue(2);
  });

  it('lists programs and applies category, platform, and search filters', async () => {
    const response = await request(app).get('/api/knowledge/programs?category=browser&platform=windows&search=chrome');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({ id: 'chrome' });
    expect(knowledgeMocks.programKnowledgeBase.searchPrograms).toHaveBeenCalledWith('chrome');
  });

  it('returns program details, operations, and 404s for missing programs', async () => {
    const detailResponse = await request(app).get('/api/knowledge/programs/chrome');
    const operationsResponse = await request(app).get('/api/knowledge/programs/chrome/operations');
    const missingResponse = await request(app).get('/api/knowledge/programs/missing');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({ id: 'chrome' });
    expect(operationsResponse.status).toBe(200);
    expect(operationsResponse.body.data[0]).toMatchObject({ id: 'open-tab' });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.success).toBe(false);
  });

  it('validates intent matching and manual program learning', async () => {
    const invalidMatchResponse = await request(app).post('/api/knowledge/programs/match').send({});
    const matchResponse = await request(app).post('/api/knowledge/programs/match').send({ intent: 'open browser' });
    const invalidProgramResponse = await request(app).post('/api/knowledge/programs').send({ id: 'missing-name' });
    const learnResponse = await request(app).post('/api/knowledge/programs').send({ id: 'new-app', name: 'New App' });

    expect(invalidMatchResponse.status).toBe(400);
    expect(matchResponse.status).toBe(200);
    expect(matchResponse.body.total).toBe(2);
    expect(invalidProgramResponse.status).toBe(400);
    expect(learnResponse.status).toBe(200);
    expect(knowledgeMocks.programKnowledgeBase.learnProgram).toHaveBeenCalledWith({ id: 'new-app', name: 'New App' });
  });

  it('updates programs and adds operations with validation and missing-resource handling', async () => {
    const updateResponse = await request(app)
      .put('/api/knowledge/programs/chrome')
      .send({ name: 'Google Chrome' });
    knowledgeMocks.programKnowledgeBase.updateProgram.mockReturnValueOnce(false);
    const missingUpdateResponse = await request(app)
      .put('/api/knowledge/programs/missing')
      .send({ name: 'Missing' });

    const invalidOperationResponse = await request(app)
      .post('/api/knowledge/programs/chrome/operations')
      .send({ id: 'open-window' });
    const addOperationResponse = await request(app)
      .post('/api/knowledge/programs/chrome/operations')
      .send({ id: 'open-window', name: 'Open window' });
    knowledgeMocks.programKnowledgeBase.addOperation.mockReturnValueOnce(false);
    const missingOperationResponse = await request(app)
      .post('/api/knowledge/programs/missing/operations')
      .send({ id: 'open-window', name: 'Open window' });

    expect(updateResponse.status).toBe(200);
    expect(knowledgeMocks.programKnowledgeBase.updateProgram).toHaveBeenCalledWith('chrome', { name: 'Google Chrome' });
    expect(missingUpdateResponse.status).toBe(404);
    expect(invalidOperationResponse.status).toBe(400);
    expect(addOperationResponse.status).toBe(200);
    expect(knowledgeMocks.programKnowledgeBase.addOperation).toHaveBeenCalledWith('chrome', {
      id: 'open-window',
      name: 'Open window',
    });
    expect(missingOperationResponse.status).toBe(404);
  });

  it('validates discovery and batch discovery inputs', async () => {
    const invalidDiscoverResponse = await request(app).post('/api/knowledge/discover').send({ packageName: 'pkg' });
    const discoverResponse = await request(app).post('/api/knowledge/discover').send({ packageName: 'pkg', platform: 'windows' });
    const invalidBatchResponse = await request(app).post('/api/knowledge/discover/batch').send({ programs: 'bad' });
    const batchResponse = await request(app).post('/api/knowledge/discover/batch').send({ programs: [{ packageName: 'pkg-a' }] });

    expect(invalidDiscoverResponse.status).toBe(400);
    expect(discoverResponse.status).toBe(200);
    expect(discoverResponse.body.data).toMatchObject({ packageName: 'pkg' });
    expect(invalidBatchResponse.status).toBe(400);
    expect(batchResponse.status).toBe(200);
    expect(batchResponse.body.total).toBe(2);
    expect(batchResponse.body.data).toHaveProperty('pkg-a');
  });

  it('returns discovered programs and learning reports', async () => {
    const discoveredResponse = await request(app).get('/api/knowledge/discovered');
    const learningReportResponse = await request(app).get('/api/knowledge/learn/report');

    expect(discoveredResponse.status).toBe(200);
    expect(discoveredResponse.body.total).toBe(1);
    expect(discoveredResponse.body.data[0]).toMatchObject({ packageName: 'pkg-a' });
    expect(learningReportResponse.status).toBe(200);
    expect(learningReportResponse.body.data).toMatchObject({ totalExecutions: 1 });
  });

  it('records learning logs and feedback with validation', async () => {
    const invalidLogResponse = await request(app).post('/api/knowledge/learn/log').send({ programId: 'chrome' });
    const logResponse = await request(app).post('/api/knowledge/learn/log').send({
      programId: 'chrome',
      operation: 'open-tab',
      parameters: { url: 'https://example.test' },
      result: { success: true },
      userId: 'user-1',
    });
    const invalidFeedbackResponse = await request(app).post('/api/knowledge/learn/feedback').send({ programId: 'chrome' });
    const feedbackResponse = await request(app).post('/api/knowledge/learn/feedback').send({
      programId: 'chrome',
      operation: 'open-tab',
      feedback: { rating: 5 },
    });

    expect(invalidLogResponse.status).toBe(400);
    expect(logResponse.status).toBe(200);
    expect(knowledgeMocks.programLearner.logExecution).toHaveBeenCalledWith(
      'chrome',
      'open-tab',
      { url: 'https://example.test' },
      { success: true },
      'user-1',
    );
    expect(invalidFeedbackResponse.status).toBe(400);
    expect(feedbackResponse.status).toBe(200);
    expect(knowledgeMocks.programLearner.recordFeedback).toHaveBeenCalledWith(
      'chrome',
      'open-tab',
      { rating: 5 },
      undefined,
    );
  });

  it('returns stats, export/import data, and learning logs', async () => {
    const statsResponse = await request(app).get('/api/knowledge/stats');
    const exportResponse = await request(app).get('/api/knowledge/export');
    const importMissingResponse = await request(app).post('/api/knowledge/import').send({});
    const importResponse = await request(app).post('/api/knowledge/import').send({ data: { programs: [browserProgram] } });
    const logsResponse = await request(app).get('/api/knowledge/learn/logs');
    const clearResponse = await request(app).delete('/api/knowledge/learn/logs?days=7');

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.data.programs.total).toBe(2);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.body.data.programs[0]).toMatchObject({ id: 'chrome' });
    expect(importMissingResponse.status).toBe(400);
    expect(importResponse.status).toBe(200);
    expect(importResponse.body.imported).toBe(1);
    expect(logsResponse.status).toBe(200);
    expect(logsResponse.body.data[0]).toMatchObject({ programId: 'chrome' });
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.removed).toBe(2);
    expect(knowledgeMocks.programLearner.clearOldLogs).toHaveBeenCalledWith(7);
  });

  it('uses a 30 day default when clearing old learning logs', async () => {
    const clearResponse = await request(app).delete('/api/knowledge/learn/logs');

    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.removed).toBe(2);
    expect(knowledgeMocks.programLearner.clearOldLogs).toHaveBeenCalledWith(30);
  });

  it('maps representative service failures to 500 responses', async () => {
    knowledgeMocks.programKnowledgeBase.getAllPrograms.mockImplementationOnce(() => {
      throw new Error('program list unavailable');
    });
    const programsResponse = await request(app).get('/api/knowledge/programs');

    knowledgeMocks.programDiscoveryService.discoverProgram.mockRejectedValueOnce(new Error('discovery unavailable'));
    const discoverResponse = await request(app)
      .post('/api/knowledge/discover')
      .send({ packageName: 'pkg', platform: 'windows' });

    knowledgeMocks.programLearner.exportLogs.mockReturnValueOnce('not-json');
    const logsResponse = await request(app).get('/api/knowledge/learn/logs');

    knowledgeMocks.programKnowledgeBase.exportDatabase.mockReturnValueOnce('not-json');
    const exportResponse = await request(app).get('/api/knowledge/export');

    expect(programsResponse.status).toBe(500);
    expect(programsResponse.body.success).toBe(false);
    expect(discoverResponse.status).toBe(500);
    expect(discoverResponse.body.success).toBe(false);
    expect(logsResponse.status).toBe(500);
    expect(logsResponse.body.success).toBe(false);
    expect(exportResponse.status).toBe(500);
    expect(exportResponse.body.success).toBe(false);
  });
});
