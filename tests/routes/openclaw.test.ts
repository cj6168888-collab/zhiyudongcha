import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { remoteControlRouter } from '../../server/routes/remote-control';
import { taskRouter } from '../../server/routes/tasks';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/remote', remoteControlRouter);
  app.use('/api/tasks', taskRouter);
  return app;
}

describe('OpenClaw API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should return remote control service status', async () => {
    const response = await request(app).get('/api/remote/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('details');
  });

  it('should return remote device list', async () => {
    const response = await request(app).get('/api/remote/devices');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should return task list', async () => {
    const response = await request(app).get('/api/tasks');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should return task execution history', async () => {
    const response = await request(app).get('/api/tasks/executions/all?limit=5');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
