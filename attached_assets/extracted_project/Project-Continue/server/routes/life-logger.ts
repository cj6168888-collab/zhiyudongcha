/**
 * Life Logger API Routes - 生活数据日志系统
 * Project Guardian Angel (守护天使协议)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { lifeLogger, HealthDataInput, SocialInteractionInput } from '../services/life-logger';
import { z } from 'zod';
import { seedLifeLoggerData } from '../seeds/life-logger-seed';

const router = Router();

const healthDataSchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.enum(['WATCH', 'PHONE', 'RING', 'GLASSES']).optional(),
  heartRate: z.number().optional(),
  hrv: z.number().optional(),
  bloodOxygen: z.number().optional(),
  bodyTemperature: z.number().optional(),
  bpSystolic: z.number().optional(),
  bpDiastolic: z.number().optional(),
  steps: z.number().optional(),
  distance: z.number().optional(),
  caloriesBurned: z.number().optional(),
  activeMinutes: z.number().optional(),
  standingHours: z.number().optional(),
  sleepDurationMinutes: z.number().optional(),
  deepSleepMinutes: z.number().optional(),
  lightSleepMinutes: z.number().optional(),
  remSleepMinutes: z.number().optional(),
  awakeMinutes: z.number().optional(),
  sleepQualityScore: z.number().optional(),
  stressLevel: z.number().optional(),
  relaxationScore: z.number().optional(),
  recordedAt: z.string().transform(s => new Date(s)),
  periodStart: z.string().transform(s => new Date(s)).optional(),
  periodEnd: z.string().transform(s => new Date(s)).optional(),
});

const socialInteractionSchema = z.object({
  contactHash: z.string().optional(),
  contactAlias: z.string().optional(),
  contactCategory: z.enum(['FAMILY', 'FRIEND', 'COLLEAGUE', 'BUSINESS', 'OTHER']).optional(),
  relationshipImportance: z.number().min(1).max(10).optional(),
  interactionType: z.enum(['CALL', 'MESSAGE', 'EMAIL', 'MEETING', 'SOCIAL_MEDIA']),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  durationSeconds: z.number().optional(),
  emotionalImpact: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'STRESSFUL', 'ENERGIZING']).optional(),
  emotionScore: z.number().min(-1).max(1).optional(),
  stressContribution: z.number().min(0).max(1).optional(),
  communicationQuality: z.number().min(0).max(1).optional(),
  wasProductive: z.boolean().optional(),
  contextTags: z.array(z.string()).optional(),
  locationCategory: z.enum(['HOME', 'OFFICE', 'TRAVEL', 'OTHER']).optional(),
  occurredAt: z.string().transform(s => new Date(s)),
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await lifeLogger.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[LifeLogger API] 获取状态失败:', error);
    res.status(500).json({ error: '获取状态失败' });
  }
});

router.post('/health', async (req: Request, res: Response) => {
  try {
    const parsed = healthDataSchema.parse(req.body);
    const result = await lifeLogger.recordHealthData(parsed as HealthDataInput);
    res.json(result);
  } catch (error) {
    console.error('[LifeLogger API] 记录健康数据失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ error: '记录健康数据失败' });
    }
  }
});

router.post('/health/batch', async (req: Request, res: Response) => {
  try {
    const data = z.array(healthDataSchema).parse(req.body);
    const results = await Promise.all(
      data.map(d => lifeLogger.recordHealthData(d as HealthDataInput))
    );
    res.json({ recorded: results.length, results });
  } catch (error) {
    console.error('[LifeLogger API] 批量记录健康数据失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ error: '批量记录失败' });
    }
  }
});

router.get('/health/recent', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const data = await lifeLogger.getRecentHealthData(hours);
    res.json(data);
  } catch (error) {
    console.error('[LifeLogger API] 获取健康数据失败:', error);
    res.status(500).json({ error: '获取健康数据失败' });
  }
});

router.post('/social', async (req: Request, res: Response) => {
  try {
    const parsed = socialInteractionSchema.parse(req.body);
    const result = await lifeLogger.recordSocialInteraction(parsed as SocialInteractionInput);
    res.json(result);
  } catch (error) {
    console.error('[LifeLogger API] 记录社交互动失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ error: '记录社交互动失败' });
    }
  }
});

router.get('/social/recent', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const data = await lifeLogger.getRecentSocialInteractions(hours);
    res.json(data);
  } catch (error) {
    console.error('[LifeLogger API] 获取社交互动失败:', error);
    res.status(500).json({ error: '获取社交互动失败' });
  }
});

router.get('/energy/analyze', async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string;
    const date = dateStr ? new Date(dateStr) : new Date();
    const analysis = await lifeLogger.analyzeEnergy(date);
    res.json(analysis);
  } catch (error) {
    console.error('[LifeLogger API] 能量分析失败:', error);
    res.status(500).json({ error: '能量分析失败' });
  }
});

router.post('/report/generate', async (req: Request, res: Response) => {
  try {
    const dateStr = req.body.date as string;
    const date = dateStr ? new Date(dateStr) : new Date();
    const report = await lifeLogger.generateDailyReport(date);
    res.json(report);
  } catch (error) {
    console.error('[LifeLogger API] 生成报告失败:', error);
    res.status(500).json({ error: '生成报告失败' });
  }
});

router.get('/report/daily', async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string;
    const date = dateStr ? new Date(dateStr) : new Date();
    const report = await lifeLogger.getDailyReport(date);
    if (report) {
      res.json(report);
    } else {
      res.status(404).json({ error: '今日报告尚未生成' });
    }
  } catch (error) {
    console.error('[LifeLogger API] 获取报告失败:', error);
    res.status(500).json({ error: '获取报告失败' });
  }
});

router.get('/report/weekly-trend', async (req: Request, res: Response) => {
  try {
    const trend = await lifeLogger.getWeeklyTrend();
    res.json(trend);
  } catch (error) {
    console.error('[LifeLogger API] 获取周趋势失败:', error);
    res.status(500).json({ error: '获取周趋势失败' });
  }
});

router.post('/emotion/analyze', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供文本内容' });
    }
    const analysis = await lifeLogger.analyzeEmotionFromText(text);
    res.json(analysis);
  } catch (error) {
    console.error('[LifeLogger API] 情绪分析失败:', error);
    res.status(500).json({ error: '情绪分析失败' });
  }
});

router.post('/seed', async (req: Request, res: Response) => {
  try {
    const result = await seedLifeLoggerData();
    res.json({ success: true, message: '示例数据已生成', ...result });
  } catch (error) {
    console.error('[LifeLogger API] 生成示例数据失败:', error);
    res.status(500).json({ error: '生成示例数据失败' });
  }
});

export default router;
