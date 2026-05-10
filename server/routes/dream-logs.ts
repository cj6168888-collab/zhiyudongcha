/**
 * 梦境日志 API 路由 (Phase 3.1)
 * 
 * 提供梦境系统的 REST API 接口
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DreamLogs');

import { Router, Request, Response } from 'express';
import { dreamService } from '../services/dream-service';

const router = Router();

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const logs = await dreamService.getDreamLogs(limit);
    res.json({ success: true, logs });
  } catch (error) {
    logger.error({ err: error }, '获取梦境日志失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取梦境日志失败' 
    });
  }
});

router.get('/logs/latest', async (req: Request, res: Response) => {
  try {
    const log = await dreamService.getLatestDreamLog();
    if (!log) {
      res.json({ success: true, log: null, message: '暂无梦境日志' });
      return;
    }
    res.json({ success: true, log });
  } catch (error) {
    logger.error({ err: error }, '获取最新梦境日志失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取最新梦境日志失败' 
    });
  }
});

router.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    const log = await dreamService.getDreamLogById(req.params.id);
    if (!log) {
      res.status(404).json({ success: false, error: '梦境日志不存在' });
      return;
    }
    res.json({ success: true, log });
  } catch (error) {
    logger.error({ err: error }, '获取梦境日志详情失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取梦境日志详情失败' 
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await dreamService.getDreamStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error({ err: error }, '获取梦境统计失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取梦境统计失败' 
    });
  }
});

router.get('/insights', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const insights = await dreamService.getConversationInsights(limit);
    res.json({ success: true, insights });
  } catch (error) {
    logger.error({ err: error }, '获取对话洞察失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取对话洞察失败' 
    });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const status = dreamService.getStatus();
    if (status.isRunning) {
      res.status(409).json({ 
        success: false, 
        error: '梦境系统正在运行中，请稍后再试' 
      });
      return;
    }

    const targetDate = req.body.targetDate ? new Date(req.body.targetDate) : undefined;
    const skipAI = req.body.skipAI === true;

    const result = await dreamService.runDreamSession({
      targetDate,
      forceRun: true,
      skipAI,
    });

    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, '手动触发梦境整理失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '手动触发梦境整理失败' 
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = dreamService.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error({ err: error }, '获取梦境状态失败');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取梦境状态失败' 
    });
  }
});

export default router;
