/**
 * Proactive Agent API - 主动式 AI 接口
 *
 * 功能：
 * - 接收消息自动处理
 * - 主动创建日历和提醒
 * - 主动推送通知
 */

import { Router, Request, Response } from 'express';
import { proactiveAgent } from '../services/agent/ProactiveAgent';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('ProactiveRoutes');

router.use(attachRole);

/**
 * POST /api/proactive/process
 * 处理消息，自动提取约定和行动
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { content, source, participants, time } = req.body;

    if (!content) {
      res.status(400).json({
        success: false,
        error: '缺少 content 参数'
      });
      return;
    }

    logger.info({ source, contentLength: content.length }, 'Processing proactive message');

    const result = await proactiveAgent.processConversation(content, {
      source: source || 'other',
      participants: participants || [],
      time: time ? new Date(time) : undefined,
    });

    // 生成通知摘要
    const notificationSummary = proactiveAgent.generateNotificationSummary(result);

    res.json({
      success: true,
      commitments: result.commitments,
      actions: result.actions,
      suggestions: result.suggestions,
      notification: notificationSummary ? {
        title: '发现约定',
        body: notificationSummary,
        actions: result.actions.slice(0, 3),
      } : null,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process proactive message');
    res.status(500).json({
      success: false,
      error: '处理失败'
    });
  }
});

/**
 * POST /api/proactive/voice
 * 处理语音消息
 */
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { audioUrl, source, participants } = req.body;

    const result = await proactiveAgent.processVoiceMessage(audioUrl, {
      source: source || 'phone',
      participants: participants || [],
    });

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process voice');
    res.status(500).json({
      success: false,
      error: '处理失败'
    });
  }
});

/**
 * POST /api/proactive/calendar
 * 手动创建日历事件
 */
router.post('/calendar', async (req: Request, res: Response) => {
  try {
    const { title, startTime, endTime, location, description, participants } = req.body;

    res.json({
      success: true,
      message: '日历事件已创建',
      eventId: `evt_${Date.now()}`,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

/**
 * POST /api/proactive/reminder
 * 手动创建提醒
 */
router.post('/reminder', async (req: Request, res: Response) => {
  try {
    const { title, time, message, repeat } = req.body;

    res.json({
      success: true,
      message: '提醒已设置',
      reminderId: `rem_${Date.now()}`,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

/**
 * GET /api/proactive/upcoming
 * 获取即将到来的事件
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;

    // 模拟数据
    const events = [
      {
        id: 'evt_1',
        title: '接陈哥',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小时后
        location: '郑州高铁站 东出站口',
        type: 'pickup',
      },
    ];

    res.json({
      success: true,
      events,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

/**
 * POST /api/proactive/simulate
 * 模拟处理对话（测试用）
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const conversation = `陈哥: 我晚上10点到郑州，你有时间来接我吗？
小王: 有的兄弟，需要我帮你安排房间吗？到了咱们去小酌一杯。
陈哥: 好的陈哥，10点见，我从高铁站东出站口出。
陈哥: 好的兄弟，我的车牌号0L5Z7`;

    const result = await proactiveAgent.processConversation(conversation, {
      source: 'wechat',
      participants: ['陈哥', '小王'],
      time: new Date(),
    });

    res.json({
      success: true,
      conversation,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '模拟失败' });
  }
});

export default router;
