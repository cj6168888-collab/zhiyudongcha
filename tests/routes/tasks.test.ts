import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const taskOrchestratorMock = vi.hoisted(() => ({
  getAllTasks: vi.fn(),
  getEnabledTasks: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  executeTask: vi.fn(),
  getTaskHistory: vi.fn(),
  getAllExecutions: vi.fn(),
  getExecution: vi.fn(),
}));

vi.mock('../../server/services/task-orchestrator', () => ({
  taskOrchestrator: taskOrchestratorMock,
}));

import { taskRouter } from '../../server/routes/tasks';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', taskRouter);
  return app;
}

function validTaskBody() {
  return {
    name: 'API contract task',
    trigger: { type: 'MANUAL', config: {} },
    actions: [
      {
        deviceId: 'pc-1',
        deviceType: 'PC',
        actionType: 'CLICK',
        params: { x: 10, y: 20 },
      },
    ],
    options: { continueOnError: false },
    enabled: true,
  };
}

describe('Task API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    taskOrchestratorMock.getAllTasks.mockResolvedValue([]);
    taskOrchestratorMock.getEnabledTasks.mockResolvedValue([]);
    taskOrchestratorMock.getTask.mockResolvedValue(undefined);
    taskOrchestratorMock.updateTask.mockResolvedValue(undefined);
    taskOrchestratorMock.deleteTask.mockResolvedValue(false);
    taskOrchestratorMock.getTaskHistory.mockResolvedValue([]);
    taskOrchestratorMock.getAllExecutions.mockResolvedValue([]);
    taskOrchestratorMock.getExecution.mockResolvedValue(undefined);
  });

  it('creates tasks after validating the request body', async () => {
    const persistedTask = {
      id: 'task-1',
      ...validTaskBody(),
      status: 'PENDING',
      createdAt: 1,
      updatedAt: 1,
    };
    taskOrchestratorMock.createTask.mockResolvedValue(persistedTask);

    const invalidResponse = await request(app).post('/api/tasks').send({ name: '' });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(taskOrchestratorMock.createTask).not.toHaveBeenCalled();

    const validResponse = await request(app).post('/api/tasks').send(validTaskBody());

    expect(validResponse.status).toBe(201);
    expect(validResponse.body.success).toBe(true);
    expect(validResponse.body.data).toMatchObject({ id: 'task-1', status: 'PENDING' });
    expect(taskOrchestratorMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'API contract task',
        enabled: true,
      }),
    );
  });

  it('lists all and enabled tasks with counts', async () => {
    const task = {
      id: 'task-1',
      ...validTaskBody(),
      status: 'PENDING',
    };
    taskOrchestratorMock.getAllTasks.mockResolvedValue([task]);
    taskOrchestratorMock.getEnabledTasks.mockResolvedValue([task]);

    const allResponse = await request(app).get('/api/tasks');
    const enabledResponse = await request(app).get('/api/tasks/enabled');

    expect(allResponse.status).toBe(200);
    expect(allResponse.body).toMatchObject({ success: true, count: 1 });
    expect(enabledResponse.status).toBe(200);
    expect(enabledResponse.body).toMatchObject({ success: true, count: 1 });
  });

  it('updates and deletes existing tasks', async () => {
    const updatedTask = {
      id: 'task-1',
      ...validTaskBody(),
      enabled: false,
      status: 'PENDING',
    };
    taskOrchestratorMock.updateTask.mockResolvedValue(updatedTask);
    taskOrchestratorMock.deleteTask.mockResolvedValue(true);

    const updateResponse = await request(app).put('/api/tasks/task-1').send({ enabled: false });
    const deleteResponse = await request(app).delete('/api/tasks/task-1');

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({ id: 'task-1', enabled: false });
    expect(taskOrchestratorMock.updateTask).toHaveBeenCalledWith('task-1', { enabled: false });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({ success: true, message: 'Task deleted' });
  });

  it('returns TaskExecution shaped data from execute requests', async () => {
    taskOrchestratorMock.executeTask.mockResolvedValue({
      id: 'execution-1',
      taskId: 'task-1',
      status: 'COMPLETED',
      startedAt: 1,
      completedAt: 2,
      actions: [{ actionId: 'action-1', status: 'COMPLETED', duration: 1 }],
      result: {
        success: true,
        completedActions: 1,
        failedActions: 0,
        totalDuration: 1,
      },
    });

    const response = await request(app).post('/api/tasks/task-1/execute').send({ triggeredBy: 'api-test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 'execution-1',
      taskId: 'task-1',
      status: 'COMPLETED',
      result: { success: true, completedActions: 1 },
    });
    expect(taskOrchestratorMock.executeTask).toHaveBeenCalledWith('task-1', 'api-test');
  });

  it('maps execute failures to useful HTTP status codes', async () => {
    taskOrchestratorMock.executeTask.mockRejectedValueOnce(new Error('Task not found: missing-task'));
    const missingResponse = await request(app).post('/api/tasks/missing-task/execute').send({});

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.success).toBe(false);
    expect(missingResponse.body.error).toContain('Task not found');

    taskOrchestratorMock.executeTask.mockRejectedValueOnce(new Error('Max concurrent tasks reached'));
    const saturatedResponse = await request(app).post('/api/tasks/task-1/execute').send({});

    expect(saturatedResponse.status).toBe(429);
    expect(saturatedResponse.body.success).toBe(false);
    expect(saturatedResponse.body.error).toContain('Max concurrent tasks');
  });

  it('returns 404 for missing task and execution resources', async () => {
    const taskResponse = await request(app).get('/api/tasks/missing-task');
    const executionResponse = await request(app).get('/api/tasks/executions/missing-execution');
    const deleteResponse = await request(app).delete('/api/tasks/missing-task');

    expect(taskResponse.status).toBe(404);
    expect(taskResponse.body.success).toBe(false);
    expect(executionResponse.status).toBe(404);
    expect(executionResponse.body.success).toBe(false);
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.success).toBe(false);
  });

  it('returns task history and execution lists with default and explicit limits', async () => {
    taskOrchestratorMock.getTaskHistory.mockResolvedValue([{ id: 'history-1' }]);
    taskOrchestratorMock.getAllExecutions.mockResolvedValue([{ id: 'execution-1' }]);
    taskOrchestratorMock.getExecution.mockResolvedValue({ id: 'execution-1', taskId: 'task-1' });

    const historyResponse = await request(app).get('/api/tasks/task-1/history');
    const executionsResponse = await request(app).get('/api/tasks/executions/all?limit=5');
    const executionResponse = await request(app).get('/api/tasks/executions/execution-1');

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body).toMatchObject({ success: true, count: 1 });
    expect(taskOrchestratorMock.getTaskHistory).toHaveBeenCalledWith('task-1', 50);
    expect(executionsResponse.status).toBe(200);
    expect(taskOrchestratorMock.getAllExecutions).toHaveBeenCalledWith(5);
    expect(executionResponse.status).toBe(200);
    expect(executionResponse.body.data).toMatchObject({ id: 'execution-1' });
  });

  it('maps task orchestrator failures to 500 responses', async () => {
    taskOrchestratorMock.getAllTasks.mockRejectedValueOnce(new Error('list failed'));
    taskOrchestratorMock.getEnabledTasks.mockRejectedValueOnce(new Error('enabled failed'));
    taskOrchestratorMock.createTask.mockRejectedValueOnce(new Error('create failed'));
    taskOrchestratorMock.updateTask.mockRejectedValueOnce(new Error('update failed'));
    taskOrchestratorMock.deleteTask.mockRejectedValueOnce(new Error('delete failed'));
    taskOrchestratorMock.getTaskHistory.mockRejectedValueOnce(new Error('history failed'));
    taskOrchestratorMock.getAllExecutions.mockRejectedValueOnce(new Error('executions failed'));
    taskOrchestratorMock.getExecution.mockRejectedValueOnce(new Error('execution failed'));

    const responses = [
      await request(app).get('/api/tasks'),
      await request(app).get('/api/tasks/enabled'),
      await request(app).post('/api/tasks').send(validTaskBody()),
      await request(app).put('/api/tasks/task-1').send({ enabled: false }),
      await request(app).delete('/api/tasks/task-1'),
      await request(app).get('/api/tasks/task-1/history'),
      await request(app).get('/api/tasks/executions/all'),
      await request(app).get('/api/tasks/executions/execution-1'),
    ];

    for (const response of responses) {
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    }
  });

  // ── 循环任务（CRON trigger）────────────────────────────

  it('创建 CRON 循环任务，透传 cron 表达式和时区', async () => {
    const cronTask = {
      id: 'task-cron-1',
      name: '每周一整理项目战报',
      trigger: { type: 'CRON', config: { expression: '0 9 * * 1', timezone: 'Asia/Shanghai' } },
      actions: [{ deviceId: 'server', deviceType: 'SERVER', actionType: 'COMMAND', params: { cmd: 'report' } }],
      options: {},
      enabled: true,
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    taskOrchestratorMock.createTask.mockResolvedValue(cronTask);

    const res = await request(app).post('/api/tasks').send({
      name: '每周一整理项目战报',
      trigger: { type: 'CRON', config: { expression: '0 9 * * 1', timezone: 'Asia/Shanghai' } },
      actions: [{ deviceId: 'server', deviceType: 'SERVER', actionType: 'COMMAND', params: { cmd: 'report' } }],
      options: {},
      enabled: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trigger.type).toBe('CRON');
    expect(taskOrchestratorMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '每周一整理项目战报',
        trigger: expect.objectContaining({ type: 'CRON' }),
      }),
    );
  });

  it('CRON 任务禁用后重新启用，执行历史可查', async () => {
    const enabledTask = {
      id: 'task-cron-1',
      name: '每周一整理项目战报',
      trigger: { type: 'CRON', config: { expression: '0 9 * * 1' } },
      actions: [],
      options: {},
      enabled: true,
      status: 'PENDING',
    };
    const execHistory = [
      { id: 'exec-1', taskId: 'task-cron-1', status: 'COMPLETED', triggeredBy: 'cron', startedAt: Date.now() },
      { id: 'exec-2', taskId: 'task-cron-1', status: 'COMPLETED', triggeredBy: 'cron', startedAt: Date.now() - 86400000 },
    ];

    taskOrchestratorMock.updateTask.mockResolvedValue(enabledTask);
    taskOrchestratorMock.getTaskHistory.mockResolvedValue(execHistory);

    const updateRes = await request(app).put('/api/tasks/task-cron-1').send({ enabled: true });
    const historyRes = await request(app).get('/api/tasks/task-cron-1/history?limit=10');

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.enabled).toBe(true);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.count).toBe(2);
    expect(historyRes.body.data[0].triggeredBy).toBe('cron');
  });
});
