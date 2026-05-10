import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const alertServiceMock = vi.hoisted(() => ({
  getActiveAlerts: vi.fn(),
  getPendingAlerts: vi.fn(),
  getAlertStats: vi.fn(),
  getHighPriorityAlerts: vi.fn(),
  dismissAlert: vi.fn(),
  markAsRead: vi.fn(),
  clearAllAlerts: vi.fn(),
  createAlert: vi.fn(),
}));

vi.mock('../../server/services/alert-notification', () => ({
  alertNotificationService: alertServiceMock,
}));

import { alertRouter } from '../../server/routes/alerts';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertRouter);
  return app;
}

describe('Alert API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    alertServiceMock.getActiveAlerts.mockReturnValue([]);
    alertServiceMock.getPendingAlerts.mockResolvedValue([]);
    alertServiceMock.getAlertStats.mockResolvedValue({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
    alertServiceMock.getHighPriorityAlerts.mockResolvedValue([]);
    alertServiceMock.dismissAlert.mockReturnValue(false);
    alertServiceMock.markAsRead.mockResolvedValue(false);
    alertServiceMock.createAlert.mockResolvedValue({
      id: 'alert-1',
      type: 'SYSTEM_ERROR',
      severity: 'HIGH',
      title: 'Test alert',
      message: 'Something happened',
      timestamp: 1,
    });
  });

  it('returns active alerts with count', async () => {
    alertServiceMock.getActiveAlerts.mockReturnValue([
      { id: 'alert-1', type: 'SYSTEM_ERROR', severity: 'HIGH', title: 'A', message: 'B', timestamp: 1 },
    ]);

    const response = await request(app).get('/api/alerts');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.data[0]).toMatchObject({ id: 'alert-1', severity: 'HIGH' });
  });

  it('passes the pending alert limit through to the service', async () => {
    const response = await request(app).get('/api/alerts/pending?limit=3');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(alertServiceMock.getPendingAlerts).toHaveBeenCalledWith(3);
  });

  it('uses the default pending alert limit when the query is omitted or invalid', async () => {
    await request(app).get('/api/alerts/pending');
    await request(app).get('/api/alerts/pending?limit=not-a-number');

    expect(alertServiceMock.getPendingAlerts).toHaveBeenNthCalledWith(1, 50);
    expect(alertServiceMock.getPendingAlerts).toHaveBeenNthCalledWith(2, 50);
  });

  it('returns alert stats and high priority alerts', async () => {
    alertServiceMock.getAlertStats.mockResolvedValue({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });
    alertServiceMock.getHighPriorityAlerts.mockResolvedValue([
      { id: 'critical-1', type: 'SYSTEM_ERROR', severity: 'CRITICAL', title: 'C', message: 'M', timestamp: 1 },
    ]);

    const statsResponse = await request(app).get('/api/alerts/stats');
    const highPriorityResponse = await request(app).get('/api/alerts/high-priority');

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.data).toEqual({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });
    expect(highPriorityResponse.status).toBe(200);
    expect(highPriorityResponse.body.count).toBe(1);
    expect(highPriorityResponse.body.data[0]).toMatchObject({ severity: 'CRITICAL' });
  });

  it('validates and creates development test alerts', async () => {
    const invalidResponse = await request(app).post('/api/alerts/test').send({
      type: 'SYSTEM_ERROR',
      title: '',
      message: '',
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(alertServiceMock.createAlert).not.toHaveBeenCalled();

    const validResponse = await request(app).post('/api/alerts/test').send({
      type: 'SYSTEM_ERROR',
      severity: 'HIGH',
      title: 'Test alert',
      message: 'Something happened',
      metadata: { source: 'api-test' },
    });

    expect(validResponse.status).toBe(201);
    expect(validResponse.body.success).toBe(true);
    expect(alertServiceMock.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYSTEM_ERROR',
        severity: 'HIGH',
        title: 'Test alert',
        message: 'Something happened',
      }),
    );
  });

  it('returns 404 for missing dismiss/read targets and clears alerts', async () => {
    const dismissResponse = await request(app).post('/api/alerts/missing-alert/dismiss');
    const readResponse = await request(app).post('/api/alerts/missing-alert/read');
    const clearResponse = await request(app).delete('/api/alerts');

    expect(dismissResponse.status).toBe(404);
    expect(dismissResponse.body.success).toBe(false);
    expect(readResponse.status).toBe(404);
    expect(readResponse.body.success).toBe(false);
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.success).toBe(true);
    expect(alertServiceMock.clearAllAlerts).toHaveBeenCalledOnce();
  });

  it('dismisses and marks existing alerts as read', async () => {
    alertServiceMock.dismissAlert.mockReturnValueOnce(true);
    alertServiceMock.markAsRead.mockResolvedValueOnce(true);

    const dismissResponse = await request(app).post('/api/alerts/alert-1/dismiss');
    const readResponse = await request(app).post('/api/alerts/alert-1/read');

    expect(dismissResponse.status).toBe(200);
    expect(dismissResponse.body).toMatchObject({ success: true, message: 'Alert dismissed' });
    expect(alertServiceMock.dismissAlert).toHaveBeenCalledWith('alert-1');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({ success: true, message: 'Alert marked as read' });
    expect(alertServiceMock.markAsRead).toHaveBeenCalledWith('alert-1');
  });

  it('maps alert service failures to 500 responses', async () => {
    alertServiceMock.getActiveAlerts.mockImplementationOnce(() => {
      throw new Error('active failed');
    });
    alertServiceMock.getPendingAlerts.mockRejectedValueOnce(new Error('pending failed'));
    alertServiceMock.getAlertStats.mockRejectedValueOnce(new Error('stats failed'));
    alertServiceMock.getHighPriorityAlerts.mockRejectedValueOnce(new Error('priority failed'));
    alertServiceMock.dismissAlert.mockImplementationOnce(() => {
      throw new Error('dismiss failed');
    });
    alertServiceMock.markAsRead.mockRejectedValueOnce(new Error('read failed'));
    alertServiceMock.clearAllAlerts.mockImplementationOnce(() => {
      throw new Error('clear failed');
    });
    alertServiceMock.createAlert.mockRejectedValueOnce(new Error('create failed'));

    const activeResponse = await request(app).get('/api/alerts');
    const pendingResponse = await request(app).get('/api/alerts/pending');
    const statsResponse = await request(app).get('/api/alerts/stats');
    const priorityResponse = await request(app).get('/api/alerts/high-priority');
    const dismissResponse = await request(app).post('/api/alerts/alert-1/dismiss');
    const readResponse = await request(app).post('/api/alerts/alert-1/read');
    const clearResponse = await request(app).delete('/api/alerts');
    const createResponse = await request(app).post('/api/alerts/test').send({
      type: 'SYSTEM_ERROR',
      severity: 'HIGH',
      title: 'Test alert',
      message: 'Something happened',
    });

    for (const response of [
      activeResponse,
      pendingResponse,
      statsResponse,
      priorityResponse,
      dismissResponse,
      readResponse,
      clearResponse,
      createResponse,
    ]) {
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    }
  });
});
