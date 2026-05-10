/**
 * 小智 Nutrition Tracker - 饮食与营养追踪系统
 * Project Guardian Angel (守护天使协议)
 * 
 * 功能：
 * 1. 餐食记录 - 早中晚餐、加餐
 * 2. 营养分析 - 卡路里、三大营养素
 * 3. 饮食建议 - 基于健康数据的个性化建议
 * 4. 水分摄入追踪
 * 5. 咖啡因/酒精监控
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('NutritionTracker');

import { getDatabase } from '../db';
import { mealLogs, nutritionGoals, type MealLog, type NutritionGoal } from '@shared/schema';
import { eq, gte, desc, and } from 'drizzle-orm';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'DRINK';
export type NutritionRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface MealEntry {
  id: string;
  mealType: MealType;
  description: string;
  estimatedCalories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  caffeineMg?: number;
  alcoholUnits?: number;
  waterMl?: number;
  timestamp: Date;
  location?: string;
  mood?: 'HUNGRY' | 'SATISFIED' | 'OVERFULL' | 'NEUTRAL';
  tags?: string[];
}

export interface DailyNutritionSummary {
  date: Date;
  totalCalories: number;
  calorieGoal: number;
  calorieBalance: number;
  proteinGrams: number;
  proteinGoal: number;
  carbsGrams: number;
  carbsGoal: number;
  fatGrams: number;
  fatGoal: number;
  fiberGrams: number;
  fiberGoal: number;
  waterMl: number;
  waterGoal: number;
  caffeineMg: number;
  caffeineLimit: number;
  alcoholUnits: number;
  alcoholLimit: number;
  mealsCount: number;
  snacksCount: number;
  rating: NutritionRating;
  insights: string[];
  recommendations: string[];
}

export interface NutritionGoals {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
  caffeineLimit: number;
  alcoholLimit: number;
}

interface StoredMeal extends MealEntry {
  date: string;
}

class NutritionTrackerService {
  private defaultGoals: NutritionGoals = {
    dailyCalories: 2000,
    proteinGrams: 60,
    carbsGrams: 250,
    fatGrams: 65,
    fiberGrams: 25,
    waterMl: 2500,
    caffeineLimit: 400,
    alcoholLimit: 2,
  };
  
  private async getActiveGoals(): Promise<NutritionGoals> {
    try {
      const [activeGoal] = await getDatabase().select()
        .from(nutritionGoals)
        .where(eq(nutritionGoals.isActive, true))
        .limit(1);
      
      if (activeGoal) {
        return {
          dailyCalories: activeGoal.dailyCalories ?? this.defaultGoals.dailyCalories,
          proteinGrams: activeGoal.proteinGrams ?? this.defaultGoals.proteinGrams,
          carbsGrams: activeGoal.carbsGrams ?? this.defaultGoals.carbsGrams,
          fatGrams: activeGoal.fatGrams ?? this.defaultGoals.fatGrams,
          fiberGrams: activeGoal.fiberGrams ?? this.defaultGoals.fiberGrams,
          waterMl: activeGoal.waterMl ?? this.defaultGoals.waterMl,
          caffeineLimit: activeGoal.caffeineLimit ?? this.defaultGoals.caffeineLimit,
          alcoholLimit: activeGoal.alcoholLimit ?? this.defaultGoals.alcoholLimit,
        };
      }
      return this.defaultGoals;
    } catch (error) {
      logger.error({ error }, 'Error getting goals');
      return this.defaultGoals;
    }
  }
  
  async recordMeal(meal: Omit<MealEntry, 'id'>): Promise<MealEntry> {
    const dateStr = meal.timestamp.toISOString().split('T')[0];
    
    const [inserted] = await getDatabase().insert(mealLogs).values({
      mealType: meal.mealType,
      description: meal.description,
      estimatedCalories: meal.estimatedCalories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      fiber: meal.fiber,
      sugar: meal.sugar,
      sodium: meal.sodium,
      caffeineMg: meal.caffeineMg,
      alcoholUnits: meal.alcoholUnits,
      waterMl: meal.waterMl,
      location: meal.location,
      mood: meal.mood,
      tags: meal.tags,
      recordedDate: dateStr,
      recordedAt: meal.timestamp,
    }).returning();
    
    logger.info(`[NutritionTracker] 记录餐食: ${meal.mealType} - ${meal.description} (${meal.estimatedCalories}kcal)`);
    
    return {
      id: inserted.id,
      mealType: inserted.mealType as MealType,
      description: inserted.description,
      estimatedCalories: inserted.estimatedCalories ?? 0,
      protein: inserted.protein ?? undefined,
      carbs: inserted.carbs ?? undefined,
      fat: inserted.fat ?? undefined,
      fiber: inserted.fiber ?? undefined,
      sugar: inserted.sugar ?? undefined,
      sodium: inserted.sodium ?? undefined,
      caffeineMg: inserted.caffeineMg ?? undefined,
      alcoholUnits: inserted.alcoholUnits ?? undefined,
      waterMl: inserted.waterMl ?? undefined,
      timestamp: inserted.recordedAt,
      location: inserted.location ?? undefined,
      mood: inserted.mood as MealEntry['mood'],
      tags: inserted.tags ?? undefined,
    };
  }
  
  async recordWater(ml: number): Promise<{ totalToday: number; remaining: number; message: string }> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    await getDatabase().insert(mealLogs).values({
      mealType: 'DRINK',
      description: '饮用水',
      estimatedCalories: 0,
      waterMl: ml,
      recordedDate: dateStr,
      recordedAt: now,
    });
    
    const todayMeals = await this.getMealsByDate(dateStr);
    const todayWater = todayMeals
      .filter(m => m.waterMl)
      .reduce((sum, m) => sum + (m.waterMl || 0), 0);
    
    const goals = await this.getActiveGoals();
    const remaining = Math.max(0, goals.waterMl - todayWater);
    const message = remaining > 0 
      ? `已喝${todayWater}ml，还需${remaining}ml达到今日目标`
      : `太棒了！今日饮水目标已达成(${todayWater}ml)`;
    
    logger.info(`[NutritionTracker] 补水记录: ${ml}ml, 今日总计: ${todayWater}ml`);
    
    return { totalToday: todayWater, remaining, message };
  }
  
  async recordCaffeine(mg: number, source: string = '咖啡'): Promise<{ totalToday: number; warning?: string }> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    await getDatabase().insert(mealLogs).values({
      mealType: 'DRINK',
      description: source,
      estimatedCalories: source.includes('咖啡') ? 5 : 0,
      caffeineMg: mg,
      recordedDate: dateStr,
      recordedAt: now,
    });
    
    const todayMeals = await this.getMealsByDate(dateStr);
    const todayCaffeine = todayMeals
      .filter(m => m.caffeineMg)
      .reduce((sum, m) => sum + (m.caffeineMg || 0), 0);
    
    const goals = await this.getActiveGoals();
    let warning: string | undefined;
    if (todayCaffeine > goals.caffeineLimit) {
      warning = `咖啡因摄入过量(${todayCaffeine}mg)，可能影响睡眠质量`;
    } else if (todayCaffeine > goals.caffeineLimit * 0.8) {
      warning = `咖啡因接近上限(${todayCaffeine}/${goals.caffeineLimit}mg)，建议控制摄入`;
    }
    
    const hour = now.getHours();
    if (hour >= 16 && mg > 50) {
      warning = (warning || '') + ' 下午4点后摄入咖啡因可能影响今晚睡眠';
    }
    
    logger.info(`[NutritionTracker] 咖啡因记录: ${mg}mg (${source}), 今日总计: ${todayCaffeine}mg`);
    
    return { totalToday: todayCaffeine, warning };
  }
  
  private async getMealsByDate(dateStr: string): Promise<MealLog[]> {
    return await getDatabase().select()
      .from(mealLogs)
      .where(eq(mealLogs.recordedDate, dateStr));
  }
  
  async getDailySummary(date: Date = new Date()): Promise<DailyNutritionSummary> {
    const dateStr = date.toISOString().split('T')[0];
    const dayMeals = await this.getMealsByDate(dateStr);
    const goals = await this.getActiveGoals();
    
    const totalCalories = dayMeals.reduce((sum, m) => sum + (m.estimatedCalories ?? 0), 0);
    const proteinGrams = dayMeals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
    const carbsGrams = dayMeals.reduce((sum, m) => sum + (m.carbs ?? 0), 0);
    const fatGrams = dayMeals.reduce((sum, m) => sum + (m.fat ?? 0), 0);
    const fiberGrams = dayMeals.reduce((sum, m) => sum + (m.fiber ?? 0), 0);
    const waterMl = dayMeals.reduce((sum, m) => sum + (m.waterMl ?? 0), 0);
    const caffeineMg = dayMeals.reduce((sum, m) => sum + (m.caffeineMg ?? 0), 0);
    const alcoholUnits = dayMeals.reduce((sum, m) => sum + (m.alcoholUnits ?? 0), 0);
    
    const mealsCount = dayMeals.filter(m => ['BREAKFAST', 'LUNCH', 'DINNER'].includes(m.mealType)).length;
    const snacksCount = dayMeals.filter(m => m.mealType === 'SNACK').length;
    
    const insights: string[] = [];
    const recommendations: string[] = [];
    
    if (totalCalories < goals.dailyCalories * 0.7) {
      insights.push('今日热量摄入偏低');
      recommendations.push('建议增加一餐或加餐补充能量');
    } else if (totalCalories > goals.dailyCalories * 1.2) {
      insights.push('今日热量摄入偏高');
      recommendations.push('明天可以适当减少碳水摄入');
    }
    
    if (proteinGrams < goals.proteinGrams * 0.7) {
      insights.push('蛋白质摄入不足');
      recommendations.push('建议增加鸡蛋、鸡胸肉或豆制品');
    }
    
    if (waterMl < goals.waterMl * 0.6) {
      insights.push('今日饮水量不足');
      recommendations.push(`还需喝${goals.waterMl - waterMl}ml水`);
    }
    
    if (caffeineMg > goals.caffeineLimit) {
      insights.push('咖啡因摄入过量');
      recommendations.push('建议减少咖啡摄入，改喝温水或淡茶');
    }
    
    if (mealsCount < 3) {
      insights.push('正餐次数不足');
      recommendations.push('建议保持规律三餐');
    }
    
    if (snacksCount > 3) {
      insights.push('加餐次数较多');
      recommendations.push('建议减少零食，选择健康加餐');
    }
    
    let rating: NutritionRating = 'GOOD';
    const issues = insights.length;
    if (issues === 0) rating = 'EXCELLENT';
    else if (issues <= 2) rating = 'GOOD';
    else if (issues <= 4) rating = 'FAIR';
    else rating = 'POOR';
    
    return {
      date,
      totalCalories,
      calorieGoal: goals.dailyCalories,
      calorieBalance: goals.dailyCalories - totalCalories,
      proteinGrams,
      proteinGoal: goals.proteinGrams,
      carbsGrams,
      carbsGoal: goals.carbsGrams,
      fatGrams,
      fatGoal: goals.fatGrams,
      fiberGrams,
      fiberGoal: goals.fiberGrams,
      waterMl,
      waterGoal: goals.waterMl,
      caffeineMg,
      caffeineLimit: goals.caffeineLimit,
      alcoholUnits,
      alcoholLimit: goals.alcoholLimit,
      mealsCount,
      snacksCount,
      rating,
      insights,
      recommendations,
    };
  }
  
  async setGoals(goals: Partial<NutritionGoals>): Promise<NutritionGoals> {
    // Get current goals BEFORE deactivating
    const currentGoals = await this.getActiveGoals();
    const newGoals = { ...currentGoals, ...goals };
    
    // Deactivate existing goals
    await getDatabase().update(nutritionGoals)
      .set({ isActive: false })
      .where(eq(nutritionGoals.isActive, true));
    
    await getDatabase().insert(nutritionGoals).values({
      dailyCalories: newGoals.dailyCalories,
      proteinGrams: newGoals.proteinGrams,
      carbsGrams: newGoals.carbsGrams,
      fatGrams: newGoals.fatGrams,
      fiberGrams: newGoals.fiberGrams,
      waterMl: newGoals.waterMl,
      caffeineLimit: newGoals.caffeineLimit,
      alcoholLimit: newGoals.alcoholLimit,
      isActive: true,
    });
    
    logger.info('[NutritionTracker] 营养目标已更新', newGoals);
    return newGoals;
  }
  
  async getGoals(): Promise<NutritionGoals> {
    return await this.getActiveGoals();
  }
  
  async getMealHistory(days: number = 7): Promise<StoredMeal[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    const meals = await getDatabase().select()
      .from(mealLogs)
      .where(gte(mealLogs.recordedDate, cutoffStr))
      .orderBy(desc(mealLogs.recordedAt));
    
    return meals.map(m => ({
      id: m.id,
      mealType: m.mealType as MealType,
      description: m.description,
      estimatedCalories: m.estimatedCalories ?? 0,
      protein: m.protein ?? undefined,
      carbs: m.carbs ?? undefined,
      fat: m.fat ?? undefined,
      fiber: m.fiber ?? undefined,
      sugar: m.sugar ?? undefined,
      sodium: m.sodium ?? undefined,
      caffeineMg: m.caffeineMg ?? undefined,
      alcoholUnits: m.alcoholUnits ?? undefined,
      waterMl: m.waterMl ?? undefined,
      timestamp: m.recordedAt,
      location: m.location ?? undefined,
      mood: m.mood as MealEntry['mood'],
      tags: m.tags ?? undefined,
      date: m.recordedDate,
    }));
  }
  
  async getWeeklyTrend(): Promise<Array<{ date: string; calories: number; water: number; rating: NutritionRating }>> {
    const result: Array<{ date: string; calories: number; water: number; rating: NutritionRating }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const summary = await this.getDailySummary(date);
      result.push({
        date: date.toISOString().split('T')[0],
        calories: summary.totalCalories,
        water: summary.waterMl,
        rating: summary.rating,
      });
    }
    
    return result;
  }
  
  async generateMealSuggestion(context: { 
    timeOfDay: 'MORNING' | 'NOON' | 'EVENING' | 'NIGHT';
    currentCalories: number;
    stressLevel?: number;
    activityLevel?: 'LOW' | 'MODERATE' | 'HIGH';
  }): Promise<{ suggestion: string; estimatedCalories: number; reason: string }> {
    const goals = await this.getActiveGoals();
    const remainingCalories = goals.dailyCalories - context.currentCalories;
    
    let suggestion: string;
    let estimatedCalories: number;
    let reason: string;
    
    if (context.timeOfDay === 'MORNING') {
      if (remainingCalories > 1500) {
        suggestion = '燕麦粥配鸡蛋和水果，搭配一杯牛奶';
        estimatedCalories = 450;
        reason = '早餐是一天中最重要的一餐，建议吃得丰盛';
      } else {
        suggestion = '全麦面包配牛油果和煎蛋';
        estimatedCalories = 350;
        reason = '轻盈但营养均衡的早餐';
      }
    } else if (context.timeOfDay === 'NOON') {
      if (context.stressLevel && context.stressLevel > 70) {
        suggestion = '清淡的蔬菜沙拉配鸡胸肉，避免油腻';
        estimatedCalories = 400;
        reason = '压力较大时，清淡饮食有助于放松';
      } else if (context.activityLevel === 'HIGH') {
        suggestion = '糙米饭配红烧牛肉和时蔬';
        estimatedCalories = 650;
        reason = '活动量大，需要补充足够能量';
      } else {
        suggestion = '米饭配清蒸鱼和蔬菜';
        estimatedCalories = 500;
        reason = '均衡的午餐搭配';
      }
    } else if (context.timeOfDay === 'EVENING') {
      if (remainingCalories < 400) {
        suggestion = '蔬菜汤配少量杂粮';
        estimatedCalories = 300;
        reason = '今日热量接近目标，建议清淡晚餐';
      } else {
        suggestion = '清蒸鱼或鸡胸肉配蔬菜';
        estimatedCalories = 450;
        reason = '晚餐不宜过重，但要保证蛋白质摄入';
      }
    } else {
      suggestion = '一小把坚果或一杯温牛奶';
      estimatedCalories = 150;
      reason = '夜间加餐要控制量，避免影响睡眠';
    }
    
    return { suggestion, estimatedCalories, reason };
  }
}

export const nutritionTracker = new NutritionTrackerService();
