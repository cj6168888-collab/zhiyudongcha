import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireMaster } from '../middleware/auth';

const logger = createServiceLogger('ArHudRoutes');

interface ArHudMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'task' | 'message';
  title: string;
  content: string;
  time: string;
}

const arMessageQueue: ArHudMessage[] = [];

export function registerArHudRoutes(app: Express, _context: RouteContext): void {
  app.get('/api/ar/messages', async (_req, res) => {
    try {
      const now = new Date();
      const formatTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      const defaultMessages: ArHudMessage[] = [
        { id: '1', type: 'info', title: '系统在线', content: '小智数字生命系统运行正常', time: formatTime(now) },
        { id: '2', type: 'task', title: '今日待办', content: '暂无紧急任务', time: '09:00' },
        { id: '3', type: 'message', title: '欢迎回来', content: '主人，有什么可以帮您？', time: formatTime(now) },
      ];

      const messages = arMessageQueue.length > 0 ? arMessageQueue : defaultMessages;
      res.json(messages);
    } catch (error) {
      logger.error({ err: error }, 'Get AR messages error');
      res.status(500).json({ error: '获取AR消息失败' });
    }
  });

  app.post('/api/ar/messages', requireMaster, async (req, res) => {
    try {
      const { type = 'info', title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: '标题和内容不能为空' });
      }

      const message: ArHudMessage = {
        id: `ar-${Date.now()}`,
        type,
        title,
        content,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };

      arMessageQueue.unshift(message);
      if (arMessageQueue.length > 10) arMessageQueue.pop();

      res.status(201).json({ success: true, message });
    } catch (error) {
      logger.error({ err: error }, 'Push AR message error');
      res.status(500).json({ error: '推送AR消息失败' });
    }
  });

  logger.info('AR HUD routes registered');
}

export function getArMessageQueue(): ArHudMessage[] {
  return arMessageQueue;
}
