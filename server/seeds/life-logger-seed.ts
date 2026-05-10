/**
 * Life Logger Sample Data Seed
 * Project Guardian Angel (守护天使协议)
 * 
 * 生成示例生活数据用于测试和演示
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('LifeLoggerSeed');

import { getDatabase } from '../db';
import { healthMetrics, socialInteractions, behaviorPatterns, dailyEnergyReports } from '@shared/schema';

export async function seedLifeLoggerData() {
  logger.info('开始生成示例数据...');
  
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const healthRecords = [
    {
      deviceType: 'WATCH',
      heartRate: 72,
      heartRateVariability: 45.5,
      bloodOxygen: 98.2,
      stressLevel: 35,
      relaxationScore: 65,
      steps: 2500,
      activeMinutes: 45,
      recordedAt: new Date(today.getTime() + 8 * 60 * 60 * 1000),
    },
    {
      deviceType: 'WATCH',
      heartRate: 85,
      heartRateVariability: 38.2,
      bloodOxygen: 97.5,
      stressLevel: 55,
      relaxationScore: 45,
      steps: 4200,
      activeMinutes: 90,
      recordedAt: new Date(today.getTime() + 12 * 60 * 60 * 1000),
    },
    {
      deviceType: 'WATCH',
      heartRate: 68,
      heartRateVariability: 52.0,
      bloodOxygen: 99.0,
      stressLevel: 25,
      relaxationScore: 75,
      steps: 8000,
      activeMinutes: 150,
      recordedAt: new Date(today.getTime() + 18 * 60 * 60 * 1000),
    },
    {
      deviceType: 'RING',
      sleepDurationMinutes: 420,
      deepSleepMinutes: 90,
      lightSleepMinutes: 210,
      remSleepMinutes: 100,
      awakeMinutes: 20,
      sleepQualityScore: 78,
      recordedAt: new Date(today.getTime() + 7 * 60 * 60 * 1000),
      periodStart: new Date(today.getTime() - 1 * 60 * 60 * 1000),
      periodEnd: new Date(today.getTime() + 6 * 60 * 60 * 1000),
    },
  ];
  
  for (const record of healthRecords) {
    await getDatabase().insert(healthMetrics).values(record);
  }
  logger.info({ count: healthRecords.length }, '已插入健康数据');
  
  const socialRecords = [
    {
      contactAlias: '张总',
      contactCategory: 'BUSINESS',
      relationshipImportance: 8,
      interactionType: 'CALL',
      direction: 'INBOUND',
      durationSeconds: 1800,
      emotionalImpact: 'STRESSFUL',
      emotionScore: -0.3,
      stressContribution: 0.6,
      communicationQuality: 0.5,
      wasProductive: true,
      contextTags: ['商务', '谈判', '合同'],
      locationCategory: 'OFFICE',
      occurredAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
    },
    {
      contactAlias: '妈妈',
      contactCategory: 'FAMILY',
      relationshipImportance: 10,
      interactionType: 'CALL',
      direction: 'OUTBOUND',
      durationSeconds: 600,
      emotionalImpact: 'POSITIVE',
      emotionScore: 0.8,
      stressContribution: 0,
      communicationQuality: 0.9,
      wasProductive: true,
      contextTags: ['家庭', '问候'],
      locationCategory: 'HOME',
      occurredAt: new Date(today.getTime() + 20 * 60 * 60 * 1000),
    },
    {
      contactAlias: '李经理',
      contactCategory: 'COLLEAGUE',
      relationshipImportance: 6,
      interactionType: 'MEETING',
      direction: 'INBOUND',
      durationSeconds: 3600,
      emotionalImpact: 'NEUTRAL',
      emotionScore: 0,
      stressContribution: 0.3,
      communicationQuality: 0.7,
      wasProductive: true,
      contextTags: ['工作', '会议', '项目'],
      locationCategory: 'OFFICE',
      occurredAt: new Date(today.getTime() + 14 * 60 * 60 * 1000),
    },
    {
      contactAlias: '老王',
      contactCategory: 'FRIEND',
      relationshipImportance: 7,
      interactionType: 'MESSAGE',
      direction: 'INBOUND',
      durationSeconds: 0,
      emotionalImpact: 'ENERGIZING',
      emotionScore: 0.6,
      stressContribution: 0,
      communicationQuality: 0.8,
      wasProductive: false,
      contextTags: ['朋友', '聊天'],
      locationCategory: 'OTHER',
      occurredAt: new Date(today.getTime() + 16 * 60 * 60 * 1000),
    },
  ];
  
  for (const record of socialRecords) {
    await getDatabase().insert(socialInteractions).values(record as any);
  }
  logger.info({ count: socialRecords.length }, '已插入社交互动记录');
  
  const patternRecords = [
    {
      patternType: 'WORK_PEAK',
      dayOfWeek: today.getDay(),
      hourOfDay: 10,
      isWeekday: today.getDay() >= 1 && today.getDay() <= 5,
      energyLevel: 85,
      focusScore: 90,
      productivityScore: 88,
      locationCategory: 'OFFICE',
      timeAtLocation: 180,
      primaryActivity: 'WORK',
      screenTime: 150,
      isOptimalForWork: true,
      isOptimalForCreative: true,
      isOptimalForSocial: false,
      isOptimalForRest: false,
      recordedDate: today,
      sampleCount: 1,
    },
    {
      patternType: 'WORK_PEAK',
      dayOfWeek: today.getDay(),
      hourOfDay: 15,
      isWeekday: today.getDay() >= 1 && today.getDay() <= 5,
      energyLevel: 70,
      focusScore: 75,
      productivityScore: 72,
      locationCategory: 'OFFICE',
      timeAtLocation: 120,
      primaryActivity: 'WORK',
      screenTime: 100,
      isOptimalForWork: true,
      isOptimalForCreative: false,
      isOptimalForSocial: true,
      isOptimalForRest: false,
      recordedDate: today,
      sampleCount: 1,
    },
    {
      patternType: 'REST',
      dayOfWeek: today.getDay(),
      hourOfDay: 21,
      isWeekday: today.getDay() >= 1 && today.getDay() <= 5,
      energyLevel: 50,
      focusScore: 30,
      productivityScore: 20,
      locationCategory: 'HOME',
      timeAtLocation: 180,
      primaryActivity: 'REST',
      screenTime: 60,
      isOptimalForWork: false,
      isOptimalForCreative: false,
      isOptimalForSocial: true,
      isOptimalForRest: true,
      recordedDate: today,
      sampleCount: 1,
    },
  ];
  
  for (const record of patternRecords) {
    await getDatabase().insert(behaviorPatterns).values(record as any);
  }
  logger.info({ count: patternRecords.length }, '已插入行为模式记录');
  
  logger.info('示例数据生成完成！');
  
  return {
    healthRecords: healthRecords.length,
    socialRecords: socialRecords.length,
    patternRecords: patternRecords.length,
  };
}
