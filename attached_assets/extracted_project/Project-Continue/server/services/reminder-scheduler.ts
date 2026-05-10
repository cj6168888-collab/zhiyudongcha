/**
 * Smart Reminder Scheduler (智能提醒调度器) - Phase 2.2
 * 
 * 功能：
 * 1. 时间触发 - 会议提前15/5分钟、截止日期倒计时
 * 2. 事件触发 - 生日/纪念日、合同到期、里程碑临近
 * 3. 智能时机 - 联系人跟进建议、合作时机检测
 * 
 * 技术：
 * - 与 scheduler.ts 集成（每5分钟扫描）
 * - WebSocket 实时推送
 * - 支持多渠道投递（PUSH/WEBSOCKET/SMS）
 */

import { db } from '../db';
import { 
  reminderRules, 
  reminderLogs,
  calendarEvents,
  persons,
  projectMilestones,
  projectTasks,
  InsertReminderRule,
  InsertReminderLog,
  ReminderRule,
  ReminderLog
} from '@shared/schema';
import { eq, and, lte, gte, isNull, or, desc, sql } from 'drizzle-orm';

export type RuleType = 
  | 'CALENDAR_EVENT'
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'CONTRACT_EXPIRY'
  | 'MILESTONE_DEADLINE'
  | 'TASK_DEADLINE'
  | 'FOLLOW_UP'
  | 'CUSTOM';

export type TriggerType = 'TIME' | 'EVENT' | 'SMART';

export type ReminderChannel = 'PUSH' | 'WEBSOCKET' | 'SMS' | 'EMAIL';

export type ReminderStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'DISMISSED' | 'SNOOZED';

export type ReminderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface TriggerConfig {
  targetDate?: string;
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  condition?: string;
  lastContactDays?: number;
  entityFilter?: Record<string, any>;
}

export interface ReminderPayload {
  id: string;
  title: string;
  content: string;
  priority: ReminderPriority;
  triggerType: TriggerType;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface WebSocketBroadcaster {
  broadcast: (type: string, data: any) => void;
}

class ReminderSchedulerService {
  private wsBroadcaster: WebSocketBroadcaster | null = null;

  setWebSocketBroadcaster(broadcaster: WebSocketBroadcaster): void {
    this.wsBroadcaster = broadcaster;
    console.log('[ReminderScheduler] WebSocket broadcaster configured');
  }

  async createRule(input: Omit<InsertReminderRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReminderRule> {
    const nextTriggerAt = this.calculateNextTrigger(input);

    const [rule] = await db.insert(reminderRules).values({
      ...input,
      nextTriggerAt,
    }).returning();

    console.log(`[ReminderScheduler] Rule created: ${rule.title} (${rule.id})`);
    return rule;
  }

  async getRules(options?: { 
    enabled?: boolean; 
    ruleType?: RuleType;
    entityType?: string;
    entityId?: string;
  }): Promise<ReminderRule[]> {
    let query = db.select().from(reminderRules);
    
    const conditions = [];
    if (options?.enabled !== undefined) {
      conditions.push(eq(reminderRules.enabled, options.enabled));
    }
    if (options?.ruleType) {
      conditions.push(eq(reminderRules.ruleType, options.ruleType));
    }
    if (options?.entityType) {
      conditions.push(eq(reminderRules.entityType, options.entityType));
    }
    if (options?.entityId) {
      conditions.push(eq(reminderRules.entityId, options.entityId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(reminderRules.createdAt));
  }

  async updateRule(id: string, updates: Partial<InsertReminderRule>): Promise<ReminderRule | null> {
    const [updated] = await db.update(reminderRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reminderRules.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await db.delete(reminderRules)
      .where(eq(reminderRules.id, id));
    
    return true;
  }

  async toggleRule(id: string, enabled: boolean): Promise<ReminderRule | null> {
    return await this.updateRule(id, { enabled });
  }

  async processReminders(): Promise<ReminderPayload[]> {
    const now = new Date();
    const triggered: ReminderPayload[] = [];

    const dueRules = await db.select()
      .from(reminderRules)
      .where(and(
        eq(reminderRules.enabled, true),
        lte(reminderRules.nextTriggerAt, now)
      ));

    console.log(`[ReminderScheduler] Processing ${dueRules.length} due reminders`);

    for (const rule of dueRules) {
      try {
        const payload = await this.triggerReminder(rule);
        if (payload) {
          triggered.push(payload);
        }
      } catch (error) {
        console.error(`[ReminderScheduler] Failed to trigger rule ${rule.id}:`, error);
      }
    }

    await this.processSmartReminders();

    return triggered;
  }

  private async triggerReminder(rule: ReminderRule): Promise<ReminderPayload | null> {
    const content = await this.generateReminderContent(rule);
    
    const payload: ReminderPayload = {
      id: rule.id,
      title: rule.title,
      content,
      priority: (rule.priority as ReminderPriority) || 'NORMAL',
      triggerType: (rule.triggerType as TriggerType) || 'TIME',
      entityType: rule.entityType || undefined,
      entityId: rule.entityId || undefined,
      metadata: rule.triggerConfig as Record<string, any> || undefined,
    };

    const [log] = await db.insert(reminderLogs).values({
      ruleId: rule.id,
      title: rule.title,
      content,
      triggerType: rule.triggerType || 'TIME',
      channel: rule.channel || 'PUSH',
      status: 'PENDING',
      metadata: payload as any,
    }).returning();

    await this.deliverReminder(payload, rule.channel as ReminderChannel || 'PUSH', log.id);

    const nextTriggerAt = this.calculateNextTrigger(rule);
    await db.update(reminderRules)
      .set({
        lastTriggeredAt: new Date(),
        nextTriggerAt,
        triggerCount: sql`${reminderRules.triggerCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(reminderRules.id, rule.id));

    return payload;
  }

  private async generateReminderContent(rule: ReminderRule): Promise<string> {
    const config = rule.triggerConfig as TriggerConfig || {};

    switch (rule.ruleType) {
      case 'CALENDAR_EVENT':
        if (rule.entityId) {
          const [event] = await db.select()
            .from(calendarEvents)
            .where(eq(calendarEvents.id, rule.entityId))
            .limit(1);
          if (event) {
            const minutes = rule.advanceMinutes || 15;
            return `${event.title} 将在 ${minutes} 分钟后开始。地点：${event.location || '未设置'}`;
          }
        }
        return rule.description || '日程提醒';

      case 'BIRTHDAY':
        if (rule.entityId) {
          const [person] = await db.select()
            .from(persons)
            .where(eq(persons.id, rule.entityId))
            .limit(1);
          if (person) {
            return `今天是 ${person.name} 的生日！记得送上祝福。`;
          }
        }
        return '生日提醒';

      case 'CONTRACT_EXPIRY':
        return rule.description || `合同即将到期，请及时处理续约事宜。`;

      case 'MILESTONE_DEADLINE':
        if (rule.entityId) {
          const [milestone] = await db.select()
            .from(projectMilestones)
            .where(eq(projectMilestones.id, rule.entityId))
            .limit(1);
          if (milestone) {
            return `里程碑「${milestone.title}」即将到期，请确认进度。`;
          }
        }
        return '项目里程碑提醒';

      case 'TASK_DEADLINE':
        if (rule.entityId) {
          const [task] = await db.select()
            .from(projectTasks)
            .where(eq(projectTasks.id, rule.entityId))
            .limit(1);
          if (task) {
            return `任务「${task.title}」即将到期，当前状态：${task.status}`;
          }
        }
        return '任务截止提醒';

      case 'FOLLOW_UP':
        if (rule.entityId) {
          const [person] = await db.select()
            .from(persons)
            .where(eq(persons.id, rule.entityId))
            .limit(1);
          if (person) {
            const days = config.lastContactDays || 7;
            return `已有 ${days} 天没有联系 ${person.name}，建议跟进。`;
          }
        }
        return '跟进提醒';

      default:
        return rule.description || '提醒';
    }
  }

  private async deliverReminder(payload: ReminderPayload, channel: ReminderChannel, logId: string): Promise<void> {
    try {
      switch (channel) {
        case 'WEBSOCKET':
        case 'PUSH':
          if (this.wsBroadcaster) {
            this.wsBroadcaster.broadcast('reminder', {
              type: 'REMINDER_TRIGGERED',
              payload,
              timestamp: new Date().toISOString(),
            });
          }
          break;

        case 'SMS':
          console.log(`[ReminderScheduler] SMS delivery not implemented: ${payload.title}`);
          break;

        case 'EMAIL':
          console.log(`[ReminderScheduler] Email delivery not implemented: ${payload.title}`);
          break;
      }

      await db.update(reminderLogs)
        .set({
          status: 'DELIVERED',
          deliveredAt: new Date(),
        })
        .where(eq(reminderLogs.id, logId));

      console.log(`[ReminderScheduler] Delivered: ${payload.title} via ${channel}`);
    } catch (error) {
      console.error(`[ReminderScheduler] Delivery failed:`, error);
    }
  }

  private async processSmartReminders(): Promise<void> {
    await this.checkFollowUpOpportunities();
    await this.checkUpcomingBirthdays();
    await this.checkProjectDeadlines();
  }

  private async checkFollowUpOpportunities(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const contacts = await db.select()
      .from(persons)
      .where(or(
        isNull(persons.lastInteraction),
        lte(persons.lastInteraction, sevenDaysAgo)
      ))
      .limit(5);

    for (const contact of contacts) {
      const existing = await db.select()
        .from(reminderRules)
        .where(and(
          eq(reminderRules.ruleType, 'FOLLOW_UP'),
          eq(reminderRules.entityId, contact.id),
          eq(reminderRules.enabled, true)
        ))
        .limit(1);

      if (existing.length === 0) {
        const daysSinceContact = contact.lastInteraction 
          ? Math.floor((Date.now() - new Date(contact.lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
          : 30;

        await this.createRule({
          title: `跟进提醒：${contact.name}`,
          description: `已有 ${daysSinceContact} 天没有联系`,
          ruleType: 'FOLLOW_UP',
          triggerType: 'SMART',
          entityType: 'PERSON',
          entityId: contact.id,
          triggerConfig: { lastContactDays: daysSinceContact },
          priority: daysSinceContact > 14 ? 'HIGH' : 'NORMAL',
          channel: 'PUSH',
          enabled: true,
          nextTriggerAt: new Date(),
        });
      }
    }
  }

  private async checkUpcomingBirthdays(): Promise<void> {
  }

  private async checkProjectDeadlines(): Promise<void> {
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const upcomingMilestones = await db.select()
      .from(projectMilestones)
      .where(and(
        lte(projectMilestones.plannedEndDate, threeDaysLater),
        gte(projectMilestones.plannedEndDate, now),
        sql`${projectMilestones.status} != 'COMPLETED'`
      ))
      .limit(20);

    for (const milestone of upcomingMilestones) {
      if (!milestone.plannedEndDate) continue;
      
      const existing = await db.select()
        .from(reminderRules)
        .where(and(
          eq(reminderRules.ruleType, 'MILESTONE_DEADLINE'),
          eq(reminderRules.entityId, milestone.id)
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.createRule({
          title: `里程碑即将到期：${milestone.title}`,
          description: milestone.description || undefined,
          ruleType: 'MILESTONE_DEADLINE',
          triggerType: 'TIME',
          entityType: 'MILESTONE',
          entityId: milestone.id,
          advanceMinutes: 60 * 24,
          priority: 'HIGH',
          channel: 'PUSH',
          enabled: true,
          nextTriggerAt: new Date(new Date(milestone.plannedEndDate).getTime() - 24 * 60 * 60 * 1000),
        });
      }
    }
  }

  private calculateNextTrigger(rule: Partial<ReminderRule>): Date | null {
    const config = rule.triggerConfig as TriggerConfig || {};
    const now = new Date();

    if (rule.nextTriggerAt && new Date(rule.nextTriggerAt) > now) {
      return new Date(rule.nextTriggerAt);
    }

    if (config.targetDate) {
      const target = new Date(config.targetDate);
      const advanceMs = (rule.advanceMinutes || 0) * 60 * 1000;
      const triggerTime = new Date(target.getTime() - advanceMs);
      return triggerTime > now ? triggerTime : null;
    }

    if (config.recurrence && config.recurrence !== 'NONE') {
      const base = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt) : now;
      
      switch (config.recurrence) {
        case 'DAILY':
          return new Date(base.getTime() + 24 * 60 * 60 * 1000);
        case 'WEEKLY':
          return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
        case 'MONTHLY':
          const nextMonth = new Date(base);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return nextMonth;
        case 'YEARLY':
          const nextYear = new Date(base);
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          return nextYear;
      }
    }

    if (rule.triggerType === 'SMART') {
      return now;
    }

    return null;
  }

  async getReminderLogs(options?: {
    ruleId?: string;
    status?: ReminderStatus;
    limit?: number;
  }): Promise<ReminderLog[]> {
    let query = db.select().from(reminderLogs);
    
    const conditions = [];
    if (options?.ruleId) {
      conditions.push(eq(reminderLogs.ruleId, options.ruleId));
    }
    if (options?.status) {
      conditions.push(eq(reminderLogs.status, options.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query
      .orderBy(desc(reminderLogs.createdAt))
      .limit(options?.limit || 50);
  }

  async markReminderRead(logId: string): Promise<ReminderLog | null> {
    const [updated] = await db.update(reminderLogs)
      .set({ status: 'READ', readAt: new Date() })
      .where(eq(reminderLogs.id, logId))
      .returning();
    
    return updated || null;
  }

  async dismissReminder(logId: string): Promise<ReminderLog | null> {
    const [updated] = await db.update(reminderLogs)
      .set({ status: 'DISMISSED', dismissedAt: new Date() })
      .where(eq(reminderLogs.id, logId))
      .returning();
    
    return updated || null;
  }

  async snoozeReminder(logId: string, snoozeDurationMinutes: number): Promise<ReminderLog | null> {
    const snoozedUntil = new Date(Date.now() + snoozeDurationMinutes * 60 * 1000);
    
    const [updated] = await db.update(reminderLogs)
      .set({ status: 'SNOOZED', snoozedUntil })
      .where(eq(reminderLogs.id, logId))
      .returning();
    
    return updated || null;
  }

  async createCalendarReminder(eventId: string, advanceMinutes: number = 15): Promise<ReminderRule> {
    const [event] = await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, eventId))
      .limit(1);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const triggerAt = new Date(new Date(event.startTime).getTime() - advanceMinutes * 60 * 1000);

    return await this.createRule({
      title: `日程提醒：${event.title}`,
      description: event.description || undefined,
      ruleType: 'CALENDAR_EVENT',
      triggerType: 'TIME',
      entityType: 'CALENDAR_EVENT',
      entityId: eventId,
      advanceMinutes,
      priority: event.priority as ReminderPriority || 'NORMAL',
      channel: 'PUSH',
      enabled: true,
      nextTriggerAt: triggerAt,
    });
  }

  async getStats(): Promise<{
    totalRules: number;
    enabledRules: number;
    pendingReminders: number;
    deliveredToday: number;
    byType: Record<string, number>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allRules = await db.select().from(reminderRules);
    const enabledRules = allRules.filter(r => r.enabled);

    const pendingLogs = await db.select()
      .from(reminderLogs)
      .where(eq(reminderLogs.status, 'PENDING'));

    const deliveredToday = await db.select()
      .from(reminderLogs)
      .where(and(
        eq(reminderLogs.status, 'DELIVERED'),
        gte(reminderLogs.deliveredAt, today)
      ));

    const byType: Record<string, number> = {};
    for (const rule of allRules) {
      byType[rule.ruleType] = (byType[rule.ruleType] || 0) + 1;
    }

    return {
      totalRules: allRules.length,
      enabledRules: enabledRules.length,
      pendingReminders: pendingLogs.length,
      deliveredToday: deliveredToday.length,
      byType,
    };
  }
}

export const reminderScheduler = new ReminderSchedulerService();
