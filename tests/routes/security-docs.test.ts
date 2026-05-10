import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import docsRouter from '../../server/routes/docs';
import csrfRouter from '../../server/routes/csrf';
import { csrfProtection } from '../../server/middleware/csrf-protection';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {};
    next();
  });
  app.use(docsRouter);
  app.use('/api/security', csrfRouter);
  return app;
}

function createProtectedApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { csrfToken: 'known-token' };
    next();
  });
  app.post('/protected', csrfProtection, (_req, res) => res.json({ success: true }));
  app.get('/protected', csrfProtection, (_req, res) => res.json({ success: true }));
  return app;
}

describe('Security and Docs Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  it('serves the OpenAPI JSON document with core metadata', async () => {
    const response = await request(app).get('/swagger.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.openapi).toBe('3.0.0');
    expect(response.body.info).toMatchObject({
      title: 'Sheng-Yu-Zhu-Shou API',
      version: '1.0.0',
    });
  });

  it('serves the Swagger UI entrypoint', async () => {
    const response = await request(app).get('/api-docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Swagger UI');
  });

  it('issues CSRF tokens with the expected header name', async () => {
    const response = await request(app).get('/api/security/csrf-token');

    expect(response.status).toBe(200);
    expect(response.body.headerName).toBe('x-csrf-token');
    expect(response.body.token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('allows safe HTTP methods through CSRF protection', async () => {
    const protectedApp = createProtectedApp();

    const response = await request(protectedApp).get('/protected');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('rejects unsafe methods with missing or mismatched CSRF tokens', async () => {
    const protectedApp = createProtectedApp();

    const missing = await request(protectedApp).post('/protected').send({});
    const mismatch = await request(protectedApp).post('/protected').set('x-csrf-token', 'wrong-token').send({});
    const valid = await request(protectedApp).post('/protected').set('x-csrf-token', 'known-token').send({});

    expect(missing.status).toBe(403);
    expect(missing.body).toMatchObject({ code: 'CSRF_TOKEN_MISSING' });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body).toMatchObject({ code: 'CSRF_TOKEN_MISMATCH' });
    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({ success: true });
  });
});
