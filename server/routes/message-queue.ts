/**
 * 消息队列 API 路由
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import { messageQueueService } from '../services/message-queue';

const logger = createServiceLogger('MessageQueueRoutes');
const router = Router();

const enqueueSchema = z.object({
  deviceId: z.string(),
  type: z.string(),
  payload: z.unknown(),
  priority: z.number().min(1).max(3).optional(),
});

/**
 * POST /api/queue/enqueue
 * 添加消息到队列
 */
router.post('/enqueue', async (req: Request, res: Response) => {
  try {
    const body = enqueueSchema.parse(req.body);
    
    const messageId = messageQueueService.enqueue(
      body.deviceId,
      body.type,
      body.payload,
      body.priority
    );
    
    res.json({
      success: true,
      messageId,
      queueSize: messageQueueService.getQueueSize(body.deviceId),
    });
  } catch (error) {
    logger.error({ err: error }, '入队失败');
    res.status(500).json({ success: false, error: '入队失败' });
  }
});

/**
 * GET /api/queue/:deviceId
 * 获取设备队列中的消息
 */
router.get('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const messages = messageQueueService.getMessages(deviceId, limit);
    
    res.json({
      success: true,
      deviceId,
      messages,
      count: messages.length,
    });
  } catch (error) {
    logger.error({ err: error }, '获取消息失败');
    res.status(500).json({ success: false, error: '获取消息失败' });
  }
});

/**
 * DELETE /api/queue/:deviceId
 * 清空设备队列
 */
router.delete('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    messageQueueService.clearQueue(deviceId);
    
    res.json({
      success: true,
      message: '队列已清空',
    });
  } catch (error) {
    logger.error({ err: error }, '清空队列失败');
    res.status(500).json({ success: false, error: '清空队列失败' });
  }
});

/**
 * DELETE /api/queue/:deviceId/:messageId
 * 删除指定消息
 */
router.delete('/:deviceId/:messageId', async (req: Request, res: Response) => {
  try {
    const { deviceId, messageId } = req.params;
    
    const removed = messageQueueService.removeMessage(deviceId, messageId);
    
    res.json({
      success: removed,
      message: removed ? '消息已删除' : '消息不存在',
    });
  } catch (error) {
    logger.error({ err: error }, '删除消息失败');
    res.status(500).json({ success: false, error: '删除消息失败' });
  }
});

/**
 * GET /api/queue/stats
 * 获取队列统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = messageQueueService.getStats();
    
    res.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    logger.error({ err: error }, '获取统计失败');
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

/**
 * GET /api/queue/devices
 * 获取所有设备ID
 */
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const deviceIds = messageQueueService.getDeviceIds();
    
    res.json({
      success: true,
      deviceIds,
      count: deviceIds.length,
    });
  } catch (error) {
    logger.error({ err: error }, '获取设备列表失败');
    res.status(500).json({ success: false, error: '获取设备列表失败' });
  }
});

export default router;
