/**
 * 小智 Action Power Orchestrator - 感知-决策-执行闭环调度器
 * Project "Action Power" (执行力协议)
 * 
 * 实现从"想到"到"做到"的完整自动化闭环
 * 协调感知层、决策层、执行层的无缝配合
 * 
 * 核心职责:
 * 1. 接收感知层信号 (视觉、语音、生理、位置等)
 * 2. 调用决策层生成行动方案
 * 3. 通过阈值系统评估风险
 * 4. 分发到执行层 (设备控制、通讯、文档等)
 * 5. 发送触觉反馈通知用户
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { actionThreshold, type ActionProposal, type ExecutionDecision, type ActionDomain, type RiskCategory } from './action-threshold';
import { hapticCodes, type HapticCodeType } from './haptic-codes';

export type PerceptionType = 
  | 'VISUAL'      // 视觉感知 (屏幕内容、AR识别)
  | 'AUDIO'       // 听觉感知 (语音、环境音)
  | 'BIOMETRIC'   // 生理感知 (心率、压力等)
  | 'LOCATION'    // 位置感知
  | 'CONTEXT'     // 上下文感知 (日历、联系人等)
  | 'DOCUMENT'    // 文档感知 (合同、邮件等)
  | 'COMMUNICATION'; // 通讯感知 (消息、通话等)

export interface PerceptionSignal {
  id: string;
  type: PerceptionType;
  source: string;
  data: Record<string, any>;
  confidence: number;
  timestamp: Date;
  requiresAction: boolean;
}

export interface ActionScenario {
  id: string;
  name: string;
  description: string;
  triggers: PerceptionType[];
  conditions: ScenarioCondition[];
  actions: ScenarioAction[];
  enabled: boolean;
  priority: number;
}

export interface ScenarioCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
  value: any;
}

export interface ScenarioAction {
  type: 'EXECUTE' | 'NOTIFY' | 'HAPTIC' | 'DISPLAY' | 'SCHEDULE' | 'DOCUMENT';
  target: string;
  params: Record<string, any>;
  delay?: number;
}

export interface OrchestrationResult {
  signalId: string;
  scenariosMatched: string[];
  actionsProposed: ActionProposal[];
  decisions: ExecutionDecision[];
  hapticsSent: string[];
  executionSummary: string;
}

const BUILTIN_SCENARIOS: ActionScenario[] = [
  {
    id: 'negotiation_price_check',
    name: '商务谈判价格监控',
    description: '识别出对方报价高于市场价时自动提示',
    triggers: ['AUDIO', 'DOCUMENT'],
    conditions: [
      { field: 'priceDeviation', operator: 'gt', value: 0.1 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'PRICE_HIGH', params: { context: '报价高于市场价' } },
      { type: 'DISPLAY', target: 'GLASSES', params: { message: '建议压价，对方报价偏高' } },
      { type: 'EXECUTE', target: 'search_evidence', params: { query: '同类合同价格' } },
    ],
    enabled: true,
    priority: 90,
  },
  {
    id: 'contract_compliance_check',
    name: '合同合规审查',
    description: '发现合同条款含糊时自动改写',
    triggers: ['DOCUMENT'],
    conditions: [
      { field: 'clauseType', operator: 'eq', value: 'liability' },
      { field: 'clarityScore', operator: 'lt', value: 0.6 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'CAUTION', params: { context: '合同条款需要审查' } },
      { type: 'EXECUTE', target: 'rewrite_clause', params: { favorDirection: 'SELF' } },
      { type: 'NOTIFY', target: 'MASTER', params: { message: '已重写违约责任条款' } },
    ],
    enabled: true,
    priority: 95,
  },
  {
    id: 'health_stress_intervention',
    name: '健康压力干预',
    description: '检测到心率过快时自动推迟会议并订咖啡',
    triggers: ['BIOMETRIC'],
    conditions: [
      { field: 'heartRate', operator: 'gt', value: 100 },
      { field: 'duration', operator: 'gt', value: 300 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'HEALTH_ALERT', params: { context: '检测到高压状态' } },
      { type: 'SCHEDULE', target: 'postpone_non_urgent', params: { delayMinutes: 30 } },
      { type: 'EXECUTE', target: 'order_coffee', params: { type: 'decaf', delay: 600 } },
      { type: 'DISPLAY', target: 'PHONE', params: { message: '已为您推迟会议，放松一下' } },
    ],
    enabled: true,
    priority: 85,
  },
  {
    id: 'lie_detection_alert',
    name: '谎言检测警报',
    description: '通过语音分析检测对方可能在撒谎',
    triggers: ['AUDIO'],
    conditions: [
      { field: 'lieScore', operator: 'gt', value: 0.7 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'LIE_DETECTED', params: { context: '对方陈述可疑' } },
      { type: 'DISPLAY', target: 'GLASSES', params: { message: '⚠️ 谨慎对待此陈述' } },
    ],
    enabled: true,
    priority: 88,
  },
  {
    id: 'opportunity_detection',
    name: '机会识别提醒',
    description: '识别到有利时机时提醒推进',
    triggers: ['CONTEXT', 'COMMUNICATION'],
    conditions: [
      { field: 'opportunityScore', operator: 'gt', value: 0.75 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'OPPORTUNITY', params: { context: '有利时机出现' } },
      { type: 'DISPLAY', target: 'GLASSES', params: { message: '可以推进' } },
    ],
    enabled: true,
    priority: 80,
  },
  {
    id: 'meeting_time_management',
    name: '会议时间管理',
    description: '会议即将结束时发送提醒',
    triggers: ['CONTEXT'],
    conditions: [
      { field: 'meetingTimeRemaining', operator: 'lte', value: 300 },
    ],
    actions: [
      { type: 'HAPTIC', target: 'MEETING_END', params: { context: '会议还剩5分钟' } },
    ],
    enabled: true,
    priority: 70,
  },
];

class ActionOrchestratorService {
  private scenarios: ActionScenario[] = [...BUILTIN_SCENARIOS];
  private signalQueue: PerceptionSignal[] = [];
  private processingLock: boolean = false;
  private orchestrationHistory: OrchestrationResult[] = [];
  
  async processSignal(signal: PerceptionSignal): Promise<OrchestrationResult> {
    console.log(`[Orchestrator] 收到感知信号: ${signal.type} from ${signal.source}`);
    
    const matchedScenarios = this.matchScenarios(signal);
    
    if (matchedScenarios.length === 0) {
      return {
        signalId: signal.id,
        scenariosMatched: [],
        actionsProposed: [],
        decisions: [],
        hapticsSent: [],
        executionSummary: '无匹配场景',
      };
    }
    
    matchedScenarios.sort((a, b) => b.priority - a.priority);
    
    const result: OrchestrationResult = {
      signalId: signal.id,
      scenariosMatched: matchedScenarios.map(s => s.id),
      actionsProposed: [],
      decisions: [],
      hapticsSent: [],
      executionSummary: '',
    };
    
    for (const scenario of matchedScenarios) {
      await this.executeScenario(scenario, signal, result);
    }
    
    result.executionSummary = this.generateSummary(result);
    this.orchestrationHistory.push(result);
    
    if (this.orchestrationHistory.length > 100) {
      this.orchestrationHistory = this.orchestrationHistory.slice(-100);
    }
    
    return result;
  }
  
  private matchScenarios(signal: PerceptionSignal): ActionScenario[] {
    return this.scenarios.filter(scenario => {
      if (!scenario.enabled) return false;
      if (!scenario.triggers.includes(signal.type)) return false;
      
      return scenario.conditions.every(condition => 
        this.evaluateCondition(condition, signal.data)
      );
    });
  }
  
  private evaluateCondition(condition: ScenarioCondition, data: Record<string, any>): boolean {
    const value = this.getNestedValue(data, condition.field);
    if (value === undefined) return false;
    
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'matches': return new RegExp(condition.value).test(String(value));
      default: return false;
    }
  }
  
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  private async executeScenario(
    scenario: ActionScenario,
    signal: PerceptionSignal,
    result: OrchestrationResult
  ): Promise<void> {
    console.log(`[Orchestrator] 执行场景: ${scenario.name}`);
    
    for (const action of scenario.actions) {
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }
      
      try {
        switch (action.type) {
          case 'HAPTIC':
            const hapticMessage = await hapticCodes.sendHapticSignal({
              code: action.target as HapticCodeType,
              context: action.params.context || scenario.name,
              priority: 'HIGH',
            });
            result.hapticsSent.push(hapticMessage.id);
            break;
            
          case 'EXECUTE':
            const proposal = actionThreshold.createProposal({
              action: action.target,
              description: `${scenario.name}: ${action.params.description || action.target}`,
              domain: this.inferDomain(action.target),
              context: { ...signal.data, ...action.params },
            });
            result.actionsProposed.push(proposal);
            
            const decision = await actionThreshold.evaluateAction(proposal);
            result.decisions.push(decision);
            break;
            
          case 'NOTIFY':
            console.log(`[Orchestrator] 通知 ${action.target}: ${action.params.message}`);
            break;
            
          case 'DISPLAY':
            console.log(`[Orchestrator] 显示到 ${action.target}: ${action.params.message}`);
            break;
            
          case 'SCHEDULE':
            console.log(`[Orchestrator] 日程操作: ${action.target}`);
            break;
            
          case 'DOCUMENT':
            console.log(`[Orchestrator] 文档操作: ${action.target}`);
            break;
        }
      } catch (error) {
        console.error(`[Orchestrator] 执行动作失败:`, error);
      }
    }
  }
  
  private inferDomain(action: string): ActionDomain {
    const domainMap: Record<string, ActionDomain> = {
      search: 'DEVICE_CONTROL',
      send: 'COMMUNICATION',
      rewrite: 'DOCUMENT',
      postpone: 'SCHEDULE',
      order: 'PAYMENT',
      sign: 'CONTRACT',
      health: 'HEALTH_INTERVENTION',
    };
    
    for (const [keyword, domain] of Object.entries(domainMap)) {
      if (action.toLowerCase().includes(keyword)) {
        return domain;
      }
    }
    
    return 'DEVICE_CONTROL';
  }
  
  private generateSummary(result: OrchestrationResult): string {
    const parts: string[] = [];
    
    if (result.scenariosMatched.length > 0) {
      parts.push(`匹配${result.scenariosMatched.length}个场景`);
    }
    
    if (result.hapticsSent.length > 0) {
      parts.push(`发送${result.hapticsSent.length}个触觉信号`);
    }
    
    const autoExecuted = result.decisions.filter(d => d.level === 'AUTO' && d.approved).length;
    const pendingConfirm = result.decisions.filter(d => d.level === 'CONFIRM').length;
    const shadowPlans = result.decisions.filter(d => d.level === 'SHADOW').length;
    
    if (autoExecuted > 0) parts.push(`自动执行${autoExecuted}个`);
    if (pendingConfirm > 0) parts.push(`待确认${pendingConfirm}个`);
    if (shadowPlans > 0) parts.push(`影子方案${shadowPlans}个`);
    
    return parts.join('，') || '无操作';
  }
  
  addScenario(scenario: ActionScenario): void {
    const existing = this.scenarios.findIndex(s => s.id === scenario.id);
    if (existing >= 0) {
      this.scenarios[existing] = scenario;
    } else {
      this.scenarios.push(scenario);
    }
    console.log(`[Orchestrator] 场景已添加/更新: ${scenario.name}`);
  }
  
  removeScenario(scenarioId: string): boolean {
    const index = this.scenarios.findIndex(s => s.id === scenarioId);
    if (index >= 0) {
      this.scenarios.splice(index, 1);
      return true;
    }
    return false;
  }
  
  toggleScenario(scenarioId: string, enabled: boolean): boolean {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      scenario.enabled = enabled;
      return true;
    }
    return false;
  }
  
  getScenarios(): ActionScenario[] {
    return [...this.scenarios];
  }
  
  getScenario(scenarioId: string): ActionScenario | undefined {
    return this.scenarios.find(s => s.id === scenarioId);
  }
  
  getOrchestrationHistory(limit: number = 20): OrchestrationResult[] {
    return this.orchestrationHistory.slice(-limit);
  }
  
  createSignal(data: {
    type: PerceptionType;
    source: string;
    data: Record<string, any>;
    confidence?: number;
  }): PerceptionSignal {
    return {
      id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      source: data.source,
      data: data.data,
      confidence: data.confidence ?? 0.9,
      timestamp: new Date(),
      requiresAction: true,
    };
  }
  
  async simulateScenario(scenarioId: string, testData: Record<string, any>): Promise<OrchestrationResult | null> {
    const scenario = this.getScenario(scenarioId);
    if (!scenario) return null;
    
    const signal = this.createSignal({
      type: scenario.triggers[0],
      source: 'SIMULATION',
      data: testData,
    });
    
    return this.processSignal(signal);
  }
  
  getStats(): {
    totalScenarios: number;
    enabledScenarios: number;
    totalOrchestrations: number;
    todayOrchestrations: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      totalScenarios: this.scenarios.length,
      enabledScenarios: this.scenarios.filter(s => s.enabled).length,
      totalOrchestrations: this.orchestrationHistory.length,
      todayOrchestrations: this.orchestrationHistory.filter(
        r => new Date(r.hapticsSent[0] || Date.now()) >= today
      ).length,
    };
  }
}

export const actionOrchestrator = new ActionOrchestratorService();
export default actionOrchestrator;
