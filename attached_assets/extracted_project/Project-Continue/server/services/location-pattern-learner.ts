/**
 * 小智 Location Pattern Learner - 地点规律学习
 * Project Guardian Angel (守护天使协议)
 * 
 * 功能：
 * 1. 自动识别常去地点
 * 2. 学习地点规律模式（工作时间、休闲时间）
 * 3. 结合时间预测用户下一个可能去的地点
 * 4. 与Calendar Scheduler集成
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { locationPatterns, locationVisits } from '@shared/schema';
import type { LocationPattern, InsertLocationPattern, LocationVisit, InsertLocationVisit } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export type LocationType = 'HOME' | 'OFFICE' | 'GYM' | 'RESTAURANT' | 'CLIENT' | 'OTHER';
export type Activity = 'WORK' | 'EXERCISE' | 'DINING' | 'MEETING' | 'LEISURE' | 'COMMUTE';

export interface LocationPrediction {
  locationName: string;
  locationType: LocationType;
  probability: number;
  predictedArrival: string;
  reason: string;
}

export interface LocationInsight {
  locationName: string;
  insight: string;
  recommendation: string;
}

export interface DailyLocationSummary {
  date: string;
  locationsVisited: number;
  totalTimeOutMinutes: number;
  mostTimeSpent: { location: string; minutes: number } | null;
  productivityScore: number;
  energyBalance: number;
  insights: string[];
}

class LocationPatternLearnerService {
  private readonly FREQUENT_VISIT_THRESHOLD = 5;
  private readonly LOCATION_PROXIMITY_METERS = 100;
  
  async recordVisit(data: {
    locationName: string;
    locationType?: LocationType;
    latitude?: number;
    longitude?: number;
    address?: string;
    arrivalTime: Date;
    departureTime?: Date;
    activities?: Activity[];
    preVisitEnergy?: number;
    postVisitEnergy?: number;
    notes?: string;
  }): Promise<{ pattern: LocationPattern; visit: LocationVisit }> {
    let pattern = await this.findOrCreatePattern(data);
    
    const durationMinutes = data.departureTime 
      ? Math.round((data.departureTime.getTime() - data.arrivalTime.getTime()) / 60000)
      : undefined;
    
    const [visit] = await db.insert(locationVisits).values({
      patternId: pattern.id,
      arrivalTime: data.arrivalTime,
      departureTime: data.departureTime,
      durationMinutes,
      dayOfWeek: data.arrivalTime.getDay(),
      preVisitEnergy: data.preVisitEnergy,
      postVisitEnergy: data.postVisitEnergy,
      activities: data.activities,
      notes: data.notes,
    }).returning();
    
    pattern = await this.updatePatternStats(pattern.id, visit);
    
    console.log(`[LocationLearner] 访问已记录: ${data.locationName}`);
    return { pattern, visit };
  }
  
  private async findOrCreatePattern(data: {
    locationName: string;
    locationType?: LocationType;
    latitude?: number;
    longitude?: number;
    address?: string;
  }): Promise<LocationPattern> {
    let pattern: LocationPattern | undefined;
    
    if (data.latitude && data.longitude) {
      const nearby = await db.select().from(locationPatterns)
        .where(
          and(
            sql`ABS(${locationPatterns.latitude} - ${data.latitude}) < 0.001`,
            sql`ABS(${locationPatterns.longitude} - ${data.longitude}) < 0.001`
          )
        )
        .limit(1);
      pattern = nearby[0];
    }
    
    if (!pattern) {
      const byName = await db.select().from(locationPatterns)
        .where(eq(locationPatterns.locationName, data.locationName))
        .limit(1);
      pattern = byName[0];
    }
    
    if (!pattern) {
      const [newPattern] = await db.insert(locationPatterns).values({
        locationName: data.locationName,
        locationType: data.locationType || 'OTHER',
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        firstVisit: new Date(),
        lastVisit: new Date(),
      }).returning();
      pattern = newPattern;
      console.log(`[LocationLearner] 新地点已识别: ${data.locationName}`);
    }
    
    return pattern;
  }
  
  private async updatePatternStats(patternId: string, visit: LocationVisit): Promise<LocationPattern> {
    const allVisits = await db.select().from(locationVisits)
      .where(eq(locationVisits.patternId, patternId));
    
    const visitCount = allVisits.length;
    const totalDuration = allVisits.reduce((sum, v) => sum + (v.durationMinutes || 0), 0);
    const avgDuration = Math.round(totalDuration / visitCount);
    
    const weekdayVisits = allVisits.filter(v => v.dayOfWeek !== 0 && v.dayOfWeek !== 6).length;
    const weekendVisits = allVisits.filter(v => v.dayOfWeek === 0 || v.dayOfWeek === 6).length;
    
    const arrivalHours = allVisits.map(v => v.arrivalTime.getHours());
    const avgArrivalHour = Math.round(arrivalHours.reduce((a, b) => a + b, 0) / arrivalHours.length);
    const typicalArrivalTime = `${avgArrivalHour.toString().padStart(2, '0')}:00`;
    
    let typicalDepartureTime: string | undefined;
    const departureHours = allVisits
      .filter(v => v.departureTime)
      .map(v => v.departureTime!.getHours());
    if (departureHours.length > 0) {
      const avgDepartureHour = Math.round(departureHours.reduce((a, b) => a + b, 0) / departureHours.length);
      typicalDepartureTime = `${avgDepartureHour.toString().padStart(2, '0')}:00`;
    }
    
    const energyImpacts = allVisits
      .filter(v => v.preVisitEnergy && v.postVisitEnergy)
      .map(v => (v.postVisitEnergy! - v.preVisitEnergy!));
    const avgEnergyImpact = energyImpacts.length > 0
      ? Math.round(energyImpacts.reduce((a, b) => a + b, 0) / energyImpacts.length)
      : 0;
    
    const isFrequent = visitCount >= this.FREQUENT_VISIT_THRESHOLD;
    
    const [updated] = await db.update(locationPatterns)
      .set({
        visitCount,
        totalDurationMinutes: totalDuration,
        avgDurationMinutes: avgDuration,
        weekdayVisits,
        weekendVisits,
        typicalArrivalTime,
        typicalDepartureTime,
        energyImpact: avgEnergyImpact,
        isFrequent,
        lastVisit: visit.arrivalTime,
        updatedAt: new Date(),
      })
      .where(eq(locationPatterns.id, patternId))
      .returning();
    
    return updated;
  }
  
  async predictNextLocation(currentTime: Date = new Date()): Promise<LocationPrediction[]> {
    const dayOfWeek = currentTime.getDay();
    const hour = currentTime.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const patterns = await db.select().from(locationPatterns)
      .where(eq(locationPatterns.isActive, true))
      .orderBy(desc(locationPatterns.visitCount));
    
    const predictions: LocationPrediction[] = [];
    
    for (const pattern of patterns) {
      let probability = 0;
      let reason = '';
      
      if (isWeekend && (pattern.weekendVisits || 0) > (pattern.weekdayVisits || 0)) {
        probability += 30;
        reason = '周末常去地点';
      } else if (!isWeekend && (pattern.weekdayVisits || 0) > (pattern.weekendVisits || 0)) {
        probability += 30;
        reason = '工作日常去地点';
      }
      
      if (pattern.typicalArrivalTime) {
        const [arrivalHour] = pattern.typicalArrivalTime.split(':').map(Number);
        const hourDiff = Math.abs(hour - arrivalHour);
        if (hourDiff <= 1) {
          probability += 40;
          reason = reason ? `${reason}, 符合到达时间规律` : '符合到达时间规律';
        } else if (hourDiff <= 2) {
          probability += 20;
        }
      }
      
      if (pattern.isFrequent) {
        probability += 20;
        reason = reason ? `${reason}, 高频地点` : '高频地点';
      }
      
      probability = Math.min(probability * ((pattern.visitCount || 1) / 10), 95);
      
      if (probability > 20) {
        predictions.push({
          locationName: pattern.locationName,
          locationType: (pattern.locationType || 'OTHER') as LocationType,
          probability: Math.round(probability),
          predictedArrival: pattern.typicalArrivalTime || `${hour}:00`,
          reason: reason || '历史访问记录',
        });
      }
    }
    
    return predictions.sort((a, b) => b.probability - a.probability).slice(0, 5);
  }
  
  async getFrequentLocations(): Promise<LocationPattern[]> {
    return await db.select().from(locationPatterns)
      .where(eq(locationPatterns.isFrequent, true))
      .orderBy(desc(locationPatterns.visitCount));
  }
  
  async getLocationsByType(type: LocationType): Promise<LocationPattern[]> {
    return await db.select().from(locationPatterns)
      .where(eq(locationPatterns.locationType, type))
      .orderBy(desc(locationPatterns.visitCount));
  }
  
  async getLocationInsights(): Promise<LocationInsight[]> {
    const patterns = await db.select().from(locationPatterns)
      .where(eq(locationPatterns.isActive, true))
      .orderBy(desc(locationPatterns.visitCount));
    
    const insights: LocationInsight[] = [];
    
    for (const pattern of patterns) {
      if ((pattern.energyImpact || 0) < -20) {
        insights.push({
          locationName: pattern.locationName,
          insight: '这个地点让您消耗较多精力',
          recommendation: '建议在精力充沛时前往，或减少停留时间',
        });
      }
      
      if ((pattern.energyImpact || 0) > 20) {
        insights.push({
          locationName: pattern.locationName,
          insight: '这个地点让您精力恢复',
          recommendation: '感到疲惫时可以前往这里放松',
        });
      }
      
      if ((pattern.avgDurationMinutes || 0) > 480 && pattern.locationType === 'OFFICE') {
        insights.push({
          locationName: pattern.locationName,
          insight: '平均工作时间超过8小时',
          recommendation: '建议设置下班提醒，注意工作生活平衡',
        });
      }
    }
    
    return insights;
  }
  
  async getDailyLocationSummary(date: Date = new Date()): Promise<DailyLocationSummary> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const visits = await db.select({
      visit: locationVisits,
      pattern: locationPatterns,
    }).from(locationVisits)
      .leftJoin(locationPatterns, eq(locationVisits.patternId, locationPatterns.id))
      .where(
        and(
          gte(locationVisits.arrivalTime, dayStart),
          lte(locationVisits.arrivalTime, dayEnd)
        )
      );
    
    if (visits.length === 0) {
      return {
        date: date.toISOString().split('T')[0],
        locationsVisited: 0,
        totalTimeOutMinutes: 0,
        mostTimeSpent: null,
        productivityScore: 50,
        energyBalance: 0,
        insights: ['今天没有记录到外出活动'],
      };
    }
    
    const uniqueLocations = new Set(visits.map(v => v.pattern?.locationName));
    const totalTimeOut = visits.reduce((sum, v) => sum + (v.visit.durationMinutes || 0), 0);
    
    const locationDurations: Record<string, number> = {};
    visits.forEach(v => {
      const name = v.pattern?.locationName || 'Unknown';
      locationDurations[name] = (locationDurations[name] || 0) + (v.visit.durationMinutes || 0);
    });
    const mostTimeSpent = Object.entries(locationDurations)
      .sort((a, b) => b[1] - a[1])[0];
    
    const energyChanges = visits
      .filter(v => v.visit.preVisitEnergy && v.visit.postVisitEnergy)
      .map(v => (v.visit.postVisitEnergy! - v.visit.preVisitEnergy!));
    const energyBalance = energyChanges.length > 0
      ? energyChanges.reduce((a, b) => a + b, 0)
      : 0;
    
    const workLocations = visits.filter(v => 
      v.pattern?.locationType === 'OFFICE' || v.pattern?.locationType === 'CLIENT'
    );
    const workMinutes = workLocations.reduce((sum, v) => sum + (v.visit.durationMinutes || 0), 0);
    const productivityScore = Math.min(100, Math.round((workMinutes / 480) * 100));
    
    const insights: string[] = [];
    if (uniqueLocations.size >= 4) {
      insights.push('今天活动范围广泛，注意合理安排交通时间');
    }
    if (energyBalance < -30) {
      insights.push('今天的外出活动消耗较多精力，建议早点休息');
    }
    if (workMinutes > 600) {
      insights.push('工作时间超过10小时，注意劳逸结合');
    }
    
    return {
      date: date.toISOString().split('T')[0],
      locationsVisited: uniqueLocations.size,
      totalTimeOutMinutes: totalTimeOut,
      mostTimeSpent: mostTimeSpent ? { location: mostTimeSpent[0], minutes: mostTimeSpent[1] } : null,
      productivityScore,
      energyBalance,
      insights,
    };
  }
  
  async updateVisitDeparture(visitId: string, departureTime: Date, postVisitEnergy?: number): Promise<LocationVisit | null> {
    const [visit] = await db.select().from(locationVisits)
      .where(eq(locationVisits.id, visitId))
      .limit(1);
    
    if (!visit) return null;
    
    const durationMinutes = Math.round(
      (departureTime.getTime() - visit.arrivalTime.getTime()) / 60000
    );
    
    const [updated] = await db.update(locationVisits)
      .set({
        departureTime,
        durationMinutes,
        postVisitEnergy,
      })
      .where(eq(locationVisits.id, visitId))
      .returning();
    
    if (visit.patternId) {
      await this.updatePatternStats(visit.patternId, updated);
    }
    
    return updated;
  }
}

export const locationPatternLearner = new LocationPatternLearnerService();
