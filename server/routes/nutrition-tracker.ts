/**
 * Nutrition Tracker API Routes - 饮食与营养追踪
 * Project Guardian Angel (守护天使协议)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('NutritionTracker');

import { Router, Request, Response } from 'express';
import { nutritionTracker, MealEntry } from '../services/nutrition-tracker';
import { z } from 'zod';

const router = Router();

const mealSchema = z.object({
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DRINK']),
  description: z.string().min(1),
  estimatedCalories: z.number().min(0),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  fiber: z.number().optional(),
  sugar: z.number().optional(),
  sodium: z.number().optional(),
  caffeineMg: z.number().optional(),
  alcoholUnits: z.number().optional(),
  waterMl: z.number().optional(),
  timestamp: z.string().transform(s => new Date(s)),
  location: z.string().optional(),
  mood: z.enum(['HUNGRY', 'SATISFIED', 'OVERFULL', 'NEUTRAL']).optional(),
  tags: z.array(z.string()).optional(),
});

router.post('/meal', async (req: Request, res: Response) => {
  try {
    const parsed = mealSchema.parse(req.body);
    const entry = await nutritionTracker.recordMeal(parsed as Omit<MealEntry, 'id'>);
    res.json({
      success: true,
      data: entry,
      message: `已记录${parsed.mealType}: ${parsed.description}`,
    });
  } catch (error) {
    logger.error({ err: error }, '记录餐食失败');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '数据格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '记录餐食失败' });
    }
  }
});

router.post('/water', async (req: Request, res: Response) => {
  try {
    const { ml } = z.object({ ml: z.number().positive() }).parse(req.body);
    const result = await nutritionTracker.recordWater(ml);
    res.json({ success: true, data: result, message: result.message });
  } catch (error) {
    logger.error({ err: error }, '记录饮水失败');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误' });
    } else {
      res.status(500).json({ success: false, error: '记录饮水失败' });
    }
  }
});

router.post('/caffeine', async (req: Request, res: Response) => {
  try {
    const { mg, source } = z.object({ 
      mg: z.number().positive(), 
      source: z.string().optional() 
    }).parse(req.body);
    const result = await nutritionTracker.recordCaffeine(mg, source);
    res.json({ 
      success: true, 
      data: result,
      message: result.warning || `咖啡因已记录: ${mg}mg`,
    });
  } catch (error) {
    logger.error({ err: error }, '记录咖啡因失败');
    res.status(500).json({ success: false, error: '记录咖啡因失败' });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const date = dateStr ? new Date(dateStr) : new Date();
    const summary = await nutritionTracker.getDailySummary(date);
    res.json({
      success: true,
      data: summary,
      message: `今日营养评级: ${summary.rating}`,
    });
  } catch (error) {
    logger.error({ err: error }, '获取每日摘要失败');
    res.status(500).json({ success: false, error: '获取每日摘要失败' });
  }
});

router.get('/goals', async (req: Request, res: Response) => {
  try {
    const goals = await nutritionTracker.getGoals();
    res.json({ success: true, data: goals });
  } catch (error) {
    logger.error({ err: error }, '获取目标失败');
    res.status(500).json({ success: false, error: '获取目标失败' });
  }
});

router.put('/goals', async (req: Request, res: Response) => {
  try {
    const goals = await nutritionTracker.setGoals(req.body);
    res.json({ success: true, data: goals, message: '营养目标已更新' });
  } catch (error) {
    logger.error({ err: error }, '更新目标失败');
    res.status(500).json({ success: false, error: '更新目标失败' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const history = await nutritionTracker.getMealHistory(days);
    res.json({ success: true, data: history, count: history.length });
  } catch (error) {
    logger.error({ err: error }, '获取历史记录失败');
    res.status(500).json({ success: false, error: '获取历史记录失败' });
  }
});

router.get('/trend', async (req: Request, res: Response) => {
  try {
    const trend = await nutritionTracker.getWeeklyTrend();
    res.json({ success: true, data: trend });
  } catch (error) {
    logger.error({ err: error }, '获取趋势失败');
    res.status(500).json({ success: false, error: '获取趋势失败' });
  }
});

router.post('/suggest', async (req: Request, res: Response) => {
  try {
    const { timeOfDay, currentCalories, stressLevel, activityLevel } = z.object({
      timeOfDay: z.enum(['MORNING', 'NOON', 'EVENING', 'NIGHT']),
      currentCalories: z.number().min(0),
      stressLevel: z.number().optional(),
      activityLevel: z.enum(['LOW', 'MODERATE', 'HIGH']).optional(),
    }).parse(req.body);
    
    const suggestion = await nutritionTracker.generateMealSuggestion({
      timeOfDay, currentCalories, stressLevel, activityLevel,
    });
    res.json({ success: true, data: suggestion, message: suggestion.suggestion });
  } catch (error) {
    logger.error({ err: error }, '生成建议失败');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误' });
    } else {
      res.status(500).json({ success: false, error: '生成建议失败' });
    }
  }
});

export default router;
