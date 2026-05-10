import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const telemetryServiceMock = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
  getSystemHealth: vi.fn(),
  getRequestMetrics: vi.fn(),
  getModelMetrics: vi.fn(),
  getHPMetrics: vi.fn(),
  getTotalCost: vi.fn(),
  getTopEndpoints: vi.fn(),
  getUnacknowledgedAlerts: vi.fn(),
  getRecentAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  recordRequest: vi.fn(),
  recordModelCall: vi.fn(),
  consumeHP: vi.fn(),
  recordError: vi.fn(),
}));

vi.mock('../../server/services/telemetry-service', () => ({
  telemetryService: telemetryServiceMock,
}));

import telemetryRouter from '../../server/routes/telemetry';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/telemetry', telemetryRouter);
  return app;
}

describe('Telemetry API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    telemetryServiceMock.getDashboardData.mockReturnValue({
      systemHealth: { status: 'healthy', uptime: 123 },
      requestMetrics: { total: 10 },
      hpMetrics: { remaining: 90 },
      recentAlerts: [{ id: 'alert-1' }],
    });
    telemetryServiceMock.getSystemHealth.mockReturnValue({ status: 'healthy' });
    telemetryServiceMock.getRequestMetrics.mockReturnValue({ total: 10 });
    telemetryServiceMock.getModelMetrics.mockReturnValue({ calls: 2 });
    telemetryServiceMock.getHPMetrics.mockReturnValue({ remaining: 90 });
    telemetryServiceMock.getTotalCost.mockReturnValue({ totalUsd: 1.25 });
    telemetryServiceMock.getTopEndpoints.mockReturnValue([{ path: '/api/chat', count: 4 }]);
    telemetryServiceMock.getUnacknowledgedAlerts.mockReturnValue([{ id: 'alert-unacked' }]);
    telemetryServiceMock.getRecentAlerts.mockReturnValue([{ id: 'alert-recent' }]);
    telemetryServiceMock.acknowledgeAlert.mockReturnValue(true);
  });

  it('returns core telemetry snapshots and derived status data', async () => {
    const dashboard = await request(app).get('/api/telemetry/dashboard');
    const health = await request(app).get('/api/telemetry/health');
    const requests = await request(app).get('/api/telemetry/requests');
    const models = await request(app).get('/api/telemetry/models');
    const hp = await request(app).get('/api/telemetry/hp');
    const cost = await request(app).get('/api/telemetry/cost');
    const status = await request(app).get('/api/telemetry/status');

    expect(dashboard.body.data.systemHealth.status).toBe('healthy');
    expect(health.body.data).toEqual({ status: 'healthy' });
    expect(requests.body.data).toEqual({ total: 10 });
    expect(models.body.data).toEqual({ calls: 2 });
    expect(hp.body.data).toEqual({ remaining: 90 });
    expect(cost.body.data).toEqual({ totalUsd: 1.25 });
    expect(status.body.data).toMatchObject({
      status: 'healthy',
      uptime: 123,
      requests: { total: 10 },
      hp: { remaining: 90 },
      cost: { totalUsd: 1.25 },
      alertCount: 1,
    });
  });

  it('applies endpoint and alert query parameters', async () => {
    const endpoints = await request(app).get('/api/telemetry/endpoints?limit=3');
    const recentAlerts = await request(app).get('/api/telemetry/alerts?limit=7');
    const unacknowledgedAlerts = await request(app).get('/api/telemetry/alerts?unacknowledged=true');

    expect(endpoints.body.data).toEqual([{ path: '/api/chat', count: 4 }]);
    expect(telemetryServiceMock.getTopEndpoints).toHaveBeenCalledWith(3);
    expect(recentAlerts.body.data).toEqual([{ id: 'alert-recent' }]);
    expect(telemetryServiceMock.getRecentAlerts).toHaveBeenCalledWith(7);
    expect(unacknowledgedAlerts.body.data).toEqual([{ id: 'alert-unacked' }]);
    expect(telemetryServiceMock.getUnacknowledgedAlerts).toHaveBeenCalledOnce();
  });

  it('uses default endpoint and alert limits when query parameters are omitted', async () => {
    const endpoints = await request(app).get('/api/telemetry/endpoints');
    const alerts = await request(app).get('/api/telemetry/alerts');

    expect(endpoints.status).toBe(200);
    expect(telemetryServiceMock.getTopEndpoints).toHaveBeenCalledWith(10);
    expect(alerts.status).toBe(200);
    expect(telemetryServiceMock.getRecentAlerts).toHaveBeenCalledWith(20);
  });

  it('acknowledges alerts and surfaces missing alert acknowledgements', async () => {
    const acknowledged = await request(app).post('/api/telemetry/alerts/alert-1/acknowledge').send({});

    telemetryServiceMock.acknowledgeAlert.mockReturnValueOnce(false);
    const missing = await request(app).post('/api/telemetry/alerts/missing/acknowledge').send({});

    expect(acknowledged.body.success).toBe(true);
    expect(telemetryServiceMock.acknowledgeAlert).toHaveBeenCalledWith('alert-1');
    expect(missing.status).toBe(200);
    expect(missing.body.success).toBe(false);
  });

  it('records all supported telemetry event types and rejects unknown records', async () => {
    const requestRecord = await request(app)
      .post('/api/telemetry/record')
      .send({ type: 'request', data: { path: '/api/chat', durationMs: 25, success: true } });
    const modelRecord = await request(app).post('/api/telemetry/record').send({
      type: 'model',
      data: { model: 'qwen', inputTokens: 10, outputTokens: 20, durationMs: 40, success: true },
    });
    const hpRecord = await request(app).post('/api/telemetry/record').send({
      type: 'hp',
      data: { amount: 3, module: 'chat' },
    });
    const errorRecord = await request(app).post('/api/telemetry/record').send({
      type: 'error',
      data: { message: 'boom', source: 'api' },
    });
    const invalidRecord = await request(app).post('/api/telemetry/record').send({ type: 'unknown', data: {} });

    expect(requestRecord.body.success).toBe(true);
    expect(modelRecord.body.success).toBe(true);
    expect(hpRecord.body.success).toBe(true);
    expect(errorRecord.body.success).toBe(true);
    expect(invalidRecord.status).toBe(400);
    expect(telemetryServiceMock.recordRequest).toHaveBeenCalledWith('/api/chat', 25, true);
    expect(telemetryServiceMock.recordModelCall).toHaveBeenCalledWith('qwen', 10, 20, 40, true);
    expect(telemetryServiceMock.consumeHP).toHaveBeenCalledWith(3, 'chat');
    expect(telemetryServiceMock.recordError).toHaveBeenCalledWith('boom', 'api');
  });

  it('returns 500 with thrown telemetry error messages and stringified non-error values', async () => {
    telemetryServiceMock.getDashboardData.mockImplementationOnce(() => {
      throw new Error('telemetry offline');
    });
    telemetryServiceMock.getSystemHealth.mockImplementationOnce(() => {
      throw 'health offline';
    });

    const response = await request(app).get('/api/telemetry/dashboard');
    const nonErrorResponse = await request(app).get('/api/telemetry/health');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, error: 'telemetry offline' });
    expect(nonErrorResponse.status).toBe(500);
    expect(nonErrorResponse.body).toEqual({ success: false, error: 'health offline' });
  });

  it('maps alert acknowledgement, record, and status failures to 500 responses', async () => {
    telemetryServiceMock.acknowledgeAlert.mockImplementationOnce(() => {
      throw new Error('ack unavailable');
    });
    const acknowledgeResponse = await request(app).post('/api/telemetry/alerts/alert-1/acknowledge').send({});

    telemetryServiceMock.recordModelCall.mockImplementationOnce(() => {
      throw new Error('model record unavailable');
    });
    const recordResponse = await request(app).post('/api/telemetry/record').send({
      type: 'model',
      data: { model: 'qwen', inputTokens: 10, outputTokens: 20, durationMs: 40, success: true },
    });

    telemetryServiceMock.getTotalCost.mockImplementationOnce(() => {
      throw new Error('cost unavailable');
    });
    const statusResponse = await request(app).get('/api/telemetry/status');

    expect(acknowledgeResponse.status).toBe(500);
    expect(acknowledgeResponse.body).toEqual({ success: false, error: 'ack unavailable' });
    expect(recordResponse.status).toBe(500);
    expect(recordResponse.body).toEqual({ success: false, error: 'model record unavailable' });
    expect(statusResponse.status).toBe(500);
    expect(statusResponse.body).toEqual({ success: false, error: 'cost unavailable' });
  });
});
