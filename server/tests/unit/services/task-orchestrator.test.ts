import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMock = vi.hoisted(() => ({
  taskCreate: vi.fn().mockResolvedValue(undefined),
  taskUpdate: vi.fn().mockResolvedValue(undefined),
  taskUpdateStatus: vi.fn().mockResolvedValue(undefined),
  taskUpdateLastRunAt: vi.fn().mockResolvedValue(undefined),
  taskDelete: vi.fn().mockResolvedValue(undefined),
  taskFindById: vi.fn().mockResolvedValue(null),
  taskFindAll: vi.fn().mockResolvedValue([]),
  executionCreate: vi.fn().mockResolvedValue(undefined),
  executionComplete: vi.fn().mockResolvedValue(undefined),
}));

const remoteControlMock = vi.hoisted(() => ({
  sendCommand: vi.fn(),
}));

vi.mock('../../../repositories', () => ({
  taskRepository: {
    create: repositoryMock.taskCreate,
    update: repositoryMock.taskUpdate,
    updateStatus: repositoryMock.taskUpdateStatus,
    updateLastRunAt: repositoryMock.taskUpdateLastRunAt,
    delete: repositoryMock.taskDelete,
    findById: repositoryMock.taskFindById,
    findAll: repositoryMock.taskFindAll,
  },
  taskExecutionRepository: {
    create: repositoryMock.executionCreate,
    complete: repositoryMock.executionComplete,
    findById: vi.fn().mockResolvedValue(null),
    findByTaskId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    getTaskStats: vi.fn().mockResolvedValue({
      totalRuns: 0,
      successCount: 0,
      failedCount: 0,
      avgDuration: 0,
      lastRun: null,
    }),
  },
}));

vi.mock('../../../services/remote-control/RemoteControlService', () => ({
  default: remoteControlMock,
}));

import { TaskOrchestrator, type TaskAction } from '../../../services/task-orchestrator/TaskOrchestrator';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createAction(id: string): TaskAction {
  return {
    id,
    deviceId: 'pc-1',
    deviceType: 'PC',
    actionType: 'CLICK',
    params: { x: 10, y: 20 },
    timeout: 1000,
    retryCount: 0,
    retryDelay: 0,
  };
}

function baseTask(name: string, actions: TaskAction[]) {
  return {
    name,
    description: `${name} description`,
    trigger: { type: 'MANUAL' as const, config: {} },
    actions,
    options: {
      retryCount: 0,
      retryDelay: 0,
      timeout: 1000,
      continueOnError: false,
      parallel: false,
    },
    enabled: true,
  };
}

async function waitForAssertion(assertion: () => void, timeoutMs = 1000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}

describe('TaskOrchestrator state machine', () => {
  const orchestrator = TaskOrchestrator.getInstance({ maxConcurrentTasks: 5 });

  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMock.taskFindAll.mockResolvedValue([]);
  });

  it('creates tasks in PENDING state and persists the definition', async () => {
    const task = await orchestrator.createTask(baseTask('unit pending task', [createAction('action-1')]));

    expect(task.status).toBe('PENDING');
    expect(task.enabled).toBe(true);
    expect(repositoryMock.taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: task.id,
        name: 'unit pending task',
        status: 'PENDING',
        enabled: true,
      }),
    );
    expect(await orchestrator.getTask(task.id)).toBe(task);
  });

  it('marks successful executions and tasks as COMPLETED', async () => {
    remoteControlMock.sendCommand.mockResolvedValue({ success: true, data: { clicked: true } });
    const task = await orchestrator.createTask(baseTask('unit success task', [createAction('action-success')]));

    const execution = await orchestrator.executeTask(task.id, 'unit-test');

    expect(execution.status).toBe('COMPLETED');
    expect(execution.result).toMatchObject({
      success: true,
      completedActions: 1,
      failedActions: 0,
    });
    expect(execution.actions[0]).toMatchObject({
      actionId: 'action-success',
      status: 'COMPLETED',
      result: { success: true, data: { clicked: true } },
    });
    expect((await orchestrator.getTask(task.id))?.status).toBe('COMPLETED');
    expect(repositoryMock.taskUpdateStatus).toHaveBeenNthCalledWith(1, task.id, 'RUNNING');
    expect(repositoryMock.taskUpdateStatus).toHaveBeenLastCalledWith(task.id, 'COMPLETED');
    expect(repositoryMock.executionComplete).toHaveBeenCalledWith(
      execution.id,
      expect.objectContaining({ success: true }),
    );
  });

  it('marks failed action executions and tasks as FAILED when continueOnError is false', async () => {
    remoteControlMock.sendCommand.mockResolvedValue({ success: false, error: 'click failed' });
    const task = await orchestrator.createTask(baseTask('unit failed task', [
      createAction('action-fail'),
      createAction('action-skipped'),
    ]));

    const execution = await orchestrator.executeTask(task.id, 'unit-test');

    expect(execution.status).toBe('FAILED');
    expect(execution.result).toMatchObject({
      success: false,
      completedActions: 0,
      failedActions: 1,
      error: '1 actions failed',
    });
    expect(execution.actions[0]).toMatchObject({
      actionId: 'action-fail',
      status: 'FAILED',
      result: { success: false, error: 'click failed' },
    });
    expect(execution.actions[1]).toMatchObject({
      actionId: 'action-skipped',
      status: 'PENDING',
    });
    expect((await orchestrator.getTask(task.id))?.status).toBe('FAILED');
    expect(repositoryMock.taskUpdateStatus).toHaveBeenLastCalledWith(task.id, 'FAILED');
    expect(repositoryMock.executionComplete).toHaveBeenCalledWith(
      execution.id,
      expect.objectContaining({ success: false, failedActions: 1 }),
    );
  });

  it('retries failed actions before completing them successfully', async () => {
    remoteControlMock.sendCommand
      .mockResolvedValueOnce({ success: false, error: 'transient disconnect' })
      .mockResolvedValueOnce({ success: true, data: { clicked: true } });
    const retryingAction = {
      ...createAction('action-retry'),
      retryCount: 1,
      retryDelay: 0,
    };
    const task = await orchestrator.createTask(baseTask('unit retry task', [retryingAction]));

    const execution = await orchestrator.executeTask(task.id, 'unit-test');

    expect(remoteControlMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(execution.status).toBe('COMPLETED');
    expect(execution.actions[0]).toMatchObject({
      actionId: 'action-retry',
      status: 'COMPLETED',
      result: { success: true, data: { clicked: true } },
    });
    expect((await orchestrator.getTask(task.id))?.status).toBe('COMPLETED');
  });

  it('continues later actions after a failure when continueOnError is true', async () => {
    remoteControlMock.sendCommand
      .mockResolvedValueOnce({ success: false, error: 'first action failed' })
      .mockResolvedValueOnce({ success: true, data: { secondAction: true } });
    const task = await orchestrator.createTask({
      ...baseTask('unit continue task', [createAction('action-fail'), createAction('action-after-fail')]),
      options: {
        ...baseTask('unit continue task options', []).options,
        continueOnError: true,
      },
    });

    const execution = await orchestrator.executeTask(task.id, 'unit-test');

    expect(remoteControlMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(execution.status).toBe('FAILED');
    expect(execution.result).toMatchObject({
      success: false,
      completedActions: 1,
      failedActions: 1,
      error: '1 actions failed',
    });
    expect(execution.actions[0]).toMatchObject({ actionId: 'action-fail', status: 'FAILED' });
    expect(execution.actions[1]).toMatchObject({ actionId: 'action-after-fail', status: 'COMPLETED' });
    expect((await orchestrator.getTask(task.id))?.status).toBe('FAILED');
  });

  it('enforces the configured concurrent task limit', async () => {
    const blockers = Array.from({ length: 5 }, () => deferred<{ success: boolean; data?: unknown }>());
    const blockerQueue = [...blockers];
    remoteControlMock.sendCommand.mockImplementation(() => {
      const blocker = blockerQueue.shift();
      return blocker ? blocker.promise : Promise.resolve({ success: true });
    });

    const runningTasks = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        orchestrator.createTask(baseTask(`unit concurrent task ${index}`, [createAction(`action-${index}`)])),
      ),
    );
    const runningExecutions = runningTasks.map(task => orchestrator.executeTask(task.id, 'unit-test'));

    await waitForAssertion(() => {
      expect(remoteControlMock.sendCommand).toHaveBeenCalledTimes(5);
    });

    const overflowTask = await orchestrator.createTask(baseTask('unit overflow task', [createAction('action-overflow')]));
    await expect(orchestrator.executeTask(overflowTask.id, 'unit-test')).rejects.toThrow('Max concurrent tasks reached');

    for (const blocker of blockers) {
      blocker.resolve({ success: true, data: { released: true } });
    }
    await Promise.all(runningExecutions);
  });

  it('triggers follow-up tasks after success and failure results', async () => {
    remoteControlMock.sendCommand.mockResolvedValue({ success: true, data: { ok: true } });
    const successChild = await orchestrator.createTask(baseTask('unit success child task', [createAction('success-child-action')]));
    const successParent = await orchestrator.createTask({
      ...baseTask('unit success parent task', [createAction('success-parent-action')]),
      options: {
        ...baseTask('unit success parent options', []).options,
        onSuccessTaskId: successChild.id,
      },
    });

    const successExecution = await orchestrator.executeTask(successParent.id, 'unit-test');

    expect(successExecution.status).toBe('COMPLETED');
    await waitForAssertion(() => {
      expect(repositoryMock.executionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: successChild.id,
          triggeredBy: `success:${successParent.id}`,
        }),
      );
    });

    vi.clearAllMocks();
    repositoryMock.taskFindAll.mockResolvedValue([]);
    remoteControlMock.sendCommand.mockResolvedValue({ success: false, error: 'expected failure' });
    const failureChild = await orchestrator.createTask(baseTask('unit failure child task', [createAction('failure-child-action')]));
    const failureParent = await orchestrator.createTask({
      ...baseTask('unit failure parent task', [createAction('failure-parent-action')]),
      options: {
        ...baseTask('unit failure parent options', []).options,
        onFailureTaskId: failureChild.id,
      },
    });

    const failureExecution = await orchestrator.executeTask(failureParent.id, 'unit-test');

    expect(failureExecution.status).toBe('FAILED');
    await waitForAssertion(() => {
      expect(repositoryMock.executionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: failureChild.id,
          triggeredBy: `failure:${failureParent.id}`,
        }),
      );
    });
  });
});
