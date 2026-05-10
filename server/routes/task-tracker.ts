/**
 * 任务执行追踪 API 路由
 * Task Execution Tracker API Routes
 */

import { Router, Request } from 'express';

const router = Router();

/**
 * 从请求中获取用户ID
 */
function getUserId(req: Request): string | null {
  return (req.body as Record<string, unknown>).userId || req.session?.userId || null;
}

/**
 * GET /api/task-tracker/status
 * 获取任务追踪服务状态
 */
router.get('/status', (req, res) => {
  try {
    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const status = taskExecutionTracker.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/task-tracker/tasks
 * 分配新任务
 */
router.post('/tasks', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const { title, description, originalRequest, priority, deadline } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: '任务标题不能为空',
      });
    }

    const task = taskExecutionTracker.assignTask(
      userId,
      title,
      description || '',
      originalRequest || title,
      priority || 'NORMAL',
      deadline ? new Date(deadline) : undefined
    );

    // 自动确认并开始任务
    taskExecutionTracker.confirmTask(task.id);
    taskExecutionTracker.startTask(task.id);

    res.json({
      success: true,
      data: {
        taskId: task.id,
        title: task.title,
        status: task.status,
        message: `收到任务「${task.title}」啦！小智会努力完成的，有进展会随时汇报给爸爸～`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/task-tracker/tasks
 * 获取用户所有任务
 */
router.get('/tasks', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const { active } = req.query;

    let tasks;
    if (active === 'true') {
      tasks = taskExecutionTracker.getActiveTasks(userId);
    } else {
      tasks = taskExecutionTracker.getUserTasks(userId);
    }

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/task-tracker/tasks/:taskId
 * 获取任务详情
 */
router.get('/tasks/:taskId', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/task-tracker/tasks/:taskId/progress
 * 更新任务进度
 */
router.post('/tasks/:taskId/progress', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { progress, note } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    const updatedTask = taskExecutionTracker.updateProgress(
      taskId,
      progress,
      note || '进度更新'
    );

    res.json({
      success: true,
      data: {
        taskId: updatedTask?.id,
        progress: updatedTask?.progress,
        status: updatedTask?.status,
        message: '进度已更新',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/task-tracker/tasks/:taskId/block
 * 报告任务遇到困难
 */
router.post('/tasks/:taskId/block', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { issue } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    if (!issue) {
      return res.status(400).json({
        success: false,
        error: '问题描述不能为空',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    const updatedTask = taskExecutionTracker.encounterBlocker(taskId, issue);

    res.json({
      success: true,
      data: {
        taskId: updatedTask?.id,
        status: updatedTask?.status,
        message: `小智遇到问题了：${issue}，正在努力想办法解决...`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/task-tracker/tasks/:taskId/complete
 * 完成任务
 */
router.post('/tasks/:taskId/complete', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { result, summary } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    const updatedTask = taskExecutionTracker.completeTask(
      taskId,
      result || '任务已完成',
      summary
    );

    res.json({
      success: true,
      data: {
        taskId: updatedTask?.id,
        status: updatedTask?.status,
        result: updatedTask?.result,
        summary: updatedTask?.resultSummary,
        message: `任务「${task.title}」完成啦！${result || ''}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/task-tracker/tasks/:taskId/cancel
 * 取消任务
 */
router.post('/tasks/:taskId/cancel', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    taskExecutionTracker.cancelTask(taskId, reason);

    res.json({
      success: true,
      message: '任务已取消',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/task-tracker/tasks/:taskId/report
 * 获取任务进度汇报
 */
router.get('/tasks/:taskId/report', (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const task = taskExecutionTracker.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    const report = taskExecutionTracker.generateProgressReport(taskId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/task-tracker/active-tasks/report
 * 获取所有活跃任务的进度汇报
 */
router.get('/active-tasks/report', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { taskExecutionTracker } = require('../services/task-execution-tracker');
    const activeTasks = taskExecutionTracker.getActiveTasks(userId);

    const reports = activeTasks.map(task =>
      taskExecutionTracker.generateProgressReport(task.id)
    ).filter(r => r !== null);

    let summary = '📋 爸爸，小智当前正在执行的任务情况：\n\n';

    if (reports.length === 0) {
      summary += '目前没有正在执行的任务哦～';
    } else {
      reports.forEach(report => {
        summary += `${report?.message}\n\n`;
      });
    }

    res.json({
      success: true,
      data: {
        tasks: activeTasks,
        reports,
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
