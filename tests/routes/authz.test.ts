import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMockState = vi.hoisted(() => ({
  available: true,
  rows: [] as Array<Record<string, unknown>>,
  insertedRow: { id: 'grant-1', resource: 'VAULT', action: 'READ' } as Record<string, unknown>,
  insertError: null as { code?: string; message?: string } | null,
  deletedRows: [] as Array<Record<string, unknown>>,
}));

function createDbMock() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => dbMockState.rows),
        })),
        limit: vi.fn(async () => dbMockState.rows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => {
          if (dbMockState.insertError) {
            throw dbMockState.insertError;
          }
          return [dbMockState.insertedRow];
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => dbMockState.deletedRows),
      })),
    })),
  };
}

const databaseMock = vi.hoisted(() => ({
  db: createDbMock(),
  getDatabase: vi.fn(() => databaseMock.db),
  isDatabaseAvailable: vi.fn(() => dbMockState.available),
}));

vi.mock('../../server/db', () => databaseMock);

vi.mock('../../server/storage', () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

import { registerAuthzRoutes } from '../../server/routes/authz';

function createTestApp(options: { attachSession?: boolean } = {}): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userRole = (req.headers['x-test-role'] as 'MASTER' | 'GUEST' | undefined) ?? 'MASTER';
    req.sessionID = 'session-1';
    if (options.attachSession !== false) {
      (req as any).session = { userId: 'session-user-1' };
    }
    if (req.headers['x-test-authz'] === 'present') {
      req.authz = {
        source: 'db',
        grants: [
          {
            resource: 'VAULT',
            action: 'READ',
            scope: 'GLOBAL',
          },
        ],
      } as never;
    }
    next();
  });
  registerAuthzRoutes(app);
  return app;
}

const validGrantBody = {
  principalKind: 'SESSION',
  principalId: 'session-1',
  workspaceId: '',
  resource: 'VAULT',
  action: 'READ',
  scope: 'GLOBAL',
};

describe('Authz API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbMockState.available = true;
    dbMockState.rows = [{ id: 'grant-1', resource: 'VAULT', action: 'READ' }];
    dbMockState.insertedRow = { id: 'grant-1', resource: 'VAULT', action: 'READ' };
    dbMockState.insertError = null;
    dbMockState.deletedRows = [{ id: 'grant-1' }];
    databaseMock.db = createDbMock();
    databaseMock.getDatabase.mockImplementation(() => databaseMock.db);
    databaseMock.isDatabaseAvailable.mockImplementation(() => dbMockState.available);
  });

  it('returns effective grants when authz context is attached', async () => {
    const missingResponse = await request(app).get('/api/authz/effective');
    const response = await request(app)
      .get('/api/authz/effective')
      .set('x-test-authz', 'present');

    expect(missingResponse.status).toBe(500);
    expect(missingResponse.body.code).toBe('AUTHZ_NOT_LOADED');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: 'session-1',
      userRole: 'MASTER',
      source: 'db',
      grantCount: 1,
    });
  });

  it('lists grants and handles unavailable databases', async () => {
    const response = await request(app)
      .get('/api/authz/grants?principalKind=SESSION&principalId=session-1&workspaceId=&limit=5')
      .set('x-test-role', 'MASTER');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      count: 1,
      grants: [{ id: 'grant-1', resource: 'VAULT', action: 'READ' }],
    });

    dbMockState.available = false;
    const unavailableResponse = await request(app)
      .get('/api/authz/grants')
      .set('x-test-role', 'MASTER');

    expect(unavailableResponse.status).toBe(503);
    expect(unavailableResponse.body.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('requires master role for grant administration endpoints', async () => {
    const listResponse = await request(app)
      .get('/api/authz/grants')
      .set('x-test-role', 'GUEST');
    const createResponse = await request(app)
      .post('/api/authz/grants')
      .set('x-test-role', 'GUEST')
      .send(validGrantBody);
    const deleteResponse = await request(app)
      .delete('/api/authz/grants/grant-1')
      .set('x-test-role', 'GUEST');

    expect(listResponse.status).toBe(403);
    expect(createResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  it('validates, creates, and reports duplicate grants', async () => {
    const invalidResponse = await request(app)
      .post('/api/authz/grants')
      .set('x-test-role', 'MASTER')
      .send({ resource: 'VAULT' });
    const createResponse = await request(app)
      .post('/api/authz/grants')
      .set('x-test-role', 'MASTER')
      .send(validGrantBody);

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.code).toBe('INVALID_BODY');
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({ id: 'grant-1', resource: 'VAULT' });

    dbMockState.insertError = { code: '23505' };
    const duplicateResponse = await request(app)
      .post('/api/authz/grants')
      .set('x-test-role', 'MASTER')
      .send(validGrantBody);

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.code).toBe('DUPLICATE');
  });

  it('returns database unavailable when creating or deleting grants without a database', async () => {
    dbMockState.available = false;

    const createResponse = await request(app)
      .post('/api/authz/grants')
      .set('x-test-role', 'MASTER')
      .send(validGrantBody);
    const deleteResponse = await request(app)
      .delete('/api/authz/grants/grant-1')
      .set('x-test-role', 'MASTER');

    expect(createResponse.status).toBe(503);
    expect(createResponse.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(deleteResponse.status).toBe(503);
    expect(deleteResponse.body.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('deletes grants and returns 404 when the row is missing', async () => {
    const response = await request(app)
      .delete('/api/authz/grants/grant-1')
      .set('x-test-role', 'MASTER');

    expect(response.status).toBe(204);

    dbMockState.deletedRows = [];
    const missingResponse = await request(app)
      .delete('/api/authz/grants/missing')
      .set('x-test-role', 'MASTER');

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.code).toBe('NOT_FOUND');
  });

  it('binds and unbinds a business user id to the current session', async () => {
    const invalidResponse = await request(app)
      .post('/api/authz/session/bind-user')
      .set('x-test-role', 'MASTER')
      .send({});
    const bindResponse = await request(app)
      .post('/api/authz/session/bind-user')
      .set('x-test-role', 'MASTER')
      .send({ userId: 'user-42' });
    const unbindResponse = await request(app)
      .delete('/api/authz/session/bind-user')
      .set('x-test-role', 'MASTER');

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.code).toBe('INVALID_BODY');
    expect(bindResponse.status).toBe(200);
    expect(bindResponse.body).toMatchObject({ success: true, userId: 'user-42' });
    expect(unbindResponse.status).toBe(200);
    expect(unbindResponse.body.success).toBe(true);
  });

  it('returns NO_SESSION when binding a business user without a session object', async () => {
    const appWithoutSession = createTestApp({ attachSession: false });

    const response = await request(appWithoutSession)
      .post('/api/authz/session/bind-user')
      .set('x-test-role', 'MASTER')
      .send({ userId: 'user-42' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('NO_SESSION');
  });
});
