/**
 * 小智 Social Strategy Engine - 社交策略优化引擎
 * Project Guardian Angel (守护天使协议)
 * 
 * 超越设计文档的功能：
 * 1. 关键联系人久未联络提醒
 * 2. 最佳沟通时间段分析
 * 3. 关系维护策略建议
 * 4. 社交动态监控与预警
 * 5. 人脉价值评估
 * 6. 沟通成功率预测
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { socialInteractions, persons } from '@shared/schema';
import { desc, eq, gte, lte, and, sql } from 'drizzle-orm';

export type RelationshipHealth = 'THRIVING' | 'STABLE' | 'COOLING' | 'AT_RISK' | 'DORMANT';
export type ContactPriority = 'VIP' | 'HIGH' | 'MEDIUM' | 'LOW';
export type CommunicationStyle = 'FORMAL' | 'CASUAL' | 'BRIEF' | 'DETAILED';

export interface ContactProfile {
  contactHash: string;
  alias: string;
  category: string;
  importance: number;
  relationshipHealth: RelationshipHealth;
  lastContactDate: Date | null;
  daysSinceLastContact: number;
  totalInteractions: number;
  positiveRatio: number;
  preferredContactTime: string | null;
  preferredChannel: string | null;
  communicationStyle: CommunicationStyle;
  averageResponseTime: number;
  stressImpact: number;
}

export interface ContactReminder {
  contactHash: string;
  alias: string;
  category: string;
  importance: number;
  daysSinceLastContact: number;
  urgency: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  suggestedTime: string;
  suggestedChannel: string;
  reason: string;
  relationshipRisk: string;
}

export interface OptimalContactWindow {
  contactHash: string;
  alias: string;
  bestHours: number[];
  bestDays: string[];
  successRate: number;
  averageResponseTime: number;
  recommendation: string;
}

export interface RelationshipInsight {
  category: string;
  insight: string;
  importance: number;
  actionable: boolean;
  suggestedAction?: string;
}

export interface SocialStrategyReport {
  overallNetworkHealth: number;
  totalActiveContacts: number;
  atRiskRelationships: number;
  dormantRelationships: number;
  contactReminders: ContactReminder[];
  weeklyPriorities: Array<{ contact: string; action: string; reason: string }>;
  networkInsights: RelationshipInsight[];
  communicationBalance: { positive: number; neutral: number; negative: number };
  topEnergyDrains: Array<{ contact: string; stressScore: number }>;
  topEnergySources: Array<{ contact: string; positiveScore: number }>;
}

const RELATIONSHIP_THRESHOLDS = {
  VIP_DORMANT_DAYS: 7,
  HIGH_DORMANT_DAYS: 14,
  MEDIUM_DORMANT_DAYS: 30,
  LOW_DORMANT_DAYS: 60,
  AT_RISK_MULTIPLIER: 1.5,
  COOLING_MULTIPLIER: 1.2,
};

class SocialStrategyService {
  
  async getContactProfile(contactHash: string): Promise<ContactProfile | null> {
    const interactions = await db.select()
      .from(socialInteractions)
      .where(eq(socialInteractions.contactHash, contactHash))
      .orderBy(desc(socialInteractions.occurredAt));
    
    if (interactions.length === 0) return null;
    
    const latest = interactions[0];
    const now = new Date();
    const lastContactDate = latest.occurredAt;
    const daysSinceLastContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const positiveCount = interactions.filter(i => 
      i.emotionalImpact === 'POSITIVE' || i.emotionalImpact === 'ENERGIZING'
    ).length;
    const positiveRatio = positiveCount / interactions.length;
    
    const avgStress = interactions.reduce((sum, i) => sum + (i.stressContribution || 0), 0) / interactions.length;
    
    const hourCounts = new Map<number, number>();
    for (const i of interactions) {
      const hour = i.occurredAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    let preferredHour = 10;
    let maxCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        preferredHour = hour;
      }
    });
    
    const channelCounts = new Map<string, number>();
    for (const i of interactions) {
      channelCounts.set(i.interactionType, (channelCounts.get(i.interactionType) || 0) + 1);
    }
    let preferredChannel = 'MESSAGE';
    maxCount = 0;
    channelCounts.forEach((count, channel) => {
      if (count > maxCount) {
        maxCount = count;
        preferredChannel = channel;
      }
    });
    
    const importance = latest.relationshipImportance || 5;
    const relationshipHealth = this.calculateRelationshipHealth(daysSinceLastContact, importance, positiveRatio);
    
    const avgDuration = interactions.filter(i => i.durationSeconds).reduce((sum, i) => sum + (i.durationSeconds || 0), 0) / 
      Math.max(1, interactions.filter(i => i.durationSeconds).length);
    const communicationStyle: CommunicationStyle = avgDuration > 600 ? 'DETAILED' : avgDuration > 120 ? 'CASUAL' : 'BRIEF';
    
    return {
      contactHash,
      alias: latest.contactAlias || '未命名联系人',
      category: latest.contactCategory || 'OTHER',
      importance,
      relationshipHealth,
      lastContactDate,
      daysSinceLastContact,
      totalInteractions: interactions.length,
      positiveRatio,
      preferredContactTime: `${preferredHour}:00`,
      preferredChannel,
      communicationStyle,
      averageResponseTime: 0,
      stressImpact: avgStress,
    };
  }
  
  private calculateRelationshipHealth(daysSince: number, importance: number, positiveRatio: number): RelationshipHealth {
    const threshold = importance >= 8 ? RELATIONSHIP_THRESHOLDS.VIP_DORMANT_DAYS
      : importance >= 6 ? RELATIONSHIP_THRESHOLDS.HIGH_DORMANT_DAYS
      : importance >= 4 ? RELATIONSHIP_THRESHOLDS.MEDIUM_DORMANT_DAYS
      : RELATIONSHIP_THRESHOLDS.LOW_DORMANT_DAYS;
    
    if (daysSince > threshold * RELATIONSHIP_THRESHOLDS.AT_RISK_MULTIPLIER) {
      return positiveRatio < 0.3 ? 'DORMANT' : 'AT_RISK';
    }
    if (daysSince > threshold * RELATIONSHIP_THRESHOLDS.COOLING_MULTIPLIER) {
      return 'COOLING';
    }
    if (daysSince <= threshold * 0.5 && positiveRatio >= 0.6) {
      return 'THRIVING';
    }
    return 'STABLE';
  }
  
  async getContactReminders(): Promise<ContactReminder[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentInteractions = await db.select()
      .from(socialInteractions)
      .where(gte(socialInteractions.occurredAt, thirtyDaysAgo))
      .orderBy(desc(socialInteractions.occurredAt));
    
    const contactMap = new Map<string, typeof recentInteractions>();
    for (const interaction of recentInteractions) {
      const hash = interaction.contactHash || interaction.contactAlias || 'unknown';
      if (!contactMap.has(hash)) {
        contactMap.set(hash, []);
      }
      contactMap.get(hash)!.push(interaction);
    }
    
    const reminders: ContactReminder[] = [];
    const now = new Date();
    
    for (const [hash, interactions] of Array.from(contactMap.entries())) {
      const latest = interactions[0];
      const importance = latest.relationshipImportance || 5;
      const daysSince = Math.floor((now.getTime() - latest.occurredAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const threshold = importance >= 8 ? 7 : importance >= 6 ? 14 : importance >= 4 ? 21 : 30;
      
      if (daysSince >= threshold * 0.8) {
        const urgency = daysSince >= threshold * 1.5 ? 'URGENT' 
          : daysSince >= threshold ? 'HIGH'
          : daysSince >= threshold * 0.8 ? 'MEDIUM' : 'LOW';
        
        const preferredHour = this.findPreferredHour(interactions);
        const preferredChannel = this.findPreferredChannel(interactions);
        
        reminders.push({
          contactHash: hash,
          alias: latest.contactAlias || '未命名联系人',
          category: latest.contactCategory || 'OTHER',
          importance,
          daysSinceLastContact: daysSince,
          urgency,
          suggestedAction: this.generateSuggestedAction(latest.contactCategory, daysSince, importance),
          suggestedTime: `${preferredHour}:00`,
          suggestedChannel: preferredChannel,
          reason: `已有${daysSince}天未联系，${importance >= 7 ? '这是重要联系人' : '关系可能变淡'}`,
          relationshipRisk: daysSince > threshold ? '关系正在冷却，建议尽快联系' : '保持联络频率',
        });
      }
    }
    
    return reminders.sort((a, b) => {
      const urgencyOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.importance - a.importance;
    });
  }
  
  private findPreferredHour(interactions: any[]): number {
    const hourCounts = new Map<number, number>();
    for (const i of interactions) {
      const hour = i.occurredAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    let preferredHour = 14;
    let maxCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        preferredHour = hour;
      }
    });
    return preferredHour;
  }
  
  private findPreferredChannel(interactions: any[]): string {
    const channelCounts = new Map<string, number>();
    for (const i of interactions) {
      channelCounts.set(i.interactionType, (channelCounts.get(i.interactionType) || 0) + 1);
    }
    let preferredChannel = 'MESSAGE';
    let maxCount = 0;
    channelCounts.forEach((count, channel) => {
      if (count > maxCount) {
        maxCount = count;
        preferredChannel = channel;
      }
    });
    return preferredChannel;
  }
  
  private generateSuggestedAction(category: string | null, daysSince: number, importance: number): string {
    if (category === 'BUSINESS') {
      if (daysSince > 21) return '发送商务问候，询问近况或分享行业动态';
      return '发送简短问候，保持商务联系';
    }
    if (category === 'FAMILY') {
      if (daysSince > 7) return '打个电话问候家人，关心他们的生活';
      return '发送温馨问候';
    }
    if (category === 'FRIEND') {
      if (daysSince > 14) return '约个时间见面或视频聊天';
      return '发送有趣的消息或表情包';
    }
    if (importance >= 8) {
      return '重要联系人，建议安排一次深度交流';
    }
    return '发送简短问候保持联系';
  }
  
  async getOptimalContactWindow(contactHash: string): Promise<OptimalContactWindow | null> {
    const interactions = await db.select()
      .from(socialInteractions)
      .where(eq(socialInteractions.contactHash, contactHash))
      .orderBy(desc(socialInteractions.occurredAt))
      .limit(50);
    
    if (interactions.length < 3) return null;
    
    const latest = interactions[0];
    
    const hourSuccess = new Map<number, { total: number; positive: number }>();
    const daySuccess = new Map<string, { total: number; positive: number }>();
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    for (const i of interactions) {
      const hour = i.occurredAt.getHours();
      const day = days[i.occurredAt.getDay()];
      const isPositive = i.emotionalImpact === 'POSITIVE' || i.emotionalImpact === 'ENERGIZING' || i.wasProductive;
      
      if (!hourSuccess.has(hour)) hourSuccess.set(hour, { total: 0, positive: 0 });
      if (!daySuccess.has(day)) daySuccess.set(day, { total: 0, positive: 0 });
      
      hourSuccess.get(hour)!.total++;
      daySuccess.get(day)!.total++;
      
      if (isPositive) {
        hourSuccess.get(hour)!.positive++;
        daySuccess.get(day)!.positive++;
      }
    }
    
    const bestHours: number[] = [];
    hourSuccess.forEach((stats, hour) => {
      if (stats.total >= 2 && stats.positive / stats.total >= 0.5) {
        bestHours.push(hour);
      }
    });
    bestHours.sort((a, b) => {
      const aRate = hourSuccess.get(a)!.positive / hourSuccess.get(a)!.total;
      const bRate = hourSuccess.get(b)!.positive / hourSuccess.get(b)!.total;
      return bRate - aRate;
    });
    
    const bestDays: string[] = [];
    daySuccess.forEach((stats, day) => {
      if (stats.total >= 2 && stats.positive / stats.total >= 0.5) {
        bestDays.push(day);
      }
    });
    
    const totalPositive = interactions.filter(i => 
      i.emotionalImpact === 'POSITIVE' || i.emotionalImpact === 'ENERGIZING' || i.wasProductive
    ).length;
    const successRate = totalPositive / interactions.length;
    
    const recommendation = bestHours.length > 0 && bestDays.length > 0
      ? `建议在${bestDays[0]}${bestHours[0]}:00联系，沟通成功率最高`
      : bestHours.length > 0
      ? `建议在${bestHours[0]}:00左右联系`
      : '数据不足，建议在工作时间联系';
    
    return {
      contactHash,
      alias: latest.contactAlias || '未命名联系人',
      bestHours: bestHours.slice(0, 3),
      bestDays: bestDays.slice(0, 3),
      successRate,
      averageResponseTime: 0,
      recommendation,
    };
  }
  
  async generateStrategyReport(): Promise<SocialStrategyReport> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    
    const interactions = await db.select()
      .from(socialInteractions)
      .where(gte(socialInteractions.occurredAt, sixtyDaysAgo))
      .orderBy(desc(socialInteractions.occurredAt));
    
    const contactMap = new Map<string, typeof interactions>();
    for (const i of interactions) {
      const hash = i.contactHash || i.contactAlias || 'unknown';
      if (!contactMap.has(hash)) contactMap.set(hash, []);
      contactMap.get(hash)!.push(i);
    }
    
    let atRiskCount = 0;
    let dormantCount = 0;
    const now = new Date();
    
    const stressScores: Array<{ contact: string; stressScore: number }> = [];
    const positiveScores: Array<{ contact: string; positiveScore: number }> = [];
    
    for (const [hash, contactInteractions] of Array.from(contactMap.entries())) {
      const latest = contactInteractions[0];
      const importance = latest.relationshipImportance || 5;
      const daysSince = Math.floor((now.getTime() - latest.occurredAt.getTime()) / (1000 * 60 * 60 * 24));
      const positiveRatio = contactInteractions.filter((i: typeof interactions[0]) => 
        i.emotionalImpact === 'POSITIVE' || i.emotionalImpact === 'ENERGIZING'
      ).length / contactInteractions.length;
      
      const health = this.calculateRelationshipHealth(daysSince, importance, positiveRatio);
      if (health === 'AT_RISK') atRiskCount++;
      if (health === 'DORMANT') dormantCount++;
      
      const avgStress = contactInteractions.reduce((sum: number, i: typeof interactions[0]) => sum + (i.stressContribution || 0), 0) / contactInteractions.length;
      stressScores.push({ contact: latest.contactAlias || hash, stressScore: avgStress });
      positiveScores.push({ contact: latest.contactAlias || hash, positiveScore: positiveRatio });
    }
    
    const reminders = await this.getContactReminders();
    
    const positive = interactions.filter(i => i.emotionalImpact === 'POSITIVE' || i.emotionalImpact === 'ENERGIZING').length;
    const negative = interactions.filter(i => i.emotionalImpact === 'NEGATIVE' || i.emotionalImpact === 'STRESSFUL').length;
    const neutral = interactions.length - positive - negative;
    
    const insights: RelationshipInsight[] = [];
    if (atRiskCount > 0) {
      insights.push({
        category: 'relationship',
        insight: `有${atRiskCount}段关系正在冷却，建议主动联系`,
        importance: 0.9,
        actionable: true,
        suggestedAction: '查看久未联络提醒并安排联系',
      });
    }
    if (negative > positive) {
      insights.push({
        category: 'emotional',
        insight: '近期负面社交较多，注意情绪管理',
        importance: 0.85,
        actionable: true,
        suggestedAction: '减少与高压力联系人的互动，增加正面社交',
      });
    }
    if (contactMap.size < 5) {
      insights.push({
        category: 'network',
        insight: '活跃社交圈较小，建议拓展人脉',
        importance: 0.7,
        actionable: true,
        suggestedAction: '参加行业活动或加入兴趣群组',
      });
    }
    
    const networkHealth = Math.max(0, 100 - (atRiskCount * 10) - (dormantCount * 5) - (negative * 2));
    
    const weeklyPriorities = reminders.slice(0, 5).map(r => ({
      contact: r.alias,
      action: r.suggestedAction,
      reason: r.reason,
    }));
    
    return {
      overallNetworkHealth: networkHealth,
      totalActiveContacts: contactMap.size,
      atRiskRelationships: atRiskCount,
      dormantRelationships: dormantCount,
      contactReminders: reminders,
      weeklyPriorities,
      networkInsights: insights,
      communicationBalance: { positive, neutral, negative },
      topEnergyDrains: stressScores.sort((a, b) => b.stressScore - a.stressScore).slice(0, 3),
      topEnergySources: positiveScores.sort((a, b) => b.positiveScore - a.positiveScore).slice(0, 3),
    };
  }
  
  async getRelationshipMaintenance(contactHash: string): Promise<{
    profile: ContactProfile | null;
    optimalWindow: OptimalContactWindow | null;
    maintenanceAdvice: string[];
    nextContactSuggestion: string;
  }> {
    const profile = await this.getContactProfile(contactHash);
    const optimalWindow = await this.getOptimalContactWindow(contactHash);
    
    const maintenanceAdvice: string[] = [];
    let nextContactSuggestion = '保持现有联络频率';
    
    if (profile) {
      if (profile.relationshipHealth === 'AT_RISK' || profile.relationshipHealth === 'DORMANT') {
        maintenanceAdvice.push('关系正在冷却，建议尽快联系');
        nextContactSuggestion = '建议本周内联系';
      } else if (profile.relationshipHealth === 'COOLING') {
        maintenanceAdvice.push('联络频率有所下降，建议增加互动');
        nextContactSuggestion = '建议下周内联系';
      }
      
      if (profile.stressImpact > 0.6) {
        maintenanceAdvice.push('此联系人互动压力较大，建议控制互动时长');
      }
      
      if (profile.positiveRatio < 0.4) {
        maintenanceAdvice.push('正面互动较少，建议增加轻松话题');
      }
      
      if (profile.importance >= 8) {
        maintenanceAdvice.push('这是重要联系人，建议保持定期深度交流');
      }
    }
    
    if (optimalWindow) {
      maintenanceAdvice.push(`最佳联系时间：${optimalWindow.recommendation}`);
    }
    
    return {
      profile,
      optimalWindow,
      maintenanceAdvice,
      nextContactSuggestion,
    };
  }
}

export const socialStrategy = new SocialStrategyService();
