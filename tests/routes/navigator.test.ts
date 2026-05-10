import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const navigatorCoreMock = vi.hoisted(() => ({
  createNode: vi.fn(),
  listNodes: vi.fn(),
  getNode: vi.fn(),
  suspendNode: vi.fn(),
  revokeNode: vi.fn(),
  reactivateNode: vi.fn(),
  issueToken: vi.fn(),
  validateToken: vi.fn(),
  listTokens: vi.fn(),
  createFleet: vi.fn(),
  listFleets: vi.fn(),
  getFleet: vi.fn(),
  generateFleetInsights: vi.fn(),
  emergencyRecall: vi.fn(),
  getAuditLog: vi.fn(),
  getStats: vi.fn(),
  checkPermission: vi.fn(),
}));

vi.mock('../../server/services/navigator-core', () => ({
  navigatorCore: navigatorCoreMock,
}));

import { registerNavigatorRoutes } from '../../server/routes/navigator-core';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  registerNavigatorRoutes(app, {} as any, {} as any);
  return app;
}

function node(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-1',
    name: 'Node One',
    type: 'WORKER',
    status: 'ACTIVE',
    capabilities: ['browser'],
    permissions: [{ resource: 'project', action: 'read' }],
    metadata: { region: 'local' },
    createdAt: '2026-04-29T00:00:00Z',
    lastActiveAt: '2026-04-29T01:00:00Z',
    expiresAt: '2026-05-29T00:00:00Z',
    ...overrides,
  };
}

describe('Navigator API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    navigatorCoreMock.createNode.mockResolvedValue(node());
    navigatorCoreMock.listNodes.mockReturnValue([node()]);
    navigatorCoreMock.getNode.mockImplementation((id: string) => (id === 'node-1' ? node({ id }) : undefined));
    navigatorCoreMock.suspendNode.mockResolvedValue(undefined);
    navigatorCoreMock.revokeNode.mockResolvedValue(undefined);
    navigatorCoreMock.reactivateNode.mockResolvedValue(undefined);
    navigatorCoreMock.issueToken.mockResolvedValue({
      id: 'token-1',
      token: 'secret-token',
      type: 'ACCESS',
      expiresAt: '2026-05-29T00:00:00Z',
      maxUsage: 3,
    });
    navigatorCoreMock.validateToken.mockResolvedValue({ valid: true, node: node() });
    navigatorCoreMock.listTokens.mockReturnValue([
      { id: 'token-1', entityId: 'node-1', type: 'ACCESS', status: 'ACTIVE', usageCount: 1, maxUsage: 3 },
    ]);
    navigatorCoreMock.createFleet.mockResolvedValue({ id: 'fleet-1', name: 'Alpha', members: [{ id: 'node-1' }] });
    navigatorCoreMock.listFleets.mockReturnValue([
      {
        id: 'fleet-1',
        name: 'Alpha',
        members: [{ id: 'node-1' }],
        aggregatedStats: { avgMoraleScore: 0.8 },
        createdAt: '2026-04-29T00:00:00Z',
        updatedAt: '2026-04-29T01:00:00Z',
      },
    ]);
    navigatorCoreMock.getFleet.mockImplementation((id: string) =>
      id === 'fleet-1' ? { id: 'fleet-1', name: 'Alpha', members: [] } : undefined,
    );
    navigatorCoreMock.generateFleetInsights.mockResolvedValue([{ id: 'insight-1' }]);
    navigatorCoreMock.emergencyRecall.mockResolvedValue({ recalled: 2, errors: [] });
    navigatorCoreMock.getAuditLog.mockReturnValue([{ id: 'audit-1' }]);
    navigatorCoreMock.getStats.mockReturnValue({ nodes: 1, fleets: 1 });
    navigatorCoreMock.checkPermission.mockReturnValue(true);
  });

  it('validates and manages navigator nodes including lifecycle actions', async () => {
    const invalidCreate = await request(app).post('/api/navigator/nodes').send({ name: 'Node' });
    const create = await request(app).post('/api/navigator/nodes').send({
      name: 'Node One',
      type: 'WORKER',
      capabilities: ['browser'],
      permissions: [{ resource: 'project', action: 'read' }],
      expiresIn: 3600,
    });
    const list = await request(app).get('/api/navigator/nodes?type=WORKER&status=ACTIVE');
    const detail = await request(app).get('/api/navigator/nodes/node-1');
    const missing = await request(app).get('/api/navigator/nodes/missing');
    const suspend = await request(app).post('/api/navigator/nodes/node-1/suspend').send({ reason: 'maintenance' });
    const revoke = await request(app).post('/api/navigator/nodes/node-1/revoke').send({});
    const reactivate = await request(app).post('/api/navigator/nodes/node-1/reactivate').send({});

    expect(invalidCreate.status).toBe(400);
    expect(create.body.node).toMatchObject({ id: 'node-1', permissionsCount: 1 });
    expect(navigatorCoreMock.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Node One', capabilities: ['browser'] }),
    );
    expect(list.body.count).toBe(1);
    expect(navigatorCoreMock.listNodes).toHaveBeenCalledWith({ type: 'WORKER', status: 'ACTIVE' });
    expect(detail.body).toMatchObject({ id: 'node-1', metadata: { region: 'local' } });
    expect(missing.status).toBe(404);
    expect(suspend.body.success).toBe(true);
    expect(navigatorCoreMock.suspendNode).toHaveBeenCalledWith('node-1', 'maintenance');
    expect(revoke.body.success).toBe(true);
    expect(reactivate.body.success).toBe(true);
    expect(navigatorCoreMock.reactivateNode).toHaveBeenCalledWith('node-1');
  });

  it('issues, validates, and lists navigator tokens', async () => {
    const invalidIssue = await request(app).post('/api/navigator/tokens').send({ entityId: 'node-1' });
    const issue = await request(app).post('/api/navigator/tokens').send({
      entityId: 'node-1',
      type: 'ACCESS',
      expiresIn: 3600,
      maxUsage: 3,
    });
    const invalidValidate = await request(app).post('/api/navigator/tokens/validate').send({});
    const validate = await request(app).post('/api/navigator/tokens/validate').send({ token: 'secret-token' });
    const list = await request(app).get('/api/navigator/tokens?entityId=node-1');
    navigatorCoreMock.validateToken.mockResolvedValueOnce({ valid: false, reason: 'expired' });
    const invalidToken = await request(app).post('/api/navigator/tokens/validate').send({ token: 'expired-token' });
    const defaultList = await request(app).get('/api/navigator/tokens');

    expect(invalidIssue.status).toBe(400);
    expect(issue.body.token).toMatchObject({ id: 'token-1', token: 'secret-token', maxUsage: 3 });
    expect(navigatorCoreMock.issueToken).toHaveBeenCalledWith({
      entityId: 'node-1',
      type: 'ACCESS',
      expiresIn: 3600,
      maxUsage: 3,
    });
    expect(invalidValidate.status).toBe(400);
    expect(validate.body).toMatchObject({ valid: true, node: { id: 'node-1' } });
    expect(list.body.count).toBe(1);
    expect(navigatorCoreMock.listTokens).toHaveBeenCalledWith('node-1');
    expect(invalidToken.body).toEqual({ valid: false, reason: 'expired', node: null });
    expect(defaultList.body.count).toBe(1);
    expect(navigatorCoreMock.listTokens).toHaveBeenCalledWith(undefined);
  });

  it('manages fleets and fleet insights', async () => {
    const invalidCreate = await request(app).post('/api/navigator/fleets').send({ name: 'Alpha' });
    const create = await request(app).post('/api/navigator/fleets').send({ name: 'Alpha', leaderNodeId: 'node-1' });
    const list = await request(app).get('/api/navigator/fleets');
    const detail = await request(app).get('/api/navigator/fleets/fleet-1');
    const missing = await request(app).get('/api/navigator/fleets/missing');
    const insights = await request(app).post('/api/navigator/fleets/fleet-1/insights').send({});

    expect(invalidCreate.status).toBe(400);
    expect(create.body.fleet).toEqual({ id: 'fleet-1', name: 'Alpha', membersCount: 1 });
    expect(navigatorCoreMock.createFleet).toHaveBeenCalledWith('Alpha', 'node-1');
    expect(list.body.fleets[0]).toMatchObject({ id: 'fleet-1', membersCount: 1, avgMoraleScore: 0.8 });
    expect(detail.body).toMatchObject({ id: 'fleet-1' });
    expect(missing.status).toBe(404);
    expect(insights.body.insights).toEqual([{ id: 'insight-1' }]);
  });

  it('exposes emergency recall, audit, stats, placeholder reports, and alerts', async () => {
    const recall = await request(app).post('/api/navigator/emergency-recall').send({});
    const audit = await request(app).get('/api/navigator/audit?entityId=node-1&action=create&limit=5');
    const stats = await request(app).get('/api/navigator/stats');
    const reports = await request(app).get('/api/navigator/pending-reports');
    const alerts = await request(app).get('/api/navigator/alerts');

    expect(recall.status).toBe(200);
    expect(recall.body).toMatchObject({ success: true, recalled: 2, errors: [] });
    expect(navigatorCoreMock.emergencyRecall).toHaveBeenCalledOnce();
    expect(audit.body).toEqual({ logs: [{ id: 'audit-1' }], count: 1 });
    expect(navigatorCoreMock.getAuditLog).toHaveBeenCalledWith({ entityId: 'node-1', action: 'create', limit: 5 });
    expect(stats.body).toMatchObject({ nodes: 1, fleets: 1, version: '1.0.0', system: 'Navigator-X' });
    expect(reports.body).toEqual([]);
    expect(alerts.body).toEqual([]);
  });

  it('uses a default audit limit when no audit query is supplied', async () => {
    const audit = await request(app).get('/api/navigator/audit');

    expect(audit.status).toBe(200);
    expect(audit.body).toEqual({ logs: [{ id: 'audit-1' }], count: 1 });
    expect(navigatorCoreMock.getAuditLog).toHaveBeenCalledWith({
      entityId: undefined,
      action: undefined,
      limit: 100,
    });
  });

  it('checks permissions with validation', async () => {
    const invalid = await request(app).post('/api/navigator/check-permission').send({ entityId: 'node-1' });
    const valid = await request(app).post('/api/navigator/check-permission').send({
      entityId: 'node-1',
      resource: 'project',
      action: 'read',
      context: { projectId: 'project-1' },
    });

    expect(invalid.status).toBe(400);
    expect(valid.body).toEqual({ hasPermission: true });
    expect(navigatorCoreMock.checkPermission).toHaveBeenCalledWith('node-1', 'project', 'read', {
      projectId: 'project-1',
    });
  });

  it('maps representative navigator service failures to 500 responses', async () => {
    navigatorCoreMock.createNode.mockRejectedValueOnce(new Error('node create unavailable'));
    const createNode = await request(app).post('/api/navigator/nodes').send({
      name: 'Node One',
      type: 'WORKER',
      capabilities: ['browser'],
    });

    navigatorCoreMock.listNodes.mockImplementationOnce(() => {
      throw new Error('node list unavailable');
    });
    const listNodes = await request(app).get('/api/navigator/nodes');

    navigatorCoreMock.issueToken.mockRejectedValueOnce(new Error('token unavailable'));
    const issueToken = await request(app).post('/api/navigator/tokens').send({
      entityId: 'node-1',
      type: 'ACCESS',
      expiresIn: 3600,
    });

    navigatorCoreMock.createFleet.mockRejectedValueOnce(new Error('fleet unavailable'));
    const createFleet = await request(app).post('/api/navigator/fleets').send({
      name: 'Alpha',
      leaderNodeId: 'node-1',
    });

    navigatorCoreMock.generateFleetInsights.mockRejectedValueOnce(new Error('insights unavailable'));
    const insights = await request(app).post('/api/navigator/fleets/fleet-1/insights').send({});

    navigatorCoreMock.getAuditLog.mockImplementationOnce(() => {
      throw new Error('audit unavailable');
    });
    const audit = await request(app).get('/api/navigator/audit');

    navigatorCoreMock.checkPermission.mockImplementationOnce(() => {
      throw new Error('permission unavailable');
    });
    const permission = await request(app).post('/api/navigator/check-permission').send({
      entityId: 'node-1',
      resource: 'project',
      action: 'read',
    });

    expect(createNode.status).toBe(500);
    expect(createNode.body.message).toBe('node create unavailable');
    expect(listNodes.status).toBe(500);
    expect(listNodes.body).toHaveProperty('error');
    expect(issueToken.status).toBe(500);
    expect(issueToken.body.message).toBe('token unavailable');
    expect(createFleet.status).toBe(500);
    expect(createFleet.body.message).toBe('fleet unavailable');
    expect(insights.status).toBe(500);
    expect(insights.body.message).toBe('insights unavailable');
    expect(audit.status).toBe(500);
    expect(audit.body).toHaveProperty('error');
    expect(permission.status).toBe(500);
    expect(permission.body).toHaveProperty('error');
  });
});
