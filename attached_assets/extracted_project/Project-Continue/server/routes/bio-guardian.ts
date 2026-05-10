/**
 * Bio-Guardian API Routes - 生物守护者系统
 * Project Guardian Angel (守护天使协议)
 * 
 * 功能:
 * - HP双向映射 (用户疲劳时限制AI任务)
 * - 紧急支援协议 (跌倒/昏厥检测、自动呼救)
 * - 实时压力干预 (呼吸引导、谈判暂停建议)
 * - 智能补水提醒
 * - 疲劳临界点预测
 * - 医疗报告OCR解析
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { bioGuardian, EmergencyContact } from '../services/bio-guardian';
import { z } from 'zod';

const router = Router();

const emergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  relationship: z.string(),
  priority: z.number().min(1).max(10),
});

const biometricUpdateSchema = z.object({
  heartRate: z.number().optional(),
  stressLevel: z.number().optional(),
  bloodOxygen: z.number().optional(),
  context: z.string().optional(),
});

const emergencyDetectionSchema = z.object({
  accelerometer: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
  heartRate: z.number().optional(),
  bloodOxygen: z.number().optional(),
  noMovementSeconds: z.number().optional(),
});

const fatigueEventSchema = z.object({
  events: z.array(z.object({
    time: z.string(),
    type: z.string(),
    duration: z.number(),
  })).optional(),
});

const healthReportSchema = z.object({
  reportText: z.string().min(10),
});

const actionCheckSchema = z.object({
  action: z.string(),
});

const hpConsumptionSchema = z.object({
  amount: z.number().positive(),
  reason: z.string(),
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await bioGuardian.getProtectionStatus();
    res.json({
      success: true,
      data: status,
      message: status.level === 'NORMAL' 
        ? '主人状态良好，小智全力待命'
        : `主人疲劳指数${status.userFatigueScore.toFixed(0)}%，小智已启动保护模式`,
    });
  } catch (error) {
    console.error('[BioGuardian API] 获取防护状态失败:', error);
    res.status(500).json({ success: false, error: '获取防护状态失败' });
  }
});

router.post('/action/check', async (req: Request, res: Response) => {
  try {
    const { action } = actionCheckSchema.parse(req.body);
    const result = await bioGuardian.checkActionAllowed(action);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[BioGuardian API] 检查操作权限失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '检查操作权限失败' });
    }
  }
});

router.post('/hp/consume', async (req: Request, res: Response) => {
  try {
    const { amount, reason } = hpConsumptionSchema.parse(req.body);
    const result = await bioGuardian.consumeHPWithFatigueAwareness(amount, reason);
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[BioGuardian API] HP消耗失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'HP消耗处理失败' });
    }
  }
});

router.post('/biometrics/update', async (req: Request, res: Response) => {
  try {
    const data = biometricUpdateSchema.parse(req.body);
    const alerts: any[] = [];
    
    if (data.heartRate !== undefined) {
      const heartRateAlert = await bioGuardian.processHeartRateUpdate(data.heartRate);
      if (heartRateAlert) alerts.push(heartRateAlert);
    }
    
    if (data.stressLevel !== undefined) {
      const stressResult = await bioGuardian.processStressUpdate(data.stressLevel, data.context);
      if (stressResult.intervention) {
        alerts.push({
          type: 'STRESS_INTERVENTION',
          ...stressResult,
        });
      }
    }
    
    res.json({
      success: true,
      alerts,
      message: alerts.length > 0 
        ? '小智检测到异常，已触发干预措施' 
        : '生物数据已更新，一切正常',
    });
  } catch (error) {
    console.error('[BioGuardian API] 生物数据更新失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '生物数据更新失败' });
    }
  }
});

router.post('/emergency/detect', async (req: Request, res: Response) => {
  try {
    const data = emergencyDetectionSchema.parse(req.body);
    const result = await bioGuardian.detectEmergency(data);
    
    if (result.emergency) {
      res.json({
        success: true,
        emergency: true,
        data: result,
        message: `⚠️ 紧急状况检测: ${result.type}，已启动紧急呼救协议`,
      });
    } else {
      res.json({
        success: true,
        emergency: false,
        message: '未检测到紧急状况',
      });
    }
  } catch (error) {
    console.error('[BioGuardian API] 紧急状况检测失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '紧急状况检测失败' });
    }
  }
});

router.get('/emergency/contacts', (req: Request, res: Response) => {
  try {
    const contacts = bioGuardian.getEmergencyContacts();
    res.json({
      success: true,
      data: contacts,
      count: contacts.length,
    });
  } catch (error) {
    console.error('[BioGuardian API] 获取紧急联系人失败:', error);
    res.status(500).json({ success: false, error: '获取紧急联系人失败' });
  }
});

router.post('/emergency/contacts', (req: Request, res: Response) => {
  try {
    const contacts = z.array(emergencyContactSchema).parse(req.body);
    bioGuardian.setEmergencyContacts(contacts as EmergencyContact[]);
    res.json({
      success: true,
      message: `已设置${contacts.length}位紧急联系人`,
      data: bioGuardian.getEmergencyContacts(),
    });
  } catch (error) {
    console.error('[BioGuardian API] 设置紧急联系人失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '设置紧急联系人失败' });
    }
  }
});

router.post('/hydration/record', (req: Request, res: Response) => {
  try {
    const { ml } = z.object({ ml: z.number().positive() }).parse(req.body);
    bioGuardian.recordWaterIntake(ml);
    res.json({
      success: true,
      message: `已记录补水 ${ml}ml，主人要多喝水哦~`,
    });
  } catch (error) {
    console.error('[BioGuardian API] 记录补水失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '记录补水失败' });
    }
  }
});

router.post('/fatigue/predict', async (req: Request, res: Response) => {
  try {
    const { events } = fatigueEventSchema.parse(req.body);
    const prediction = await bioGuardian.predictFatigue(events);
    res.json({
      success: true,
      data: prediction,
      message: prediction.suggestedNapDuration 
        ? `建议午休${prediction.suggestedNapDuration}分钟` 
        : `当前疲劳指数${prediction.currentFatigue.toFixed(0)}%`,
    });
  } catch (error) {
    console.error('[BioGuardian API] 疲劳预测失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '疲劳预测失败' });
    }
  }
});

router.post('/health-report/analyze', async (req: Request, res: Response) => {
  try {
    const { reportText } = healthReportSchema.parse(req.body);
    const analysis = await bioGuardian.analyzeHealthReport(reportText);
    res.json({
      success: true,
      data: analysis,
      message: analysis.followUpNeeded 
        ? '⚠️ 发现需要关注的指标，建议尽快复查' 
        : '报告分析完成，各项指标基本正常',
    });
  } catch (error) {
    console.error('[BioGuardian API] 健康报告分析失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '健康报告分析失败' });
    }
  }
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const acknowledged = bioGuardian.acknowledgeAlert(alertId);
    res.json({
      success: acknowledged,
      message: acknowledged ? '警报已确认' : '警报不存在或已处理',
    });
  } catch (error) {
    console.error('[BioGuardian API] 确认警报失败:', error);
    res.status(500).json({ success: false, error: '确认警报失败' });
  }
});

router.delete('/alerts/acknowledged', (req: Request, res: Response) => {
  try {
    const cleared = bioGuardian.clearAcknowledgedAlerts();
    res.json({
      success: true,
      cleared,
      message: `已清除${cleared}条已确认警报`,
    });
  } catch (error) {
    console.error('[BioGuardian API] 清除警报失败:', error);
    res.status(500).json({ success: false, error: '清除警报失败' });
  }
});

router.post('/stress-intervention/complete', (req: Request, res: Response) => {
  try {
    bioGuardian.completeStressIntervention();
    res.json({
      success: true,
      message: '压力干预已完成，主人辛苦了',
    });
  } catch (error) {
    console.error('[BioGuardian API] 完成压力干预失败:', error);
    res.status(500).json({ success: false, error: '完成压力干预失败' });
  }
});

export default router;
