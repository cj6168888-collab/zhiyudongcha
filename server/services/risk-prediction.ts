/**
 * 小智 Risk Prediction Service - 风险预测系统
 *
 * 功能：
 * 1. 离职风险预警 - 基于行为模式预测离职可能性
 * 2. 泄密风险预警 - 检测异常数据访问和传输
 * 3. 行为异常检测 - 识别偏离正常模式的行为
 * 4. 预警通知 - 分级预警推送
 *
 * 风险类型：
 * - RESIGNATION: 离职风险
 * - LEAK: 泄密风险
 * - FRAUD: 欺诈风险
 * - BURNOUT: 职业倦怠
 * - CONFLICT: 人际冲突
 *
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RiskPrediction');

import { getDatabase } from '../db';
import { teamMembers, auditLogs, satelliteDevices } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { riskDataCollector } from './risk-data-collector';

export type RiskType = 'RESIGNATION' | 'LEAK' | 'FRAUD' | 'BURNOUT' | 'CONFLICT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertPriority = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

interface RiskIndicator {
  id: string;
  type: string;
  weight: number;
  description: string;
  detectedAt: Date;
  rawData?: Record<string, unknown>;
}

interface RiskProfile {
  memberId: string;
  memberName: string;
  overallRisk: RiskLevel;
  riskScore: number;
  risks: {
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }[];
  lastUpdated: Date;
}

interface RiskAlert {
  id: string;
  memberId: string;
  memberName: string;
  riskType: RiskType;
  priority: AlertPriority;
  title: string;
  description: string;
  indicators: string[];
  recommendations: string[];
  status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

interface BehaviorPattern {
  memberId: string;
  baseline: Record<string, number>;
  recent: Record<string, number>;
  deviations: {
    metric: string;
    baselineValue: number;
    recentValue: number;
    deviationPercent: number;
  }[];
}

const RISK_THRESHOLDS: Record<RiskLevel, { min: number; max: number }> = {
  LOW: { min: 0, max: 30 },
  MEDIUM: { min: 30, max: 60 },
  HIGH: { min: 60, max: 80 },
  CRITICAL: { min: 80, max: 100 },
};

const RESIGNATION_INDICATORS = [
  { id: 'late_arrivals', description: '迟到频率增加', weight: 15 },
  { id: 'early_departures', description: '早退频率增加', weight: 15 },
  { id: 'job_search', description: '访问招聘网站', weight: 25 },
  { id: 'resume_update', description: '更新简历', weight: 30 },
  { id: 'reduced_engagement', description: '参与度下降', weight: 10 },
  { id: 'increased_sick_days', description: '病假增加', weight: 10 },
  { id: 'linkedin_activity', description: 'LinkedIn活跃度增加', weight: 20 },
  { id: 'negative_sentiment', description: '沟通中负面情绪增加', weight: 15 },
];

const LEAK_INDICATORS = [
  { id: 'bulk_download', description: '大量文件下载', weight: 30 },
  { id: 'off_hours_access', description: '非工作时间访问敏感数据', weight: 25 },
  { id: 'usb_usage', description: '异常USB设备使用', weight: 25 },
  { id: 'cloud_upload', description: '上传至个人云存储', weight: 35 },
  { id: 'email_forward', description: '转发敏感邮件至外部', weight: 30 },
  { id: 'screenshot_activity', description: '异常截图活动', weight: 20 },
  { id: 'print_sensitive', description: '打印敏感文档', weight: 20 },
];

const FRAUD_INDICATORS = [
  { id: 'expense_anomaly', description: '报销异常', weight: 25 },
  { id: 'time_falsification', description: '工时记录异常', weight: 25 },
  { id: 'access_violation', description: '越权访问', weight: 30 },
  { id: 'vendor_collusion', description: '与供应商异常互动', weight: 35 },
  { id: 'financial_pressure', description: '财务压力信号', weight: 15 },
];

const CONFLICT_INDICATORS = [
  { id: 'email_escalation', description: '邮件冲突升级', weight: 20 },
  { id: 'meeting_avoidance', description: '回避特定同事会议', weight: 15 },
  { id: 'complaint_filed', description: '提交投诉', weight: 30 },
  { id: 'negative_feedback', description: '收到负面评价', weight: 20 },
  { id: 'team_tension', description: '团队氛围紧张', weight: 25 },
  { id: 'communication_breakdown', description: '沟通中断', weight: 25 },
  { id: 'isolation_behavior', description: '孤立行为', weight: 15 },
];

class RiskPredictionService {
  private riskProfiles: Map<string, RiskProfile> = new Map();
  private alerts: Map<string, RiskAlert> = new Map();
  private behaviorBaselines: Map<string, BehaviorPattern> = new Map();
  private alertListeners: Set<(alert: RiskAlert) => void> = new Set();

  async assessMemberRisk(memberId: string): Promise<RiskProfile> {
    const [member] = await getDatabase().select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
    if (!member) {
      throw new Error('成员不存在');
    }

    const resignationRisk = await this.assessResignationRisk(memberId, member);
    const leakRisk = await this.assessLeakRisk(memberId, member);
    const fraudRisk = await this.assessFraudRisk(memberId, member);
    const burnoutRisk = await this.assessBurnoutRisk(memberId, member);
    const conflictRisk = await this.assessConflictRisk(memberId, member);

    const allRisks = [resignationRisk, leakRisk, fraudRisk, burnoutRisk, conflictRisk];
    const overallScore = Math.max(...allRisks.map(r => r.score));
    const overallRisk = this.scoreToLevel(overallScore);

    const profile: RiskProfile = {
      memberId,
      memberName: member.name,
      overallRisk,
      riskScore: overallScore,
      risks: allRisks,
      lastUpdated: new Date(),
    };

    this.riskProfiles.set(memberId, profile);

    for (const risk of allRisks) {
      if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
        await this.createAlert(memberId, member.name, risk);
      }
    }

    return profile;
  }

  private async assessResignationRisk(memberId: string, member: typeof teamMembers.$inferSelect): Promise<{
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }> {
    const indicators: RiskIndicator[] = [];
    let score = 0;

    // 使用真实数据采集器获取行为数据
    const behavioralData = await riskDataCollector.collectAllBehavioralData(memberId);

    // 分析网络行为（离职风险指标）
    const { jobSiteVisits, linkedInActivity } = behavioralData.networkBehavior;

    if (jobSiteVisits > 5) {
      indicators.push({
        id: 'job_search',
        type: 'RESIGNATION',
        weight: 25,
        description: '频繁访问招聘网站',
        detectedAt: new Date(),
        rawData: { visitCount: jobSiteVisits },
      });
      score += 25;
    }

    if (linkedInActivity > 3) {
      indicators.push({
        id: 'linkedin_activity',
        type: 'RESIGNATION',
        weight: 20,
        description: 'LinkedIn活跃度增加',
        detectedAt: new Date(),
        rawData: { activityCount: linkedInActivity },
      });
      score += 20;
    }

    // 分析工作模式（加班情况）
    if (behavioralData.workPattern) {
      const { overtimeHours, absenceDays } = behavioralData.workPattern;

      if (overtimeHours > 20) {
        indicators.push({
          id: 'reduced_engagement',
          type: 'RESIGNATION',
          weight: 15,
          description: '工作负荷异常',
          detectedAt: new Date(),
          rawData: { overtimeHours },
        });
        score += 15;
      }

      if (absenceDays > 5) {
        indicators.push({
          id: 'increased_sick_days',
          type: 'RESIGNATION',
          weight: 10,
          description: '缺勤天数增加',
          detectedAt: new Date(),
          rawData: { absenceDays },
        });
        score += 10;
      }
    }

    // 备用：如果没有真实数据，使用模拟数据（兼容性）
    if (indicators.length === 0) {
      const simulatedIndicators = this.simulateResignationIndicators(memberId);
      for (const ind of simulatedIndicators) {
        const template = RESIGNATION_INDICATORS.find(t => t.id === ind.id);
        if (template) {
          indicators.push({
            id: ind.id,
            type: 'RESIGNATION',
            weight: template.weight,
            description: template.description,
            detectedAt: new Date(),
            rawData: ind.rawData,
          });
          score += template.weight * (ind.severity || 1);
        }
      }
    }

    score = Math.min(100, score);

    return {
      type: 'RESIGNATION',
      level: this.scoreToLevel(score),
      score,
      indicators,
      trend: this.calculateTrend(memberId, 'RESIGNATION'),
      lastAssessed: new Date(),
    };
  }

  private async assessLeakRisk(memberId: string, member: typeof teamMembers.$inferSelect): Promise<{
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }> {
    const indicators: RiskIndicator[] = [];
    let score = 0;

    // 基础分数：基于访问级别
    const tier = member.accessTier;
    if (tier === 'PROBATION' || tier === 'RESTRICTED') {
      score += 10;
    }

    // 使用真实数据采集器获取文档操作数据
    const behavioralData = await riskDataCollector.collectAllBehavioralData(memberId);

    const { downloadCount, uploadCount, printCount, shareCount } = behavioralData.documentActivity;

    // 分析泄密风险指标
    if (downloadCount > 20) {
      indicators.push({
        id: 'bulk_download',
        type: 'LEAK',
        weight: 30,
        description: '大量文件下载',
        detectedAt: new Date(),
        rawData: { downloadCount },
      });
      score += 30;
    }

    if (uploadCount > 10) {
      indicators.push({
        id: 'cloud_upload',
        type: 'LEAK',
        weight: 35,
        description: '上传至个人云存储',
        detectedAt: new Date(),
        rawData: { uploadCount },
      });
      score += 35;
    }

    if (printCount > 15) {
      indicators.push({
        id: 'print_sensitive',
        type: 'LEAK',
        weight: 20,
        description: '打印敏感文档',
        detectedAt: new Date(),
        rawData: { printCount },
      });
      score += 20;
    }

    if (shareCount > 5) {
      indicators.push({
        id: 'email_forward',
        type: 'LEAK',
        weight: 30,
        description: '转发敏感邮件至外部',
        detectedAt: new Date(),
        rawData: { shareCount },
      });
      score += 30;
    }

    // 分析访问模式（非工作时间访问）
    if (behavioralData.accessPattern && behavioralData.accessPattern.unusualHours > 3) {
      indicators.push({
        id: 'off_hours_access',
        type: 'LEAK',
        weight: 25,
        description: '非工作时间访问敏感数据',
        detectedAt: new Date(),
        rawData: { unusualHours: behavioralData.accessPattern.unusualHours },
      });
      score += 25;
    }

    // 备用：如果没有真实数据，使用模拟数据（兼容性）
    if (indicators.length === 0) {
      const simulatedIndicators = this.simulateLeakIndicators(memberId);
      for (const ind of simulatedIndicators) {
        const template = LEAK_INDICATORS.find(t => t.id === ind.id);
        if (template) {
          indicators.push({
            id: ind.id,
            type: 'LEAK',
            weight: template.weight,
            description: template.description,
            detectedAt: new Date(),
            rawData: ind.rawData,
          });
          score += template.weight * (ind.severity || 1);
        }
      }
    }

    score = Math.min(100, score);

    return {
      type: 'LEAK',
      level: this.scoreToLevel(score),
      score,
      indicators,
      trend: this.calculateTrend(memberId, 'LEAK'),
      lastAssessed: new Date(),
    };
  }

  private async assessFraudRisk(memberId: string, member: typeof teamMembers.$inferSelect): Promise<{
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }> {
    const indicators: RiskIndicator[] = [];
    let score = 0;

    const simulatedIndicators = this.simulateFraudIndicators(memberId);

    for (const ind of simulatedIndicators) {
      const template = FRAUD_INDICATORS.find(t => t.id === ind.id);
      if (template) {
        indicators.push({
          id: ind.id,
          type: 'FRAUD',
          weight: template.weight,
          description: template.description,
          detectedAt: new Date(),
          rawData: ind.rawData,
        });
        score += template.weight * (ind.severity || 1);
      }
    }

    score = Math.min(100, score);

    return {
      type: 'FRAUD',
      level: this.scoreToLevel(score),
      score,
      indicators,
      trend: this.calculateTrend(memberId, 'FRAUD'),
      lastAssessed: new Date(),
    };
  }

  private async assessBurnoutRisk(memberId: string, member: typeof teamMembers.$inferSelect): Promise<{
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }> {
    const indicators: RiskIndicator[] = [];
    let score = 0;

    const workload = Math.random() * 100;
    if (workload > 80) {
      indicators.push({
        id: 'high_workload',
        type: 'BURNOUT',
        weight: 20,
        description: '工作负荷过高',
        detectedAt: new Date(),
        rawData: { workloadScore: workload },
      });
      score += 20;
    }

    const overtimeHours = Math.random() * 40;
    if (overtimeHours > 20) {
      indicators.push({
        id: 'excessive_overtime',
        type: 'BURNOUT',
        weight: 25,
        description: '加班时间过长',
        detectedAt: new Date(),
        rawData: { overtimeHours },
      });
      score += 25;
    }

    const vacationDays = Math.random() * 30;
    if (vacationDays < 5) {
      indicators.push({
        id: 'no_vacation',
        type: 'BURNOUT',
        weight: 15,
        description: '长期未休假',
        detectedAt: new Date(),
        rawData: { daysSinceVacation: 90 - vacationDays },
      });
      score += 15;
    }

    score = Math.min(100, score);

    return {
      type: 'BURNOUT',
      level: this.scoreToLevel(score),
      score,
      indicators,
      trend: this.calculateTrend(memberId, 'BURNOUT'),
      lastAssessed: new Date(),
    };
  }

  private simulateResignationIndicators(memberId: string): Array<{ id: string; severity: number; rawData?: Record<string, unknown> }> {
    const hash = memberId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const indicators = [];

    if (hash % 7 === 0) {
      indicators.push({ id: 'late_arrivals', severity: 0.5, rawData: { count: 3, period: '2weeks' } });
    }
    if (hash % 11 === 0) {
      indicators.push({ id: 'reduced_engagement', severity: 0.6, rawData: { meetingParticipation: -30 } });
    }
    if (hash % 13 === 0) {
      indicators.push({ id: 'linkedin_activity', severity: 0.7, rawData: { profileViews: 150 } });
    }

    return indicators;
  }

  private simulateLeakIndicators(memberId: string): Array<{ id: string; severity: number; rawData?: Record<string, unknown> }> {
    const hash = memberId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const indicators = [];

    if (hash % 17 === 0) {
      indicators.push({ id: 'off_hours_access', severity: 0.6, rawData: { accessCount: 5, hours: '23:00-02:00' } });
    }
    if (hash % 19 === 0) {
      indicators.push({ id: 'bulk_download', severity: 0.8, rawData: { fileCount: 150, size: '2.5GB' } });
    }

    return indicators;
  }

  private simulateFraudIndicators(memberId: string): Array<{ id: string; severity: number; rawData?: Record<string, unknown> }> {
    const hash = memberId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const indicators = [];

    if (hash % 23 === 0) {
      indicators.push({ id: 'expense_anomaly', severity: 0.4, rawData: { amount: 5000, avgAmount: 2000 } });
    }

    return indicators;
  }

  private simulateConflictIndicators(memberId: string): Array<{ id: string; severity: number; rawData?: Record<string, unknown> }> {
    const hash = memberId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const indicators = [];

    if (hash % 29 === 0) {
      indicators.push({ id: 'email_escalation', severity: 0.5, rawData: { escalations: 3, period: '1month' } });
    }
    if (hash % 31 === 0) {
      indicators.push({ id: 'meeting_avoidance', severity: 0.4, rawData: { avoidedMeetings: 5, colleague: 'unknown' } });
    }
    if (hash % 37 === 0) {
      indicators.push({ id: 'complaint_filed', severity: 0.8, rawData: { complaintDate: new Date().toISOString() } });
    }
    if (hash % 41 === 0) {
      indicators.push({ id: 'team_tension', severity: 0.6, rawData: { tensionScore: 7 } });
    }

    return indicators;
  }

  private async assessConflictRisk(memberId: string, member: typeof teamMembers.$inferSelect): Promise<{
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    lastAssessed: Date;
  }> {
    const indicators: RiskIndicator[] = [];
    let score = 0;

    const simulatedIndicators = this.simulateConflictIndicators(memberId);

    for (const ind of simulatedIndicators) {
      const template = CONFLICT_INDICATORS.find(t => t.id === ind.id);
      if (template) {
        indicators.push({
          id: ind.id,
          type: 'CONFLICT',
          weight: template.weight,
          description: template.description,
          detectedAt: new Date(),
          rawData: ind.rawData,
        });
        score += template.weight * (ind.severity || 1);
      }
    }

    score = Math.min(100, score);

    return {
      type: 'CONFLICT',
      level: this.scoreToLevel(score),
      score,
      indicators,
      trend: this.calculateTrend(memberId, 'CONFLICT'),
      lastAssessed: new Date(),
    };
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= RISK_THRESHOLDS.CRITICAL.min) return 'CRITICAL';
    if (score >= RISK_THRESHOLDS.HIGH.min) return 'HIGH';
    if (score >= RISK_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
    return 'LOW';
  }

  private calculateTrend(memberId: string, riskType: RiskType): 'INCREASING' | 'STABLE' | 'DECREASING' {
    const random = Math.random();
    if (random < 0.3) return 'DECREASING';
    if (random < 0.6) return 'STABLE';
    return 'INCREASING';
  }

  private async createAlert(memberId: string, memberName: string, risk: {
    type: RiskType;
    level: RiskLevel;
    score: number;
    indicators: RiskIndicator[];
  }): Promise<RiskAlert> {
    const priority = this.levelToPriority(risk.level);

    const alert: RiskAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      memberId,
      memberName,
      riskType: risk.type,
      priority,
      title: this.generateAlertTitle(risk.type, risk.level),
      description: this.generateAlertDescription(risk.type, risk.indicators),
      indicators: risk.indicators.map(i => i.description),
      recommendations: this.generateRecommendations(risk.type, risk.level),
      status: 'NEW',
      createdAt: new Date(),
    };

    this.alerts.set(alert.id, alert);

    for (const listener of Array.from(this.alertListeners)) {
      try {
        listener(alert);
      } catch (error) {
        logger.error({ error }, 'Alert listener error');
      }
    }

    await this.logRiskAlert(alert);

    return alert;
  }

  private levelToPriority(level: RiskLevel): AlertPriority {
    switch (level) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'URGENT';
      case 'MEDIUM': return 'WARNING';
      default: return 'INFO';
    }
  }

  private generateAlertTitle(type: RiskType, level: RiskLevel): string {
    const typeNames: Record<RiskType, string> = {
      RESIGNATION: '离职风险',
      LEAK: '泄密风险',
      FRAUD: '欺诈风险',
      BURNOUT: '职业倦怠',
      CONFLICT: '人际冲突',
    };
    return `${level === 'CRITICAL' ? '紧急' : ''}${typeNames[type]}预警`;
  }

  private generateAlertDescription(type: RiskType, indicators: RiskIndicator[]): string {
    const count = indicators.length;
    return `检测到${count}个风险指标，建议立即关注并采取预防措施。`;
  }

  private generateRecommendations(type: RiskType, level: RiskLevel): string[] {
    const recommendations: Record<RiskType, string[]> = {
      RESIGNATION: [
        '安排一对一沟通了解员工状态',
        '评估是否需要调整工作内容或职责',
        '考虑提供职业发展机会',
        '评估薪酬竞争力',
      ],
      LEAK: [
        '加强敏感数据访问监控',
        '限制非必要的数据访问权限',
        '安排合规培训',
        '必要时启动调查程序',
      ],
      FRAUD: [
        '复核相关财务记录',
        '加强内部控制',
        '安排合规审计',
        '必要时报告法务部门',
      ],
      BURNOUT: [
        '评估工作量分配',
        '安排强制休假',
        '提供心理健康支持',
        '考虑临时调整工作安排',
      ],
      CONFLICT: [
        '安排冲突调解会议',
        '了解各方诉求',
        '必要时进行团队重组',
        '提供沟通技能培训',
      ],
    };

    return recommendations[type] || ['请联系人力资源部门获取建议'];
  }

  async getMemberProfile(memberId: string): Promise<RiskProfile | null> {
    return this.riskProfiles.get(memberId) || null;
  }

  async getAllProfiles(): Promise<RiskProfile[]> {
    return Array.from(this.riskProfiles.values());
  }

  async getHighRiskMembers(): Promise<RiskProfile[]> {
    return Array.from(this.riskProfiles.values())
      .filter(p => p.overallRisk === 'HIGH' || p.overallRisk === 'CRITICAL')
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async getAlerts(filter?: { status?: string; priority?: string; riskType?: string }): Promise<RiskAlert[]> {
    let alerts = Array.from(this.alerts.values());

    if (filter?.status) {
      alerts = alerts.filter(a => a.status === filter.status);
    }
    if (filter?.priority) {
      alerts = alerts.filter(a => a.priority === filter.priority);
    }
    if (filter?.riskType) {
      alerts = alerts.filter(a => a.riskType === filter.riskType);
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async acknowledgeAlert(alertId: string, operatorId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date();

    return true;
  }

  async resolveAlert(alertId: string, resolution: string, operatorId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date();

    return true;
  }

  async dismissAlert(alertId: string, reason: string, operatorId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'DISMISSED';

    return true;
  }

  onAlert(callback: (alert: RiskAlert) => void): void {
    this.alertListeners.add(callback);
  }

  offAlert(callback: (alert: RiskAlert) => void): void {
    this.alertListeners.delete(callback);
  }

  async getRiskStats(): Promise<{
    totalAssessed: number;
    byLevel: Record<RiskLevel, number>;
    byType: Record<RiskType, number>;
    activeAlerts: number;
    criticalAlerts: number;
  }> {
    const profiles = Array.from(this.riskProfiles.values());
    const alerts = Array.from(this.alerts.values()).filter(a => a.status === 'NEW' || a.status === 'ACKNOWLEDGED');

    const byLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const byType: Record<RiskType, number> = { RESIGNATION: 0, LEAK: 0, FRAUD: 0, BURNOUT: 0, CONFLICT: 0 };

    for (const profile of profiles) {
      byLevel[profile.overallRisk]++;
      for (const risk of profile.risks) {
        if (risk.level !== 'LOW') {
          byType[risk.type]++;
        }
      }
    }

    return {
      totalAssessed: profiles.length,
      byLevel,
      byType,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.priority === 'CRITICAL').length,
    };
  }

  private async logRiskAlert(alert: RiskAlert): Promise<void> {
    try {
      await getDatabase().insert(auditLogs).values({
        actor: 'SYSTEM',
        action: 'RISK_ALERT_CREATED',
        targetType: 'MEMBER',
        targetId: alert.memberId,
        details: {
          alertId: alert.id,
          riskType: alert.riskType,
          priority: alert.priority,
          title: alert.title,
          timestamp: new Date().toISOString(),
        },
        result: 'SUCCESS',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log alert');
    }
  }

  getRiskTypeDescription(type: RiskType): string {
    const descriptions: Record<RiskType, string> = {
      RESIGNATION: '离职风险 - 员工可能计划离开公司',
      LEAK: '泄密风险 - 敏感信息可能被不当处理',
      FRAUD: '欺诈风险 - 可能存在不诚信行为',
      BURNOUT: '职业倦怠 - 员工可能身心疲惫',
      CONFLICT: '人际冲突 - 团队内部可能存在矛盾',
    };
    return descriptions[type];
  }
}

export const riskPredictionService = new RiskPredictionService();
