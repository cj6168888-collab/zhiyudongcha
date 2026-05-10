/**
 * 风险数据采集服务 - RiskDataCollector
 *
 * 从系统各模块收集真实的行为数据，用于风险预测
 *
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { getDatabase } from '../db';
import { teamMembers, auditLogs, satelliteDevices, vaultItems } from '@shared/schema';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('RiskDataCollector');

export interface BehavioralData {
  memberId: string;
  type: string;
  metrics: Record<string, number>;
  timestamp: Date;
}

export interface AccessPattern {
  memberId: string;
  resourceType: string;
  accessCount: number;
  unusualHours: number;
  lastAccess: Date;
}

export interface WorkPattern {
  memberId: string;
  avgCheckIn: string;
  avgCheckOut: string;
  overtimeHours: number;
  absenceDays: number;
  vacationDays: number;
}

class RiskDataCollector {
  /**
   * 收集成员访问模式数据
   */
  async collectAccessPattern(memberId: string, days: number = 30): Promise<AccessPattern | null> {
    try {
      const db = getDatabase();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 查询审计日志中该成员的访问记录
      const logs = await db.select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.targetId, memberId),
            gte(auditLogs.createdAt, startDate)
          )
        )
        .order(desc(auditLogs.createdAt))
        .limit(100);

      if (logs.length === 0) {
        return null;
      }

      // 分析访问模式
      const accessByHour: Record<number, number> = {};
      const accessByType: Record<string, number> = {};

      logs.forEach(log => {
        const hour = new Date(log.createdAt).getHours();
        // 统计非工作时间访问（早上8点前或晚上6点后）
        if (hour < 8 || hour > 18) {
          accessByHour[hour] = (accessByHour[hour] || 0) + 1;
        }

        // 按资源类型统计
        const resourceType = log.targetType || 'UNKNOWN';
        accessByType[resourceType] = (accessByType[resourceType] || 0) + 1;
      });

      const unusualHours = Object.keys(accessByHour).length;

      return {
        memberId,
        resourceType: Object.entries(accessByType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN',
        accessCount: logs.length,
        unusualHours,
        lastAccess: logs[0]?.createdAt || new Date(),
      };
    } catch (error) {
      logger.error({ memberId, error }, 'Failed to collect access pattern');
      return null;
    }
  }

  /**
   * 收集工作模式数据
   */
  async collectWorkPattern(memberId: string): Promise<WorkPattern | null> {
    try {
      const db = getDatabase();

      // 从设备签入记录中获取工作模式
      const [member] = await db.select()
        .from(teamMembers)
        .where(eq(teamMembers.id, memberId))
        .limit(1);

      if (!member) {
        return null;
      }

      // 这里可以扩展从实际打卡系统获取数据
      // 目前返回基于成员数据的基本信息
      return {
        memberId,
        avgCheckIn: '09:00',  // TODO: 从实际考勤系统获取
        avgCheckOut: '18:00', // TODO: 从实际考勤系统获取
        overtimeHours: 0,     // TODO: 从实际考勤系统获取
        absenceDays: 0,       // TODO: 从实际考勤系统获取
        vacationDays: 0,      // TODO: 从实际考勤系统获取
      };
    } catch (error) {
      logger.error({ memberId, error }, 'Failed to collect work pattern');
      return null;
    }
  }

  /**
   * 收集文档操作数据（用于泄密风险）
   */
  async collectDocumentActivity(memberId: string, days: number = 7): Promise<{
    downloadCount: number;
    uploadCount: number;
    printCount: number;
    shareCount: number;
  }> {
    try {
      const db = getDatabase();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await db.select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.targetId, memberId),
            gte(auditLogs.createdAt, startDate)
          )
        )
        .limit(100);

      const activities = {
        downloadCount: 0,
        uploadCount: 0,
        printCount: 0,
        shareCount: 0,
      };

      logs.forEach(log => {
        const action = log.action.toUpperCase();
        if (action.includes('DOWNLOAD')) activities.downloadCount++;
        if (action.includes('UPLOAD')) activities.uploadCount++;
        if (action.includes('PRINT')) activities.printCount++;
        if (action.includes('SHARE')) activities.shareCount++;
      });

      return activities;
    } catch (error) {
      logger.error({ memberId, error }, 'Failed to collect document activity');
      return { downloadCount: 0, uploadCount: 0, printCount: 0, shareCount: 0 };
    }
  }

  /**
   * 收集网络行为数据（用于离职风险）
   */
  async collectNetworkBehavior(memberId: string, days: number = 14): Promise<{
    jobSiteVisits: number;
    linkedInActivity: number;
    emailExternalCount: number;
  }> {
    try {
      const db = getDatabase();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await db.select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.targetId, memberId),
            gte(auditLogs.createdAt, startDate)
          )
        )
        .limit(100);

      const behavior = {
        jobSiteVisits: 0,
        linkedInActivity: 0,
        emailExternalCount: 0,
      };

      const jobSites = ['招聘', '猎头', 'job', 'career', 'linkedin', 'zhilian', 'boss'];
      const details = logs.map(l => JSON.stringify(l.details).toLowerCase());

      details.forEach(detail => {
        if (jobSites.some(site => detail.includes(site))) {
          behavior.jobSiteVisits++;
        }
        if (detail.includes('linkedin')) {
          behavior.linkedInActivity++;
        }
      });

      return behavior;
    } catch (error) {
      logger.error({ memberId, error }, 'Failed to collect network behavior');
      return { jobSiteVisits: 0, linkedInActivity: 0, emailExternalCount: 0 };
    }
  }

  /**
   * 综合收集所有行为数据
   */
  async collectAllBehavioralData(memberId: string): Promise<{
    accessPattern: AccessPattern | null;
    workPattern: WorkPattern | null;
    documentActivity: ReturnType<typeof this.collectDocumentActivity>;
    networkBehavior: ReturnType<typeof this.collectNetworkBehavior>;
  }> {
    const [accessPattern, workPattern, documentActivity, networkBehavior] = await Promise.all([
      this.collectAccessPattern(memberId),
      this.collectWorkPattern(memberId),
      this.collectDocumentActivity(memberId),
      this.collectNetworkBehavior(memberId),
    ]);

    return {
      accessPattern,
      workPattern,
      documentActivity,
      networkBehavior,
    };
  }

  /**
   * 获取所有团队成员
   */
  async getAllTeamMembers(): Promise<Array<{ id: string; name: string; accessTier: string }>> {
    try {
      const db = getDatabase();
      const members = await db.select({
        id: teamMembers.id,
        name: teamMembers.name,
        accessTier: teamMembers.accessTier,
      }).from(teamMembers);

      return members;
    } catch (error) {
      logger.error({ error }, 'Failed to get team members');
      return [];
    }
  }
}

export const riskDataCollector = new RiskDataCollector();
export default riskDataCollector;
