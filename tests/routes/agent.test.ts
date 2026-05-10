import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const autonomousAgentMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  getTasks: vi.fn(),
  getExecutionHistory: vi.fn(),
  executeTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const browserAgentMock = vi.hoisted(() => ({
  createProfile: vi.fn(),
  executeActions: vi.fn(),
  getPageSnapshot: vi.fn(),
  deleteProfile: vi.fn(),
  getStats: vi.fn(),
}));

const governmentFormServiceMock = vi.hoisted(() => ({
  registerWebsite: vi.fn(),
  setCredential: vi.fn(),
  setCompanyInfo: vi.fn(),
  executeApplication: vi.fn(),
  getRegisteredWebsites: vi.fn(),
}));

const websiteMonitorServiceMock = vi.hoisted(() => ({
  addMonitorConfig: vi.fn(),
  triggerCheck: vi.fn(),
  getMonitorStatus: vi.fn(),
  deleteConfig: vi.fn(),
  getAllConfigs: vi.fn(),
}));

vi.mock('../../server/services/agent', () => ({
  autonomousAgent: autonomousAgentMock,
  browserAgent: browserAgentMock,
  governmentFormService: governmentFormServiceMock,
  websiteMonitorService: websiteMonitorServiceMock,
}));

import agentRouter from '../../server/routes/agent';

function createTestApp(options: { user?: { id: string } | null } = {}): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = options.user === undefined ? { id: 'user-1' } : options.user;
    next();
  });
  app.use('/api/agent', agentRouter);
  return app;
}

describe('Agent API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    browserAgentMock.createProfile.mockResolvedValue('profile-1');
    browserAgentMock.executeActions.mockResolvedValue({ success: true, steps: 2 });
    browserAgentMock.getPageSnapshot.mockResolvedValue({ title: 'Example', url: 'https://example.com' });
    browserAgentMock.deleteProfile.mockResolvedValue(undefined);
    browserAgentMock.getStats.mockReturnValue({ profiles: 1 });
    governmentFormServiceMock.executeApplication.mockResolvedValue({ success: true, applicationId: 'app-1' });
    governmentFormServiceMock.getRegisteredWebsites.mockReturnValue([{ id: 'gov-1' }]);
    websiteMonitorServiceMock.triggerCheck.mockResolvedValue({ changed: false });
    websiteMonitorServiceMock.getMonitorStatus.mockReturnValue({ id: 'monitor-1', status: 'ok' });
    websiteMonitorServiceMock.getAllConfigs.mockReturnValue([
      { id: 'monitor-1', enabled: true },
      { id: 'monitor-2', enabled: false },
    ]);
    autonomousAgentMock.createTask.mockResolvedValue('task-1');
    autonomousAgentMock.getTasks.mockReturnValue([
      { id: 'task-1', type: 'scheduled' },
      { id: 'task-2', type: 'continuous' },
    ]);
    autonomousAgentMock.getExecutionHistory.mockReturnValue([{ id: 'exec-1' }]);
    autonomousAgentMock.executeTask.mockResolvedValue({ status: 'completed' });
    autonomousAgentMock.deleteTask.mockResolvedValue(undefined);
  });

  it('creates browser profiles, executes browser actions, and handles snapshots', async () => {
    const profileResponse = await request(app).post('/api/agent/browser/profile').send({
      name: 'Default',
      userAgent: 'UA',
      proxy: 'http://proxy',
      cookies: [{ name: 'sid' }],
    });
    const executeResponse = await request(app).post('/api/agent/browser/execute').send({
      profileId: 'profile-1',
      actions: [{ type: 'click' }],
      screenshotEach: true,
    });
    const invalidSnapshot = await request(app).get('/api/agent/browser/snapshot?profileId=profile-1');
    const snapshotResponse = await request(app).get('/api/agent/browser/snapshot?profileId=profile-1&url=https://example.com');
    const deleteResponse = await request(app).delete('/api/agent/browser/profile/profile-1');

    expect(profileResponse.body).toEqual({ success: true, profileId: 'profile-1' });
    expect(browserAgentMock.createProfile).toHaveBeenCalledWith({
      name: 'Default',
      userAgent: 'UA',
      proxy: 'http://proxy',
      cookies: [{ name: 'sid' }],
    });
    expect(executeResponse.body).toEqual({ success: true, steps: 2 });
    expect(browserAgentMock.executeActions).toHaveBeenCalledWith('profile-1', [{ type: 'click' }], { screenshotEach: true });
    expect(invalidSnapshot.status).toBe(400);
    expect(snapshotResponse.body.snapshot).toEqual({ title: 'Example', url: 'https://example.com' });
    expect(deleteResponse.body.success).toBe(true);
  });

  it('forwards government website configuration and applications with the current user', async () => {
    const registerResponse = await request(app).post('/api/agent/gov/register').send({ id: 'gov-1', url: 'https://gov.test' });
    const credentialResponse = await request(app).post('/api/agent/gov/credential').send({
      websiteId: 'gov-1',
      username: 'ada',
      password: 'secret',
    });
    const companyResponse = await request(app).post('/api/agent/gov/company').send({ name: 'Acme' });
    const applyResponse = await request(app).post('/api/agent/gov/apply').send({
      websiteId: 'gov-1',
      profileId: 'profile-1',
    });
    const websitesResponse = await request(app).get('/api/agent/gov/websites');

    expect(registerResponse.body.success).toBe(true);
    expect(governmentFormServiceMock.registerWebsite).toHaveBeenCalledWith({ id: 'gov-1', url: 'https://gov.test' });
    expect(credentialResponse.body.success).toBe(true);
    expect(governmentFormServiceMock.setCredential).toHaveBeenCalledWith('gov-1', 'ada', 'secret');
    expect(companyResponse.body.success).toBe(true);
    expect(governmentFormServiceMock.setCompanyInfo).toHaveBeenCalledWith('user-1', { name: 'Acme' });
    expect(applyResponse.body).toEqual({ success: true, applicationId: 'app-1' });
    expect(governmentFormServiceMock.executeApplication).toHaveBeenCalledWith('gov-1', 'profile-1', 'user-1');
    expect(websitesResponse.body.websites).toEqual([{ id: 'gov-1' }]);
  });

  it('creates, checks, reads, and deletes website monitors', async () => {
    const createResponse = await request(app).post('/api/agent/monitor').send({ id: 'monitor-1', url: 'https://example.com' });
    const checkResponse = await request(app).post('/api/agent/monitor/check').send({ configId: 'monitor-1' });
    const statusResponse = await request(app).get('/api/agent/monitor/monitor-1');
    const deleteResponse = await request(app).delete('/api/agent/monitor/monitor-1');

    expect(createResponse.body).toEqual({ success: true, configId: 'monitor-1' });
    expect(websiteMonitorServiceMock.addMonitorConfig).toHaveBeenCalledWith({ id: 'monitor-1', url: 'https://example.com' });
    expect(checkResponse.body.result).toEqual({ changed: false });
    expect(websiteMonitorServiceMock.triggerCheck).toHaveBeenCalledWith('monitor-1');
    expect(statusResponse.body.status).toEqual({ id: 'monitor-1', status: 'ok' });
    expect(deleteResponse.body.success).toBe(true);
  });

  it('manages autonomous agent tasks and task execution history', async () => {
    const createResponse = await request(app).post('/api/agent/tasks').send({
      name: 'Daily scan',
      type: 'scheduled',
    });
    const listResponse = await request(app).get('/api/agent/tasks');
    const detailResponse = await request(app).get('/api/agent/tasks/task-1');
    const missingResponse = await request(app).get('/api/agent/tasks/missing-task');
    const executeResponse = await request(app).post('/api/agent/tasks/task-1/execute').send({
      context: { source: 'api-test' },
      options: { dryRun: true },
    });
    const deleteResponse = await request(app).delete('/api/agent/tasks/task-1');

    expect(createResponse.body).toEqual({ success: true, taskId: 'task-1' });
    expect(autonomousAgentMock.createTask).toHaveBeenCalledWith({
      name: 'Daily scan',
      type: 'scheduled',
      createdBy: 'user-1',
    });
    expect(listResponse.body.tasks).toHaveLength(2);
    expect(detailResponse.body.history).toEqual([{ id: 'exec-1' }]);
    expect(missingResponse.status).toBe(404);
    expect(executeResponse.body.result).toEqual({ status: 'completed' });
    expect(autonomousAgentMock.executeTask).toHaveBeenCalledWith('task-1', { source: 'api-test' }, { dryRun: true });
    expect(deleteResponse.body.success).toBe(true);
  });

  it('falls back to master as task creator when no request user is attached', async () => {
    const masterFallbackApp = createTestApp({ user: null });

    const response = await request(masterFallbackApp).post('/api/agent/tasks').send({
      name: 'Fallback scan',
      type: 'scheduled',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, taskId: 'task-1' });
    expect(autonomousAgentMock.createTask).toHaveBeenCalledWith({
      name: 'Fallback scan',
      type: 'scheduled',
      createdBy: 'master',
    });
  });

  it('maps core agent service failures to 500 responses', async () => {
    browserAgentMock.executeActions.mockRejectedValueOnce(new Error('browser unavailable'));
    governmentFormServiceMock.executeApplication.mockRejectedValueOnce(new Error('gov unavailable'));
    websiteMonitorServiceMock.triggerCheck.mockRejectedValueOnce(new Error('monitor unavailable'));
    autonomousAgentMock.executeTask.mockRejectedValueOnce(new Error('task unavailable'));

    const browserResponse = await request(app).post('/api/agent/browser/execute').send({
      profileId: 'profile-1',
      actions: [{ type: 'click' }],
    });
    const govResponse = await request(app).post('/api/agent/gov/apply').send({
      websiteId: 'gov-1',
      profileId: 'profile-1',
    });
    const monitorResponse = await request(app).post('/api/agent/monitor/check').send({
      configId: 'monitor-1',
    });
    const taskResponse = await request(app).post('/api/agent/tasks/task-1/execute').send({});

    expect(browserResponse.status).toBe(500);
    expect(browserResponse.body.success).toBe(false);
    expect(govResponse.status).toBe(500);
    expect(govResponse.body.success).toBe(false);
    expect(monitorResponse.status).toBe(500);
    expect(monitorResponse.body.success).toBe(false);
    expect(taskResponse.status).toBe(500);
    expect(taskResponse.body.success).toBe(false);
  });

  it('maps aggregate stats dependency failures to 500 responses', async () => {
    browserAgentMock.getStats.mockImplementationOnce(() => {
      throw new Error('stats unavailable');
    });

    const response = await request(app).get('/api/agent/stats');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  it('returns voice command acknowledgement and aggregate agent stats', async () => {
    const voiceResponse = await request(app).post('/api/agent/voice').send({ command: 'start monitor' });
    const statsResponse = await request(app).get('/api/agent/stats');

    expect(voiceResponse.body.success).toBe(true);
    expect(statsResponse.body.stats).toEqual({
      browser: { profiles: 1 },
      tasks: { total: 2, scheduled: 1, running: 1 },
      monitors: { total: 2, active: 1 },
    });
  });
});
