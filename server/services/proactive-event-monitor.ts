/**
 * 主动事件监控与影响分析服务
 * Proactive Event Monitoring & Impact Analysis Service
 *
 * 功能：
 * 1. 事件监控 - 从政策库、行业资讯等来源获取最新事件
 * 2. 影响分析 - 分析事件对用户的影响程度
 * 3. 解决方案生成 - 自动生成应对方案
 * 4. 主动提醒 - 及时推送给用户
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ProactiveEventMonitor');

import { policyHarvester } from './policy-harvester';
import { knowledgeScheduler } from './knowledge-scheduler';

export type EventType = 'POLICY' | 'LEGAL' | 'EMERGENCY' | 'TAX' | 'LABOR' | 'INDUSTRY' | 'MARKET';
export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EventInfo {
  id?: string;
  eventType: EventType;
  title: string;
  summary: string;
  content: string;
  source: string;
  sourceUrl?: string;
  publishDate: Date;
  effectiveDate?: Date;
  category: string;
  tags: string[];
}

export interface UserPreferences {
  userId: string;
  interestedCategories: string[];
  interestedEventTypes: EventType[];
  followedIndustries: string[];
  followedCompanies: string[];
  notifyEnabled: boolean;
  notifyTypes: string[];
  minImpactLevel: ImpactLevel;
  activeHoursStart: string;
  activeHoursEnd: string;
}

export interface ImpactAnalysisResult {
  relevance: number;
  impactScore: number;
  urgencyScore: number;
  affectedAreas: string[];
  impactDescription: string;
}

export interface SolutionGenerationResult {
  solution: string;
  actionItems: Array<{
    title: string;
    deadline?: Date;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface AlertResult {
  eventId: string;
  userId: string;
  title: string;
  message: string;
  solution: string;
  impactLevel: ImpactLevel;
  affectedAreas: string[];
  generatedAt: Date;
}

class ProactiveEventMonitor {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  private userPreferences: Map<string, UserPreferences> = new Map();
  private alerts: AlertResult[] = [];
  private processedEvents: Set<string> = new Set();

  constructor() {
    logger.info('[ProactiveEventMonitor] 主动事件监控服务已创建');
  }

  /**
   * 启动监控服务
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('[ProactiveEventMonitor] 监控服务已在运行');
      return;
    }

    this.isRunning = true;

    this.checkInterval = setInterval(() => {
      this.checkAndProcessEvents().catch(err => {
        logger.error({ err }, '事件检查失败');
      });
    }, 60 * 60 * 1000);

    this.checkAndProcessEvents().catch(err => {
      logger.error({ err }, '初始事件检查失败');
    });

    logger.info('[ProactiveEventMonitor] 主动事件监控服务已启动');
  }

  /**
   * 停止监控服务
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('[ProactiveEventMonitor] 主动事件监控服务已停止');
  }

  /**
   * 设置用户偏好
   */
  setUserPreferences(prefs: UserPreferences): void {
    this.userPreferences.set(prefs.userId, prefs);
    logger.info({ userId: prefs.userId }, '用户偏好已设置');
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences(userId: string): UserPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  /**
   * 获取用户的所有提醒
   */
  getUserAlerts(userId: string): AlertResult[] {
    return this.alerts.filter(a => a.userId === userId);
  }

  /**
   * 获取未读提醒数量
   */
  getUnreadAlertCount(userId: string): number {
    return this.alerts.filter(a => a.userId === userId && !(a as Record<string, unknown>).isRead).length;
  }

  /**
   * 标记提醒为已读
   */
  markAsRead(alertId: string, userId: string): void {
    const alert = this.alerts.find(a => a.eventId === alertId && a.userId === userId);
    if (alert) {
      (alert as Record<string, unknown>).isRead = true;
    }
  }

  /**
   * 忽略提醒
   */
  dismissAlert(alertId: string, userId: string): void {
    const index = this.alerts.findIndex(a => a.eventId === alertId && a.userId === userId);
    if (index !== -1) {
      this.alerts.splice(index, 1);
    }
  }

  /**
   * 清除所有提醒
   */
  clearAlerts(userId: string): void {
    this.alerts = this.alerts.filter(a => a.userId !== userId);
  }

  /**
   * 检查并处理事件
   */
  async checkAndProcessEvents(): Promise<void> {
    logger.info('[ProactiveEventMonitor] 开始检查新事件');

    try {
      const policies = await this.fetchLatestPolicies();
      const users = Array.from(this.userPreferences.values());

      for (const user of users) {
        if (!user.notifyEnabled) continue;

        await this.processEventsForUser(policies, user);
      }

      logger.info({ policyCount: policies.length, userCount: users.length }, '事件检查完成');

    } catch (error) {
      logger.error({ err: error }, '事件检查处理失败');
    }
  }

  /**
   * 获取最新政策
   */
  private async fetchLatestPolicies(): Promise<EventInfo[]> {
    const events: EventInfo[] = [];

    try {
      await policyHarvester.syncAll();
    } catch (error) {
      logger.error({ err: error }, '政策同步失败');
    }

    return events;
  }

  /**
   * 为单个用户处理事件
   */
  private async processEventsForUser(
    events: EventInfo[],
    userPrefs: UserPreferences
  ): Promise<void> {
    const userId = userPrefs.userId;

    if (!this.isWithinActiveHours(userPrefs)) {
      return;
    }

    for (const event of events) {
      const eventKey = `${event.title}-${userId}`;
      if (this.processedEvents.has(eventKey)) {
        continue;
      }

      if (!this.isUserInterested(event, userPrefs)) {
        continue;
      }

      const impact = await this.analyzeImpact(event, userPrefs);

      const minImpact = this.getImpactLevelScore(userPrefs.minImpactLevel);
      if (impact.impactScore < minImpact) {
        continue;
      }

      const solution = await this.generateSolution(event, impact);
      const alert = this.generateAlert(event, impact, solution, userId);

      this.alerts.push(alert);
      this.processedEvents.add(eventKey);

      logger.info({ userId, event: event.title, impactScore: impact.impactScore }, '已生成事件提醒');
    }
  }

  /**
   * 检查是否在活跃时间内
   */
  private isWithinActiveHours(prefs: UserPreferences): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const start = prefs.activeHoursStart || '09:00';
    const end = prefs.activeHoursEnd || '22:00';

    return currentTime >= start && currentTime <= end;
  }

  /**
   * 检查用户是否对此事件感兴趣
   */
  private isUserInterested(event: EventInfo, userPrefs: UserPreferences): boolean {
    const interestedTypes = userPrefs.interestedEventTypes || [];
    const interestedCategories = userPrefs.interestedCategories || [];
    const followedIndustries = userPrefs.followedIndustries || [];

    if (interestedTypes.length > 0 && !interestedTypes.includes(event.eventType)) {
      return false;
    }

    if (interestedCategories.length > 0) {
      const hasMatch = interestedCategories.some(cat =>
        event.category.includes(cat) || event.tags.includes(cat)
      );
      if (!hasMatch) return false;
    }

    if (followedIndustries.length > 0) {
      const hasMatch = followedIndustries.some(ind =>
        event.content.includes(ind) || event.tags.includes(ind)
      );
      if (!hasMatch) return false;
    }

    return true;
  }

  /**
   * 分析事件对用户的影响
   */
  async analyzeImpact(event: EventInfo, userPrefs: UserPreferences): Promise<ImpactAnalysisResult> {
    let relevance = 50;
    let impactScore = 50;
    let urgencyScore = 30;
    const affectedAreas: string[] = [];
    let impactDescription = '';

    switch (event.eventType) {
      case 'POLICY':
        relevance = 70;
        impactScore = 60;
        affectedAreas.push('政策合规', '企业经营');
        impactDescription = '政策变化可能影响企业运营和合规要求';
        break;
      case 'LEGAL':
        relevance = 80;
        impactScore = 75;
        affectedAreas.push('法律合规', '风险管理');
        impactDescription = '法律法规变化需要及时调整业务';
        break;
      case 'TAX':
        relevance = 85;
        impactScore = 80;
        affectedAreas.push('财务管理', '税务合规');
        impactDescription = '税务政策直接影响企业成本';
        break;
      case 'LABOR':
        relevance = 75;
        impactScore = 70;
        affectedAreas.push('人力资源', '劳动合规');
        impactDescription = '劳动法规变化影响员工管理';
        break;
      case 'EMERGENCY':
        relevance = 90;
        impactScore = 90;
        urgencyScore = 95;
        affectedAreas.push('业务连续性', '风险管理');
        impactDescription = '突发事件需要立即关注和应对';
        break;
    }

    const userCategories = userPrefs.interestedCategories || [];
    const userIndustries = userPrefs.followedIndustries || [];

    for (const cat of userCategories) {
      if (event.category.includes(cat) || event.tags.includes(cat)) {
        relevance += 20;
        impactScore += 15;
      }
    }

    for (const ind of userIndustries) {
      if (event.content.includes(ind) || event.tags.includes(ind)) {
        relevance += 25;
        impactScore += 20;
        affectedAreas.push(ind);
      }
    }

    if (event.effectiveDate) {
      const daysUntilEffective = Math.ceil(
        (event.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilEffective <= 7) {
        urgencyScore = Math.min(100, urgencyScore + 40);
      } else if (daysUntilEffective <= 30) {
        urgencyScore = Math.min(100, urgencyScore + 20);
      }
    }

    relevance = Math.min(100, Math.max(0, relevance));
    impactScore = Math.min(100, Math.max(0, impactScore));
    urgencyScore = Math.min(100, Math.max(0, urgencyScore));

    return {
      relevance,
      impactScore,
      urgencyScore,
      affectedAreas,
      impactDescription,
    };
  }

  /**
   * 生成解决方案
   */
  async generateSolution(
    event: EventInfo,
    impact: ImpactAnalysisResult
  ): Promise<SolutionGenerationResult> {
    const actionItems: SolutionGenerationResult['actionItems'] = [];
    let solution = '';

    switch (event.eventType) {
      case 'TAX':
        solution = '税务政策变化需要及时了解并调整税务筹划。建议：\n1. 关注政策细节和适用条件\n2. 咨询专业税务顾问\n3. 评估对企业税负的影响\n4. 及时调整申报策略';
        actionItems.push(
          { title: '详细阅读政策文件', priority: 'HIGH' },
          { title: '联系税务顾问评估影响', priority: 'HIGH' },
          { title: '调整税务筹划方案', priority: 'MEDIUM' }
        );
        break;

      case 'LEGAL':
      case 'POLICY':
        solution = '法规政策变化需要及时合规。建议：\n1. 分析政策对企业的影响\n2. 评估现有业务流程\n3. 调整合规策略\n4. 更新内部管理制度';
        actionItems.push(
          { title: '分析政策影响范围', priority: 'HIGH' },
          { title: '评估业务流程合规性', priority: 'HIGH' },
          { title: '更新管理制度', priority: 'MEDIUM' }
        );
        break;

      case 'LABOR':
        solution = '劳动法规变化影响人力资源管理。建议：\n1. 审查现有劳动合同\n2. 评估用工成本变化\n3. 调整员工福利方案\n4. 更新员工手册';
        actionItems.push(
          { title: '审查劳动合同条款', priority: 'HIGH' },
          { title: '评估用工成本', priority: 'MEDIUM' },
          { title: '更新员工手册', priority: 'LOW' }
        );
        break;

      case 'EMERGENCY':
        solution = '突发事件需要快速响应。建议：\n1. 评估事件影响程度\n2. 启动应急预案\n3. 及时与相关方沟通\n4. 跟进事件发展';
        actionItems.push(
          { title: '立即评估影响', priority: 'CRITICAL' },
          { title: '启动应急响应', priority: 'CRITICAL' },
          { title: '通知相关方', priority: 'HIGH' },
          { title: '持续跟进', priority: 'HIGH' }
        );
        break;

      default:
        solution = '建议关注事件发展，评估对业务的影响并适时调整策略。';
        actionItems.push({ title: '关注事件发展', priority: 'MEDIUM' });
    }

    if (event.effectiveDate) {
      for (const item of actionItems) {
        if (!item.deadline) {
          item.deadline = new Date(event.effectiveDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      }
    }

    return { solution, actionItems };
  }

  /**
   * 生成提醒
   */
  private generateAlert(
    event: EventInfo,
    impact: ImpactAnalysisResult,
    solution: SolutionGenerationResult,
    userId: string
  ): AlertResult {
    const title = `【${this.getEventTypeName(event.eventType)}】${event.title}`;

    let message = event.summary || event.content.slice(0, 200);
    if (message.length >= 200) message += '...';

    if (impact.urgencyScore >= 80) {
      message = `⚠️ 紧急提醒：${message}`;
    }

    return {
      eventId: `${event.title}-${Date.now()}`,
      userId,
      title,
      message,
      solution: solution.solution,
      impactLevel: this.getImpactLevelFromScore(impact.impactScore),
      affectedAreas: impact.affectedAreas,
      generatedAt: new Date(),
    };
  }

  /**
   * 获取事件类型名称
   */
  private getEventTypeName(type: EventType): string {
    const names: Record<EventType, string> = {
      'POLICY': '政策',
      'LEGAL': '法律',
      'EMERGENCY': '突发',
      'TAX': '税务',
      'LABOR': '劳动',
      'INDUSTRY': '行业',
      'MARKET': '市场',
    };
    return names[type] || '资讯';
  }

  /**
   * 根据分数获取影响级别
   */
  private getImpactLevelFromScore(score: number): ImpactLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 获取影响级别分数
   */
  private getImpactLevelScore(level: ImpactLevel): number {
    const scores: Record<ImpactLevel, number> = {
      'LOW': 20,
      'MEDIUM': 40,
      'HIGH': 60,
      'CRITICAL': 80,
    };
    return scores[level] || 40;
  }

  /**
   * 手动触发事件检查
   */
  async triggerManualCheck(): Promise<void> {
    await this.checkAndProcessEvents();
  }

  /**
   * 获取服务状态
   */
  getStatus(): { isRunning: boolean; userCount: number; alertCount: number } {
    return {
      isRunning: this.isRunning,
      userCount: this.userPreferences.size,
      alertCount: this.alerts.length,
    };
  }
}

export const proactiveEventMonitor = new ProactiveEventMonitor();
export default proactiveEventMonitor;
