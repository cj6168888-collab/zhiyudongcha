import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const battleReportGeneratorMock = vi.hoisted(() => ({
  generateDailyReport: vi.fn(),
  getLatestReport: vi.fn(),
  listReports: vi.fn(),
  getReport: vi.fn(),
  getStats: vi.fn(),
}));

vi.mock('../../server/services/battle-report-generator', () => ({
  battleReportGenerator: battleReportGeneratorMock,
}));

import { registerBattleReportRoutes } from '../../server/routes/battle-report';

function createReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    date: '2026-04-29',
    generatedAt: '2026-04-29T08:00:00Z',
    summary: {
      overallHealth: 'GOOD',
      highlights: ['momentum'],
      concerns: ['coverage'],
      actionItems: ['add tests'],
    },
    riskAlerts: [{ id: 'risk-1', level: 'CRITICAL' }],
    recommendations: [{ id: 'rec-1', priority: 'URGENT' }],
    ...overrides,
  };
}

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  registerBattleReportRoutes(app, {} as any, {} as any);
  return app;
}

describe('Battle Report API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    battleReportGeneratorMock.generateDailyReport.mockResolvedValue(createReport());
    battleReportGeneratorMock.getLatestReport.mockReturnValue(createReport());
    battleReportGeneratorMock.listReports.mockReturnValue([createReport()]);
    battleReportGeneratorMock.getReport.mockImplementation((id: string) =>
      id === 'report-1' ? createReport({ id }) : undefined,
    );
    battleReportGeneratorMock.getStats.mockReturnValue({ totalReports: 1 });
  });

  it('generates reports for explicit dates and returns response summaries', async () => {
    const response = await request(app).post('/api/report/generate').send({ date: '2026-04-29' });

    expect(response.status).toBe(200);
    expect(response.body.report).toMatchObject({
      id: 'report-1',
      risksCount: 1,
      recommendationsCount: 1,
    });
    expect(battleReportGeneratorMock.generateDailyReport).toHaveBeenCalledWith(new Date('2026-04-29'));
  });

  it('generates reports for the current date when no date is provided', async () => {
    const before = Date.now();
    const response = await request(app).post('/api/report/generate').send({});
    const after = Date.now();
    const calledDate = battleReportGeneratorMock.generateDailyReport.mock.calls.at(-1)?.[0] as Date;

    expect(response.status).toBe(200);
    expect(calledDate).toBeInstanceOf(Date);
    expect(calledDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(calledDate.getTime()).toBeLessThanOrEqual(after);
  });

  it('returns latest report and list summaries with limit forwarding', async () => {
    const latestResponse = await request(app).get('/api/report/latest');
    const listResponse = await request(app).get('/api/report/list?limit=5');
    const defaultListResponse = await request(app).get('/api/report/list');

    expect(latestResponse.body).toMatchObject({ id: 'report-1' });
    expect(listResponse.body).toMatchObject({ count: 1 });
    expect(listResponse.body.reports[0]).toMatchObject({
      id: 'report-1',
      overallHealth: 'GOOD',
      risksCount: 1,
      actionItems: ['add tests'],
    });
    expect(battleReportGeneratorMock.listReports).toHaveBeenCalledWith(5);
    expect(defaultListResponse.body.count).toBe(1);
    expect(battleReportGeneratorMock.listReports).toHaveBeenCalledWith(30);
  });

  it('returns summary and stats through their literal routes before id matching', async () => {
    const summaryResponse = await request(app).get('/api/report/summary');
    const statsResponse = await request(app).get('/api/report/stats');

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body).toMatchObject({
      available: true,
      overallHealth: 'GOOD',
      criticalRisks: 1,
      urgentRecommendations: 1,
    });
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body).toMatchObject({
      totalReports: 1,
      version: '1.0.0',
      phase: '11.6',
    });
  });

  it('returns report detail and 404s for missing latest/detail reports', async () => {
    const detailResponse = await request(app).get('/api/report/report-1');

    battleReportGeneratorMock.getLatestReport.mockReturnValueOnce(undefined);
    battleReportGeneratorMock.getReport.mockReturnValueOnce(undefined);
    const missingLatest = await request(app).get('/api/report/latest');
    const missingDetail = await request(app).get('/api/report/missing-report');

    expect(detailResponse.body).toMatchObject({ id: 'report-1' });
    expect(missingLatest.status).toBe(404);
    expect(missingDetail.status).toBe(404);
  });

  it('returns unavailable summary when no latest report exists', async () => {
    battleReportGeneratorMock.getLatestReport.mockReturnValueOnce(undefined);

    const response = await request(app).get('/api/report/summary');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ available: false });
  });

  it('maps representative service failures to route-specific 500 responses', async () => {
    battleReportGeneratorMock.generateDailyReport.mockRejectedValueOnce(new Error('generation unavailable'));
    const generateResponse = await request(app).post('/api/report/generate').send({ date: '2026-04-29' });

    battleReportGeneratorMock.getLatestReport.mockImplementationOnce(() => {
      throw new Error('latest unavailable');
    });
    const latestResponse = await request(app).get('/api/report/latest');

    battleReportGeneratorMock.listReports.mockImplementationOnce(() => {
      throw new Error('list unavailable');
    });
    const listResponse = await request(app).get('/api/report/list');

    battleReportGeneratorMock.getLatestReport.mockImplementationOnce(() => {
      throw new Error('summary unavailable');
    });
    const summaryResponse = await request(app).get('/api/report/summary');

    battleReportGeneratorMock.getStats.mockImplementationOnce(() => {
      throw new Error('stats unavailable');
    });
    const statsResponse = await request(app).get('/api/report/stats');

    battleReportGeneratorMock.getReport.mockImplementationOnce(() => {
      throw new Error('detail unavailable');
    });
    const detailResponse = await request(app).get('/api/report/report-1');

    expect(generateResponse.status).toBe(500);
    expect(generateResponse.body).toEqual({
      error: 'Failed to generate report',
      message: 'generation unavailable',
    });
    expect(latestResponse.status).toBe(500);
    expect(latestResponse.body).toEqual({ error: 'Failed to get report' });
    expect(listResponse.status).toBe(500);
    expect(listResponse.body).toEqual({ error: 'Failed to list reports' });
    expect(summaryResponse.status).toBe(500);
    expect(summaryResponse.body).toEqual({ error: 'Failed to get summary' });
    expect(statsResponse.status).toBe(500);
    expect(statsResponse.body).toEqual({ error: 'Failed to get stats' });
    expect(detailResponse.status).toBe(500);
    expect(detailResponse.body).toEqual({ error: 'Failed to get report detail' });
  });
});
