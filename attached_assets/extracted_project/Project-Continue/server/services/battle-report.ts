/**
 * 小智 Battle Report Service - 战报自动汇总服务
 * 
 * 功能：
 * 1. 分台活动实时统计
 * 2. 商机捕获总量统计
 * 3. 环境安全状态评估
 * 4. 自动生成战报摘要
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { battleReports, satelliteDevices, loyaltyEvents, teamMembers } from '@shared/schema';
import { eq, sql, gte, lte, and, desc } from 'drizzle-orm';

interface DailyStats {
  date: string;
  opportunities: number;
  traps: number;
  successRate: number;
}

interface DeviceActivity {
  deviceId: string;
  deviceName: string;
  reportCount: number;
  lastActive: Date | null;
  status: string;
}

interface SecurityAssessment {
  overallLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  riskFactors: string[];
  recommendations: string[];
  score: number;
}

class BattleReportService {

  async generateDailySummary(date?: Date): Promise<{
    date: string;
    totalReports: number;
    byRiskLevel: Record<string, number>;
    topOpportunities: Array<{ title: string; value: number }>;
    activeDevices: number;
    securityStatus: SecurityAssessment;
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const reports = await db.select()
      .from(battleReports)
      .where(and(
        gte(battleReports.createdAt, startOfDay),
        lte(battleReports.createdAt, endOfDay)
      ));

    const byRiskLevel: Record<string, number> = {};
    const opportunities: Array<{ title: string; value: number }> = [];

    for (const report of reports) {
      const riskLevel = report.riskLevel || 'LOW';
      byRiskLevel[riskLevel] = (byRiskLevel[riskLevel] || 0) + 1;

      const oppFound = report.opportunitiesFound || 0;
      if (oppFound > 0) {
        opportunities.push({
          title: report.title,
          value: oppFound,
        });
      }
    }

    const activeDevices = await db.select({ count: sql<number>`count(*)` })
      .from(satelliteDevices)
      .where(eq(satelliteDevices.status, 'ACTIVE'));

    const securityStatus = await this.assessSecurityStatus();

    return {
      date: targetDate.toISOString().split('T')[0],
      totalReports: reports.length,
      byRiskLevel,
      topOpportunities: opportunities.sort((a, b) => b.value - a.value).slice(0, 5),
      activeDevices: Number(activeDevices[0]?.count) || 0,
      securityStatus,
    };
  }

  async getWeeklyTrend(): Promise<{
    weekStart: string;
    weekEnd: string;
    dailyStats: DailyStats[];
    totalOpportunities: number;
    totalTraps: number;
    avgSuccessRate: number;
  }> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const reports = await db.select()
      .from(battleReports)
      .where(gte(battleReports.createdAt, weekStart))
      .orderBy(battleReports.createdAt);

    const dailyMap: Map<string, { opportunities: number; traps: number; success: number; total: number }> = new Map();

    for (const report of reports) {
      const dateKey = (report.createdAt || new Date()).toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { opportunities: 0, traps: 0, success: 0, total: 0 };
      
      existing.opportunities += report.opportunitiesFound || 0;
      existing.traps += report.trapsDetected || 0;
      existing.total += 1;
      
      const outcomes = report.outcomes as Record<string, any> | null;
      if (outcomes?.status === 'SUCCESS' || report.riskLevel === 'LOW') {
        existing.success += 1;
      }
      
      dailyMap.set(dateKey, existing);
    }

    const dailyStats: DailyStats[] = [];
    let totalOpportunities = 0;
    let totalTraps = 0;
    let totalSuccess = 0;
    let totalReports = 0;

    for (const [date, stats] of Array.from(dailyMap.entries())) {
      dailyStats.push({
        date,
        opportunities: stats.opportunities,
        traps: stats.traps,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
      });
      totalOpportunities += stats.opportunities;
      totalTraps += stats.traps;
      totalSuccess += stats.success;
      totalReports += stats.total;
    }

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: now.toISOString().split('T')[0],
      dailyStats: dailyStats.sort((a, b) => a.date.localeCompare(b.date)),
      totalOpportunities,
      totalTraps,
      avgSuccessRate: totalReports > 0 ? (totalSuccess / totalReports) * 100 : 0,
    };
  }

  async getDeviceActivitySummary(): Promise<DeviceActivity[]> {
    const devices = await db.select().from(satelliteDevices);
    const deviceActivities: DeviceActivity[] = [];

    for (const device of devices) {
      const reports = await db.select({ count: sql<number>`count(*)` })
        .from(battleReports)
        .where(eq(battleReports.sourceDeviceId, device.id));

      const lastReport = await db.select()
        .from(battleReports)
        .where(eq(battleReports.sourceDeviceId, device.id))
        .orderBy(desc(battleReports.createdAt))
        .limit(1);

      deviceActivities.push({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        reportCount: Number(reports[0]?.count) || 0,
        lastActive: lastReport[0]?.createdAt || null,
        status: device.status || 'UNKNOWN',
      });
    }

    return deviceActivities.sort((a, b) => b.reportCount - a.reportCount);
  }

  async assessSecurityStatus(): Promise<SecurityAssessment> {
    const riskFactors: string[] = [];
    let score = 100;

    const recentLoyaltyEvents = await db.select()
      .from(loyaltyEvents)
      .where(and(
        gte(loyaltyEvents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        eq(loyaltyEvents.status, 'ACTIVE')
      ));

    if (recentLoyaltyEvents.length > 0) {
      score -= recentLoyaltyEvents.length * 10;
      riskFactors.push(`${recentLoyaltyEvents.length}个活跃忠诚度风险事件`);
    }

    const killedDevices = await db.select()
      .from(satelliteDevices)
      .where(eq(satelliteDevices.status, 'KILLED'));

    if (killedDevices.length > 0) {
      score -= killedDevices.length * 5;
      riskFactors.push(`${killedDevices.length}台设备已熔断`);
    }

    const weeklyReports = await db.select()
      .from(battleReports)
      .where(gte(battleReports.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));

    const totalTraps = weeklyReports.reduce((sum, r) => sum + (r.trapsDetected || 0), 0);
    if (totalTraps > 10) {
      score -= 15;
      riskFactors.push(`本周发现${totalTraps}个陷阱`);
    } else if (totalTraps > 5) {
      score -= 8;
      riskFactors.push(`本周发现${totalTraps}个陷阱`);
    }

    const restrictedMembers = await db.select()
      .from(teamMembers)
      .where(eq(teamMembers.accessTier, 'RESTRICTED'));

    if (restrictedMembers.length > 0) {
      riskFactors.push(`${restrictedMembers.length}名成员处于受限状态`);
    }

    score = Math.max(0, Math.min(100, score));

    let overallLevel: SecurityAssessment['overallLevel'] = 'SAFE';
    if (score < 30) overallLevel = 'CRITICAL';
    else if (score < 50) overallLevel = 'WARNING';
    else if (score < 70) overallLevel = 'CAUTION';

    const recommendations: string[] = [];
    if (recentLoyaltyEvents.length > 0) {
      recommendations.push('建议处理未解决的忠诚度风险事件');
    }
    if (totalTraps > 5) {
      recommendations.push('建议加强信息安全培训');
    }
    if (killedDevices.length > 0) {
      recommendations.push('建议评估熔断设备的恢复可能性');
    }
    if (score < 70) {
      recommendations.push('建议召开安全复盘会议');
    }

    return {
      overallLevel,
      riskFactors,
      recommendations,
      score,
    };
  }

  async getOpportunityPipeline(): Promise<{
    total: number;
    byRiskLevel: Record<string, number>;
    highValue: Array<{ title: string; value: number; deviceName: string }>;
    conversionRate: number;
  }> {
    const reports = await db.select()
      .from(battleReports)
      .where(sql`${battleReports.opportunitiesFound} > 0`)
      .orderBy(desc(battleReports.opportunitiesFound));

    const byRiskLevel: Record<string, number> = {};
    let totalOpportunities = 0;
    let convertedOpportunities = 0;

    for (const report of reports) {
      const riskLevel = report.riskLevel || 'LOW';
      const oppFound = report.opportunitiesFound || 0;
      byRiskLevel[riskLevel] = (byRiskLevel[riskLevel] || 0) + oppFound;
      totalOpportunities += oppFound;
      
      const outcomes = report.outcomes as Record<string, any> | null;
      if (outcomes?.status === 'SUCCESS' || riskLevel === 'LOW') {
        convertedOpportunities += oppFound;
      }
    }

    const devices = await db.select().from(satelliteDevices);
    const deviceMap = new Map(devices.map(d => [d.id, d.deviceName]));

    const highValue = reports.slice(0, 10).map(r => ({
      title: r.title,
      value: r.opportunitiesFound || 0,
      deviceName: deviceMap.get(r.sourceDeviceId || '') || '未知设备',
    }));

    return {
      total: totalOpportunities,
      byRiskLevel,
      highValue,
      conversionRate: totalOpportunities > 0 ? (convertedOpportunities / totalOpportunities) * 100 : 0,
    };
  }

  async generateAutoSummary(): Promise<{
    timestamp: Date;
    highlights: string[];
    alerts: string[];
    kpi: {
      totalReports: number;
      activeDevices: number;
      securityScore: number;
      opportunityCount: number;
    };
  }> {
    const daily = await this.generateDailySummary();
    const weekly = await this.getWeeklyTrend();
    const pipeline = await this.getOpportunityPipeline();

    const highlights: string[] = [];
    const alerts: string[] = [];

    if (daily.totalReports > 0) {
      highlights.push(`今日收到${daily.totalReports}份战报`);
    }
    if (weekly.totalOpportunities > 0) {
      highlights.push(`本周捕获${weekly.totalOpportunities}个商机`);
    }
    if (weekly.avgSuccessRate > 70) {
      highlights.push(`战报成功率${weekly.avgSuccessRate.toFixed(1)}%，表现优异`);
    }
    if (pipeline.conversionRate > 50) {
      highlights.push(`商机转化率${pipeline.conversionRate.toFixed(1)}%`);
    }

    if (daily.securityStatus.overallLevel === 'CRITICAL') {
      alerts.push('安全状态严重警告，需要立即处理');
    } else if (daily.securityStatus.overallLevel === 'WARNING') {
      alerts.push('安全状态预警，建议关注');
    }
    if (weekly.totalTraps > 5) {
      alerts.push(`本周发现${weekly.totalTraps}个陷阱，需要关注`);
    }
    if (daily.activeDevices === 0) {
      alerts.push('无活跃设备，分台系统可能离线');
    }

    return {
      timestamp: new Date(),
      highlights,
      alerts,
      kpi: {
        totalReports: daily.totalReports,
        activeDevices: daily.activeDevices,
        securityScore: daily.securityStatus.score,
        opportunityCount: pipeline.total,
      },
    };
  }

  async submitBattleReport(data: {
    sourceDeviceId?: string;
    sourceMemberId?: string;
    reportType: string;
    title: string;
    summary?: string;
    details?: Record<string, any>;
    opportunitiesFound?: number;
    trapsDetected?: number;
    riskLevel?: string;
    priority?: number;
    tags?: string[];
  }): Promise<{ id: string; success: boolean }> {
    const [report] = await db.insert(battleReports).values({
      reportType: data.reportType,
      sourceDeviceId: data.sourceDeviceId,
      sourceMemberId: data.sourceMemberId,
      title: data.title,
      summary: data.summary,
      details: data.details || {},
      opportunitiesFound: data.opportunitiesFound || 0,
      trapsDetected: data.trapsDetected || 0,
      riskLevel: data.riskLevel || 'LOW',
      priority: data.priority || 5,
      tags: data.tags,
    }).returning();

    return { id: report.id, success: true };
  }
}

export const battleReportService = new BattleReportService();
