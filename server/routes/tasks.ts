/**
 * 任务管理 API 路由
 *
 * 提供任务编排引擎的REST API接口
 *
 * 端点：
 * - GET /api/tasks - 获取所有任务
 * - POST /api/tasks - 创建任务
 * - GET /api/tasks/:id - 获取任务详情
 * - PUT /api/tasks/:id - 更新任务
 * - DELETE /api/tasks/:id - 删除任务
 * - POST /api/tasks/:id/execute - 执行任务
 * - GET /api/tasks/:id/history - 获取任务执行历史
 * - GET /api/tasks/executions/:executionId - 获取执行记录
 * - GET /api/tasks/executions - 获取所有执行记录
 *
 * @version 1.0.0
 * @date 2026-03-13
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { taskOrchestrator } from '../services/task-orchestrator';
import type { TaskDefinition, TaskTriggerType, ActionType, DeviceType } from '../services/task-orchestrator';

const logger = createServiceLogger('TaskRoutes');

export const taskRouter = Router();

// 输入验证schema
const createTaskSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trigger: z.object({
    type: z.enum(['CRON', 'HEARTBEAT', 'MANUAL', 'WEBHOOK']),
    config: z.record(z.unknown()),
  }),
  actions: z.array(z.object({
    id: z.string().optional(),
    deviceId: z.string().min(1),
    deviceType: z.enum(['PC', 'ANDROID', 'IOS', 'SERVER']),
    actionType: z.enum(['CLICK', 'TYPE', 'SCREENSHOT', 'FILE', 'APP', 'COMMAND', 'HTTP']),
    params: z.record(z.unknown()).optional(),
    timeout: z.number().positive().optional(),
    retryCount: z.number().min(0).max(10).optional(),
    retryDelay: z.number().positive().optional(),
  })),
  options: z.object({
    retryCount: z.number().min(0).max(10).optional(),
    retryDelay: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
    continueOnError: z.boolean().optional(),
    parallel: z.boolean().optional(),
    onSuccessTaskId: z.string().optional(),
    onFailureTaskId: z.string().optional(),
  }).optional(),
  enabled: z.boolean().optional(),
  createdBy: z.string().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const executeTaskSchema = z.object({
  triggeredBy: z.string().optional(),
});

// 获取所有任务
taskRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await taskOrchestrator.getAllTasks();

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get tasks');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tasks',
    });
  }
});

// 获取启用的任务
taskRouter.get('/enabled', async (_req: Request, res: Response) => {
  try {
    const tasks = await taskOrchestrator.getEnabledTasks();

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get enabled tasks');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get enabled tasks',
    });
  }
});

// 创建任务
taskRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createTaskSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid task format',
        details: validation.error.errors,
      });
      return;
    }

    const task = await taskOrchestrator.createTask(validation.data);

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create task');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    });
  }
});

// 获取任务详情
taskRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await taskOrchestrator.getTask(id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Failed to get task');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get task',
    });
  }
});

// 更新任务
taskRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateTaskSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid task format',
        details: validation.error.errors,
      });
      return;
    }

    const task = await taskOrchestrator.updateTask(id, validation.data);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Failed to update task');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update task',
    });
  }
});

// 删除任务
taskRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await taskOrchestrator.deleteTask(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Task deleted',
    });
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Failed to delete task');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete task',
    });
  }
});

// 执行任务
taskRouter.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = executeTaskSchema.safeParse(req.body);

    const triggeredBy = validation.success ? validation.data.triggeredBy : 'api';

    const execution = await taskOrchestrator.executeTask(id, triggeredBy);

    res.json({
      success: execution.result?.success ?? execution.status === 'COMPLETED',
      data: execution,
      error: execution.result?.error,
    });
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Failed to execute task');
    const message = error instanceof Error ? error.message : 'Failed to execute task';
    const status = message.includes('Task not found') ? 404 : message.includes('Max concurrent tasks') ? 429 : 500;
    res.status(status).json({
      success: false,
      error: message,
    });
  }
});

// 获取任务执行历史
taskRouter.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await taskOrchestrator.getTaskHistory(id, limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Failed to get task history');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get task history',
    });
  }
});

// 获取所有执行记录
taskRouter.get('/executions/all', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const executions = await taskOrchestrator.getAllExecutions(limit);

    res.json({
      success: true,
      data: executions,
      count: executions.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get executions');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get executions',
    });
  }
});

// 获取单个执行记录
taskRouter.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    const execution = await taskOrchestrator.getExecution(executionId);

    if (!execution) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
      return;
    }

    res.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error({ error, executionId: req.params.executionId }, 'Failed to get execution');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get execution',
    });
  }
});

// 导出路由注册函数
export function registerTaskRoutes(app: Router): void {
  app.use('/api/tasks', taskRouter);
  logger.info('Task routes registered');
}
