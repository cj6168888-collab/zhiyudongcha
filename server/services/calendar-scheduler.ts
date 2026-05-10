/**
 * 小智 Calendar Scheduler - 日程智能调度
 * Project Guardian Angel (守护天使协议) - 日程健康守护
 *
 * 功能：
 * 1. 强制离线时间 - 自动插入休息/离线时段
 * 2. 健康与商务平衡 - 智能平衡工作与健康日程
 * 3. 疲劳预测调度 - 基于Bio-Guardian数据动态调整
 * 4. 休息间隔自动插入 - 长时间工作后强制休息
 * 5. 睡眠保护 - 确保充足睡眠时间
 *
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

// (ts-nocheck removed for type safety)

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CalendarScheduler');

import { getDatabase } from '../db';
import type { CalendarEvent, InsertCalendarEvent, ScheduleSetting, InsertScheduleSetting } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { bioGuardian } from './bio-guardian';

export type EventType = 'MEETING' | 'OFFLINE' | 'REST' | 'EXERCISE' | 'PERSONAL' | 'WORK' | 'HEALTH_CHECK';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface ScheduleConflict {
  existingEvent: CalendarEvent;
  newEvent: Partial<InsertCalendarEvent>;
  conflictType: 'OVERLAP' | 'FATIGUE_LIMIT' | 'OFFLINE_VIOLATION' | 'WORK_HOURS_EXCEEDED';
  resolution: 'REJECT' | 'RESCHEDULE' | 'FORCE_OVERRIDE' | 'SPLIT';
  suggestedTime?: Date;
}

export interface ScheduleAnalysis {
  date: string;
  totalWorkMinutes: number;
  totalRestMinutes: number;
  meetingCount: number;
  healthScore: number;
  workLifeBalance: number;
  suggestions: string[];
  warnings: string[];
}

export interface DaySchedule {
  date: string;
  events: CalendarEvent[];
  forcedOfflineBlocks: Array<{ start: string; end: string }>;
  restBreaks: Array<{ start: string; end: string }>;
  fatigueProjection: Array<{ time: string; level: number }>;
}

class CalendarSchedulerService {
  async getSettings(): Promise<ScheduleSetting | null> {
    const settings = await getDatabase().select().from(scheduleSettings)
      .where(eq(scheduleSettings.isActive, true))
      .limit(1);
    return settings[0] || null;
  }

  async updateSettings(data: Partial<InsertScheduleSetting>): Promise<ScheduleSetting> {
    const existing = await this.getSettings();

    if (existing) {
      const [updated] = await getDatabase().update(scheduleSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(scheduleSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await getDatabase().insert(scheduleSettings)
        .values(data)
        .returning();
      return created;
    }
  }

  async createEvent(data: InsertCalendarEvent): Promise<{ event?: CalendarEvent; conflict?: ScheduleConflict }> {
    const settings = await this.getSettings();

    const conflicts = await this.checkConflicts(data, settings);
    if (conflicts.length > 0) {
      const primaryConflict = conflicts[0];
      if (primaryConflict.resolution === 'REJECT' && !data.isForced) {
        return { conflict: primaryConflict };
      }
    }

    const [event] = await getDatabase().insert(calendarEvents)
      .values(data)
      .returning();

    return { event };
  }

  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return await getDatabase().select().from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, startDate),
          lte(calendarEvents.endTime, endDate)
        )
      )
      .orderBy(calendarEvents.startTime);
  }

  async getEventById(id: string): Promise<CalendarEvent | null> {
    const events = await getDatabase().select().from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);
    return events[0] || null;
  }

  async updateEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | null> {
    const [updated] = await getDatabase().update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated || null;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await getDatabase().delete(calendarEvents)
      .where(eq(calendarEvents.id, id));
    return true;
  }

  async checkConflicts(newEvent: Partial<InsertCalendarEvent>, settings: ScheduleSetting | null): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    if (!newEvent.startTime || !newEvent.endTime) {
      return conflicts;
    }

    const overlapping = await getDatabase().select().from(calendarEvents)
      .where(
        and(
          sql`${calendarEvents.startTime} < ${newEvent.endTime}`,
          sql`${calendarEvents.endTime} > ${newEvent.startTime}`
        )
      );

    for (const existing of overlapping) {
      conflicts.push({
        existingEvent: existing,
        newEvent,
        conflictType: 'OVERLAP',
        resolution: existing.isForced ? 'REJECT' : 'RESCHEDULE',
        suggestedTime: await this.findNextAvailableSlot(newEvent.startTime, this.getDurationMinutes(newEvent.startTime, newEvent.endTime)),
      });
    }

    if (settings?.forcedOfflineEnabled) {
      const violation = this.checkOfflineViolation(newEvent, settings);
      if (violation) {
        conflicts.push(violation);
      }
    }

    if (settings?.fatigueAwareScheduling && newEvent.eventType === 'MEETING') {
      const fatigueConflict = await this.checkFatigueConflict(newEvent);
      if (fatigueConflict) {
        conflicts.push(fatigueConflict);
      }
    }

    return conflicts;
  }

  private checkOfflineViolation(event: Partial<InsertCalendarEvent>, settings: ScheduleSetting): ScheduleConflict | null {
    if (!event.startTime || !settings.forcedOfflineStart || !settings.forcedOfflineEnd) {
      return null;
    }

    const eventHour = event.startTime.getHours();
    const eventMinute = event.startTime.getMinutes();
    const [offlineStartHour, offlineStartMinute] = settings.forcedOfflineStart.split(':').map(Number);
    const [offlineEndHour, offlineEndMinute] = settings.forcedOfflineEnd.split(':').map(Number);

    const eventTime = eventHour * 60 + eventMinute;
    const offlineStart = offlineStartHour * 60 + offlineStartMinute;
    const offlineEnd = offlineEndHour * 60 + offlineEndMinute;

    let isInOfflineWindow = false;
    if (offlineStart > offlineEnd) {
      isInOfflineWindow = eventTime >= offlineStart || eventTime < offlineEnd;
    } else {
      isInOfflineWindow = eventTime >= offlineStart && eventTime < offlineEnd;
    }

    if (isInOfflineWindow && event.eventType !== 'OFFLINE' && event.eventType !== 'REST') {
      return {
        existingEvent: {} as CalendarEvent,
        newEvent: event,
        conflictType: 'OFFLINE_VIOLATION',
        resolution: 'REJECT',
      };
    }

    return null;
  }

  private async checkFatigueConflict(event: Partial<InsertCalendarEvent>): Promise<ScheduleConflict | null> {
    try {
      const prediction = await bioGuardian.predictFatigue();

      if (!event.startTime) return null;

      const eventHour = event.startTime.getHours().toString().padStart(2, '0') + ':00';
      const lowPoint = prediction.predictedLowPoints.find(p => p.time === eventHour);

      if (lowPoint && lowPoint.fatigue > 70) {
        const suggestedSlot = await this.findLowFatigueSlot(event.startTime, prediction.optimalRestTimes);
        return {
          existingEvent: {} as CalendarEvent,
          newEvent: event,
          conflictType: 'FATIGUE_LIMIT',
          resolution: 'RESCHEDULE',
          suggestedTime: suggestedSlot,
        };
      }
    } catch (error) {
      logger.info('[CalendarScheduler] 无法获取疲劳预测数据');
    }

    return null;
  }

  private async findNextAvailableSlot(preferredTime: Date, durationMinutes: number): Promise<Date> {
    const searchEnd = new Date(preferredTime);
    searchEnd.setDate(searchEnd.getDate() + 7);

    const events = await this.getEvents(preferredTime, searchEnd);

    let slotStart = new Date(preferredTime);
    slotStart.setMinutes(slotStart.getMinutes() + 30);

    for (let attempt = 0; attempt < 48; attempt++) {
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

      const hasConflict = events.some(e =>
        (slotStart >= e.startTime && slotStart < e.endTime) ||
        (slotEnd > e.startTime && slotEnd <= e.endTime)
      );

      if (!hasConflict) {
        return slotStart;
      }

      slotStart.setMinutes(slotStart.getMinutes() + 30);
    }

    return preferredTime;
  }

  private findLowFatigueSlot(preferredTime: Date, optimalRestTimes: string[]): Date {
    if (optimalRestTimes.length === 0) {
      return preferredTime;
    }

    const nextRestTime = optimalRestTimes[0];
    const [hour] = nextRestTime.split(':').map(Number);

    const result = new Date(preferredTime);
    result.setHours(hour + 1, 0, 0, 0);

    return result;
  }

  private getDurationMinutes(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  async insertForcedOfflineBlocks(date: Date): Promise<CalendarEvent[]> {
    const settings = await this.getSettings();
    if (!settings?.forcedOfflineEnabled) {
      return [];
    }

    const inserted: CalendarEvent[] = [];
    const dateStr = date.toISOString().split('T')[0];

    const [offlineStartHour, offlineStartMinute] = (settings.forcedOfflineStart || '22:00').split(':').map(Number);
    const [offlineEndHour, offlineEndMinute] = (settings.forcedOfflineEnd || '07:00').split(':').map(Number);

    const offlineStart = new Date(date);
    offlineStart.setHours(offlineStartHour, offlineStartMinute, 0, 0);

    const offlineEnd = new Date(date);
    if (offlineEndHour < offlineStartHour) {
      offlineEnd.setDate(offlineEnd.getDate() + 1);
    }
    offlineEnd.setHours(offlineEndHour, offlineEndMinute, 0, 0);

    const existing = await getDatabase().select().from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.eventType, 'OFFLINE'),
          eq(calendarEvents.isForced, true),
          gte(calendarEvents.startTime, new Date(dateStr)),
          lte(calendarEvents.startTime, new Date(dateStr + 'T23:59:59'))
        )
      );

    if (existing.length === 0) {
      const [event] = await getDatabase().insert(calendarEvents)
        .values({
          title: '🌙 强制离线时间',
          description: '小智守护您的休息时间，此时段不安排任何工作',
          eventType: 'OFFLINE',
          startTime: offlineStart,
          endTime: offlineEnd,
          isForced: true,
          priority: 'CRITICAL',
          fatigueImpact: -30,
          energyRequired: 0,
        })
        .returning();
      inserted.push(event);
    }

    return inserted;
  }

  async insertRestBreaks(date: Date): Promise<CalendarEvent[]> {
    const settings = await this.getSettings();
    if (!settings?.autoInsertRestBreaks) {
      return [];
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const dayEvents = await this.getEvents(dateStart, dateEnd);
    const workEvents = dayEvents.filter(e =>
      e.eventType === 'MEETING' || e.eventType === 'WORK'
    );

    const inserted: CalendarEvent[] = [];
    const intervalMinutes = settings.restBreakIntervalMinutes || 90;
    const breakDuration = settings.restBreakDurationMinutes || 15;

    let consecutiveWorkMinutes = 0;
    let lastBreakEnd = new Date(dateStart);
    lastBreakEnd.setHours(9, 0, 0, 0);

    for (const event of workEvents) {
      const workDuration = this.getDurationMinutes(event.startTime, event.endTime);
      consecutiveWorkMinutes += workDuration;

      if (consecutiveWorkMinutes >= intervalMinutes) {
        const breakStart = new Date(event.endTime);
        const breakEnd = new Date(breakStart);
        breakEnd.setMinutes(breakEnd.getMinutes() + breakDuration);

        const hasOverlap = dayEvents.some(e =>
          (breakStart >= e.startTime && breakStart < e.endTime) ||
          (breakEnd > e.startTime && breakEnd <= e.endTime)
        );

        if (!hasOverlap) {
          const [restEvent] = await getDatabase().insert(calendarEvents)
            .values({
              title: '☕ 休息时间',
              description: '小智建议您休息一下，活动身体，补充水分',
              eventType: 'REST',
              startTime: breakStart,
              endTime: breakEnd,
              isForced: true,
              priority: 'HIGH',
              fatigueImpact: -20,
              energyRequired: 0,
            })
            .returning();
          inserted.push(restEvent);
          consecutiveWorkMinutes = 0;
        }
      }
    }

    return inserted;
  }

  async analyzeDay(date: Date): Promise<ScheduleAnalysis> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const events = await this.getEvents(dateStart, dateEnd);
    const settings = await this.getSettings();

    let totalWorkMinutes = 0;
    let totalRestMinutes = 0;
    let meetingCount = 0;

    for (const event of events) {
      const duration = this.getDurationMinutes(event.startTime, event.endTime);

      if (event.eventType === 'MEETING') {
        totalWorkMinutes += duration;
        meetingCount++;
      } else if (event.eventType === 'WORK') {
        totalWorkMinutes += duration;
      } else if (event.eventType === 'REST' || event.eventType === 'OFFLINE') {
        totalRestMinutes += duration;
      }
    }

    const maxWork = (settings?.maxWorkHoursPerDay || 10) * 60;
    const minRest = settings?.minBreakMinutes || 60;

    const workScore = Math.max(0, 100 - (totalWorkMinutes / maxWork) * 100);
    const restScore = Math.min(100, (totalRestMinutes / minRest) * 100);
    const healthScore = Math.round((workScore + restScore) / 2);
    const workLifeBalance = Math.round(restScore);

    const suggestions: string[] = [];
    const warnings: string[] = [];

    if (totalWorkMinutes > maxWork) {
      warnings.push(`工作时间超标：${Math.round(totalWorkMinutes / 60)}小时，建议不超过${settings?.maxWorkHoursPerDay || 10}小时`);
    }

    if (totalRestMinutes < minRest) {
      warnings.push(`休息时间不足：${totalRestMinutes}分钟，建议至少${minRest}分钟`);
    }

    if (meetingCount > 5) {
      suggestions.push(`今日会议较多(${meetingCount}个)，建议适当减少或合并会议`);
    }

    if (healthScore < 60) {
      suggestions.push('今日日程健康评分较低，建议增加休息时间');
    }

    return {
      date: date.toISOString().split('T')[0],
      totalWorkMinutes,
      totalRestMinutes,
      meetingCount,
      healthScore,
      workLifeBalance,
      suggestions,
      warnings,
    };
  }

  async getDaySchedule(date: Date): Promise<DaySchedule> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const events = await this.getEvents(dateStart, dateEnd);
    const settings = await this.getSettings();

    const forcedOfflineBlocks: Array<{ start: string; end: string }> = [];
    const restBreaks: Array<{ start: string; end: string }> = [];

    for (const event of events) {
      if (event.eventType === 'OFFLINE' && event.isForced) {
        forcedOfflineBlocks.push({
          start: event.startTime.toISOString(),
          end: event.endTime.toISOString(),
        });
      } else if (event.eventType === 'REST') {
        restBreaks.push({
          start: event.startTime.toISOString(),
          end: event.endTime.toISOString(),
        });
      }
    }

    let fatigueProjection: Array<{ time: string; level: number }> = [];
    try {
      const prediction = await bioGuardian.predictFatigue();
      fatigueProjection = prediction.predictedLowPoints.map(p => ({
        time: p.time,
        level: p.fatigue,
      }));
    } catch (error) {
      for (let h = 8; h <= 22; h++) {
        let baseFatigue = 30;
        if (h >= 14 && h <= 16) baseFatigue = 60;
        if (h >= 20) baseFatigue = 70 + (h - 20) * 10;
        fatigueProjection.push({
          time: `${h.toString().padStart(2, '0')}:00`,
          level: baseFatigue,
        });
      }
    }

    return {
      date: date.toISOString().split('T')[0],
      events,
      forcedOfflineBlocks,
      restBreaks,
      fatigueProjection,
    };
  }

  async suggestOptimalMeetingTime(durationMinutes: number, preferredDate?: Date): Promise<Date[]> {
    const targetDate = preferredDate || new Date();
    const suggestions: Date[] = [];

    let prediction;
    try {
      prediction = await bioGuardian.predictFatigue();
    } catch {
      prediction = { predictedLowPoints: [], optimalRestTimes: ['09:00', '14:00'] };
    }

    const lowFatigueTimes = ['09:00', '10:00', '11:00', '14:00', '15:00']
      .filter(time => {
        const lowPoint = prediction.predictedLowPoints.find(p => p.time === time);
        return !lowPoint || lowPoint.fatigue < 60;
      });

    for (const time of lowFatigueTimes.slice(0, 3)) {
      const [hour, minute] = time.split(':').map(Number);
      const slot = new Date(targetDate);
      slot.setHours(hour, minute, 0, 0);

      const slotEnd = new Date(slot);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

      const conflicts = await this.checkConflicts({
        startTime: slot,
        endTime: slotEnd,
        eventType: 'MEETING',
      }, await this.getSettings());

      if (conflicts.length === 0) {
        suggestions.push(slot);
      }
    }

    return suggestions;
  }
}

export const calendarScheduler = new CalendarSchedulerService();
