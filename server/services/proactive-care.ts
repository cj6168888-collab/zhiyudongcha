import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ProactiveCare');

import { getDatabase } from "../db";
import { 
  proactiveCareRules,
  proactiveCareLogs,
  careNotificationQueue,
  emotionalMemories,
  conversationEmotionalContext,
  type ProactiveCareRule,
  type InsertProactiveCareRule,
  type ProactiveCareLog,
  type InsertProactiveCareLog,
  type InsertCareNotificationQueue
} from "@shared/schema";
import { eq, and, gte, desc, or, isNull } from "drizzle-orm";

export interface TriggerCondition {
  eventType?: string;
  threshold?: number;
  daysSince?: number;
  emotionLevel?: number;
  keywords?: string[];
}

export interface ActionConfig {
  message?: string;
  priority?: string;
  voiceEnabled?: boolean;
  customTemplate?: string;
}

export interface CareEvent {
  type: string;
  personId?: string;
  personName?: string;
  eventData?: Record<string, unknown>;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
}

export class ProactiveCareService {
  
  async createRule(rule: InsertProactiveCareRule): Promise<ProactiveCareRule> {
    const [created] = await getDatabase().insert(proactiveCareRules).values(rule).returning();
    return created;
  }

  async updateRule(id: string, updates: Partial<InsertProactiveCareRule>): Promise<ProactiveCareRule | null> {
    const [updated] = await getDatabase().update(proactiveCareRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proactiveCareRules.id, id))
      .returning();
    return updated || null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await getDatabase().delete(proactiveCareRules).where(eq(proactiveCareRules.id, id));
    return true;
  }

  async getRules(enabledOnly = false): Promise<ProactiveCareRule[]> {
    if (enabledOnly) {
      return getDatabase().select().from(proactiveCareRules).where(eq(proactiveCareRules.isEnabled, true));
    }
    return getDatabase().select().from(proactiveCareRules);
  }

  async getRule(id: string): Promise<ProactiveCareRule | null> {
    const [rule] = await getDatabase().select().from(proactiveCareRules).where(eq(proactiveCareRules.id, id));
    return rule || null;
  }

  async scanForHealthEvents(): Promise<CareEvent[]> {
    const events: CareEvent[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const healthMemories = await getDatabase().select()
      .from(emotionalMemories)
      .where(
        and(
          eq(emotionalMemories.entityType, "HEALTH"),
          gte(emotionalMemories.createdAt, twentyFourHoursAgo)
        )
      );

    for (const memory of healthMemories) {
      const content = memory.originalText as string || "";
      let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      
      if (content?.includes("疼痛") || content?.includes("不舒服") || content?.includes("难受")) {
        severity = "MEDIUM";
      }
      if (content?.includes("严重") || content?.includes("急性") || content?.includes("发烧")) {
        severity = "HIGH";
      }

      events.push({
        type: "HEALTH_EVENT",
        eventData: memory,
        severity,
        message: `检测到健康相关事件：${content}`
      });
    }

    return events;
  }

  async scanForEmotionAnomalies(): Promise<CareEvent[]> {
    const events: CareEvent[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const emotionContexts = await getDatabase().select()
      .from(conversationEmotionalContext)
      .where(gte(conversationEmotionalContext.createdAt, twentyFourHoursAgo));

    for (const ctx of emotionContexts) {
      const intensity = ctx.emotionIntensity || 0;
      const emotion = ctx.dominantEmotion;

      if ((emotion === "stressed" || emotion === "anxious" || emotion === "sad") && intensity > 0.7) {
        events.push({
          type: "EMOTION_ANOMALY",
          eventData: ctx,
          severity: intensity > 0.85 ? "HIGH" : "MEDIUM",
          message: `检测到情绪异常：${emotion}，强度 ${(intensity * 100).toFixed(0)}%`
        });
      }
    }

    return events;
  }

  async scanForIdleContacts(): Promise<CareEvent[]> {
    return [];
  }

  async runScan(): Promise<{ eventsDetected: number; rulesTriggered: number; notificationsQueued: number }> {
    const rules = await this.getRules(true);
    const allEvents: CareEvent[] = [];

    const healthEvents = await this.scanForHealthEvents();
    const emotionEvents = await this.scanForEmotionAnomalies();
    const idleContactEvents = await this.scanForIdleContacts();

    allEvents.push(...healthEvents, ...emotionEvents, ...idleContactEvents);

    let rulesTriggered = 0;
    let notificationsQueued = 0;

    for (const rule of rules) {
      if (!this.canTriggerRule(rule)) continue;

      const matchingEvents = this.matchEventsToRule(allEvents, rule);
      
      for (const event of matchingEvents) {
        const log = await this.createCareLog(rule, event);
        await this.queueNotification(rule, log, event);
        rulesTriggered++;
        notificationsQueued++;
      }

      if (matchingEvents.length > 0) {
        await getDatabase().update(proactiveCareRules)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(proactiveCareRules.id, rule.id));
      }
    }

    return {
      eventsDetected: allEvents.length,
      rulesTriggered,
      notificationsQueued
    };
  }

  private canTriggerRule(rule: ProactiveCareRule): boolean {
    if (!rule.lastTriggeredAt) return true;
    
    const cooldownMs = (rule.cooldownHours || 24) * 60 * 60 * 1000;
    const now = new Date().getTime();
    const lastTriggered = new Date(rule.lastTriggeredAt).getTime();
    
    return (now - lastTriggered) >= cooldownMs;
  }

  private matchEventsToRule(events: CareEvent[], rule: ProactiveCareRule): CareEvent[] {
    const condition = rule.triggerCondition as TriggerCondition;
    
    return events.filter(event => {
      if (rule.triggerType === "HEALTH_EVENT" && event.type === "HEALTH_EVENT") {
        return true;
      }
      if (rule.triggerType === "EMOTION_ANOMALY" && event.type === "EMOTION_ANOMALY") {
        const threshold = condition?.threshold || 0.7;
        const intensity = event.eventData?.emotionIntensity || 0;
        return intensity >= threshold;
      }
      if (rule.triggerType === "CONTACT_IDLE" && event.type === "CONTACT_IDLE") {
        return true;
      }
      return false;
    });
  }

  private async createCareLog(rule: ProactiveCareRule, event: CareEvent): Promise<ProactiveCareLog> {
    const config = rule.actionConfig as ActionConfig;
    
    const logData: InsertProactiveCareLog = {
      ruleId: rule.id,
      ruleName: rule.name,
      triggerType: rule.triggerType,
      triggerData: event.eventData,
      actionType: rule.actionType,
      message: config?.message || event.message,
      targetPersonId: event.personId,
    };

    const [log] = await getDatabase().insert(proactiveCareLogs).values(logData).returning();
    return log;
  }

  private async queueNotification(rule: ProactiveCareRule, log: ProactiveCareLog, event: CareEvent): Promise<void> {
    const config = rule.actionConfig as ActionConfig;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const notification: InsertCareNotificationQueue = {
      logId: log.id,
      notificationType: this.mapActionToNotificationType(rule.actionType),
      title: rule.name,
      message: config?.message || event.message,
      priority: rule.priority || "MEDIUM",
      scheduledAt: now,
      expiresAt,
    };

    await getDatabase().insert(careNotificationQueue).values(notification);
  }

  private mapActionToNotificationType(actionType: string): string {
    const map: Record<string, string> = {
      "DASHBOARD_BUBBLE": "BUBBLE",
      "PUSH_NOTIFICATION": "PUSH",
      "VOICE_REMINDER": "VOICE",
      "EMAIL": "EMAIL",
    };
    return map[actionType] || "BUBBLE";
  }

  async getCareLogs(limit = 50): Promise<ProactiveCareLog[]> {
    return getDatabase().select()
      .from(proactiveCareLogs)
      .orderBy(desc(proactiveCareLogs.createdAt))
      .limit(limit);
  }

  async getPendingNotifications(): Promise<any[]> {
    const now = new Date();
    return getDatabase().select()
      .from(careNotificationQueue)
      .where(
        and(
          eq(careNotificationQueue.status, "PENDING"),
          or(
            isNull(careNotificationQueue.expiresAt),
            gte(careNotificationQueue.expiresAt, now)
          )
        )
      )
      .orderBy(desc(careNotificationQueue.createdAt));
  }

  async markNotificationSent(id: string): Promise<void> {
    await getDatabase().update(careNotificationQueue)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(careNotificationQueue.id, id));
  }

  async dismissNotification(id: string): Promise<void> {
    await getDatabase().update(careNotificationQueue)
      .set({ status: "EXPIRED" })
      .where(eq(careNotificationQueue.id, id));
  }

  async acknowledgeLog(logId: string, response: string): Promise<void> {
    await getDatabase().update(proactiveCareLogs)
      .set({ 
        userResponse: response,
        respondedAt: new Date(),
        actionResult: "DELIVERED"
      })
      .where(eq(proactiveCareLogs.id, logId));
  }

  async seedDefaultRules(): Promise<void> {
    const existingRules = await this.getRules();
    if (existingRules.length > 0) return;

    const defaultRules: InsertProactiveCareRule[] = [
      {
        name: "健康事件关怀",
        description: "当检测到健康相关事件时，主动询问身体状况",
        triggerType: "HEALTH_EVENT",
        triggerCondition: { eventType: "HEALTH" },
        actionType: "DASHBOARD_BUBBLE",
        actionConfig: { message: "爸爸，小智注意到您提到了身体不适，现在感觉怎么样？需要我帮您查询相关信息吗？" },
        priority: "HIGH",
        cooldownHours: 12,
        isEnabled: true,
        isSystemRule: true,
      },
      {
        name: "情绪异常关怀",
        description: "当检测到负面情绪强度过高时，主动提供心理支持",
        triggerType: "EMOTION_ANOMALY",
        triggerCondition: { threshold: 0.7, emotionLevel: 0.7 },
        actionType: "DASHBOARD_BUBBLE",
        actionConfig: { message: "爸爸，小智感受到您今天可能有些压力，要不要和我聊聊？或者我可以帮您安排一些放松活动。" },
        priority: "MEDIUM",
        cooldownHours: 8,
        isEnabled: true,
        isSystemRule: true,
      },
      {
        name: "重要联系人联络提醒",
        description: "当与重要联系人超过30天未联系时，提醒保持联络",
        triggerType: "CONTACT_IDLE",
        triggerCondition: { daysSince: 30 },
        actionType: "DASHBOARD_BUBBLE",
        actionConfig: { message: "爸爸，您已经很久没有联系 {personName} 了，要不要我帮您起草一条问候消息？" },
        priority: "LOW",
        cooldownHours: 168,
        isEnabled: true,
        isSystemRule: true,
      },
    ];

    for (const rule of defaultRules) {
      await this.createRule(rule);
    }
  }
}

export const proactiveCareService = new ProactiveCareService();
