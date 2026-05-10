import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';
import type { AuditLog, InsertAuditLog } from '@shared/schema';

const logger = createServiceLogger('AuditService');

export class AuditService {
  /**
   * 创建审计日志
   */
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const auditLog = await storage.createAuditLog(log);
    logger.debug({ action: log.action, actor: log.actor }, '审计日志创建成功');
    return auditLog;
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(options?: {
    action?: string;
    actor?: string;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    // 注意：storage 中可能没有 getAuditLogs 方法，需要检查
    // 暂时使用简单实现
    return await storage.getAuditLogs(options?.limit);
  }

  /**
   * 创建 HP 消耗审计日志（封装通用模式）
   */
  async logHPConsumption(actor: string, amount: number, reason: string, oldHp: number, newHp: number): Promise<AuditLog> {
    return await this.createAuditLog({
      action: 'HP_CONSUMED',
      actor,
      targetType: 'hp',
      targetId: 'singleton',
      details: { amount, reason, oldHp, newHp },
      result: 'SUCCESS',
    });
  }

  /**
   * 创建 HP 充值审计日志
   */
  async logHPRecharge(actor: string, amount: number, source: string, oldHp: number, newHp: number): Promise<AuditLog> {
    return await this.createAuditLog({
      action: 'HP_RECHARGED',
      actor,
      targetType: 'hp',
      targetId: 'singleton',
      details: { amount, source, oldHp, newHp },
      result: 'SUCCESS',
    });
  }
}

export const auditService = new AuditService();