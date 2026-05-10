/**
 * 告警通知 API 路由
 *
 * 提供告警通知的 REST API 接口
 *
 * 端点：
 * - GET /api/alerts - 获取所有告警
 * - GET /api/alerts/pending - 获取待处理告警
 * - GET /api/alerts/stats - 获取告警统计
 * - POST /api/alerts/:id/dismiss - 消散告警
 * - POST /api/alerts/:id/read - 标记为已读
 * - DELETE /api/alerts - 清除所有告警
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { alertNotificationService } from '../services/alert-notification';

const logger = createServiceLogger('AlertRoutes');

export const alertRouter = Router();

// 输入验证schema
const createAlertSchema = z.object({
  type: z.enum(['TASK_FAILED', 'TASK_TIMEOUT', 'DEVICE_OFFLINE', 'DEVICE_ONLINE', 'EXECUTION_ERROR', 'SYSTEM_ERROR']),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  taskId: z.string().optional(),
  executionId: z.string().optional(),
  deviceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// 获取所有活跃告警
alertRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const alerts = alertNotificationService.getActiveAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get alerts');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts',
    });
  }
});

// 获取待处理告警
alertRouter.get('/pending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await alertNotificationService.getPendingAlerts(limit);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending alerts');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pending alerts',
    });
  }
});

// 获取告警统计
alertRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await alertNotificationService.getAlertStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get alert stats');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alert stats',
    });
  }
});

// 获取高优先级告警
alertRouter.get('/high-priority', async (_req: Request, res: Response) => {
  try {
    const alerts = await alertNotificationService.getHighPriorityAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get high priority alerts');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get high priority alerts',
    });
  }
});

// 消散告警
alertRouter.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dismissed = alertNotificationService.dismissAlert(id);

    if (!dismissed) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Alert dismissed',
    });
  } catch (error) {
    logger.error({ error, alertId: req.params.id }, 'Failed to dismiss alert');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss alert',
    });
  }
});

// 标记告警为已读
alertRouter.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const marked = await alertNotificationService.markAsRead(id);

    if (!marked) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    logger.error({ error, alertId: req.params.id }, 'Failed to mark alert as read');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark alert as read',
    });
  }
});

// 清除所有告警
alertRouter.delete('/', async (_req: Request, res: Response) => {
  try {
    alertNotificationService.clearAllAlerts();

    res.json({
      success: true,
      message: 'All alerts cleared',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to clear alerts');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear alerts',
    });
  }
});

// 创建测试告警 (仅开发环境)
if (process.env.NODE_ENV !== 'production') {
  alertRouter.post('/test', async (req: Request, res: Response) => {
    try {
      const validation = createAlertSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid alert format',
          details: validation.error.errors,
        });
        return;
      }

      const { type, title, message, severity, taskId, executionId, deviceId, metadata } = validation.data;

      const alert = await alertNotificationService.createAlert({
        type,
        severity: severity || 'MEDIUM',
        title,
        message,
        taskId,
        executionId,
        deviceId,
        metadata,
      } as Parameters<typeof alertNotificationService.createTaskFailedAlert>[0] extends never ? Parameters<typeof alertNotificationService.createAlert>[0] : never);

      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create test alert');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test alert',
      });
    }
  });
}

// 导出路由注册函数
export function registerAlertRoutes(app: Router): void {
  app.use('/api/alerts', alertRouter);
  logger.info('Alert routes registered');
}
