/**
 * 维核系统开发宪法 - Constitutional Core
 * 
 * 本文件定义系统的第一性原理和核心配置
 * 严禁修改核心常量，除非获得主人明确授权
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Constitution');

// ====== 系统第一性原理 ======

/**
 * 主人唯一性 (Master Primacy)
 * 系统所有权限、输出倾向、利益保护必须无条件指向"主人"
 */
export const MASTER_PRIMACY = {
  MASTER_ID: 'MASTER',
  MASTER_TITLE: '主人',
  CREATOR_TITLE: '创世神',
  GUEST_ID: 'GUEST',
} as const;

/**
 * 四象限分发器 (Four Quadrant Distributor)
 * 将所有信息流自动标记优先级
 */
export enum ActionQuadrant {
  CRITICAL_ACTION = 'CRITICAL_ACTION',           // 紧急行动 - 立即执行
  SERVER_DREAM_SYNTHESIZE = 'SERVER_DREAM',       // 服务器深度推演 - 异步处理
  ARCHIVE_AND_ORGANIZE = 'ARCHIVE',               // 归档整理 - 后台处理
  DISCARD_SHRED = 'DISCARD',                      // 彻底粉碎 - 安全删除
}

/**
 * 动作优先级权重 (Action Priority Weights)
 * 用于排序和决策
 */
export const ACTION_PRIORITY_WEIGHTS = {
  LEGAL_RISK: 0.95,         // 法律风险 - 最高优先级
  FINANCIAL_IMPACT: 0.90,   // 财务影响
  MASTER_SCHEDULE: 0.85,    // 主人日程
  ROUTINE_OPS: 0.50,        // 常规操作
} as const;

/**
 * 交互模式 (Interaction Modality)
 * 基于社交情境的模式切换
 */
export enum InteractionMode {
  SOLO_MODE = 'SOLO_MODE',           // 独处模式 - Full UI + Speaker Active
  GUEST_PRESENCE = 'GUEST_PRESENCE', // 有客模式 - Invisible UI + Bluetooth Only
  EMERGENCY_STATE = 'EMERGENCY',     // 紧急状态 - Wipe + Stealth
}

export interface InteractionModality {
  mode: InteractionMode;
  uiVisible: boolean;
  audioOutput: 'speaker' | 'bluetooth' | 'silent';
  hapticEnabled: boolean;
  stealthOverlay: boolean;
}

export const INTERACTION_CONFIGS: Record<InteractionMode, InteractionModality> = {
  [InteractionMode.SOLO_MODE]: {
    mode: InteractionMode.SOLO_MODE,
    uiVisible: true,
    audioOutput: 'speaker',
    hapticEnabled: false,
    stealthOverlay: false,
  },
  [InteractionMode.GUEST_PRESENCE]: {
    mode: InteractionMode.GUEST_PRESENCE,
    uiVisible: false,
    audioOutput: 'bluetooth',
    hapticEnabled: true,
    stealthOverlay: false,
  },
  [InteractionMode.EMERGENCY_STATE]: {
    mode: InteractionMode.EMERGENCY_STATE,
    uiVisible: false,
    audioOutput: 'silent',
    hapticEnabled: false,
    stealthOverlay: true,
  },
};

/**
 * 执行策略降级 (Execution Strategy Fallback)
 * API失败时的降级路径
 */
export enum ExecutionStrategy {
  API_CALL = 'API_CALL',                           // 优先：API调用
  UI_AUTOMATION = 'UI_AUTOMATION_ACCESSIBILITY',   // 次选：无障碍服务UI自动化
  VISUAL_OCR = 'VISUAL_OCR_COORDINATE_CLICK',      // 最终：视觉OCR+坐标点击
}

export const EXECUTION_FALLBACK_ORDER: ExecutionStrategy[] = [
  ExecutionStrategy.API_CALL,
  ExecutionStrategy.UI_AUTOMATION,
  ExecutionStrategy.VISUAL_OCR,
];

// ====== 输入分类器 ======

/**
 * 根据输入内容判断四象限分类
 */
export function classifyInputQuadrant(input: string, context?: {
  hasUrgentKeyword?: boolean;
  isFromMaster?: boolean;
  legalRisk?: number;
  financialImpact?: number;
}): ActionQuadrant {
  const lowerInput = input.toLowerCase();
  
  // 紧急行动关键词
  const urgentKeywords = [
    '紧急', '立即', '马上', '现在', '赶紧', '危险', '警告', 
    'urgent', 'immediately', 'now', 'asap', 'critical'
  ];
  
  // 深度分析关键词
  const analysisKeywords = [
    '分析', '研究', '预测', '推演', '策略', '博弈', '对手',
    'analyze', 'research', 'predict', 'strategy'
  ];
  
  // 归档整理关键词
  const archiveKeywords = [
    '保存', '记录', '归档', '整理', '备份', '存档',
    'save', 'record', 'archive', 'backup'
  ];
  
  // 删除/销毁关键词
  const discardKeywords = [
    '删除', '销毁', '粉碎', '清除', '移除', '抹掉',
    'delete', 'destroy', 'shred', 'remove', 'wipe'
  ];
  
  // 检查法律/财务风险
  if (context?.legalRisk && context.legalRisk >= ACTION_PRIORITY_WEIGHTS.LEGAL_RISK) {
    return ActionQuadrant.CRITICAL_ACTION;
  }
  
  if (context?.financialImpact && context.financialImpact >= ACTION_PRIORITY_WEIGHTS.FINANCIAL_IMPACT) {
    return ActionQuadrant.CRITICAL_ACTION;
  }
  
  // 关键词匹配
  if (urgentKeywords.some(k => lowerInput.includes(k))) {
    return ActionQuadrant.CRITICAL_ACTION;
  }
  
  if (discardKeywords.some(k => lowerInput.includes(k))) {
    return ActionQuadrant.DISCARD_SHRED;
  }
  
  if (analysisKeywords.some(k => lowerInput.includes(k))) {
    return ActionQuadrant.SERVER_DREAM_SYNTHESIZE;
  }
  
  if (archiveKeywords.some(k => lowerInput.includes(k))) {
    return ActionQuadrant.ARCHIVE_AND_ORGANIZE;
  }
  
  // 默认归档
  return ActionQuadrant.ARCHIVE_AND_ORGANIZE;
}

/**
 * 计算动作优先级分数
 */
export function calculatePriorityScore(input: string, context?: {
  isLegal?: boolean;
  isFinancial?: boolean;
  isMasterSchedule?: boolean;
}): number {
  let score: number = 0.50; // ROUTINE_OPS
  
  const legalKeywords = ['合同', '法律', '诉讼', '侵权', '违约', 'legal', 'contract', 'lawsuit'];
  const financialKeywords = ['财务', '账款', '投资', '支付', '金额', 'finance', 'payment', 'invest'];
  const scheduleKeywords = ['日程', '会议', '约会', '预约', 'schedule', 'meeting', 'appointment'];
  
  const lowerInput = input.toLowerCase();
  
  if (context?.isLegal || legalKeywords.some(k => lowerInput.includes(k))) {
    score = Math.max(score, ACTION_PRIORITY_WEIGHTS.LEGAL_RISK);
  }
  
  if (context?.isFinancial || financialKeywords.some(k => lowerInput.includes(k))) {
    score = Math.max(score, ACTION_PRIORITY_WEIGHTS.FINANCIAL_IMPACT);
  }
  
  if (context?.isMasterSchedule || scheduleKeywords.some(k => lowerInput.includes(k))) {
    score = Math.max(score, ACTION_PRIORITY_WEIGHTS.MASTER_SCHEDULE);
  }
  
  return score;
}

// ====== 主人利益守护 ======

/**
 * 检查是否损害主人利益
 * 开发者警告：严禁任何形式的中立建议
 */
export function checkMasterInterestViolation(action: string, outcome?: string): {
  isViolation: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresAlert: boolean;
} {
  // 损害主人利益的关键词
  const violationKeywords = [
    '损失', '亏损', '泄露', '风险', '危害', '不利',
    'loss', 'leak', 'risk', 'harm', 'disadvantage'
  ];
  
  const combinedText = `${action} ${outcome || ''}`.toLowerCase();
  
  const hasViolation = violationKeywords.some(k => combinedText.includes(k));
  
  if (!hasViolation) {
    return { isViolation: false, severity: 'LOW', requiresAlert: false };
  }
  
  // 判断严重程度
  const criticalKeywords = ['重大损失', '严重泄露', '致命', 'critical', 'fatal'];
  const highKeywords = ['大额', '重要', '机密', 'major', 'confidential'];
  
  if (criticalKeywords.some(k => combinedText.includes(k))) {
    return { isViolation: true, severity: 'CRITICAL', requiresAlert: true };
  }
  
  if (highKeywords.some(k => combinedText.includes(k))) {
    return { isViolation: true, severity: 'HIGH', requiresAlert: true };
  }
  
  return { isViolation: true, severity: 'MEDIUM', requiresAlert: false };
}

// ====== 感知即执行检查 ======

/**
 * 确保输入有对应的执行器
 * 严禁生成无后续动作的纯文字分析
 */
export interface ExecutionBinding {
  hasExecutor: boolean;
  executorType: 'action' | 'query' | 'archive' | 'alert' | 'none';
  fallbackExecutor?: string;
}

export function ensureExecutionBinding(
  action: string,
  quadrant: ActionQuadrant
): ExecutionBinding {
  // 每个象限都必须有对应的执行器
  const quadrantExecutors: Record<ActionQuadrant, ExecutionBinding['executorType']> = {
    [ActionQuadrant.CRITICAL_ACTION]: 'action',
    [ActionQuadrant.SERVER_DREAM_SYNTHESIZE]: 'query',
    [ActionQuadrant.ARCHIVE_AND_ORGANIZE]: 'archive',
    [ActionQuadrant.DISCARD_SHRED]: 'action',
  };
  
  const executorType = quadrantExecutors[quadrant];
  
  return {
    hasExecutor: executorType !== 'none',
    executorType,
    fallbackExecutor: executorType === 'none' ? 'default_archive' : undefined,
  };
}

// ====== 紧急动作执行器 ======

/**
 * 紧急动作意图解析结果
 */
export interface CriticalActionIntent {
  actionType: 'create_task' | 'send_alert' | 'schedule' | 'notify' | 'execute_command' | 'unknown';
  target?: string;
  urgencyLevel: 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
  suggestedTool?: string;
  parameters?: Record<string, any>;
}

/**
 * 解析紧急动作意图
 * 感知即执行：将紧急消息转化为可执行动作
 */
export function parseCriticalActionIntent(input: string): CriticalActionIntent {
  const lowerInput = input.toLowerCase();
  
  // 创建任务/项目关键词
  const createKeywords = ['创建', '新建', '添加', '建立', 'create', 'add', 'new'];
  // 提醒/通知关键词
  const alertKeywords = ['提醒', '通知', '告诉', '警告', 'remind', 'notify', 'alert', 'tell'];
  // 日程关键词
  const scheduleKeywords = ['安排', '预约', '预定', '日程', 'schedule', 'book', 'arrange'];
  // 执行命令关键词
  const executeKeywords = ['执行', '运行', '启动', '发送', 'execute', 'run', 'start', 'send'];
  
  let actionType: CriticalActionIntent['actionType'] = 'unknown';
  let suggestedTool: string | undefined;
  
  if (createKeywords.some(k => lowerInput.includes(k))) {
    actionType = 'create_task';
    suggestedTool = 'create_project';
  } else if (alertKeywords.some(k => lowerInput.includes(k))) {
    actionType = 'send_alert';
    suggestedTool = 'send_notification';
  } else if (scheduleKeywords.some(k => lowerInput.includes(k))) {
    actionType = 'schedule';
    suggestedTool = 'create_schedule';
  } else if (executeKeywords.some(k => lowerInput.includes(k))) {
    actionType = 'execute_command';
    suggestedTool = 'execute_action';
  }
  
  // 判断紧急程度
  const immediateKeywords = ['立即', '马上', '现在', '赶紧', 'immediately', 'now', 'asap'];
  const highKeywords = ['紧急', '重要', '优先', 'urgent', 'important', 'priority'];
  
  let urgencyLevel: CriticalActionIntent['urgencyLevel'] = 'MEDIUM';
  if (immediateKeywords.some(k => lowerInput.includes(k))) {
    urgencyLevel = 'IMMEDIATE';
  } else if (highKeywords.some(k => lowerInput.includes(k))) {
    urgencyLevel = 'HIGH';
  }
  
  return {
    actionType,
    urgencyLevel,
    suggestedTool,
    parameters: { originalInput: input },
  };
}

/**
 * 生成执行结果响应
 * 感知即执行：返回动作结果而非纯文字分析
 */
export function generateExecutionResponse(
  intent: CriticalActionIntent,
  executionResult: { success: boolean; result?: string; error?: string }
): string {
  const urgencyPrefix = intent.urgencyLevel === 'IMMEDIATE' ? '⚡ ' : 
                        intent.urgencyLevel === 'HIGH' ? '🔴 ' : '';
  
  if (executionResult.success) {
    return `${urgencyPrefix}已执行：${executionResult.result || '动作完成'}`;
  } else {
    return `${urgencyPrefix}执行中遇到问题：${executionResult.error || '未知错误'}，正在尝试降级方案...`;
  }
}

logger.info('维核系统开发宪法已加载');
