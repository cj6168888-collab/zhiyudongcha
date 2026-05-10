/**
 * 小智 Call Emotion Analyzer - 通话情绪分析
 * Project Guardian Angel (守护天使协议)
 * 
 * 功能：
 * 1. 分析通话对象让用户开心还是压力大
 * 2. 结合心率变化判断通话影响
 * 3. 存储每次通话的情绪评分
 * 4. 与Social Strategy集成，优化社交建议
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { callEmotionLogs, persons } from '@shared/schema';
import type { CallEmotionLog, InsertCallEmotionLog } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { bioGuardian } from './bio-guardian';

export type EmotionType = 'HAPPY' | 'NEUTRAL' | 'STRESSED' | 'ANXIOUS' | 'CALM';
export type ConversationMood = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type ImpactOnDay = 'ENERGIZING' | 'NEUTRAL' | 'DRAINING';

export interface EmotionProbabilities {
  happy: number;
  calm: number;
  neutral: number;
  stressed: number;
  anxious: number;
}

export interface MoodProbabilities {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ImpactProbabilities {
  energizing: number;
  neutral: number;
  draining: number;
}

export interface CallAnalysisResult {
  emotionScore: number;
  emotionType: EmotionType;
  emotionProbabilities: EmotionProbabilities;
  conversationMood: ConversationMood;
  moodProbabilities: MoodProbabilities;
  impactOnDay: ImpactOnDay;
  impactProbabilities: ImpactProbabilities;
  heartRateChange: number;
  suggestedAction: string;
  insights: string[];
  confidenceLevel: number;
}

export interface ContactEmotionProfile {
  contactName: string;
  personId?: string;
  totalCalls: number;
  avgEmotionScore: number;
  dominantEmotion: EmotionType;
  avgHeartRateChange: number;
  overallImpact: ImpactOnDay;
  recommendation: string;
}

export interface VoiceToneAnalysis {
  pitchVariance: number;
  speakingSpeed: number;
  volumeLevel: number;
  pauseFrequency: number;
  emotionalIndicators: string[];
}

class CallEmotionAnalyzerService {
  private readonly STRESS_HEART_RATE_THRESHOLD = 15;
  private readonly CALM_HEART_RATE_THRESHOLD = -5;
  
  async analyzeCall(data: {
    contactName: string;
    contactPhone?: string;
    personId?: string;
    callDirection: 'INCOMING' | 'OUTGOING';
    callDuration: number;
    callTime: Date;
    preCallHeartRate?: number;
    duringCallHeartRate?: number;
    postCallHeartRate?: number;
    voiceToneData?: VoiceToneAnalysis;
  }): Promise<CallAnalysisResult> {
    const heartRateChange = this.calculateHeartRateChange(
      data.preCallHeartRate,
      data.duringCallHeartRate,
      data.postCallHeartRate
    );
    
    const voiceEmotionScore = data.voiceToneData 
      ? this.analyzeVoiceTone(data.voiceToneData) 
      : 0;
    
    const heartRateEmotionScore = this.calculateHeartRateEmotionScore(heartRateChange);
    
    const emotionScore = Math.round((voiceEmotionScore + heartRateEmotionScore) / 2);
    const emotionType = this.determineEmotionType(emotionScore, heartRateChange);
    const conversationMood = this.determineConversationMood(emotionScore);
    const impactOnDay = this.determineImpactOnDay(emotionScore, heartRateChange);
    
    const suggestedAction = this.generateSuggestedAction(emotionType, impactOnDay, data.contactName);
    const insights = this.generateInsights(data, emotionScore, heartRateChange);
    
    await this.logCallEmotion({
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      personId: data.personId,
      callDirection: data.callDirection,
      callDuration: data.callDuration,
      callTime: data.callTime,
      preCallHeartRate: data.preCallHeartRate,
      duringCallHeartRate: data.duringCallHeartRate,
      postCallHeartRate: data.postCallHeartRate,
      heartRateChange,
      emotionScore,
      emotionType,
      voiceToneAnalysis: data.voiceToneData,
      conversationMood,
      impactOnDay,
      suggestedAction,
    });
    
    const emotionProbabilities = this.calculateEmotionProbabilities(emotionScore, heartRateChange);
    const moodProbabilities = this.calculateMoodProbabilities(emotionScore);
    const impactProbabilities = this.calculateImpactProbabilities(emotionScore, heartRateChange);
    const confidenceLevel = this.calculateConfidenceLevel(data);
    
    return {
      emotionScore,
      emotionType,
      emotionProbabilities,
      conversationMood,
      moodProbabilities,
      impactOnDay,
      impactProbabilities,
      heartRateChange,
      suggestedAction,
      insights,
      confidenceLevel,
    };
  }
  
  private calculateEmotionProbabilities(score: number, heartRateChange: number): EmotionProbabilities {
    const base = { happy: 0, calm: 0, neutral: 0, stressed: 0, anxious: 0 };
    
    if (score >= 40) {
      base.happy = 70 + Math.min(score - 40, 30);
      base.calm = Math.max(0, 30 - (score - 40));
    } else if (score >= 20) {
      base.happy = 40 + (score - 20);
      base.calm = heartRateChange <= 0 ? 40 : 20;
      base.neutral = 20;
    } else if (score >= 0) {
      base.neutral = 50 + score;
      base.calm = heartRateChange <= 0 ? 30 : 10;
      base.happy = score;
    } else if (score >= -20) {
      base.neutral = 40;
      base.stressed = Math.abs(score) * 2;
      base.anxious = heartRateChange >= 15 ? 20 : 5;
    } else if (score >= -40) {
      base.stressed = 50 + Math.abs(score + 20);
      base.anxious = heartRateChange >= 20 ? 30 : 15;
      base.neutral = 20;
    } else {
      base.anxious = 60 + Math.min(Math.abs(score + 40), 30);
      base.stressed = 30;
    }
    
    if (heartRateChange >= 25) {
      base.anxious = Math.min(100, base.anxious + 20);
      base.happy = Math.max(0, base.happy - 20);
    }
    
    const total = Object.values(base).reduce((a, b) => a + b, 0);
    if (total > 0) {
      base.happy = Math.round(base.happy / total * 100);
      base.calm = Math.round(base.calm / total * 100);
      base.neutral = Math.round(base.neutral / total * 100);
      base.stressed = Math.round(base.stressed / total * 100);
      base.anxious = Math.round(base.anxious / total * 100);
    }
    
    return base;
  }
  
  private calculateMoodProbabilities(score: number): MoodProbabilities {
    if (score >= 40) return { positive: 90, neutral: 8, negative: 2 };
    if (score >= 20) return { positive: 70, neutral: 25, negative: 5 };
    if (score >= 0) return { positive: 40, neutral: 50, negative: 10 };
    if (score >= -20) return { positive: 15, neutral: 55, negative: 30 };
    if (score >= -40) return { positive: 5, neutral: 25, negative: 70 };
    return { positive: 2, neutral: 8, negative: 90 };
  }
  
  private calculateImpactProbabilities(score: number, heartRateChange: number): ImpactProbabilities {
    const base = { energizing: 0, neutral: 0, draining: 0 };
    
    if (score >= 30 && heartRateChange <= 10) {
      base.energizing = 70;
      base.neutral = 25;
      base.draining = 5;
    } else if (score <= -30 || heartRateChange >= 20) {
      base.draining = 70;
      base.neutral = 20;
      base.energizing = 10;
    } else {
      base.neutral = 60;
      base.energizing = score > 0 ? 25 : 10;
      base.draining = score < 0 ? 25 : 10;
    }
    
    return base;
  }
  
  private calculateConfidenceLevel(data: any): number {
    let confidence = 50;
    
    if (data.preCallHeartRate && data.duringCallHeartRate) confidence += 20;
    if (data.postCallHeartRate) confidence += 10;
    if (data.voiceToneData) confidence += 15;
    if (data.callDuration > 60) confidence += 5;
    
    return Math.min(100, confidence);
  }
  
  private calculateHeartRateChange(pre?: number, during?: number, post?: number): number {
    if (!pre) return 0;
    
    const avgDuringPost = during && post 
      ? (during + post) / 2 
      : (during || post || pre);
    
    return Math.round(avgDuringPost - pre);
  }
  
  private analyzeVoiceTone(tone: VoiceToneAnalysis): number {
    let score = 0;
    
    if (tone.pitchVariance > 0.7) score += 20;
    else if (tone.pitchVariance < 0.3) score -= 10;
    
    if (tone.speakingSpeed > 0.8) score -= 15;
    else if (tone.speakingSpeed < 0.4) score -= 5;
    else score += 10;
    
    if (tone.volumeLevel > 0.8) score -= 10;
    else if (tone.volumeLevel < 0.3) score -= 5;
    
    if (tone.pauseFrequency > 0.6) score -= 15;
    
    if (tone.emotionalIndicators.includes('laughter')) score += 30;
    if (tone.emotionalIndicators.includes('sighing')) score -= 20;
    if (tone.emotionalIndicators.includes('raised_voice')) score -= 25;
    if (tone.emotionalIndicators.includes('calm_tone')) score += 15;
    
    return Math.max(-100, Math.min(100, score));
  }
  
  private calculateHeartRateEmotionScore(heartRateChange: number): number {
    if (heartRateChange >= this.STRESS_HEART_RATE_THRESHOLD) {
      return -50 - (heartRateChange - this.STRESS_HEART_RATE_THRESHOLD) * 2;
    } else if (heartRateChange <= this.CALM_HEART_RATE_THRESHOLD) {
      return 30 + Math.abs(heartRateChange - this.CALM_HEART_RATE_THRESHOLD) * 2;
    } else {
      return 10;
    }
  }
  
  private determineEmotionType(score: number, heartRateChange: number): EmotionType {
    if (score >= 40) return 'HAPPY';
    if (score >= 10 && heartRateChange <= 0) return 'CALM';
    if (score <= -40 || heartRateChange >= 25) return 'ANXIOUS';
    if (score <= -20 || heartRateChange >= 15) return 'STRESSED';
    return 'NEUTRAL';
  }
  
  private determineConversationMood(score: number): ConversationMood {
    if (score >= 20) return 'POSITIVE';
    if (score <= -20) return 'NEGATIVE';
    return 'NEUTRAL';
  }
  
  private determineImpactOnDay(score: number, heartRateChange: number): ImpactOnDay {
    if (score >= 30 && heartRateChange <= 10) return 'ENERGIZING';
    if (score <= -30 || heartRateChange >= 20) return 'DRAINING';
    return 'NEUTRAL';
  }
  
  private generateSuggestedAction(emotion: EmotionType, impact: ImpactOnDay, contact: string): string {
    if (emotion === 'ANXIOUS' || emotion === 'STRESSED') {
      return `通话后建议休息5分钟，做几次深呼吸。与${contact}的通话可能带来压力。`;
    }
    if (impact === 'DRAINING') {
      return `这次通话消耗了不少精力，建议喝杯水，稍作休息再继续工作。`;
    }
    if (emotion === 'HAPPY' && impact === 'ENERGIZING') {
      return `与${contact}的通话让你精力充沛，这是进行重要工作的好时机！`;
    }
    return '通话情绪稳定，可以继续正常工作。';
  }
  
  private generateInsights(data: any, score: number, heartRateChange: number): string[] {
    const insights: string[] = [];
    
    if (heartRateChange >= 20) {
      insights.push(`与${data.contactName}通话时心率明显升高，可能存在压力源`);
    }
    if (heartRateChange <= -10) {
      insights.push(`与${data.contactName}通话让你感到放松`);
    }
    if (data.callDuration > 1800) {
      insights.push('通话时间超过30分钟，长时间通话可能影响专注力');
    }
    if (data.callDirection === 'INCOMING' && score < -20) {
      insights.push('这个来电带来了负面情绪，考虑是否需要调整沟通方式');
    }
    
    return insights;
  }
  
  private async logCallEmotion(data: InsertCallEmotionLog): Promise<CallEmotionLog> {
    const [log] = await db.insert(callEmotionLogs).values(data).returning();
    console.log(`[CallEmotionAnalyzer] 通话情绪已记录: ${data.contactName}, 评分: ${data.emotionScore}`);
    return log;
  }
  
  async getContactEmotionProfile(contactName: string): Promise<ContactEmotionProfile | null> {
    const logs = await db.select().from(callEmotionLogs)
      .where(eq(callEmotionLogs.contactName, contactName))
      .orderBy(desc(callEmotionLogs.callTime));
    
    if (logs.length === 0) return null;
    
    const totalCalls = logs.length;
    const avgEmotionScore = Math.round(
      logs.reduce((sum, log) => sum + (log.emotionScore || 0), 0) / totalCalls
    );
    const avgHeartRateChange = Math.round(
      logs.reduce((sum, log) => sum + (log.heartRateChange || 0), 0) / totalCalls
    );
    
    const emotionCounts: Record<string, number> = {};
    logs.forEach(log => {
      const emotion = log.emotionType || 'NEUTRAL';
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    const dominantEmotion = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as EmotionType;
    
    const overallImpact = this.determineImpactOnDay(avgEmotionScore, avgHeartRateChange);
    const recommendation = this.generateContactRecommendation(
      contactName, avgEmotionScore, dominantEmotion, overallImpact, totalCalls
    );
    
    return {
      contactName,
      personId: logs[0].personId || undefined,
      totalCalls,
      avgEmotionScore,
      dominantEmotion,
      avgHeartRateChange,
      overallImpact,
      recommendation,
    };
  }
  
  private generateContactRecommendation(
    name: string, 
    avgScore: number, 
    emotion: EmotionType, 
    impact: ImpactOnDay,
    totalCalls: number
  ): string {
    if (impact === 'DRAINING' && totalCalls >= 3) {
      return `与${name}的通话通常消耗精力，建议在精力充沛时进行，或考虑使用文字沟通。`;
    }
    if (emotion === 'STRESSED' || emotion === 'ANXIOUS') {
      return `与${name}的通话容易产生压力，建议提前准备通话要点，保持冷静。`;
    }
    if (impact === 'ENERGIZING') {
      return `与${name}的通话让你精力充沛，可以在需要激励时主动联系。`;
    }
    return `与${name}的通话情绪稳定，保持正常沟通频率即可。`;
  }
  
  async getRecentCallEmotions(days: number = 7): Promise<CallEmotionLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db.select().from(callEmotionLogs)
      .where(gte(callEmotionLogs.callTime, startDate))
      .orderBy(desc(callEmotionLogs.callTime));
  }
  
  async getDrainingContacts(): Promise<ContactEmotionProfile[]> {
    const contacts = await db.select({
      contactName: callEmotionLogs.contactName,
    }).from(callEmotionLogs)
      .groupBy(callEmotionLogs.contactName);
    
    const profiles: ContactEmotionProfile[] = [];
    
    for (const contact of contacts) {
      const profile = await this.getContactEmotionProfile(contact.contactName);
      if (profile && profile.overallImpact === 'DRAINING') {
        profiles.push(profile);
      }
    }
    
    return profiles.sort((a, b) => a.avgEmotionScore - b.avgEmotionScore);
  }
  
  async getEnergizingContacts(): Promise<ContactEmotionProfile[]> {
    const contacts = await db.select({
      contactName: callEmotionLogs.contactName,
    }).from(callEmotionLogs)
      .groupBy(callEmotionLogs.contactName);
    
    const profiles: ContactEmotionProfile[] = [];
    
    for (const contact of contacts) {
      const profile = await this.getContactEmotionProfile(contact.contactName);
      if (profile && profile.overallImpact === 'ENERGIZING') {
        profiles.push(profile);
      }
    }
    
    return profiles.sort((a, b) => b.avgEmotionScore - a.avgEmotionScore);
  }
  
  async getDailyEmotionSummary(date: Date = new Date()): Promise<{
    totalCalls: number;
    avgEmotionScore: number;
    drainingCalls: number;
    energizingCalls: number;
    totalHeartRateImpact: number;
    overallMood: ConversationMood;
    recommendation: string;
  }> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const logs = await db.select().from(callEmotionLogs)
      .where(
        and(
          gte(callEmotionLogs.callTime, dayStart),
          sql`${callEmotionLogs.callTime} <= ${dayEnd}`
        )
      );
    
    if (logs.length === 0) {
      return {
        totalCalls: 0,
        avgEmotionScore: 0,
        drainingCalls: 0,
        energizingCalls: 0,
        totalHeartRateImpact: 0,
        overallMood: 'NEUTRAL',
        recommendation: '今天没有通话记录。',
      };
    }
    
    const totalCalls = logs.length;
    const avgEmotionScore = Math.round(
      logs.reduce((sum, log) => sum + (log.emotionScore || 0), 0) / totalCalls
    );
    const drainingCalls = logs.filter(log => log.impactOnDay === 'DRAINING').length;
    const energizingCalls = logs.filter(log => log.impactOnDay === 'ENERGIZING').length;
    const totalHeartRateImpact = logs.reduce((sum, log) => sum + (log.heartRateChange || 0), 0);
    const overallMood = this.determineConversationMood(avgEmotionScore);
    
    let recommendation = '';
    if (drainingCalls > energizingCalls && drainingCalls >= 2) {
      recommendation = '今天消耗性通话较多，建议晚上提前休息，做些放松活动。';
    } else if (energizingCalls > drainingCalls) {
      recommendation = '今天的通话整体正向，精力状态良好。';
    } else {
      recommendation = '今天通话情绪平稳。';
    }
    
    return {
      totalCalls,
      avgEmotionScore,
      drainingCalls,
      energizingCalls,
      totalHeartRateImpact,
      overallMood,
      recommendation,
    };
  }
}

export const callEmotionAnalyzer = new CallEmotionAnalyzerService();
