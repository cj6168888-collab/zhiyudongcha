/**
 * Social Strategy API Routes - 社交策略优化引擎
 * Project Guardian Angel (守护天使协议)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SocialStrategy');

import { Router, Request, Response } from 'express';
import { socialStrategy } from '../services/social-strategy';
import { z } from 'zod';

const router = Router();

router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const reminders = await socialStrategy.getContactReminders();
    res.json({
      success: true,
      data: reminders,
      count: reminders.length,
      message: reminders.length > 0 
        ? `有${reminders.length}位联系人建议联络` 
        : '所有关系维护良好',
    });
  } catch (error) {
    logger.error({ error }, '获取联络提醒失败');
    res.status(500).json({ success: false, error: '获取联络提醒失败' });
  }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await socialStrategy.generateStrategyReport();
    res.json({
      success: true,
      data: report,
      message: `人脉健康度: ${report.overallNetworkHealth}%`,
    });
  } catch (error) {
    logger.error({ error }, '生成策略报告失败');
    res.status(500).json({ success: false, error: '生成策略报告失败' });
  }
});

router.get('/contact/:hash/profile', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const profile = await socialStrategy.getContactProfile(hash);
    if (!profile) {
      res.status(404).json({ success: false, error: '联系人未找到' });
      return;
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ error }, '获取联系人资料失败');
    res.status(500).json({ success: false, error: '获取联系人资料失败' });
  }
});

router.get('/contact/:hash/optimal-time', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const window = await socialStrategy.getOptimalContactWindow(hash);
    if (!window) {
      res.json({ 
        success: true, 
        data: null,
        message: '数据不足，建议在工作时间联系',
      });
      return;
    }
    res.json({ 
      success: true, 
      data: window,
      message: window.recommendation,
    });
  } catch (error) {
    logger.error({ error }, '获取最佳联络时间失败');
    res.status(500).json({ success: false, error: '获取最佳联络时间失败' });
  }
});

router.get('/contact/:hash/maintenance', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const result = await socialStrategy.getRelationshipMaintenance(hash);
    res.json({
      success: true,
      data: result,
      message: result.nextContactSuggestion,
    });
  } catch (error) {
    logger.error({ error }, '获取关系维护建议失败');
    res.status(500).json({ success: false, error: '获取关系维护建议失败' });
  }
});

export default router;
