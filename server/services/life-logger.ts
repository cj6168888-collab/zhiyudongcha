/**
 * 小智 Life Logger - 生活数据日志系统
 * Project Guardian Angel (守护天使协议)
 * 
 * 功能：
 * 1. 整合健康数据采集（心率、睡眠、步数、血氧）
 * 2. 社交互动追踪与情绪分析
 * 3. 行为规律识别
 * 4. 能量损耗分析与明日最优建议
 * 
 * 整合现有服务：
 * - presenceDetection: 用户活动追踪
 * - night-cycle-engine: 设备状态监控
 * - empathic-dialogue: 情绪分析
 * - retrospection-engine: 复盘与洞察生成
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('LifeLogger');

import { getDatabase } from '../db';
import { 
  healthMetrics, socialInteractions, behaviorPatterns, dailyEnergyReports,
  InsertHealthMetrics, InsertSocialInteraction, InsertBehaviorPattern, InsertDailyEnergyReport,
  HealthMetrics, SocialInteraction, BehaviorPattern, DailyEnergyReport
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { getCurrentPresenceState, type PresenceState } from './presenceDetection';
import { nightCycleEngine } from './night-cycle-engine';
import { empathicDialogue, type EmotionAnalysis } from './empathic-dialogue';

export interface HealthDataInput {
  deviceId?: string;
  deviceType?: 'WATCH' | 'PHONE' | 'RING' | 'GLASSES';
  heartRate?: number;
  hrv?: number;
  bloodOxygen?: number;
  bodyTemperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  steps?: number;
  distance?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  standingHours?: number;
  sleepDurationMinutes?: number;
  deepSleepMinutes?: number;
  lightSleepMinutes?: number;
  remSleepMinutes?: number;
  awakeMinutes?: number;
  sleepQualityScore?: number;
  stressLevel?: number;
  relaxationScore?: number;
  recordedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface SocialInteractionInput {
  contactHash?: string;
  contactAlias?: string;
  contactCategory?: 'FAMILY' | 'FRIEND' | 'COLLEAGUE' | 'BUSINESS' | 'OTHER';
  relationshipImportance?: number;
  interactionType: 'CALL' | 'MESSAGE' | 'EMAIL' | 'MEETING' | 'SOCIAL_MEDIA';
  direction?: 'INBOUND' | 'OUTBOUND';
  durationSeconds?: number;
  emotionalImpact?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'STRESSFUL' | 'ENERGIZING';
  emotionScore?: number;
  stressContribution?: number;
  communicationQuality?: number;
  wasProductive?: boolean;
  contextTags?: string[];
  locationCategory?: 'HOME' | 'OFFICE' | 'TRAVEL' | 'OTHER';
  occurredAt: Date;
}

export interface EnergyAnalysis {
  totalEnergyScore: number;
  physicalEnergySpent: number;
  mentalEnergySpent: number;
  emotionalEnergySpent: number;
  sleepRecoveryScore: number;
  overallStressLevel: number;
  stressPeakTime?: string;
  stressTriggers: Array<{ source: string; impact: number; time: string }>;
  socialHealthScore: number;
  positiveInteractions: number;
  negativeInteractions: number;
  productivityPeakHours: string[];
  focusTimeMinutes: number;
  keyInsights: Array<{ category: string; insight: string; importance: number }>;
  anomalies: Array<{ metric: string; value: number; baseline: number; deviation: number }>;
}

export interface DailyRecommendations {
  suggestedWakeTime: string;
  suggestedSleepTime: string;
  suggestedBreakTimes: string[];
  priorityTasks: string[];
  avoidanceRecommendations: string[];
  recommendations: Array<{ category: string; suggestion: string; priority: number; reason: string }>;
}

export interface LifeLoggerStatus {
  isActive: boolean;
  lastHealthSync: Date | null;
  lastSocialSync: Date | null;
  todayHealthRecords: number;
  todaySocialInteractions: number;
  todayEnergyScore: number | null;
  presenceState: PresenceState;
  nightCycleMode: string;
}

class LifeLoggerService {
  private lastHealthSync: Date | null = null;
  private lastSocialSync: Date | null = null;
  
  async getStatus(): Promise<LifeLoggerStatus> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [healthCount, socialCount, todayReport] = await Promise.all([
      getDatabase().select({ count: sql<number>`count(*)` })
        .from(healthMetrics)
        .where(gte(healthMetrics.recordedAt, today)),
      getDatabase().select({ count: sql<number>`count(*)` })
        .from(socialInteractions)
        .where(gte(socialInteractions.occurredAt, today)),
      getDatabase().select()
        .from(dailyEnergyReports)
        .where(gte(dailyEnergyReports.reportDate, today))
        .limit(1)
    ]);
    
    const presenceState = getCurrentPresenceState();
    const nightStatus = nightCycleEngine.getStatus();
    
    return {
      isActive: true,
      lastHealthSync: this.lastHealthSync,
      lastSocialSync: this.lastSocialSync,
      todayHealthRecords: Number(healthCount[0]?.count || 0),
      todaySocialInteractions: Number(socialCount[0]?.count || 0),
      todayEnergyScore: todayReport[0]?.totalEnergyScore ?? null,
      presenceState,
      nightCycleMode: nightStatus.mode,
    };
  }
  
  async recordHealthData(input: HealthDataInput): Promise<HealthMetrics> {
    const data: InsertHealthMetrics = {
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      heartRate: input.heartRate,
      heartRateVariability: input.hrv,
      bloodOxygen: input.bloodOxygen,
      bodyTemperature: input.bodyTemperature,
      bloodPressureSystolic: input.bpSystolic,
      bloodPressureDiastolic: input.bpDiastolic,
      steps: input.steps,
      distance: input.distance,
      caloriesBurned: input.caloriesBurned,
      activeMinutes: input.activeMinutes,
      standingHours: input.standingHours,
      sleepDurationMinutes: input.sleepDurationMinutes,
      deepSleepMinutes: input.deepSleepMinutes,
      lightSleepMinutes: input.lightSleepMinutes,
      remSleepMinutes: input.remSleepMinutes,
      awakeMinutes: input.awakeMinutes,
      sleepQualityScore: input.sleepQualityScore,
      stressLevel: input.stressLevel,
      relaxationScore: input.relaxationScore,
      recordedAt: input.recordedAt,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    };
    
    const [result] = await getDatabase().insert(healthMetrics).values(data).returning();
    this.lastHealthSync = new Date();
    
    logger.info(`[LifeLogger] 健康数据已记录: HR=${input.heartRate}, Steps=${input.steps}`);
    
    return result;
  }
  
  async recordSocialInteraction(input: SocialInteractionInput): Promise<SocialInteraction> {
    const data: InsertSocialInteraction = {
      contactHash: input.contactHash,
      contactAlias: input.contactAlias,
      contactCategory: input.contactCategory,
      relationshipImportance: input.relationshipImportance,
      interactionType: input.interactionType,
      direction: input.direction,
      durationSeconds: input.durationSeconds,
      emotionalImpact: input.emotionalImpact,
      emotionScore: input.emotionScore,
      stressContribution: input.stressContribution,
      communicationQuality: input.communicationQuality,
      wasProductive: input.wasProductive,
      contextTags: input.contextTags,
      locationCategory: input.locationCategory,
      occurredAt: input.occurredAt,
    };
    
    const [result] = await getDatabase().insert(socialInteractions).values(data).returning();
    this.lastSocialSync = new Date();
    
    logger.info(`[LifeLogger] 社交互动已记录: ${input.interactionType} with ${input.contactAlias || 'unknown'}`);
    
    return result;
  }
  
  async recordBehaviorPattern(input: InsertBehaviorPattern): Promise<BehaviorPattern> {
    const [result] = await getDatabase().insert(behaviorPatterns).values(input).returning();
    logger.info(`[LifeLogger] 行为模式已记录: ${input.patternType}`);
    return result;
  }
  
  async getRecentHealthData(hours: number = 24): Promise<HealthMetrics[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return getDatabase().select()
      .from(healthMetrics)
      .where(gte(healthMetrics.recordedAt, since))
      .orderBy(desc(healthMetrics.recordedAt));
  }
  
  async getRecentSocialInteractions(hours: number = 24): Promise<SocialInteraction[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return getDatabase().select()
      .from(socialInteractions)
      .where(gte(socialInteractions.occurredAt, since))
      .orderBy(desc(socialInteractions.occurredAt));
  }
  
  async analyzeEnergy(date: Date = new Date()): Promise<EnergyAnalysis> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [healthData, socialData, patterns] = await Promise.all([
      getDatabase().select().from(healthMetrics)
        .where(and(gte(healthMetrics.recordedAt, startOfDay), lte(healthMetrics.recordedAt, endOfDay))),
      getDatabase().select().from(socialInteractions)
        .where(and(gte(socialInteractions.occurredAt, startOfDay), lte(socialInteractions.occurredAt, endOfDay))),
      getDatabase().select().from(behaviorPatterns)
        .where(and(gte(behaviorPatterns.recordedDate, startOfDay), lte(behaviorPatterns.recordedDate, endOfDay)))
    ]);
    
    const avgStress = healthData.length > 0 
      ? healthData.reduce((sum, h) => sum + (h.stressLevel || 0), 0) / healthData.length 
      : 50;
    
    const avgHeartRate = healthData.length > 0
      ? healthData.reduce((sum, h) => sum + (h.heartRate || 0), 0) / healthData.length
      : 70;
    
    const totalSteps = healthData.reduce((sum, h) => sum + (h.steps || 0), 0);
    const totalActiveMinutes = healthData.reduce((sum, h) => sum + (h.activeMinutes || 0), 0);
    
    const sleepData = healthData.find(h => h.sleepDurationMinutes && h.sleepDurationMinutes > 0);
    const sleepRecoveryScore = sleepData?.sleepQualityScore || 0;
    
    const positiveInteractions = socialData.filter(s => 
      s.emotionalImpact === 'POSITIVE' || s.emotionalImpact === 'ENERGIZING'
    ).length;
    const negativeInteractions = socialData.filter(s => 
      s.emotionalImpact === 'NEGATIVE' || s.emotionalImpact === 'STRESSFUL'
    ).length;
    
    const socialHealthScore = socialData.length > 0
      ? Math.min(100, (positiveInteractions * 20) + (50 - negativeInteractions * 15))
      : 50;
    
    const productivityPeaks = patterns
      .filter(p => p.isOptimalForWork)
      .map(p => `${p.hourOfDay}:00`);
    
    const focusTimeMinutes = patterns
      .filter(p => (p.focusScore || 0) > 70)
      .reduce((sum, p) => sum + 60, 0);
    
    const physicalEnergySpent = Math.min(100, (totalSteps / 100) + (totalActiveMinutes / 2));
    const mentalEnergySpent = Math.min(100, focusTimeMinutes / 4.8);
    const emotionalEnergySpent = Math.min(100, avgStress + (negativeInteractions * 10));
    
    const totalEnergyScore = Math.max(0, 100 - (physicalEnergySpent * 0.3 + mentalEnergySpent * 0.35 + emotionalEnergySpent * 0.35));
    
    const stressTriggers: Array<{ source: string; impact: number; time: string }> = [];
    const stressfulInteractions = socialData.filter(s => s.emotionalImpact === 'STRESSFUL');
    for (const interaction of stressfulInteractions) {
      stressTriggers.push({
        source: interaction.contactAlias || interaction.interactionType,
        impact: interaction.stressContribution || 0.5,
        time: interaction.occurredAt.toISOString(),
      });
    }
    
    const stressPeakTime = healthData.length > 0
      ? healthData.reduce((max, h) => (h.stressLevel || 0) > (max.stressLevel || 0) ? h : max).recordedAt.toISOString()
      : undefined;
    
    const keyInsights: Array<{ category: string; insight: string; importance: number }> = [];
    if (sleepRecoveryScore < 60) {
      keyInsights.push({ category: 'sleep', insight: '睡眠质量偏低，建议调整作息', importance: 0.9 });
    }
    if (avgStress > 70) {
      keyInsights.push({ category: 'stress', insight: '今日压力较高，需要放松', importance: 0.85 });
    }
    if (negativeInteractions > positiveInteractions) {
      keyInsights.push({ category: 'social', insight: '负面社交较多，注意情绪管理', importance: 0.8 });
    }
    if (totalSteps < 5000) {
      keyInsights.push({ category: 'activity', insight: '今日运动量不足，建议增加活动', importance: 0.7 });
    }
    
    const anomalies: Array<{ metric: string; value: number; baseline: number; deviation: number }> = [];
    if (avgHeartRate > 100) {
      anomalies.push({ metric: 'heart_rate', value: avgHeartRate, baseline: 70, deviation: (avgHeartRate - 70) / 70 });
    }
    
    return {
      totalEnergyScore,
      physicalEnergySpent,
      mentalEnergySpent,
      emotionalEnergySpent,
      sleepRecoveryScore,
      overallStressLevel: avgStress,
      stressPeakTime,
      stressTriggers,
      socialHealthScore,
      positiveInteractions,
      negativeInteractions,
      productivityPeakHours: productivityPeaks,
      focusTimeMinutes,
      keyInsights,
      anomalies,
    };
  }
  
  async generateDailyRecommendations(energyAnalysis: EnergyAnalysis): Promise<DailyRecommendations> {
    const recommendations: Array<{ category: string; suggestion: string; priority: number; reason: string }> = [];
    
    if (energyAnalysis.sleepRecoveryScore < 70) {
      recommendations.push({
        category: 'sleep',
        suggestion: '今晚建议提前30分钟入睡',
        priority: 1,
        reason: '昨晚睡眠恢复不足',
      });
    }
    
    if (energyAnalysis.overallStressLevel > 60) {
      recommendations.push({
        category: 'wellness',
        suggestion: '安排15分钟冥想或深呼吸练习',
        priority: 2,
        reason: '压力水平偏高，需要主动放松',
      });
    }
    
    if (energyAnalysis.negativeInteractions > energyAnalysis.positiveInteractions) {
      recommendations.push({
        category: 'social',
        suggestion: '今天尽量与亲近的人交流',
        priority: 3,
        reason: '社交能量需要补充',
      });
    }
    
    if (energyAnalysis.focusTimeMinutes < 120) {
      recommendations.push({
        category: 'productivity',
        suggestion: '安排2个专注时段处理重要任务',
        priority: 2,
        reason: '专注时间需要增加',
      });
    }
    
    const suggestedBreakTimes = ['10:30', '15:00', '17:30'];
    if (energyAnalysis.overallStressLevel > 70) {
      suggestedBreakTimes.push('12:30', '19:00');
    }
    
    const priorityTasks: string[] = [];
    if (energyAnalysis.productivityPeakHours.length > 0) {
      priorityTasks.push(`在效率高峰期(${energyAnalysis.productivityPeakHours[0]})处理最重要的工作`);
    }
    
    const avoidanceRecommendations: string[] = [];
    for (const trigger of energyAnalysis.stressTriggers.slice(0, 2)) {
      avoidanceRecommendations.push(`减少与"${trigger.source}"相关的活动`);
    }
    if (energyAnalysis.overallStressLevel > 70) {
      avoidanceRecommendations.push('避免安排额外的会议');
    }
    
    return {
      suggestedWakeTime: energyAnalysis.sleepRecoveryScore < 60 ? '07:30' : '06:30',
      suggestedSleepTime: energyAnalysis.overallStressLevel > 60 ? '22:00' : '23:00',
      suggestedBreakTimes,
      priorityTasks,
      avoidanceRecommendations,
      recommendations,
    };
  }
  
  async generateDailyReport(date: Date = new Date()): Promise<DailyEnergyReport> {
    const energyAnalysis = await this.analyzeEnergy(date);
    const recommendations = await this.generateDailyRecommendations(energyAnalysis);
    
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);
    
    const existing = await getDatabase().select()
      .from(dailyEnergyReports)
      .where(eq(dailyEnergyReports.reportDate, reportDate))
      .limit(1);
    
    const reportData: InsertDailyEnergyReport = {
      reportDate,
      totalEnergyScore: energyAnalysis.totalEnergyScore,
      physicalEnergySpent: energyAnalysis.physicalEnergySpent,
      mentalEnergySpent: energyAnalysis.mentalEnergySpent,
      emotionalEnergySpent: energyAnalysis.emotionalEnergySpent,
      sleepRecoveryScore: energyAnalysis.sleepRecoveryScore,
      restfulnessScore: energyAnalysis.sleepRecoveryScore * 0.8,
      overallStressLevel: energyAnalysis.overallStressLevel,
      stressPeakTime: energyAnalysis.stressPeakTime,
      stressTriggers: energyAnalysis.stressTriggers,
      socialHealthScore: energyAnalysis.socialHealthScore,
      positiveInteractions: energyAnalysis.positiveInteractions,
      negativeInteractions: energyAnalysis.negativeInteractions,
      keyRelationshipAlerts: [],
      productivityPeakHours: energyAnalysis.productivityPeakHours,
      focusTimeMinutes: energyAnalysis.focusTimeMinutes,
      interruptionCount: 0,
      keyInsights: energyAnalysis.keyInsights,
      anomalies: energyAnalysis.anomalies,
      tomorrowRecommendations: recommendations.recommendations,
      suggestedWakeTime: recommendations.suggestedWakeTime,
      suggestedSleepTime: recommendations.suggestedSleepTime,
      suggestedBreakTimes: recommendations.suggestedBreakTimes,
      priorityTasks: recommendations.priorityTasks,
      avoidanceRecommendations: recommendations.avoidanceRecommendations,
      weeklyTrend: 'STABLE',
      monthlyComparison: 0,
      analysisModel: 'life-logger-v1',
      confidenceScore: 0.85,
    };
    
    if (existing.length > 0) {
      const [result] = await getDatabase().update(dailyEnergyReports)
        .set(reportData)
        .where(eq(dailyEnergyReports.id, existing[0].id))
        .returning();
      logger.info(`[LifeLogger] 每日报告已更新: ${reportDate.toISOString().split('T')[0]}`);
      return result;
    } else {
      const [result] = await getDatabase().insert(dailyEnergyReports).values(reportData).returning();
      logger.info(`[LifeLogger] 每日报告已生成: ${reportDate.toISOString().split('T')[0]}`);
      return result;
    }
  }
  
  async getDailyReport(date: Date = new Date()): Promise<DailyEnergyReport | null> {
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);
    
    const [report] = await getDatabase().select()
      .from(dailyEnergyReports)
      .where(eq(dailyEnergyReports.reportDate, reportDate))
      .limit(1);
    
    return report || null;
  }
  
  async getWeeklyTrend(): Promise<{ date: string; energyScore: number }[]> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const reports = await getDatabase().select()
      .from(dailyEnergyReports)
      .where(gte(dailyEnergyReports.reportDate, weekAgo))
      .orderBy(desc(dailyEnergyReports.reportDate));
    
    return reports.map(r => ({
      date: r.reportDate.toISOString().split('T')[0],
      energyScore: r.totalEnergyScore || 0,
    }));
  }
  
  async analyzeEmotionFromText(text: string): Promise<EmotionAnalysis> {
    return empathicDialogue.analyzeEmotion(text);
  }
}

export const lifeLogger = new LifeLoggerService();
