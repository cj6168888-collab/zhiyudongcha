/**
 * Navigator-X Plan B 预案引擎 (Contingency Engine)
 *
 * 核心功能：
 * 1. 预案库管理
 * 2. 智能匹配预案
 * 3. 毫秒级激活
 * 4. 自我修复追踪
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ContingencyEngine');

import { EventEmitter } from 'events';
import { type AnomalySignal, type AnomalyType } from './anomaly-detector';

// ============ 类型定义 ============

export interface ContingencyPlan {
  id: string;
  name: string;
  description: string;
  triggerTypes: AnomalyType[];
  severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actions: ContingencyAction[];
  successRate: number;
  activatedCount: number;
}

export interface ContingencyAction {
  type: 'TASK_DISPATCH' | 'NOTIFICATION' | 'RESOURCE_REALLOC' | 'WORKLOAD_TRANSFER';
  target?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  description: string;
  autoExecute: boolean;
}

export interface ActivationResult {
  planId: string;
  anomalyId: string;
  executedActions: ContingencyAction[];
  skippedActions: ContingencyAction[];
  startTime: number;
  endTime: number;
  success: boolean;
  selfHealingScore: number;
}

export interface SelfHealingRecord {
  id: string;
  anomaly: AnomalySignal;
  activatedPlan: ContingencyPlan;
  result: ActivationResult;
  timestamp: number;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [ContingencyEngine] ${message}`);
}

// ============ 预案引擎类 ============

class ContingencyEngineService extends EventEmitter {
  private plans: Map<string, ContingencyPlan> = new Map();
  private activationHistory: SelfHealingRecord[] = [];

  constructor() {
    super();
    this.initializeDefaultPlans();
    log('Plan B 预案引擎已初始化');
  }

  /**
   * 初始化默认预案库
   */
  private initializeDefaultPlans(): void {
    // 供应链断裂预案
    this.registerPlan({
      id: 'plan_supply_break',
      name: '供应链备份切换',
      description: '当检测到供应链断裂时，自动切换到备用供应商',
      triggerTypes: ['SUPPLY_BREAK'],
      severityThreshold: 'HIGH',
      actions: [
        {
          type: 'NOTIFICATION',
          description: '通知采购部门启动备用供应商',
          autoExecute: true,
        },
        {
          type: 'TASK_DISPATCH',
          target: 'purchase',
          priority: 'URGENT',
          description: '紧急采购任务',
          autoExecute: true,
        },
        {
          type: 'WORKLOAD_TRANSFER',
          description: '将受影响的订单转移到其他节点',
          autoExecute: true,
        },
      ],
      successRate: 0.85,
      activatedCount: 0,
    });

    // 人员缺席预案
    this.registerPlan({
      id: 'plan_person_absent',
      name: '任务接管',
      description: '当检测到人员缺席时，自动将任务分配给其他成员',
      triggerTypes: ['PERSON_ABSENT'],
      severityThreshold: 'MEDIUM',
      actions: [
        {
          type: 'NOTIFICATION',
          description: '通知团队负责人',
          autoExecute: true,
        },
        {
          type: 'WORKLOAD_TRANSFER',
          description: '将任务转移到其他节点',
          autoExecute: true,
        },
      ],
      successRate: 0.9,
      activatedCount: 0,
    });

    // 进度延迟预案
    this.registerPlan({
      id: 'plan_progress_delay',
      name: '进度追赶',
      description: '当检测到进度延迟时，增加资源或调整计划',
      triggerTypes: ['PROGRESS_DELAY'],
      severityThreshold: 'MEDIUM',
      actions: [
        {
          type: 'RESOURCE_REALLOC',
          description: '增加该节点的算力配额',
          autoExecute: true,
        },
        {
          type: 'TASK_DISPATCH',
          priority: 'HIGH',
          description: '分配额外人员协助',
          autoExecute: false,
        },
      ],
      successRate: 0.75,
      activatedCount: 0,
    });

    // 质量下降预案
    this.registerPlan({
      id: 'plan_quality_drop',
      name: '质量加固',
      description: '当检测到质量下降时，增加审核环节',
      triggerTypes: ['QUALITY_DROP'],
      severityThreshold: 'MEDIUM',
      actions: [
        {
          type: 'NOTIFICATION',
          description: '通知质量管理部门',
          autoExecute: true,
        },
        {
          type: 'TASK_DISPATCH',
          priority: 'HIGH',
          description: '安排专项质量审核',
          autoExecute: true,
        },
      ],
      successRate: 0.8,
      activatedCount: 0,
    });

    // 士气低落预案
    this.registerPlan({
      id: 'plan_morale_low',
      name: '团队关怀',
      description: '当检测到团队士气低落时，触发关怀机制',
      triggerTypes: ['MORALE_LOW'],
      severityThreshold: 'LOW',
      actions: [
        {
          type: 'NOTIFICATION',
          description: '向领导发送关怀提醒',
          autoExecute: false,
        },
      ],
      successRate: 0.6,
      activatedCount: 0,
    });

    log(`已加载 ${this.plans.size} 个默认预案`);
  }

  /**
   * 注册新预案
   */
  registerPlan(plan: ContingencyPlan): void {
    this.plans.set(plan.id, plan);
    log(`预案已注册: ${plan.name}`);
  }

  /**
   * 获取预案
   */
  getPlan(planId: string): ContingencyPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * 获取所有预案
   */
  getAllPlans(): ContingencyPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * 智能匹配预案
   */
  matchPlan(anomaly: AnomalySignal): ContingencyPlan | null {
    const severityOrder = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3 };

    const matchedPlans = Array.from(this.plans.values())
      .filter(plan => plan.triggerTypes.includes(anomaly.type))
      .filter(plan => severityOrder[plan.severityThreshold] <= severityOrder[anomaly.severity])
      .sort((a, b) => {
        // 优先选择触发次数最少、成功率最高的
        if (a.activatedCount !== b.activatedCount) {
          return a.activatedCount - b.activatedCount;
        }
        return b.successRate - a.successRate;
      });

    if (matchedPlans.length > 0) {
      log(`匹配到预案: ${matchedPlans[0].name}`);
      return matchedPlans[0];
    }

    log(`未找到匹配的预案: ${anomaly.type}`);
    return null;
  }

  /**
   * 激活预案
   */
  async activate(plan: ContingencyPlan, anomaly: AnomalySignal): Promise<ActivationResult> {
    const startTime = Date.now();
    log(`🚀 激活预案: ${plan.name}`);

    const executedActions: ContingencyAction[] = [];
    const skippedActions: ContingencyAction[] = [];

    for (const action of plan.actions) {
      if (action.autoExecute) {
        try {
          await this.executeAction(action, anomaly);
          executedActions.push(action);
          log(`✅ 执行动作: ${action.description}`);
        } catch (error) {
          log(`❌ 执行失败: ${action.description} - ${error}`);
          skippedActions.push(action);
        }
      } else {
        skippedActions.push(action);
        log(`⏭️ 跳过（需手动）: ${action.description}`);
      }
    }

    const endTime = Date.now();
    const selfHealingScore = executedActions.length / plan.actions.length;

    const result: ActivationResult = {
      planId: plan.id,
      anomalyId: anomaly.id,
      executedActions,
      skippedActions,
      startTime,
      endTime,
      success: executedActions.length > 0,
      selfHealingScore,
    };

    // 更新预案激活次数
    plan.activatedCount++;

    // 记录自我修复历史
    const record: SelfHealingRecord = {
      id: `heal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      anomaly,
      activatedPlan: plan,
      result,
      timestamp: Date.now(),
    };
    this.activationHistory.push(record);

    // 限制历史记录数量
    if (this.activationHistory.length > 100) {
      this.activationHistory = this.activationHistory.slice(-50);
    }

    this.emit('plan_activated', record);
    log(`📊 自我修复完成，自愈分数: ${(selfHealingScore * 100).toFixed(1)}%`);

    return result;
  }

  /**
   * 执行动作
   */
  private async executeAction(action: ContingencyAction, anomaly: AnomalySignal): Promise<void> {
    switch (action.type) {
      case 'NOTIFICATION':
        logger.info(`📢 通知: ${action.description}`);
        break;

      case 'TASK_DISPATCH':
        logger.info(`📋 任务分派: ${action.description} -> ${action.target || '自动选择'}`);
        break;

      case 'RESOURCE_REALLOC':
        logger.info(`⚡ 资源重分配: ${action.description}`);
        break;

      case 'WORKLOAD_TRANSFER':
        logger.info(`🔄 工作负载转移: ${action.description}`);
        break;
    }

    // 模拟执行延迟
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * 追踪自我修复历史
   */
  trackSelfHealing(limit: number = 20): SelfHealingRecord[] {
    return this.activationHistory.slice(-limit);
  }

  /**
   * 获取自我修复统计
   */
  getSelfHealingStats(): {
    totalActivations: number;
    successRate: number;
    avgSelfHealingScore: number;
    topPlans: { planId: string; name: string; activatedCount: number }[];
  } {
    const total = this.activationHistory.length;
    const successCount = this.activationHistory.filter(r => r.result.success).length;
    const avgScore = total > 0
      ? this.activationHistory.reduce((sum, r) => sum + r.result.selfHealingScore, 0) / total
      : 0;

    const planCounts = new Map<string, { name: string; count: number }>();
    this.activationHistory.forEach(r => {
      const existing = planCounts.get(r.planId);
      planCounts.set(r.planId, {
        name: r.activatedPlan.name,
        count: (existing?.count || 0) + 1,
      });
    });

    const topPlans = Array.from(planCounts.entries())
      .map(([planId, data]) => ({ planId, name: data.name, activatedCount: data.count }))
      .sort((a, b) => b.activatedCount - a.activatedCount)
      .slice(0, 5);

    return {
      totalActivations: total,
      successRate: total > 0 ? successCount / total : 0,
      avgSelfHealingScore: avgScore,
      topPlans,
    };
  }
}

// 导出单例
export const contingencyEngine = new ContingencyEngineService();
logger.info('[ContingencyEngine] Plan B 预案引擎已加载 (Navigator-X)');
