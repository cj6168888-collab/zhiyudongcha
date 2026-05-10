/**
 * 小智 Guardian Angel Enhanced Routes - 守护天使增强API
 * 通话情绪分析 + 地点规律学习
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('GuardianAngelEnhanced');

import { Router } from 'express';
import { z } from 'zod';
import { callEmotionAnalyzer } from '../services/call-emotion-analyzer';
import { locationPatternLearner } from '../services/location-pattern-learner';

const router = Router();

const CallAnalysisSchema = z.object({
  contactName: z.string().min(1, '联系人姓名必填'),
  contactPhone: z.string().optional(),
  personId: z.string().optional(),
  callDirection: z.enum(['INCOMING', 'OUTGOING']),
  callDuration: z.number().min(0),
  callTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: '无效的通话时间' }),
  preCallHeartRate: z.number().optional(),
  duringCallHeartRate: z.number().optional(),
  postCallHeartRate: z.number().optional(),
  voiceToneData: z.object({
    pitchVariance: z.number(),
    speakingSpeed: z.number(),
    volumeLevel: z.number(),
    pauseFrequency: z.number(),
    emotionalIndicators: z.array(z.string())
  }).optional()
});

const LocationVisitSchema = z.object({
  locationName: z.string().min(1, '地点名称必填'),
  locationType: z.enum(['HOME', 'OFFICE', 'GYM', 'RESTAURANT', 'CLIENT', 'OTHER']).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
  arrivalTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: '无效的到达时间' }),
  departureTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: '无效的离开时间' }).optional(),
  activities: z.array(z.enum(['WORK', 'EXERCISE', 'DINING', 'MEETING', 'LEISURE', 'COMMUTE'])).optional(),
  preVisitEnergy: z.number().min(0).max(100).optional(),
  postVisitEnergy: z.number().min(0).max(100).optional(),
  notes: z.string().optional()
});

const DepartureUpdateSchema = z.object({
  departureTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: '无效的离开时间' }),
  postVisitEnergy: z.number().min(0).max(100).optional()
});

router.post('/call-emotion/analyze', async (req, res) => {
  try {
    const parseResult = CallAnalysisSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: '请求参数验证失败',
        details: parseResult.error.errors 
      });
    }
    
    const data = {
      ...parseResult.data,
      callTime: new Date(parseResult.data.callTime)
    };
    const result = await callEmotionAnalyzer.analyzeCall(data);
    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, '通话情绪分析失败');
    res.status(500).json({ success: false, error: '通话情绪分析失败' });
  }
});

router.get('/call-emotion/contact/:name', async (req, res) => {
  try {
    const name = req.params.name;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: '联系人姓名必填' });
    }
    const profile = await callEmotionAnalyzer.getContactEmotionProfile(name);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取联系人情绪档案失败' });
  }
});

router.get('/call-emotion/recent', async (req, res) => {
  try {
    const daysStr = req.query.days as string;
    const days = daysStr ? parseInt(daysStr, 10) : 7;
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ success: false, error: '天数参数无效 (1-365)' });
    }
    const logs = await callEmotionAnalyzer.getRecentCallEmotions(days);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取近期通话情绪失败' });
  }
});

router.get('/call-emotion/draining-contacts', async (req, res) => {
  try {
    const contacts = await callEmotionAnalyzer.getDrainingContacts();
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取消耗性联系人失败' });
  }
});

router.get('/call-emotion/energizing-contacts', async (req, res) => {
  try {
    const contacts = await callEmotionAnalyzer.getEnergizingContacts();
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取激励性联系人失败' });
  }
});

router.get('/call-emotion/daily-summary', async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    let date = new Date();
    if (dateStr) {
      const parsed = Date.parse(dateStr);
      if (isNaN(parsed)) {
        return res.status(400).json({ success: false, error: '无效的日期格式' });
      }
      date = new Date(parsed);
    }
    const summary = await callEmotionAnalyzer.getDailyEmotionSummary(date);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取每日情绪摘要失败' });
  }
});

router.post('/location/visit', async (req, res) => {
  try {
    const parseResult = LocationVisitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: '请求参数验证失败',
        details: parseResult.error.errors 
      });
    }
    
    const data = {
      ...parseResult.data,
      arrivalTime: new Date(parseResult.data.arrivalTime),
      departureTime: parseResult.data.departureTime ? new Date(parseResult.data.departureTime) : undefined
    };
    const result = await locationPatternLearner.recordVisit(data);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, '记录地点访问失败');
    res.status(500).json({ success: false, error: '记录地点访问失败' });
  }
});

router.put('/location/visit/:id/departure', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id.trim() === '') {
      return res.status(400).json({ success: false, error: '访问ID必填' });
    }
    
    const parseResult = DepartureUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: '请求参数验证失败',
        details: parseResult.error.errors 
      });
    }
    
    const visit = await locationPatternLearner.updateVisitDeparture(
      id,
      new Date(parseResult.data.departureTime),
      parseResult.data.postVisitEnergy
    );
    res.json({ success: true, visit });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新离开时间失败' });
  }
});

router.get('/location/predict', async (req, res) => {
  try {
    const predictions = await locationPatternLearner.predictNextLocation();
    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: '预测地点失败' });
  }
});

router.get('/location/frequent', async (req, res) => {
  try {
    const locations = await locationPatternLearner.getFrequentLocations();
    res.json({ success: true, locations });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取常去地点失败' });
  }
});

router.get('/location/insights', async (req, res) => {
  try {
    const insights = await locationPatternLearner.getLocationInsights();
    res.json({ success: true, insights });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取地点洞察失败' });
  }
});

router.get('/location/daily-summary', async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    let date = new Date();
    if (dateStr) {
      const parsed = Date.parse(dateStr);
      if (isNaN(parsed)) {
        return res.status(400).json({ success: false, error: '无效的日期格式' });
      }
      date = new Date(parsed);
    }
    const summary = await locationPatternLearner.getDailyLocationSummary(date);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取每日地点摘要失败' });
  }
});

export default router;
