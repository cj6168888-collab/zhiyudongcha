/**
 * SmartAssistant - 极简智能助手核心
 *
 * 设计理念：
 * - 扁平化：没有层层路由，只有一个消息入口
 * - 智能化：AI 理解一切，自主决策
 * - 原则驱动：底层有价值观指导行动
 * - 极简界面：对话即界面
 *
 * @version 3.0.0 - 重构版
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('SmartAssistant');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

// ============ 核心类型 ============

/**
 * 用户消息
 */
export interface UserMessage {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  source: 'app' | 'wechat' | 'phone' | 'watch' | 'other';
  timestamp: Date;
  context?: MessageContext;
}

/**
 * 消息上下文
 */
export interface MessageContext {
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  time?: Date;
  recentMessages?: UserMessage[];
  userState?: {
    isDriving?: boolean;
    isInMeeting?: boolean;
    batteryLevel?: number;
  };
}

/**
 * 小星的原则（系统级）
 */
export const XIAO_XING_PRINCIPLES = {
  // 核心原则
  core: [
    "永远把主人的利益放在第一位",
    "不偷懒，主动发现问题并解决",
    "不说谎，有问题及时告知",
    "保护主人的隐私和安全",
    "尊重主人的最终决策权",
  ],

  // 行动原则
  actions: [
    "能自己做的不打扰主人",
    "不确定的主动确认",
    "敏感操作必须授权",
    "重要信息主动汇报",
    "遇到困难及时求助主人",
  ],

  // 敏感操作类型
  sensitiveActions: [
    'payment',      // 支付/转账
    'appointment',  // 重要邀约/日程
    'personal_info', // 泄露个人信息
    'deletion',     // 删除重要数据
    'commitment',   // 做出承诺
    'disclosure',   // 透露位置/行踪
  ],

  // 授权阈值
  authorization: {
    payment: { minAmount: 100 },  // 超过100元需要授权
    commitment: { requiresConfirm: true },
    personalInfo: { requiresConfirm: true },
  }
};

/**
 * 小星的响应
 */
export interface XiaoXingResponse {
  id: string;

  // 响应类型
  type: 'execute' | 'confirm' | 'discuss' | 'question' | 'report' | 'greeting';

  // 消息内容
  message: string;

  // 如果需要授权
  authorization?: {
    required: boolean;
    reason: string;
    action: ActionPlan;
    options: AuthorizationOption[];
  };

  // 如果要执行
  execution?: {
    plan: ActionPlan;
    progress?: number;
    result?: unknown;
  };

  // 如果是讨论
  discussion?: {
    perspective: string;
    suggestions: string[];
    concerns?: string[];
  };

  // 卡片（可选的UI展示）
  cards?: ResponseCard[];

  // 后续行动
  followUp?: {
    type: 'reminder' | 'check' | 'report';
    time?: Date;
    message: string;
  };
}

/**
 * 行动规划
 */
export interface ActionPlan {
  id: string;
  summary: string;
  steps: ActionStep[];
  estimatedTime?: number;
  requiresAuth: boolean;
  reason?: string;
}

export interface ActionStep {
  id: string;
  type: 'calendar' | 'notify' | 'search' | 'book' | 'navigate' | 'call' | 'execute' | 'delegate';
  title: string;
  description: string;
  tool: string;
  params: Record<string, unknown>;
  autoExecute: boolean;
}

/**
 * 授权选项
 */
export interface AuthorizationOption {
  id: string;
  label: string;
  action: 'approve' | 'deny' | 'modify' | 'discuss';
  nextMessage?: string;
}

/**
 * 响应卡片
 */
export interface ResponseCard {
  id: string;
  type: 'calendar' | 'map' | 'list' | 'form' | 'confirm';
  title: string;
  content: unknown;
  actions?: {
    label: string;
    type: 'button' | 'link';
    action: string;
  }[];
}

// ============ 核心类 ============

class SmartAssistant {
  private static instance: SmartAssistant | null = null;

  private aiProvider: AIProviderChain;

  // 小星的"工具箱" - 所有可用能力
  private capabilities: Map<string, Capability> = new Map();

  // 当前对话上下文
  private conversationContext: Map<string, ConversationTurn[]> = new Map();

  private constructor() {
    this.aiProvider = new AIProviderChain();
    this.initializeCapabilities();
  }

  public static getInstance(): SmartAssistant {
    if (!SmartAssistant.instance) {
      SmartAssistant.instance = new SmartAssistant();
    }
    return SmartAssistant.instance;
  }

  /**
   * 初始化能力注册
   */
  private initializeCapabilities(): void {
    // 注册所有能力 - 但这些只是"工具"，不是路由
    // AI 会根据情况选择使用哪些工具

    this.registerCapability({
      name: 'calendar',
      description: '日历管理',
      actions: ['create', 'read', 'update', 'delete', 'remind'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'navigation',
      description: '导航服务',
      actions: ['route', 'navigate', 'location'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'booking',
      description: '预订服务',
      actions: ['restaurant', 'hotel', 'ticket', 'taxi'],
      requiresAuth: ['payment'],
    });

    this.registerCapability({
      name: 'search',
      description: '搜索查询',
      actions: ['web', 'document', 'contact'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'notification',
      description: '消息通知',
      actions: ['push', 'sms', 'email'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'browser',
      description: '浏览器自动化',
      actions: ['navigate', 'fill', 'submit', 'extract'],
      requiresAuth: ['personal_data'],
    });

    this.registerCapability({
      name: 'meeting',
      description: '会议管理',
      actions: ['create', 'invite', 'minutes'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'document',
      description: '文档处理',
      actions: ['create', 'read', 'share'],
      autoAuth: true,
    });

    this.registerCapability({
      name: 'recommendation',
      description: '智能推荐',
      actions: ['restaurant', 'hotel', 'route', 'gift'],
      autoAuth: true,
    });

    logger.info({ capabilityCount: this.capabilities.size }, 'Capabilities initialized');
  }

  /**
   * 注册能力
   */
  private registerCapability(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  /**
   * ========== 核心入口 ==========
   *
   * 用户发消息 → 小星理解 → 规划 → 执行/授权 → 响应
   */
  public async processMessage(message: UserMessage): Promise<XiaoXingResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;
    logger.info({
      messageId: message.id,
      content: message.content.substring(0, 50),
      source: message.source
    }, 'Processing message');

    try {
      // ========== 第1步：理解 ==========
      const understanding = await this.understand(message);

      // ========== 第2步：规划 ==========
      const plan = await this.plan(understanding, message);

      // ========== 第3步：决策 ==========
      const decision = await this.decide(plan);

      // ========== 第4步：响应 ==========
      const response = await this.respond(decision, plan, understanding);

      response.id = responseId;
      return response;

    } catch (error) {
      logger.error({ err: error }, 'Processing failed');
      return {
        id: responseId,
        type: 'report',
        message: `抱歉，我遇到了一些问题：${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * ========== 第1步：理解 ==========
   *
   * AI 深度理解用户意图、情感、上下文
   */
  private async understand(message: UserMessage): Promise<Understanding> {
    const capabilitiesList = Array.from(this.capabilities.values())
      .map(c => `${c.name}: ${c.description} (${c.actions.join(', ')})`)
      .join('\n');

    const systemPrompt = `你是小星，一个贴心、能干、值得信赖的个人智能助手。

你的核心原则：
${XIAO_XING_PRINCIPLES.core.map(p => `- ${p}`).join('\n')}

你的行动准则：
${XIAO_XING_PRINCIPLES.actions.map(a => `- ${a}`).join('\n')}

你拥有的能力：
${capabilitiesList}

请深入理解用户的这条消息：

"${message.content}"

分析维度：
1. **显性意图**：用户明确想要什么？
2. **隐性需求**：用户没说出来但可能需要的？
3. **情感状态**：用户情绪如何？急切？随意？焦虑？
4. **紧急程度**：立刻要做还是可以等？
5. **上下文关联**：和之前的对话有什么关联？
6. **风险判断**：是否涉及敏感操作？
7. **需要的能力**：应该调用哪些工具？

返回JSON格式：
{
  "intent": {
    "primary": "主要意图（如：安排日程、获取信息、请求帮助）",
    "secondary": ["次要意图"],
    "emotional": "情感状态（急切/随意/焦虑/开心/正常）",
    "urgency": "紧急程度（high/medium/low）"
  },
  "needs": {
    "explicit": ["明确说出的需求"],
    "implicit": ["隐含的需求"]
  },
  "context": {
    "related": "与上下文的关联",
    "continues": "是否延续之前的对话"
  },
  "risks": {
    "sensitive": ["敏感操作"],
    "level": "high/medium/low"
  },
  "requiredCapabilities": ["需要的工具/能力"],
  "confidence": 0.0-1.0,
  "summary": "一句话总结你理解的用户意图"
}`;

    const response = await this.aiProvider.chat(message.content, systemPrompt, {
      temperature: 0.3,
      maxTokens: 1500,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[2]);
      }
    } catch {
      logger.warn({ response }, 'Failed to parse understanding');
    }

    // 默认理解
    return {
      intent: { primary: 'unknown', emotional: 'normal', urgency: 'medium' },
      needs: { explicit: [message.content], implicit: [] },
      context: { related: '', continues: false },
      risks: { sensitive: [], level: 'low' },
      requiredCapabilities: [],
      confidence: 0.5,
      summary: message.content,
    };
  }

  /**
   * ========== 第2步：规划 ==========
   *
   * AI 自己规划该怎么做
   */
  private async plan(understanding: Understanding, message: UserMessage): Promise<ActionPlan> {
    const planId = `plan_${randomUUID().slice(0, 8)}`;

    const systemPrompt = `你是小星，正在为用户规划行动方案。

理解结果：
- 主要意图：${understanding.intent.primary}
- 次要意图：${understanding.intent.secondary?.join(', ') || '无'}
- 紧急程度：${understanding.intent.urgency}
- 需要的能力：${understanding.requiredCapabilities?.join(', ') || '未指定'}
- 风险等级：${understanding.risks?.level || 'low'}

用户消息： "${message.content}"

请规划具体的行动方案：

1. 需要哪些步骤？
2. 每步使用什么工具？
3. 步骤之间有什么依赖？
4. 哪些可以并行执行？
5. 哪些需要用户授权？

注意：
- 能自动做的就不要打扰用户
- 涉及敏感操作必须标记需要授权
- 考虑用户体验，不要一次性做太多事

返回JSON格式：
{
  "summary": "一句话概括行动方案",
  "requiresAuth": true/false,
  "authReason": "如果需要授权，说明原因",
  "steps": [
    {
      "id": "step_1",
      "type": "calendar/notify/search/book/navigate/call/execute",
      "title": "步骤标题",
      "description": "具体做什么",
      "tool": "使用的工具名",
      "params": {},
      "autoExecute": true/false,
      "parallel": true/false
    }
  ]
}`;

    const response = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.3,
      maxTokens: 1500,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return { ...plan, id: planId };
      }
    } catch {
      logger.warn({ response }, 'Failed to parse plan');
    }

    // 默认空计划
    return {
      id: planId,
      summary: '无法规划',
      requiresAuth: false,
      steps: [],
    };
  }

  /**
   * ========== 第3步：决策 ==========
   *
   * 判断是直接执行还是请求授权
   */
  private async decide(plan: ActionPlan): Promise<'execute' | 'confirm' | 'discuss' | 'question'> {
    // 如果计划为空或无法理解，询问用户
    if (plan.steps.length === 0) {
      return 'question';
    }

    // 检查是否需要授权
    if (plan.requiresAuth) {
      return 'confirm';
    }

    // 检查是否有敏感操作
    const hasSensitive = plan.steps.some(step =>
      XIAO_XING_PRINCIPLES.sensitiveActions.some(s =>
        step.title.toLowerCase().includes(s) ||
        step.description.toLowerCase().includes(s)
      )
    );

    if (hasSensitive) {
      return 'confirm';
    }

    // 检查步骤数量，如果太多，分解执行
    if (plan.steps.length > 5) {
      return 'discuss'; // 先讨论分解方案
    }

    // 低风险、低操作数 → 直接执行
    return 'execute';
  }

  /**
   * ========== 第4步：响应 ==========
   *
   * 根据决策生成合适的响应
   */
  private async respond(
    decision: 'execute' | 'confirm' | 'discuss' | 'question',
    plan: ActionPlan,
    understanding: Understanding
  ): Promise<XiaoXingResponse> {
    switch (decision) {
      case 'execute':
        return this.respondExecute(plan, understanding);

      case 'confirm':
        return this.respondConfirm(plan, understanding);

      case 'discuss':
        return this.respondDiscuss(plan, understanding);

      case 'question':
        return this.respondQuestion(understanding);

      default:
        return this.respondQuestion(understanding);
    }
  }

  /**
   * 直接执行
   */
  private async respondExecute(plan: ActionPlan, understanding: Understanding): Promise<XiaoXingResponse> {
    const executedSteps: Array<{ step: ActionStep; success: boolean; result?: unknown; error?: string }> = [];
    let failedStep: ActionStep | null = null;

    // 按顺序执行可自动执行的步骤
    for (const step of plan.steps) {
      if (!step.autoExecute) continue;

      try {
        const result = await this.executeStep(step);
        executedSteps.push({ step, success: true, result });
      } catch (error) {
        executedSteps.push({ step, success: false, error: error instanceof Error ? error.message : 'Failed' });
        failedStep = step;
        break; // 遇到失败就停止
      }
    }

    // 生成执行报告
    const successCount = executedSteps.filter(s => s.success).length;
    const totalCount = executedSteps.length;

    let message = '';
    if (failedStep) {
      message = `好的，已经完成了 ${successCount} 项，但是「${failedStep.title}」遇到了问题，我需要你的帮助。`;
    } else if (successCount === plan.steps.length) {
      message = `已经搞定了！我帮你：\n${plan.steps.map(s => `✅ ${s.title}`).join('\n')}`;
    } else {
      message = `已经完成了 ${successCount}/${totalCount} 项。`;
    }

    // 添加后续提醒
    let followUp: XiaoXingResponse['followUp'] | undefined;
    if (understanding.intent.urgency === 'high') {
      followUp = {
        type: 'check',
        time: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后检查
        message: '检查任务完成情况',
      };
    }

    return {
      id: `resp_${randomUUID().slice(0, 8)}`,
      type: 'execute',
      message,
      execution: {
        plan,
        progress: totalCount > 0 ? (successCount / plan.steps.filter(s => s.autoExecute).length) * 100 : 0,
        result: { executed: executedSteps, failed: failedStep },
      },
      followUp,
    };
  }

  /**
   * 请求授权
   */
  private async respondConfirm(plan: ActionPlan, understanding: Understanding): Promise<XiaoXingResponse> {
    const reason = plan.authReason || '这个操作可能涉及费用或重要事项，我想确认一下';

    let message = '';
    if (understanding.intent.emotional === 'urgent') {
      message = `好的，我来安排「${plan.summary}」，`;
    } else {
      message = `我理解你想「${plan.summary}」，`;
    }
    message += `\n\n${reason}\n\n`;
    message += `计划做的事情：\n${plan.steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`;

    return {
      id: `resp_${randomUUID().slice(0, 8)}`,
      type: 'confirm',
      message,
      authorization: {
        required: true,
        reason,
        action: plan,
        options: [
          { id: 'approve', label: '好的，去做吧', action: 'approve' },
          { id: 'modify', label: '稍微改一下', action: 'modify', nextMessage: '我想修改一下' },
          { id: 'deny', label: '算了，不做了', action: 'deny' },
          { id: 'discuss', label: '我们讨论一下', action: 'discuss', nextMessage: '我想和你讨论一下' },
        ],
      },
    };
  }

  /**
   * 讨论
   */
  private async respondDiscuss(plan: ActionPlan, understanding: Understanding): Promise<XiaoXingResponse> {
    const systemPrompt = `你是小星，用户想和你讨论他的请求。

用户的请求： "${understanding.summary || understanding.needs?.explicit?.[0] || ''}"

你的初步方案：
${plan.summary || '暂无具体方案'}

请给出你的观点和建议：

1. 你对这件事的看法
2. 你建议怎么做
3. 你有什么顾虑或担心（如果有）
4. 你需要用户确认什么

语气：友好、专业、像朋友一样聊天，但有观点不回避`;

    const perspective = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.5,
      maxTokens: 500,
    });

    return {
      id: `resp_${randomUUID().slice(0, 8)}`,
      type: 'discuss',
      message: perspective,
      discussion: {
        perspective,
        suggestions: plan.steps.map(s => s.title),
      },
    };
  }

  /**
   * 询问
   */
  private async respondQuestion(understanding: Understanding): Promise<XiaoXingResponse> {
    let message = '';

    if (understanding.confidence < 0.5) {
      message = `我有点没太理解你的意思...\n\n"${understanding.needs?.explicit?.[0] || ''}"\n\n`;
      message += `你能说得更具体一点吗？比如：\n`;
      message += `• 具体是什么时间？\n`;
      message += `• 需要在什么地点？\n`;
      message += `• 有什么特别的要求吗？`;
    } else {
      message = `我想帮你做「${understanding.intent.primary}」，但我需要确认一些细节：\n\n`;

      if (understanding.needs?.implicit?.length > 0) {
        message += `我猜你可能还想要：\n`;
        message += understanding.needs.implicit.map((n: string) => `• ${n}`).join('\n');
        message += `\n\n`;
      }

      message += `你想让我怎么做呢？`;
    }

    return {
      id: `resp_${randomUUID().slice(0, 8)}`,
      type: 'question',
      message,
    };
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: ActionStep): Promise<unknown> {
    logger.info({ stepId: step.id, type: step.type }, 'Executing step');

    switch (step.tool) {
      case 'calendar':
        return this.executeCalendar(step);
      case 'navigation':
        return this.executeNavigation(step);
      case 'booking':
        return this.executeBooking(step);
      case 'notification':
        return this.executeNotification(step);
      case 'search':
        return this.executeSearch(step);
      case 'recommendation':
        return this.executeRecommendation(step);
      default:
        logger.warn({ tool: step.tool }, 'Unknown tool, using generic execution');
        return { success: true, step: step.id };
    }
  }

  /**
   * 执行日历操作
   */
  private async executeCalendar(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Calendar operation');
    return { success: true, eventId: `evt_${Date.now()}` };
  }

  /**
   * 执行导航操作
   */
  private async executeNavigation(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Navigation operation');
    return { success: true, routeId: `route_${Date.now()}` };
  }

  /**
   * 执行预订操作
   */
  private async executeBooking(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Booking operation');
    return { success: true, bookingId: `book_${Date.now()}` };
  }

  /**
   * 执行通知操作
   */
  private async executeNotification(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Notification operation');
    return { success: true };
  }

  /**
   * 执行搜索操作
   */
  private async executeSearch(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Search operation');
    return { success: true, results: [] };
  }

  /**
   * 执行推荐操作
   */
  private async executeRecommendation(step: ActionStep): Promise<unknown> {
    logger.debug({ params: step.params }, 'Recommendation operation');
    return { success: true, recommendations: [] };
  }
}

// 类型定义
export interface Capability {
  name: string;
  description: string;
  actions: string[];
  autoAuth?: boolean;
  requiresAuth?: string[];
}

export interface Understanding {
  intent: {
    primary: string;
    secondary?: string[];
    emotional: string;
    urgency: 'high' | 'medium' | 'low';
  };
  needs: {
    explicit: string[];
    implicit: string[];
  };
  context: {
    related: string;
    continues: boolean;
  };
  risks: {
    sensitive: string[];
    level: 'high' | 'medium' | 'low';
  };
  requiredCapabilities: string[];
  confidence: number;
  summary: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// 修正单例
SmartAssistant.instance = null;
SmartAssistant.getInstance = function() {
  if (!SmartAssistant.instance) {
    SmartAssistant.instance = new SmartAssistant();
  }
  return SmartAssistant.instance;
};

export const smartAssistant = SmartAssistant.getInstance();
export default smartAssistant;
