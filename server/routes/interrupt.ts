/**
 * 打断处理 API 路由 - Phase 8.3
 * 
 * HTTP端点:
 * - POST /api/interrupt/:sessionId - 请求打断
 * - GET /api/interrupt/:sessionId/state - 获取打断状态
 * - POST /api/interrupt/:sessionId/reset - 重置打断状态
 * - GET /api/interrupt/stats - 全局统计
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Interrupt');

import type { Express, Request, Response } from 'express';
import { interruptHandler, type InterruptLevel, type InterruptSource } from '../services/interrupt-handler';
import type { RegisterRouteFn } from './types';

export const registerInterruptRoutes: RegisterRouteFn = (app, storage, context) => {

  // 请求打断
  app.post('/api/interrupt/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { level, source, reason, priority } = req.body as {
        level?: InterruptLevel;
        source?: InterruptSource;
        reason?: string;
        priority?: number;
      };

      const result = await interruptHandler.requestInterrupt(
        sessionId,
        level || 'hard',
        source || 'user',
        { reason, priority }
      );

      res.json(result);

    } catch (error) {
      res.status(500).json({ 
        error: '打断请求失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // VAD触发快捷打断
  app.post('/api/interrupt/:sessionId/vad', async (req: Request, res: Response) => {
    try {
      const result = await interruptHandler.vadInterrupt(req.params.sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'VAD打断失败' });
    }
  });

  // 用户触发快捷打断
  app.post('/api/interrupt/:sessionId/user', async (req: Request, res: Response) => {
    try {
      const result = await interruptHandler.userInterrupt(req.params.sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '用户打断失败' });
    }
  });

  // 紧急停止
  app.post('/api/interrupt/:sessionId/emergency', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };
      const result = await interruptHandler.emergencyStop(
        req.params.sessionId,
        reason || '紧急停止'
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '紧急停止失败' });
    }
  });

  // 获取打断状态
  app.get('/api/interrupt/:sessionId/state', async (req: Request, res: Response) => {
    try {
      const state = interruptHandler.getState(req.params.sessionId);

      if (!state) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({
        sessionId: state.sessionId,
        isInterrupting: state.isInterrupting,
        pendingInterrupts: state.pendingInterrupts.length,
        lastInterrupt: state.lastInterrupt,
        hasPausedContent: !!state.pausedContent,
      });

    } catch (error) {
      res.status(500).json({ error: '获取状态失败' });
    }
  });

  // 重置打断状态
  app.post('/api/interrupt/:sessionId/reset', async (req: Request, res: Response) => {
    try {
      interruptHandler.reset(req.params.sessionId);
      res.json({
        success: true,
        sessionId: req.params.sessionId,
        message: '打断状态已重置',
      });
    } catch (error) {
      res.status(500).json({ error: '重置失败' });
    }
  });

  // 清理会话
  app.delete('/api/interrupt/:sessionId', async (req: Request, res: Response) => {
    try {
      interruptHandler.cleanup(req.params.sessionId);
      res.json({
        success: true,
        sessionId: req.params.sessionId,
        message: '会话已清理',
      });
    } catch (error) {
      res.status(500).json({ error: '清理失败' });
    }
  });

  // 全局统计
  app.get('/api/interrupt/stats', async (req: Request, res: Response) => {
    try {
      const stats = interruptHandler.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '8.3',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  logger.info('[InterruptHandler] HTTP路由已注册 /api/interrupt/*');
};
