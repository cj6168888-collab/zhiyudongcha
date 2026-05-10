import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const storageAdapterMock = vi.hoisted(() => ({
  createVaultItem: vi.fn(),
  updatePerson: vi.fn(),
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
  updateVaultItem: vi.fn(),
}));

const webSocketManagerMock = vi.hoisted(() => ({
  context: {
    broadcastDataChange: vi.fn(),
    connectedUsers: new Map<string, unknown>(),
    z3Clients: new Map<string, { readyState: number; send: ReturnType<typeof vi.fn> }>(),
  },
}));

const lawyerLetterProcessorMock = vi.hoisted(() => ({
  processFromFile: vi.fn(),
}));

const psychProfilerServiceMock = vi.hoisted(() => ({
  analyzeFromPhoto: vi.fn(),
}));

const mctsEngineMock = vi.hoisted(() => ({
  runSimulation: vi.fn(),
}));

const financeServiceMock = vi.hoisted(() => ({
  processExpense: vi.fn(),
}));

const autoProcessWorkflowMock = vi.hoisted(() => ({
  getStatistics: vi.fn(),
}));

vi.mock('../../server/storage/adapter', () => ({
  storageAdapter: storageAdapterMock,
}));

vi.mock('../../server/websocket', () => ({
  webSocketManager: webSocketManagerMock,
}));

vi.mock('../../server/services/LawyerLetterProcessor', () => ({
  default: lawyerLetterProcessorMock,
}));

vi.mock('../../server/services/psych-profiler', () => ({
  psychProfilerService: psychProfilerServiceMock,
}));

vi.mock('../../server/services/mcts-engine', () => ({
  mctsEngine: mctsEngineMock,
}));

vi.mock('../../server/services/FinanceService', () => ({
  financeService: financeServiceMock,
}));

vi.mock('../../server/services/mobile/AutoProcessWorkflow', () => ({
  autoProcessWorkflow: autoProcessWorkflowMock,
}));

// swarmTaskRegistry 用真实实例（纯内存，无副作用）
// 不需要 mock：每次测试 registry 由路由内部单例共享，测试间任务 ID 不同可独立验证

import businessRouter from '../../server/routes/business.routes';

function createTestApp(): Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/business', businessRouter);
  return app;
}

describe('Business API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    webSocketManagerMock.context.connectedUsers = new Map([
      ['user-1', { id: 'user-1' }],
      ['user-2', { id: 'user-2' }],
    ]);
    webSocketManagerMock.context.z3Clients = new Map([
      ['client-1', { readyState: 1, send: vi.fn() }],
      ['client-2', { readyState: 0, send: vi.fn() }],
    ]);
    storageAdapterMock.createVaultItem.mockResolvedValue({ id: 'vault-1', fileName: 'review.md' });
    storageAdapterMock.updatePerson.mockResolvedValue({ id: 'person-1' });
    storageAdapterMock.getAuditLogs.mockResolvedValue([{ id: 'audit-1' }]);
    storageAdapterMock.createAuditLog.mockResolvedValue({ id: 'audit-2' });
    storageAdapterMock.updateVaultItem.mockResolvedValue({ id: 'vault-1', content: 'updated' });
    lawyerLetterProcessorMock.processFromFile.mockResolvedValue({ success: true, summary: 'image summary' });
    psychProfilerServiceMock.analyzeFromPhoto.mockResolvedValue({
      success: true,
      profile: {
        decisionMakingStyle: 'analytical',
        personalityType: 'INTJ',
        avoidBehaviors: ['rushing'],
      },
    });
    mctsEngineMock.runSimulation.mockResolvedValue({ insights: ['step-1'], winProbability: 0.72 });
    financeServiceMock.processExpense.mockResolvedValue({ success: true, entryId: 'expense-1' });
    autoProcessWorkflowMock.getStatistics.mockReturnValue({ activeJobs: 2 });
  });

  it('validates expert review input, persists review reports, and broadcasts vault changes', async () => {
    const invalidResponse = await request(app).post('/api/business/experts/review').send({ content: 'x' });
    const contentResponse = await request(app).post('/api/business/experts/review').send({
      expertId: 'lawyer-1',
      content: 'review this contract',
      projectId: 'project-1',
    });
    const imageResponse = await request(app).post('/api/business/experts/review').send({
      expertId: 'lawyer/1',
      imageBase64: 'data:image/png;base64,abc123',
      projectId: 'project:1',
    });

    expect(invalidResponse.status).toBe(400);
    expect(contentResponse.status).toBe(200);
    expect(contentResponse.body.item).toMatchObject({ id: 'vault-1' });
    expect(storageAdapterMock.createVaultItem).toHaveBeenCalledWith(
      expect.objectContaining({
        expertId: 'lawyer-1',
        content: 'review this contract',
        projectId: 'project-1',
      }),
    );
    expect(webSocketManagerMock.context.broadcastDataChange).toHaveBeenCalledWith(
      'vault',
      'create',
      expect.objectContaining({ id: 'vault-1' }),
    );
    expect(imageResponse.status).toBe(200);
    expect(lawyerLetterProcessorMock.processFromFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^scan_project_1_lawyer_1_\d+\.jpg$/),
        content: 'abc123',
        encoding: 'base64',
      }),
    );
  });

  it('validates and forwards finance, psych, and reasoning requests', async () => {
    const invalidFinance = await request(app).post('/api/business/finance/analysis').send({ amount: 0 });
    const financeResponse = await request(app)
      .post('/api/business/finance/analysis')
      .send({ amount: '12.5', note: 'lunch', projectId: 'project-1' });
    const psychResponse = await request(app)
      .post('/api/business/experts/psych-analysis')
      .send({ imageBase64: 'data:image/jpeg;base64,photo', personId: 'person-1' });
    const reasoningResponse = await request(app).post('/api/business/experts/reasoning').send({});

    expect(invalidFinance.status).toBe(400);
    expect(financeResponse.body).toEqual({ success: true, entryId: 'expense-1' });
    expect(financeServiceMock.processExpense).toHaveBeenCalledWith(12.5, 'lunch', 'project-1');
    expect(psychResponse.body.success).toBe(true);
    expect(storageAdapterMock.updatePerson).toHaveBeenCalledWith('person-1', {
      decisionStyle: 'analytical',
      decisionDna: 'INTJ',
      weakness: ['rushing'],
    });
    expect(reasoningResponse.body).toMatchObject({ success: true, steps: ['step-1'], winRate: 0.72 });
    expect(mctsEngineMock.runSimulation).toHaveBeenCalledWith('negotiation', {});
  });

  it('enforces strict payload schemas and skips CRM sync when psych analysis has no person', async () => {
    const strictFinanceResponse = await request(app)
      .post('/api/business/finance/analysis')
      .send({ amount: 12, extra: 'not allowed' });
    const strictReasoningResponse = await request(app)
      .post('/api/business/experts/reasoning')
      .send({ scenarioId: 'strategy', extra: 'not allowed' });
    const psychResponse = await request(app)
      .post('/api/business/experts/psych-analysis')
      .send({ imageBase64: 'raw-photo' });

    expect(strictFinanceResponse.status).toBe(400);
    expect(strictReasoningResponse.status).toBe(400);
    expect(psychResponse.status).toBe(200);
    expect(psychProfilerServiceMock.analyzeFromPhoto).toHaveBeenCalledWith('raw-photo');
    expect(storageAdapterMock.updatePerson).not.toHaveBeenCalled();
  });

  it('returns workflow, audit, and swarm status snapshots', async () => {
    const workflowResponse = await request(app).get('/api/business/workflow/status');
    const auditResponse = await request(app).get('/api/business/system/audit');
    const swarmResponse = await request(app).get('/api/business/swarm/status');

    expect(workflowResponse.body).toMatchObject({ success: true, activeJobs: 2, progress: 74 });
    expect(auditResponse.body.logs).toEqual([{ id: 'audit-1' }]);
    expect(storageAdapterMock.getAuditLogs).toHaveBeenCalledWith(50);
    expect(swarmResponse.body).toMatchObject({ success: true, onlineCount: 2, tasks: [] });
  });

  it('validates swarm broadcast input, sends to ready clients, and writes audit logs', async () => {
    const invalidResponse = await request(app).post('/api/business/swarm/broadcast').send({});
    const response = await request(app).post('/api/business/swarm/broadcast').send({
      taskName: 'refresh-index',
      targetNodes: ['node-1'],
      payload: { scope: 'knowledge' },
    });
    const readyClient = webSocketManagerMock.context.z3Clients.get('client-1');
    const offlineClient = webSocketManagerMock.context.z3Clients.get('client-2');

    expect(invalidResponse.status).toBe(400);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      taskName: 'refresh-index',
      deliveredCount: 1,
      failedCount: 0,
      onlineNodes: 2,
    });
    expect(readyClient?.send).toHaveBeenCalledWith(expect.stringContaining('"type":"TASK_BROADCAST"'));
    expect(offlineClient?.send).not.toHaveBeenCalled();
    expect(storageAdapterMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'MASTER',
        action: 'TASK_BROADCAST',
        targetType: 'SWARM',
        result: 'SUCCESS',
      }),
    );
  });

  it('counts failed swarm client sends while preserving the broadcast audit', async () => {
    const failingClient = { readyState: 1, send: vi.fn(() => { throw new Error('socket closed'); }) };
    const readyClient = { readyState: 1, send: vi.fn() };
    webSocketManagerMock.context.z3Clients = new Map([
      ['client-fail', failingClient],
      ['client-ready', readyClient],
    ]);

    const response = await request(app).post('/api/business/swarm/broadcast').send({
      taskName: 'refresh-index',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      deliveredCount: 1,
      failedCount: 1,
      targetNodes: 'ALL',
    });
    expect(failingClient.send).toHaveBeenCalledOnce();
    expect(readyClient.send).toHaveBeenCalledOnce();
    expect(storageAdapterMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ taskName: 'refresh-index', targetNodes: undefined }),
      }),
    );
  });

  it('validates vault update bodies and persists content changes', async () => {
    const invalidResponse = await request(app).put('/api/business/vault/vault-1').send({ content: '' });
    const response = await request(app).put('/api/business/vault/vault-1').send({ content: 'updated' });

    expect(invalidResponse.status).toBe(400);
    expect(response.status).toBe(200);
    expect(response.body.item).toEqual({ id: 'vault-1', content: 'updated' });
    expect(storageAdapterMock.updateVaultItem).toHaveBeenCalledWith('vault-1', { content: 'updated' });
  });

  it('maps representative business service failures to 500 responses', async () => {
    storageAdapterMock.createVaultItem.mockRejectedValueOnce(new Error('vault unavailable'));
    const expertResponse = await request(app).post('/api/business/experts/review').send({
      expertId: 'lawyer-1',
      content: 'review this contract',
    });

    financeServiceMock.processExpense.mockRejectedValueOnce(new Error('finance unavailable'));
    const financeResponse = await request(app)
      .post('/api/business/finance/analysis')
      .send({ amount: 12, note: 'lunch' });

    psychProfilerServiceMock.analyzeFromPhoto.mockRejectedValueOnce(new Error('psych unavailable'));
    const psychResponse = await request(app)
      .post('/api/business/experts/psych-analysis')
      .send({ imageBase64: 'raw-photo' });

    mctsEngineMock.runSimulation.mockRejectedValueOnce(new Error('mcts unavailable'));
    const reasoningResponse = await request(app).post('/api/business/experts/reasoning').send({});

    storageAdapterMock.updateVaultItem.mockRejectedValueOnce(new Error('vault update unavailable'));
    const vaultResponse = await request(app).put('/api/business/vault/vault-1').send({ content: 'updated' });

    expect(expertResponse.status).toBe(500);
    expect(expertResponse.body.error.code).toBe('EXPERT_ERROR');
    expect(financeResponse.status).toBe(500);
    expect(financeResponse.body.error.code).toBe('FINANCE_ERROR');
    expect(psychResponse.status).toBe(500);
    expect(psychResponse.body.error.code).toBe('PSYCH_ERROR');
    expect(reasoningResponse.status).toBe(500);
    expect(reasoningResponse.body.error.code).toBe('REASONING_ERROR');
    expect(vaultResponse.status).toBe(500);
    expect(vaultResponse.body.error.code).toBe('VAULT_ERROR');
  });

  // ── 蜂群闭环 (阶段六) ──────────────────────────────────────────────────────

  it('broadcast returns taskId for closure tracking', async () => {
    const response = await request(app).post('/api/business/swarm/broadcast').send({
      taskName: '整理项目战报',
      payload: { week: '2026-W18' },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.taskId).toBeTruthy();
    expect(response.body.taskName).toBe('整理项目战报');
    // taskId 应透传到 WebSocket 消息
    const readyClient = webSocketManagerMock.context.z3Clients.get('client-1');
    expect(readyClient?.send).toHaveBeenCalledWith(
      expect.stringContaining('"taskId"'),
    );
  });

  it('node can report status back via POST /swarm/report', async () => {
    // 先广播获得 taskId
    const broadcastRes = await request(app).post('/api/business/swarm/broadcast').send({
      taskName: '发送日报',
    });
    const { taskId } = broadcastRes.body;

    // 节点回传 running
    const reportRunning = await request(app).post('/api/business/swarm/report').send({
      taskId,
      nodeId: 'node-a',
      status: 'running',
    });
    expect(reportRunning.status).toBe(200);
    expect(reportRunning.body.report.status).toBe('running');

    // 节点回传 completed（覆盖 running）
    const reportDone = await request(app).post('/api/business/swarm/report').send({
      taskId,
      nodeId: 'node-a',
      status: 'completed',
      result: { summary: '日报已发送' },
    });
    expect(reportDone.status).toBe(200);
    expect(reportDone.body.report.status).toBe('completed');
  });

  it('POST /swarm/report validates required fields', async () => {
    const missingTaskId = await request(app).post('/api/business/swarm/report').send({
      nodeId: 'node-a', status: 'completed',
    });
    const missingStatus = await request(app).post('/api/business/swarm/report').send({
      taskId: 'some-id', nodeId: 'node-a',
    });
    const invalidStatus = await request(app).post('/api/business/swarm/report').send({
      taskId: 'some-id', nodeId: 'node-a', status: 'unknown',
    });
    const unknownTask = await request(app).post('/api/business/swarm/report').send({
      taskId: 'non-existent', nodeId: 'node-a', status: 'completed',
    });

    expect(missingTaskId.status).toBe(400);
    expect(missingStatus.status).toBe(400);
    expect(invalidStatus.status).toBe(400);
    expect(unknownTask.status).toBe(404);
  });

  it('GET /swarm/tasks lists all broadcast tasks', async () => {
    const b1 = await request(app).post('/api/business/swarm/broadcast').send({ taskName: 'task-list-a' });
    const b2 = await request(app).post('/api/business/swarm/broadcast').send({ taskName: 'task-list-b' });

    const listRes = await request(app).get('/api/business/swarm/tasks');
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const taskNames = listRes.body.tasks.map((t: any) => t.taskName);
    expect(taskNames).toContain('task-list-a');
    expect(taskNames).toContain('task-list-b');

    // 最新任务排在前面
    expect(listRes.body.tasks[0].taskName).toBe('task-list-b');

    // 结构检查
    const first = listRes.body.tasks[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('reportCount');
    expect(first).toHaveProperty('completedCount');
    expect(first).toHaveProperty('failedCount');
  });

  it('GET /swarm/tasks/:id returns full task progress (queen view)', async () => {
    const broadcastRes = await request(app).post('/api/business/swarm/broadcast').send({
      taskName: '核对战报',
      payload: { scope: 'Q2' },
    });
    const { taskId } = broadcastRes.body;

    // 两个节点回传
    await request(app).post('/api/business/swarm/report').send({ taskId, nodeId: 'node-1', status: 'completed', result: '已核对' });
    await request(app).post('/api/business/swarm/report').send({ taskId, nodeId: 'node-2', status: 'failed', error: '超时' });

    const detailRes = await request(app).get(`/api/business/swarm/tasks/${taskId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.task.taskName).toBe('核对战报');
    expect(detailRes.body.task.reports).toHaveLength(2);
    expect(detailRes.body.task.summary).toMatchObject({
      total: 2,
      completed: 1,
      failed: 1,
      running: 0,
    });
  });

  it('GET /swarm/tasks/:id returns 404 for unknown task', async () => {
    const res = await request(app).get('/api/business/swarm/tasks/non-existent');
    expect(res.status).toBe(404);
  });
});
