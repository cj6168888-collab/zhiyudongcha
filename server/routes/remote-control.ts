/**
 * 远程控制 API 路由
 *
 * 提供PC远程控制的REST API接口
 *
 * 端点：
 * - GET /api/remote/devices - 获取可控制的PC列表
 * - GET /api/remote/devices/:deviceId - 获取设备详情
 * - GET /api/remote/screenshot/:deviceId - 获取PC截图
 * - POST /api/remote/control/:deviceId - 发送控制指令
 * - GET /api/remote/sessions - 获取活动会话
 * - GET /api/remote/status - 服务状态
 *
 * @version 1.0.0
 * @author 架构组
 * @date 2026-03-13
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { remoteControlService } from '../services/remote-control';

const logger = createServiceLogger('RemoteControlRoutes');

export const remoteControlRouter = Router();

// 输入验证schema
const controlCommandSchema = z.object({
  type: z.enum(['MOUSE', 'KEYBOARD', 'SCREENSHOT', 'FILE', 'APP', 'SYSTEM']),
  action: z.string(),
  params: z.record(z.unknown()).optional(),
});

const screenshotQuerySchema = z.object({
  quality: z.number().min(10).max(100).optional(),
});

// 获取所有设备
remoteControlRouter.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await remoteControlService.getDevices();

    res.json({
      success: true,
      data: devices,
      count: devices.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get devices');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get devices',
    });
  }
});

// 获取设备详情
remoteControlRouter.get('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await remoteControlService.getDevice(deviceId);

    if (!device) {
      res.status(404).json({
        success: false,
        error: 'Device not found',
      });
      return;
    }

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    logger.error({ error, deviceId: req.params.deviceId }, 'Failed to get device');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get device',
    });
  }
});

// 获取PC截图
remoteControlRouter.get('/screenshot/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const query = screenshotQuerySchema.safeParse(req.query);

    const result = await remoteControlService.takeScreenshot(deviceId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Screenshot failed',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        width: result.data?.width,
        height: result.data?.height,
        image: result.data?.data,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error({ error, deviceId: req.params.deviceId }, 'Failed to capture screenshot');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed',
    });
  }
});

// 发送控制指令
remoteControlRouter.post('/control/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const validation = controlCommandSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid command format',
        details: validation.error.errors,
      });
      return;
    }

    const result = await remoteControlService.sendCommand(deviceId, validation.data);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
      duration: result.duration,
    });
  } catch (error) {
    logger.error({ error, deviceId: req.params.deviceId }, 'Failed to send command');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Command failed',
    });
  }
});

// 获取活动会话
remoteControlRouter.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = remoteControlService.getSessions();

    // 脱敏处理，不返回WebSocket对象
    const sanitizedSessions = sessions.map(s => ({
      id: s.id,
      deviceId: s.deviceId,
      userId: s.userId,
      status: s.status,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
    }));

    res.json({
      success: true,
      data: sanitizedSessions,
      count: sanitizedSessions.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get sessions');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    });
  }
});

// 获取服务状态
remoteControlRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const health = await remoteControlService.healthCheck();

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

// 导出路由注册函数
export function registerRemoteControlRoutes(app: Router): void {
  app.use('/api/remote', remoteControlRouter);
  logger.info('Remote control routes registered');
}
