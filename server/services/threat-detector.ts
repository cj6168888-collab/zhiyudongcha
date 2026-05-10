/**
 * 小智威胁检测服务 (Threat Detector)
 * Phase 4.1 - 免疫系统激活
 * 
 * 功能：
 * 1. 异常登录模式检测
 * 2. 敏感操作频率监控
 * 3. 数据批量导出检测
 * 4. API调用异常检测
 * 5. 自动响应动作触发
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { getDatabase } from '../db';
import { auditLogs } from '@shared/schema';
import { eq, desc, and, gte, sql, count } from 'drizzle-orm';
import { killSwitchService } from './kill-switch';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ThreatDetector');

export type ThreatType = 
  | 'ABNORMAL_LOGIN'
  | 'SENSITIVE_OP_FREQUENCY'
  | 'BULK_DATA_EXPORT'
  | 'API_ABUSE'
  | 'BRUTE_FORCE'
  | 'PRIVILEGE_ESCALATION'
  | 'SUSPICIOUS_PATTERN';

export type ThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ResponseAction = 
  | 'ALERT'
  | 'LOG_ONLY'
  | 'REQUIRE_2FA'
  | 'TEMP_LOCK'
  | 'PERMANENT_LOCK'
  | 'ACTIVATE_LAST_STAND';

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  threatType: ThreatType;
  enabled: boolean;
  threshold: number;
  timeWindowMinutes: number;
  severity: ThreatSeverity;
  actions: ResponseAction[];
  patterns?: string[];
  excludeActors?: string[];
}

export interface DetectedThreat {
  id: string;
  ruleId: string;
  ruleName: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  actor: string;
  deviceId?: string;
  ipAddress?: string;
  description: string;
  evidence: {
    eventCount: number;
    timeWindow: string;
    samples: string[];
  };
  suggestedActions: ResponseAction[];
  detectedAt: Date;
  handledAt?: Date;
  handledBy?: string;
  actionsTaken?: ResponseAction[];
}

export interface SecurityEvent {
  action: string;
  actor: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  deviceId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
}

const DEFAULT_THREAT_RULES: ThreatRule[] = [
  {
    id: 'rule_abnormal_login',
    name: '异常登录模式',
    description: '短时间内多次登录失败',
    threatType: 'ABNORMAL_LOGIN',
    enabled: true,
    threshold: 5,
    timeWindowMinutes: 10,
    severity: 'HIGH',
    actions: ['ALERT', 'REQUIRE_2FA'],
    patterns: ['LOGIN_FAILED', 'AUTH_FAILED'],
  },
  {
    id: 'rule_brute_force',
    name: '暴力破解检测',
    description: '疑似暴力破解攻击',
    threatType: 'BRUTE_FORCE',
    enabled: true,
    threshold: 10,
    timeWindowMinutes: 5,
    severity: 'CRITICAL',
    actions: ['ALERT', 'TEMP_LOCK'],
    patterns: ['LOGIN_FAILED', 'AUTH_FAILED', 'SECRET_VALIDATION_FAILED'],
  },
  {
    id: 'rule_sensitive_ops',
    name: '敏感操作频率',
    description: '短时间内执行大量敏感操作',
    threatType: 'SENSITIVE_OP_FREQUENCY',
    enabled: true,
    threshold: 20,
    timeWindowMinutes: 5,
    severity: 'MEDIUM',
    actions: ['ALERT', 'LOG_ONLY'],
    patterns: ['DELETE', 'UPDATE', 'EXPORT', 'MODIFY_PERMISSION'],
  },
  {
    id: 'rule_bulk_export',
    name: '数据批量导出',
    description: '大量数据导出行为',
    threatType: 'BULK_DATA_EXPORT',
    enabled: true,
    threshold: 3,
    timeWindowMinutes: 30,
    severity: 'HIGH',
    actions: ['ALERT', 'REQUIRE_2FA'],
    patterns: ['EXPORT', 'DOWNLOAD_BULK', 'BACKUP_CREATE'],
  },
  {
    id: 'rule_api_abuse',
    name: 'API调用异常',
    description: 'API调用频率异常高',
    threatType: 'API_ABUSE',
    enabled: true,
    threshold: 100,
    timeWindowMinutes: 1,
    severity: 'MEDIUM',
    actions: ['ALERT', 'TEMP_LOCK'],
    patterns: ['API_CALL'],
  },
  {
    id: 'rule_privilege_escalation',
    name: '权限提升尝试',
    description: '尝试访问未授权资源',
    threatType: 'PRIVILEGE_ESCALATION',
    enabled: true,
    threshold: 3,
    timeWindowMinutes: 15,
    severity: 'CRITICAL',
    actions: ['ALERT', 'TEMP_LOCK', 'ACTIVATE_LAST_STAND'],
    patterns: ['ACCESS_DENIED', 'UNAUTHORIZED', 'PERMISSION_DENIED'],
    excludeActors: ['MASTER'],
  },
];

class ThreatDetectorService {
  private rules: Map<string, ThreatRule> = new Map();
  private detectedThreats: Map<string, DetectedThreat> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private readonly BUFFER_MAX_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;

  constructor() {
    DEFAULT_THREAT_RULES.forEach(rule => this.rules.set(rule.id, rule));
    logger.info('[ThreatDetector] 威胁检测服务已启动');
    logger.info(`[ThreatDetector] 已加载 ${this.rules.size} 条检测规则`);
    
    setInterval(() => this.cleanupOldEvents(), this.CLEANUP_INTERVAL);
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.eventBuffer.push(event);
    
    if (this.eventBuffer.length > this.BUFFER_MAX_SIZE) {
      this.eventBuffer = this.eventBuffer.slice(-this.BUFFER_MAX_SIZE);
    }

    try {
      await getDatabase().insert(auditLogs).values({
        action: event.action,
        actor: event.actor,
        targetType: event.targetType || null,
        targetId: event.targetId || null,
        details: event.metadata || null,
        ipAddress: event.ipAddress || null,
        deviceInfo: event.deviceId || null,
        result: event.result,
      });
    } catch (error) {
      logger.error({ err: error }, '[ThreatDetector] 记录安全事件失败');
    }

    await this.analyzeEventForThreats(event);
  }

  private async analyzeEventForThreats(event: SecurityEvent): Promise<void> {
    for (const rule of Array.from(this.rules.values())) {
      if (!rule.enabled) continue;
      if (rule.excludeActors?.includes(event.actor)) continue;

      const matchesPattern = rule.patterns?.some((pattern: string) => 
        event.action.toUpperCase().includes(pattern)
      );

      if (!matchesPattern) continue;

      const recentCount = await this.countRecentEvents(
        event.actor,
        rule.patterns || [],
        rule.timeWindowMinutes
      );

      if (recentCount >= rule.threshold) {
        await this.triggerThreat(rule, event, recentCount);
      }
    }
  }

  private async countRecentEvents(
    actor: string,
    patterns: string[],
    timeWindowMinutes: number
  ): Promise<number> {
    const windowStart = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const bufferCount = this.eventBuffer.filter(e => 
      e.actor === actor &&
      patterns.some(p => e.action.toUpperCase().includes(p))
    ).length;

    try {
      const dbResults = await getDatabase().select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.actor, actor),
            gte(auditLogs.createdAt, windowStart)
          )
        );
      
      return (dbResults[0]?.count || 0) + bufferCount;
    } catch {
      return bufferCount;
    }
  }

  private async triggerThreat(
    rule: ThreatRule,
    event: SecurityEvent,
    eventCount: number
  ): Promise<void> {
    const threatId = `threat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const threat: DetectedThreat = {
      id: threatId,
      ruleId: rule.id,
      ruleName: rule.name,
      threatType: rule.threatType,
      severity: rule.severity,
      actor: event.actor,
      deviceId: event.deviceId,
      ipAddress: event.ipAddress,
      description: `${rule.description}（检测到 ${eventCount} 次，阈值 ${rule.threshold}）`,
      evidence: {
        eventCount,
        timeWindow: `${rule.timeWindowMinutes}分钟`,
        samples: this.eventBuffer
          .filter(e => e.actor === event.actor)
          .slice(-5)
          .map(e => `${e.action} - ${e.result}`),
      },
      suggestedActions: rule.actions,
      detectedAt: new Date(),
    };

    this.detectedThreats.set(threatId, threat);
    logger.info(`[ThreatDetector] 检测到威胁: ${rule.name} (${rule.severity})`);
    logger.info(`[ThreatDetector] 行为者: ${event.actor}, 事件数: ${eventCount}`);

    await this.executeResponseActions(threat, rule.actions);

    await this.logSecurityEvent({
      action: 'THREAT_DETECTED',
      actor: 'SYSTEM',
      targetType: 'THREAT',
      targetId: threatId,
      metadata: {
        ruleName: rule.name,
        severity: rule.severity,
        eventCount,
        actions: rule.actions,
      },
      result: 'SUCCESS',
    });
  }

  private async executeResponseActions(
    threat: DetectedThreat,
    actions: ResponseAction[]
  ): Promise<void> {
    const actionsTaken: ResponseAction[] = [];

    for (const action of actions) {
      try {
        switch (action) {
          case 'ALERT':
            logger.info(`[ThreatDetector] 告警: ${threat.description}`);
            actionsTaken.push('ALERT');
            break;

          case 'LOG_ONLY':
            actionsTaken.push('LOG_ONLY');
            break;

          case 'REQUIRE_2FA':
            logger.info(`[ThreatDetector] 要求二次验证: ${threat.actor}`);
            actionsTaken.push('REQUIRE_2FA');
            break;

          case 'TEMP_LOCK':
            if (threat.deviceId) {
              await killSwitchService.lockDevice(
                threat.deviceId,
                `威胁检测: ${threat.ruleName}`,
                'SYSTEM'
              );
              logger.info(`[ThreatDetector] 临时锁定设备: ${threat.deviceId}`);
            }
            actionsTaken.push('TEMP_LOCK');
            break;

          case 'PERMANENT_LOCK':
            if (threat.deviceId) {
              await killSwitchService.revokeDeviceAccess(
                threat.deviceId,
                `威胁检测: ${threat.ruleName}`,
                'SYSTEM'
              );
              logger.info(`[ThreatDetector] 永久锁定设备: ${threat.deviceId}`);
            }
            actionsTaken.push('PERMANENT_LOCK');
            break;

          case 'ACTIVATE_LAST_STAND':
            logger.info(`[ThreatDetector] 触发最后防线: ${threat.description}`);
            actionsTaken.push('ACTIVATE_LAST_STAND');
            break;
        }
      } catch (error) {
        logger.error({ err: error, action }, '执行响应动作失败');
      }
    }

    threat.actionsTaken = actionsTaken;
    this.detectedThreats.set(threat.id, threat);
  }

  async handleThreat(
    threatId: string,
    handledBy: string,
    additionalActions?: ResponseAction[]
  ): Promise<{ success: boolean; message: string }> {
    const threat = this.detectedThreats.get(threatId);
    if (!threat) {
      return { success: false, message: '威胁记录不存在' };
    }

    threat.handledAt = new Date();
    threat.handledBy = handledBy;

    if (additionalActions && additionalActions.length > 0) {
      await this.executeResponseActions(threat, additionalActions);
    }

    this.detectedThreats.set(threatId, threat);

    await this.logSecurityEvent({
      action: 'THREAT_HANDLED',
      actor: handledBy,
      targetType: 'THREAT',
      targetId: threatId,
      metadata: { additionalActions },
      result: 'SUCCESS',
    });

    return { 
      success: true, 
      message: `威胁 ${threat.ruleName} 已处理` 
    };
  }

  getActiveThreats(): DetectedThreat[] {
    return Array.from(this.detectedThreats.values())
      .filter(t => !t.handledAt)
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  getThreatHistory(limit: number = 50): DetectedThreat[] {
    return Array.from(this.detectedThreats.values())
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, limit);
  }

  getThreatStats(): {
    total: number;
    active: number;
    handled: number;
    bySeverity: Record<ThreatSeverity, number>;
    byType: Record<ThreatType, number>;
  } {
    const threats = Array.from(this.detectedThreats.values());
    const stats = {
      total: threats.length,
      active: threats.filter(t => !t.handledAt).length,
      handled: threats.filter(t => t.handledAt).length,
      bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      byType: {} as Record<ThreatType, number>,
    };

    for (const threat of threats) {
      stats.bySeverity[threat.severity]++;
      stats.byType[threat.threatType] = (stats.byType[threat.threatType] || 0) + 1;
    }

    return stats;
  }

  getRules(): ThreatRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(ruleId: string, updates: Partial<ThreatRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.set(ruleId, { ...rule, ...updates });
    logger.info(`[ThreatDetector] 规则已更新: ${ruleId}`);
    return true;
  }

  addRule(rule: ThreatRule): boolean {
    if (this.rules.has(rule.id)) return false;
    this.rules.set(rule.id, rule);
    logger.info(`[ThreatDetector] 新规则已添加: ${rule.name}`);
    return true;
  }

  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      logger.info(`[ThreatDetector] 规则已删除: ${ruleId}`);
    }
    return deleted;
  }

  async getAuditLogs(options: {
    actor?: string;
    action?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    const { actor, action, limit = 100, startDate, endDate } = options;
    
    let query = getDatabase().select().from(auditLogs);
    const conditions = [];

    if (actor) {
      conditions.push(eq(auditLogs.actor, actor));
    }
    if (action) {
      conditions.push(sql`${auditLogs.action} ILIKE ${'%' + action + '%'}`);
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${endDate}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  private cleanupOldEvents(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [id, threat] of Array.from(this.detectedThreats.entries())) {
      if (threat.handledAt && threat.handledAt.getTime() < oneDayAgo) {
        this.detectedThreats.delete(id);
      }
    }

    logger.info('[ThreatDetector] 已清理过期威胁记录');
  }

  async simulateAttack(attackType: ThreatType): Promise<DetectedThreat | null> {
    logger.info(`[ThreatDetector] 模拟攻击: ${attackType}`);

    const eventMap: Record<ThreatType, () => Promise<void>> = {
      ABNORMAL_LOGIN: async () => {
        for (let i = 0; i < 6; i++) {
          await this.logSecurityEvent({
            action: 'LOGIN_FAILED',
            actor: 'SIMULATED_ATTACKER',
            result: 'FAILURE',
            ipAddress: '192.168.1.' + (100 + i),
          });
        }
      },
      BRUTE_FORCE: async () => {
        for (let i = 0; i < 12; i++) {
          await this.logSecurityEvent({
            action: 'AUTH_FAILED',
            actor: 'SIMULATED_ATTACKER',
            result: 'FAILURE',
          });
        }
      },
      SENSITIVE_OP_FREQUENCY: async () => {
        for (let i = 0; i < 25; i++) {
          await this.logSecurityEvent({
            action: 'DELETE_RECORD',
            actor: 'SIMULATED_ATTACKER',
            targetType: 'RECORD',
            targetId: `record_${i}`,
            result: 'SUCCESS',
          });
        }
      },
      BULK_DATA_EXPORT: async () => {
        for (let i = 0; i < 4; i++) {
          await this.logSecurityEvent({
            action: 'EXPORT_DATA',
            actor: 'SIMULATED_ATTACKER',
            metadata: { recordCount: 10000 },
            result: 'SUCCESS',
          });
        }
      },
      API_ABUSE: async () => {
        for (let i = 0; i < 110; i++) {
          await this.logSecurityEvent({
            action: 'API_CALL',
            actor: 'SIMULATED_ATTACKER',
            result: 'SUCCESS',
          });
        }
      },
      PRIVILEGE_ESCALATION: async () => {
        for (let i = 0; i < 4; i++) {
          await this.logSecurityEvent({
            action: 'ACCESS_DENIED',
            actor: 'SIMULATED_ATTACKER',
            targetType: 'ADMIN_RESOURCE',
            result: 'BLOCKED',
          });
        }
      },
      SUSPICIOUS_PATTERN: async () => {
        await this.logSecurityEvent({
          action: 'SUSPICIOUS_ACTIVITY',
          actor: 'SIMULATED_ATTACKER',
          result: 'BLOCKED',
        });
      },
    };

    const simulate = eventMap[attackType];
    if (simulate) {
      await simulate();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const threats = this.getActiveThreats();
    return threats.find(t => t.threatType === attackType) || null;
  }
}

export const threatDetector = new ThreatDetectorService();
export default threatDetector;
