/**
 * 小智 Action Threshold Service - 三级执行阈值系统
 * Project "Action Power" (执行力协议)
 * 
 * 执行等级:
 * Level 1 (AUTO): 自动执行 - 低风险、高确定性任务
 * Level 2 (CONFIRM): 确认执行 - 中风险任务，需要用户确认
 * Level 3 (SHADOW): 影子执行 - 高风险，后台生成方案等待审阅
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { auditLogs } from '@shared/schema';

export type ExecutionLevel = 'AUTO' | 'CONFIRM' | 'SHADOW';
export type RiskCategory = 'FINANCIAL' | 'LEGAL' | 'SOCIAL' | 'HEALTH' | 'PRIVACY' | 'OPERATIONAL';
export type ActionDomain = 'DEVICE_CONTROL' | 'COMMUNICATION' | 'DOCUMENT' | 'SCHEDULE' | 'PAYMENT' | 'CONTRACT' | 'HEALTH_INTERVENTION';

export interface ActionProposal {
  id: string;
  domain: ActionDomain;
  action: string;
  description: string;
  riskCategories: RiskCategory[];
  riskScore: number;
  confidence: number;
  reversible: boolean;
  estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context: Record<string, any>;
  createdAt: Date;
}

export interface ExecutionDecision {
  proposalId: string;
  level: ExecutionLevel;
  approved: boolean;
  reason: string;
  conditions?: string[];
  alternativeActions?: ActionProposal[];
  expiresAt?: Date;
}

export interface ShadowPlan {
  id: string;
  proposalId: string;
  options: ActionProposal[];
  recommendation: number;
  analysis: string;
  dreamReviewRequired: boolean;
  createdAt: Date;
  reviewedAt?: Date;
  selectedOption?: number;
}

const RISK_WEIGHTS: Record<RiskCategory, number> = {
  FINANCIAL: 0.9,
  LEGAL: 0.95,
  SOCIAL: 0.6,
  HEALTH: 0.85,
  PRIVACY: 0.8,
  OPERATIONAL: 0.4,
};

const DOMAIN_BASE_RISK: Record<ActionDomain, number> = {
  DEVICE_CONTROL: 20,
  COMMUNICATION: 40,
  DOCUMENT: 30,
  SCHEDULE: 15,
  PAYMENT: 85,
  CONTRACT: 90,
  HEALTH_INTERVENTION: 70,
};

const AUTO_ACTIONS: Set<string> = new Set([
  'organize_notes',
  'mark_calendar_conflict',
  'log_health_data',
  'summarize_meeting',
  'archive_document',
  'set_reminder',
  'translate_text',
  'display_notification',
  'update_hud',
  'log_location',
]);

const CONFIRM_PATTERNS: RegExp[] = [
  /send.*email/i,
  /reply.*message/i,
  /schedule.*meeting/i,
  /cancel.*appointment/i,
  /share.*document/i,
  /post.*social/i,
  /call.*contact/i,
];

const SHADOW_PATTERNS: RegExp[] = [
  /sign.*contract/i,
  /transfer.*money/i,
  /delete.*permanent/i,
  /legal.*response/i,
  /terminate.*relationship/i,
  /negotiate.*deal/i,
  /submit.*official/i,
];

// ===== Critical Points (借鉴Fara-7B设计) =====
// 在这些敏感操作前，系统必须暂停并请求用户确认
export interface CriticalPoint {
  id: string;
  type: CriticalPointType;
  description: string;
  severity: 'WARNING' | 'DANGER' | 'CRITICAL';
  requiresExplicitApproval: boolean;
  timeout?: number;  // 超时自动取消(秒)
  context: Record<string, any>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: 'APPROVED' | 'REJECTED' | 'TIMEOUT' | 'MODIFIED';
}

export type CriticalPointType = 
  | 'PAYMENT'           // 支付/转账
  | 'EMAIL_SEND'        // 发送邮件
  | 'MESSAGE_SEND'      // 发送消息(微信/短信等)
  | 'FILE_DELETE'       // 删除文件
  | 'ACCOUNT_ACTION'    // 账户操作(登录/登出/修改密码)
  | 'FORM_SUBMIT'       // 表单提交
  | 'PURCHASE'          // 购买操作
  | 'BOOKING'           // 预订操作
  | 'SUBSCRIPTION'      // 订阅操作
  | 'DATA_EXPORT'       // 数据导出
  | 'PRIVACY_SHARE'     // 隐私数据分享
  | 'IRREVERSIBLE';     // 其他不可逆操作

// Critical Point检测模式 - 屏幕元素关键词
const CRITICAL_POINT_PATTERNS: Record<CriticalPointType, RegExp[]> = {
  PAYMENT: [
    /支付|付款|转账|汇款|充值/i,
    /pay|payment|transfer|checkout/i,
    /确认支付|立即支付|去支付/i,
    /¥|￥|\$|USD|CNY/i,
  ],
  EMAIL_SEND: [
    /发送邮件|send.*email|发送.*mail/i,
    /发送|send|submit/i,
  ],
  MESSAGE_SEND: [
    /发送消息|send.*message/i,
    /发送.*微信|发送.*短信/i,
    /发送|send/i,
  ],
  FILE_DELETE: [
    /删除|delete|remove|清空/i,
    /永久删除|彻底删除|不可恢复/i,
  ],
  ACCOUNT_ACTION: [
    /登录|登出|注销|logout|login/i,
    /修改密码|change.*password/i,
    /注销账户|delete.*account/i,
  ],
  FORM_SUBMIT: [
    /提交|submit|确认提交/i,
    /提交申请|提交订单/i,
  ],
  PURCHASE: [
    /购买|下单|立即购买|加入购物车/i,
    /buy|purchase|order|add.*cart/i,
  ],
  BOOKING: [
    /预订|预约|book|reserve/i,
    /确认预订|立即预约/i,
  ],
  SUBSCRIPTION: [
    /订阅|subscribe|开通.*会员/i,
    /自动续费|续订/i,
  ],
  DATA_EXPORT: [
    /导出|export|下载.*数据/i,
    /备份|backup/i,
  ],
  PRIVACY_SHARE: [
    /分享.*位置|share.*location/i,
    /授权|authorize|allow.*access/i,
    /获取.*权限|request.*permission/i,
  ],
  IRREVERSIBLE: [
    /不可撤销|irreversible|无法恢复/i,
    /永久|permanent/i,
  ],
};

class ActionThresholdService {
  private pendingConfirmations: Map<string, ActionProposal> = new Map();
  private shadowPlans: Map<string, ShadowPlan> = new Map();
  private executionHistory: ActionProposal[] = [];
  
  calculateRiskScore(proposal: ActionProposal): number {
    let baseRisk = DOMAIN_BASE_RISK[proposal.domain] || 50;
    
    let categoryMultiplier = 1;
    for (const category of proposal.riskCategories) {
      categoryMultiplier *= RISK_WEIGHTS[category] || 0.5;
    }
    
    const reversibilityFactor = proposal.reversible ? 0.7 : 1.3;
    const confidenceFactor = 1 - (proposal.confidence * 0.3);
    
    const impactMultiplier = {
      LOW: 0.5,
      MEDIUM: 1.0,
      HIGH: 1.5,
      CRITICAL: 2.0,
    }[proposal.estimatedImpact];
    
    const finalScore = Math.min(100, Math.max(0,
      baseRisk * categoryMultiplier * reversibilityFactor * confidenceFactor * impactMultiplier
    ));
    
    return Math.round(finalScore);
  }
  
  determineExecutionLevel(proposal: ActionProposal): ExecutionLevel {
    if (AUTO_ACTIONS.has(proposal.action)) {
      return 'AUTO';
    }
    
    for (const pattern of SHADOW_PATTERNS) {
      if (pattern.test(proposal.action) || pattern.test(proposal.description)) {
        return 'SHADOW';
      }
    }
    
    for (const pattern of CONFIRM_PATTERNS) {
      if (pattern.test(proposal.action) || pattern.test(proposal.description)) {
        return 'CONFIRM';
      }
    }
    
    const riskScore = this.calculateRiskScore(proposal);
    
    if (riskScore < 25) return 'AUTO';
    if (riskScore < 60) return 'CONFIRM';
    return 'SHADOW';
  }
  
  async evaluateAction(proposal: ActionProposal): Promise<ExecutionDecision> {
    proposal.riskScore = this.calculateRiskScore(proposal);
    const level = this.determineExecutionLevel(proposal);
    
    const decision: ExecutionDecision = {
      proposalId: proposal.id,
      level,
      approved: level === 'AUTO',
      reason: this.generateDecisionReason(proposal, level),
    };
    
    if (level === 'AUTO') {
      this.executionHistory.push(proposal);
      await this.logAction(proposal, 'AUTO_EXECUTED');
    } else if (level === 'CONFIRM') {
      this.pendingConfirmations.set(proposal.id, proposal);
      decision.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    } else {
      const shadowPlan = await this.generateShadowPlan(proposal);
      this.shadowPlans.set(shadowPlan.id, shadowPlan);
      decision.alternativeActions = shadowPlan.options;
    }
    
    return decision;
  }
  
  private generateDecisionReason(proposal: ActionProposal, level: ExecutionLevel): string {
    const riskScore = proposal.riskScore;
    
    switch (level) {
      case 'AUTO':
        return `低风险操作 (风险分: ${riskScore}/100)，已自动执行`;
      case 'CONFIRM':
        return `中等风险操作 (风险分: ${riskScore}/100)，需要您确认后执行`;
      case 'SHADOW':
        return `高风险操作 (风险分: ${riskScore}/100)，已生成多个方案供您在"梦境"中审阅`;
    }
  }
  
  async generateShadowPlan(proposal: ActionProposal): Promise<ShadowPlan> {
    const options: ActionProposal[] = [];
    
    options.push({
      ...proposal,
      id: `${proposal.id}_opt1`,
      description: `保守方案: ${proposal.description}`,
      estimatedImpact: 'MEDIUM',
    });
    
    options.push({
      ...proposal,
      id: `${proposal.id}_opt2`,
      description: `激进方案: ${proposal.description} (加速执行)`,
      estimatedImpact: 'HIGH',
    });
    
    options.push({
      ...proposal,
      id: `${proposal.id}_opt3`,
      description: `观望方案: 暂不行动，持续监控`,
      estimatedImpact: 'LOW',
    });
    
    const plan: ShadowPlan = {
      id: `shadow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      proposalId: proposal.id,
      options,
      recommendation: 0,
      analysis: this.generateAnalysis(proposal),
      dreamReviewRequired: true,
      createdAt: new Date(),
    };
    
    return plan;
  }
  
  private generateAnalysis(proposal: ActionProposal): string {
    const risks = proposal.riskCategories.join('、');
    return `此操作涉及${risks}风险。建议在充分评估后决策。
风险评分: ${proposal.riskScore}/100
可逆性: ${proposal.reversible ? '可撤销' : '不可撤销'}
影响程度: ${proposal.estimatedImpact}`;
  }
  
  async confirmAction(proposalId: string, approved: boolean, selectedOption?: number): Promise<{ success: boolean; message: string }> {
    const pending = this.pendingConfirmations.get(proposalId);
    if (pending) {
      this.pendingConfirmations.delete(proposalId);
      if (approved) {
        this.executionHistory.push(pending);
        await this.logAction(pending, 'CONFIRMED_EXECUTED');
        return { success: true, message: '操作已确认执行' };
      }
      await this.logAction(pending, 'REJECTED');
      return { success: true, message: '操作已取消' };
    }
    
    for (const [planId, plan] of Array.from(this.shadowPlans.entries())) {
      if (plan.proposalId === proposalId) {
        plan.reviewedAt = new Date();
        plan.selectedOption = selectedOption;
        
        if (approved && selectedOption !== undefined) {
          const selectedPlan = plan.options[selectedOption];
          if (selectedPlan) {
            this.executionHistory.push(selectedPlan);
            await this.logAction(selectedPlan, 'SHADOW_APPROVED');
            return { success: true, message: `方案${selectedOption + 1}已批准执行` };
          }
        }
        await this.logAction(plan.options[0], 'SHADOW_REJECTED');
        return { success: true, message: '所有方案已拒绝' };
      }
    }
    
    return { success: false, message: '未找到待处理的操作' };
  }
  
  getPendingConfirmations(): ActionProposal[] {
    return Array.from(this.pendingConfirmations.values());
  }
  
  getShadowPlans(): ShadowPlan[] {
    return Array.from(this.shadowPlans.values()).filter(p => !p.reviewedAt);
  }
  
  getExecutionHistory(limit: number = 50): ActionProposal[] {
    return this.executionHistory.slice(-limit);
  }
  
  private async logAction(proposal: ActionProposal, outcome: string): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        action: `ACTION_THRESHOLD:${proposal.action}`,
        actor: 'SYSTEM',
        targetType: 'ACTION_PROPOSAL',
        targetId: proposal.id,
        details: {
          domain: proposal.domain,
          riskScore: proposal.riskScore,
          outcome,
          description: proposal.description,
        },
        result: outcome,
      });
    } catch (error) {
      console.error('[ActionThreshold] 日志记录失败:', error);
    }
  }
  
  createProposal(data: {
    action: string;
    description: string;
    domain: ActionDomain;
    riskCategories?: RiskCategory[];
    confidence?: number;
    reversible?: boolean;
    estimatedImpact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    context?: Record<string, any>;
  }): ActionProposal {
    return {
      id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      domain: data.domain,
      action: data.action,
      description: data.description,
      riskCategories: data.riskCategories || ['OPERATIONAL'],
      riskScore: 0,
      confidence: data.confidence ?? 0.8,
      reversible: data.reversible ?? true,
      estimatedImpact: data.estimatedImpact || 'MEDIUM',
      context: data.context || {},
      createdAt: new Date(),
    };
  }
  
  getStats(): {
    pendingConfirmations: number;
    shadowPlans: number;
    executedToday: number;
    autoExecuted: number;
    confirmedExecuted: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayExecutions = this.executionHistory.filter(
      p => p.createdAt >= today
    );
    
    return {
      pendingConfirmations: this.pendingConfirmations.size,
      shadowPlans: this.getShadowPlans().length,
      executedToday: todayExecutions.length,
      autoExecuted: todayExecutions.filter(p => AUTO_ACTIONS.has(p.action)).length,
      confirmedExecuted: todayExecutions.filter(p => !AUTO_ACTIONS.has(p.action)).length,
    };
  }
  
  // ===== Critical Points 系统 (借鉴Fara-7B) =====
  private pendingCriticalPoints: Map<string, CriticalPoint> = new Map();
  private criticalPointHistory: CriticalPoint[] = [];
  
  detectCriticalPoint(
    screenText: string,
    buttonLabel?: string,
    context?: Record<string, any>
  ): CriticalPoint | null {
    const textToCheck = `${screenText} ${buttonLabel || ''}`.toLowerCase();
    
    for (const [type, patterns] of Object.entries(CRITICAL_POINT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(textToCheck)) {
          const severity = this.determineCriticalSeverity(type as CriticalPointType);
          const criticalPoint: CriticalPoint = {
            id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type as CriticalPointType,
            description: this.generateCriticalDescription(type as CriticalPointType, buttonLabel),
            severity,
            requiresExplicitApproval: severity === 'CRITICAL' || severity === 'DANGER',
            timeout: severity === 'CRITICAL' ? 60 : 120,
            context: { screenText, buttonLabel, ...context },
            detectedAt: new Date(),
          };
          
          this.pendingCriticalPoints.set(criticalPoint.id, criticalPoint);
          console.log(`[CriticalPoint] 检测到关键操作: ${type} - ${criticalPoint.description}`);
          return criticalPoint;
        }
      }
    }
    
    return null;
  }
  
  private determineCriticalSeverity(type: CriticalPointType): 'WARNING' | 'DANGER' | 'CRITICAL' {
    const criticalTypes: CriticalPointType[] = ['PAYMENT', 'FILE_DELETE', 'IRREVERSIBLE', 'ACCOUNT_ACTION'];
    const dangerTypes: CriticalPointType[] = ['PURCHASE', 'SUBSCRIPTION', 'EMAIL_SEND', 'PRIVACY_SHARE'];
    
    if (criticalTypes.includes(type)) return 'CRITICAL';
    if (dangerTypes.includes(type)) return 'DANGER';
    return 'WARNING';
  }
  
  private generateCriticalDescription(type: CriticalPointType, buttonLabel?: string): string {
    const descriptions: Record<CriticalPointType, string> = {
      PAYMENT: '检测到支付操作，需要您确认',
      EMAIL_SEND: '准备发送邮件，请确认内容无误',
      MESSAGE_SEND: '准备发送消息，请确认',
      FILE_DELETE: '检测到删除操作，此操作可能不可恢复',
      ACCOUNT_ACTION: '检测到账户操作，请谨慎确认',
      FORM_SUBMIT: '准备提交表单，请确认信息正确',
      PURCHASE: '检测到购买操作，请确认订单',
      BOOKING: '准备进行预订操作，请确认',
      SUBSCRIPTION: '检测到订阅操作，可能产生定期费用',
      DATA_EXPORT: '准备导出数据，请确认',
      PRIVACY_SHARE: '检测到隐私授权请求，请谨慎',
      IRREVERSIBLE: '此操作不可撤销，请三思',
    };
    
    let desc = descriptions[type] || '检测到敏感操作';
    if (buttonLabel) {
      desc += ` (按钮: "${buttonLabel}")`;
    }
    return desc;
  }
  
  async resolveCriticalPoint(
    id: string,
    resolution: 'APPROVED' | 'REJECTED' | 'MODIFIED',
    modifiedAction?: string
  ): Promise<{ success: boolean; message: string }> {
    const cp = this.pendingCriticalPoints.get(id);
    if (!cp) {
      return { success: false, message: '未找到该关键点' };
    }
    
    cp.resolution = resolution;
    cp.resolvedAt = new Date();
    
    this.pendingCriticalPoints.delete(id);
    this.criticalPointHistory.push(cp);
    
    await this.logCriticalPoint(cp);
    
    const messages: Record<string, string> = {
      APPROVED: '操作已批准，继续执行',
      REJECTED: '操作已拒绝，已停止执行',
      MODIFIED: `操作已修改: ${modifiedAction || ''}`,
    };
    
    return { success: true, message: messages[resolution] };
  }
  
  private async logCriticalPoint(cp: CriticalPoint): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        action: `CRITICAL_POINT:${cp.type}`,
        actor: 'USER',
        targetType: 'CRITICAL_POINT',
        targetId: cp.id,
        details: {
          type: cp.type,
          severity: cp.severity,
          resolution: cp.resolution,
          description: cp.description,
          durationMs: cp.resolvedAt ? cp.resolvedAt.getTime() - cp.detectedAt.getTime() : null,
        },
        result: cp.resolution || 'PENDING',
      });
    } catch (error) {
      console.error('[CriticalPoint] 日志记录失败:', error);
    }
  }
  
  getPendingCriticalPoints(): CriticalPoint[] {
    const now = Date.now();
    const points: CriticalPoint[] = [];
    const entries = Array.from(this.pendingCriticalPoints.entries());
    
    for (const [id, cp] of entries) {
      if (cp.timeout && (now - cp.detectedAt.getTime()) > cp.timeout * 1000) {
        cp.resolution = 'TIMEOUT';
        cp.resolvedAt = new Date();
        this.pendingCriticalPoints.delete(id);
        this.criticalPointHistory.push(cp);
        console.log(`[CriticalPoint] 超时自动取消: ${cp.id}`);
      } else {
        points.push(cp);
      }
    }
    
    return points;
  }
  
  getCriticalPointHistory(limit: number = 50): CriticalPoint[] {
    return this.criticalPointHistory.slice(-limit);
  }
  
  getCriticalPointStats(): {
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    timeoutToday: number;
    byType: Record<string, number>;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayHistory = this.criticalPointHistory.filter(
      cp => cp.detectedAt >= today
    );
    
    const byType: Record<string, number> = {};
    for (const cp of todayHistory) {
      byType[cp.type] = (byType[cp.type] || 0) + 1;
    }
    
    return {
      pending: this.pendingCriticalPoints.size,
      approvedToday: todayHistory.filter(cp => cp.resolution === 'APPROVED').length,
      rejectedToday: todayHistory.filter(cp => cp.resolution === 'REJECTED').length,
      timeoutToday: todayHistory.filter(cp => cp.resolution === 'TIMEOUT').length,
      byType,
    };
  }
}

export const actionThreshold = new ActionThresholdService();
export default actionThreshold;
