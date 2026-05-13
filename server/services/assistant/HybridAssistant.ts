/**
 * HybridAssistant - 混合智能助手
 *
 * 设计原则：
 * - 高频场景路由直达（快、准、稳）
 * - 低频/复杂场景 AI 处理（灵活）
 * - 渐进授权，安全可控
 *
 * @version 1.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('HybridAssistant');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';
import {
  authorizationManager,
  AuthorizationType,
  AuthorizationScope,
  AuthorizationRequest
} from './AuthorizationManager';
import { conversationRiskGuard } from './ConversationRiskGuard';
import { hasRecurringPattern, parseCronFromText, extractTaskNameFromRecurring } from './CronExpressionParser';

// ============ 权限系统 ============

/**
 * 权限等级
 */
export enum PermissionLevel {
  /** 可自动执行 */
  AUTO = 'auto',
  /** 需要确认 */
  CONFIRM = 'confirm',
  /** 需要授权 */
  AUTHORIZE = 'authorize',
  /** 禁止执行 */
  DENY = 'deny',
}

/**
 * 敏感操作定义
 */
export const SENSITIVE_OPERATIONS = {
  // 支付类 - 必须授权
  payment: {
    threshold: 100,  // 超过100元必须授权
    level: PermissionLevel.AUTHORIZE,
    reason: '涉及资金支出，需要您确认',
  },

  // 预约/邀约类 - 需要确认
  appointment: {
    level: PermissionLevel.CONFIRM,
    reason: '这会影响他人的时间安排',
  },

  // 个人信息类 - 需要确认
  personalInfo: {
    level: PermissionLevel.CONFIRM,
    reason: '涉及您的个人信息',
  },

  // 承诺类 - 需要确认
  commitment: {
    level: PermissionLevel.CONFIRM,
    reason: '这代表您的承诺',
  },

  // 删除类 - 必须授权
  deletion: {
    level: PermissionLevel.DENY,
    reason: '删除操作不可逆，需要您授权',
  },

  // 转发/泄露位置 - 需要确认
  locationSharing: {
    level: PermissionLevel.CONFIRM,
    reason: '位置信息涉及您的隐私安全',
  },

  // 登录/授权第三方 - 需要授权
  thirdPartyAuth: {
    level: PermissionLevel.AUTHORIZE,
    reason: '第三方授权可能涉及您的账户安全',
  },
};

// ============ 场景分类 ============

/**
 * 场景分类定义
 */
export interface ScenarioCategory {
  /** 场景名称 */
  name: string;
  /** 频率 */
  frequency: 'high' | 'medium' | 'low';
  /** 处理方式 */
  handler: 'direct' | 'ai' | 'hybrid';
  /** 默认权限 */
  defaultPermission: PermissionLevel;
  /** 示例 */
  examples: string[];
}

/**
 * 完整场景分类
 */
export const SCENARIO_CATEGORIES: Record<string, ScenarioCategory> = {
  // ========== 高频场景 - 路由直达 ==========

  /** 日程管理 */
  calendar: {
    name: '日程管理',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '明天上午10点开会',
      '周五下午3点有约',
      '明天有什么安排',
      '帮我取消明天的会议',
      '把这个会议改到下午3点',
    ],
  },

  /** 闹钟提醒 */
  alarm: {
    name: '闹钟提醒',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '半小时后提醒我开会',
      '明天早上7点叫我起床',
      '设置一个10分钟的倒计时',
    ],
  },

  /** 计时器 */
  timer: {
    name: '计时器',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '计时5分钟',
      '帮我记一下时间',
      '我开始做菜了，帮我计时',
    ],
  },

  /** 快速记事 */
  note: {
    name: '快速记事',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '记一下，牛奶没有了',
      '帮我记一下这个网址',
      '存个密码xxx',
    ],
  },

  /** 导航 */
  navigation: {
    name: '导航',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '导航到北京西站',
      '去最近的加油站',
      '怎么去机场',
      '帮我看看现在到公司多远',
    ],
  },

  /** 快速搜索 */
  search: {
    name: '快速搜索',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '今天天气怎么样',
      '帮我搜一下高企认定条件',
      '查一下这个词的意思',
    ],
  },

  /** 通话/短信 */
  communication: {
    name: '通讯',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.CONFIRM,
    examples: [
      '给张三打电话',
      '发短信告诉李四我马上到',
      '帮我回复张三说好',
    ],
  },

  /** 音乐/媒体 */
  media: {
    name: '媒体播放',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '播放音乐',
      '放点轻音乐',
      '暂停一下',
      '下一首',
    ],
  },

  /** 系统控制 */
  system: {
    name: '系统控制',
    frequency: 'high',
    handler: 'direct',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '打开蓝牙',
      '关掉WiFi',
      '调暗屏幕',
      '打开手电筒',
    ],
  },

  // ========== 中频场景 - 混合处理 ==========

  /** 会议安排 */
  meeting: {
    name: '会议安排',
    frequency: 'medium',
    handler: 'hybrid',
    defaultPermission: PermissionLevel.CONFIRM,
    examples: [
      '明天上午要开周会',
      '安排一个和小明的1v1',
      '创建下周的评审会议',
    ],
  },

  /** 预订服务 */
  booking: {
    name: '预订服务',
    frequency: 'medium',
    handler: 'hybrid',
    defaultPermission: PermissionLevel.AUTHORIZE,
    examples: [
      '帮我订个酒店',
      '预订餐厅',
      '买张去北京的火车票',
    ],
  },

  /** 出行安排 */
  trip: {
    name: '出行安排',
    frequency: 'medium',
    handler: 'hybrid',
    defaultPermission: PermissionLevel.CONFIRM,
    examples: [
      '帮我安排下周的出差',
      '规划一条自驾游路线',
      '我周末想去周边玩',
    ],
  },

  /** 智能推荐 */
  recommendation: {
    name: '智能推荐',
    frequency: 'medium',
    handler: 'hybrid',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '附近有什么好吃的',
      '推荐个周末去的地方',
      '送人送什么礼物好',
    ],
  },

  // ========== 低频场景 - AI 处理 ==========

  /** 情感陪伴 */
  emotion: {
    name: '情感陪伴',
    frequency: 'low',
    handler: 'ai',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '最近好累',
      '心情不好',
      '陪我聊聊天',
      '我有点焦虑',
    ],
  },

  /** 工作总结 */
  summary: {
    name: '工作总结',
    frequency: 'low',
    handler: 'ai',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '帮我总结下这周的工作',
      '写个工作汇报',
      '分析下这个文档',
    ],
  },

  /** 复杂规划 */
  planning: {
    name: '复杂规划',
    frequency: 'low',
    handler: 'ai',
    defaultPermission: PermissionLevel.CONFIRM,
    examples: [
      '帮我规划下这个项目',
      '分析下市场情况',
      '给我一些建议',
    ],
  },

  /** 创意写作 */
  writing: {
    name: '创意写作',
    frequency: 'low',
    handler: 'ai',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '帮我写一封邮件',
      '润色下这段话',
      '想个广告语',
    ],
  },

  /** 闲聊 */
  chat: {
    name: '闲聊',
    frequency: 'low',
    handler: 'ai',
    defaultPermission: PermissionLevel.AUTO,
    examples: [
      '今天有什么新闻',
      '讲个笑话',
      '你觉得AI会取代人类吗',
    ],
  },
};

// ============ 意图匹配器 ============

/**
 * 意图匹配结果
 */
export interface IntentMatch {
  /** 场景分类 */
  category: string;
  /** 置信度 */
  confidence: number;
  /** 匹配到的关键词 */
  keywords: string[];
  /** 提取的参数 */
  params: Record<string, unknown>;
  /** 处理方式 */
  handler: 'direct' | 'ai' | 'hybrid';
}

/**
 * 意图匹配器
 *
 * 快速判断用户意图，决定处理方式
 */
class IntentMatcher {
  private patterns: Map<string, Array<{ pattern: RegExp; params: (text: string) => Record<string, any> }>> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * 初始化匹配模式
   */
  private initializePatterns(): void {
    // 日程类
    this.patterns.set('calendar', [
      {
        pattern: /(明天|今天|后天|周五|周一|(?:下)?(?:个)?星期[一二三四五六日])(?:上午|下午|晚上)?(\d{1,2})(?:点|:(\d{1,2}))?[时分]?(?:开会|会议|有约|见|约)/i,
        params: (text) => this.extractCalendarParams(text),
      },
      {
        pattern: /(?:帮我)?(?:安排|创建|新建)?(?:一个)?(?:会议|日程|约)/i,
        params: (text) => ({ type: 'create' }),
      },
      {
        pattern: /(?:明天|今天|这周|下周)?(?:有什么|看下|查看)(?:安排|日程|会议)/i,
        params: (text) => ({ type: 'query' }),
      },
      {
        pattern: /(?:取消|删掉|删除)(?:明天的|今天的|那个)?(?:会议|日程|约)/i,
        params: (text) => ({ type: 'cancel' }),
      },
    ]);

    // 导航类
    this.patterns.set('navigation', [
      {
        pattern: /(?:帮我)?(?:导航|导到|去|到)(?:到)?(.+?)(?:怎么走|路线|多远|方便)/i,
        params: (text) => this.extractLocation(text),
      },
      {
        pattern: /(?:帮我)?(?:导航|导到|去|到)(?:到)?(.+)/i,
        params: (text) => this.extractLocation(text),
      },
      {
        pattern: /(?:最近|附近)的?(.+?)(?:在哪|位置|怎么去)/i,
        params: (text) => ({ type: 'nearby', keyword: this.extractKeyword(text) }),
      },
    ]);

    // 提醒类
    this.patterns.set('alarm', [
      {
        pattern: /(.+)(?:后|以后)(?:提醒|叫我)/i,
        params: (text) => this.extractDurationParams(text),
      },
      {
        pattern: /(?:明天|今天)?(?:早上|上午|下午|晚上)?(\d{1,2})(?:点)(?:提醒|叫我|闹钟)/i,
        params: (text) => this.extractTimeParams(text),
      },
      {
        pattern: /(?:设置|建一个)(?:个)?(?:.+)(?:分钟)?(?:的)?(?:倒计时|计时器|提醒)/i,
        params: (text) => this.extractDurationParams(text),
      },
    ]);

    // 搜索类
    this.patterns.set('search', [
      {
        pattern: /(?:今天|明天|这周)?(?:天气|天气怎么样)/i,
        params: (text) => ({ type: 'weather' }),
      },
      {
        pattern: /(?:帮我)?(?:搜|查找|查下?|看下?)(?:一下)?(.+)/i,
        params: (text) => ({ type: 'search', query: this.extractKeyword(text) }),
      },
      {
        pattern: /(?:什么|怎.{0,5}是|定义是?)(.{2,20})(?:意思|定义|是什么)/i,
        params: (text) => ({ type: 'definition', query: this.extractKeyword(text) }),
      },
    ]);

    // 通讯类
    this.patterns.set('communication', [
      {
        pattern: /(?:给|打)(?:个|个电话给)(.+?)(?:打电话|电话)/i,
        params: (text) => ({ type: 'call', contact: this.extractContact(text) }),
      },
      {
        pattern: /(?:发|给)(.+?)(?:短信|信息)(?:告诉|说)(?:他|她|我|说)(.+)/i,
        params: (text) => this.extractMessageParams(text),
      },
    ]);

    // 预订类
    this.patterns.set('booking', [
      {
        pattern: /(?:帮我|给我)?(?:订|预约|预订)(?:一个|下)?(?:.+)?(?:酒店|房间|宾馆)/i,
        params: (text) => ({ type: 'hotel' }),
      },
      {
        pattern: /(?:帮我|给我)?(?:订|预约|预订)(?:一个|下)?(?:.+)?(?:餐厅|饭店|吃饭)/i,
        params: (text) => ({ type: 'restaurant' }),
      },
      {
        pattern: /(?:帮我|给我)?(?:买|订)(?:一张)?(?:去)?(.+)?(?:机票|火车票|高铁票|飞机)/i,
        params: (text) => ({ type: 'ticket' }),
      },
    ]);

    // 情感类
    this.patterns.set('emotion', [
      {
        pattern: /(?:最近|最近?)(?:好|挺|有点|感觉)(.+)(?:啊|呀|啊呀|了)/i,
        params: (text) => ({ emotion: this.extractEmotion(text) }),
      },
      {
        pattern: /(?:陪我|我想|好想|想).*(?:聊聊|聊天|说说话)/i,
        params: (text) => ({ type: 'chat' }),
      },
      {
        pattern: /(?:心情|情绪|不爽|开心|高兴|难过)/i,
        params: (text) => ({ type: 'emotion' }),
      },
    ]);
  }

  /**
   * 匹配意图
   */
  public match(text: string): IntentMatch | null {
    const textLower = text.toLowerCase();

    // 遍历所有模式
    for (const [category, patterns] of this.patterns) {
      for (const { pattern, params } of patterns) {
        if (pattern.test(textLower)) {
          const matchedParams = params(text);
          const categoryInfo = SCENARIO_CATEGORIES[category];

          return {
            category,
            confidence: this.calculateConfidence(pattern, text),
            keywords: this.extractKeywords(pattern, text),
            params: matchedParams,
            handler: categoryInfo?.handler || 'ai',
          };
        }
      }
    }

    // 没有匹配到 → AI 处理
    return null;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(pattern: RegExp, text: string): number {
    const match = text.match(pattern);
    if (!match) return 0;

    // 匹配长度占文本长度的比例
    const matchLength = match[0].length;
    const textLength = text.length;
    const lengthRatio = matchLength / textLength;

    // 基础分
    let confidence = 0.7;

    // 完整匹配加分
    if (lengthRatio > 0.8) confidence += 0.2;
    else if (lengthRatio > 0.5) confidence += 0.1;

    // 时间词精确匹配加分
    if (/\d{1,2}[点时:]/.test(text)) confidence += 0.05;

    // 人名/地点精确匹配加分
    if (/[北京上海深圳杭州]/i.test(text)) confidence += 0.05;

    return Math.min(1, confidence);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(pattern: RegExp, text: string): string[] {
    const match = text.match(pattern);
    if (!match) return [];

    const keywords: string[] = [];
    for (let i = 1; i < match.length; i++) {
      if (match[i] && typeof match[i] === 'string' && match[i].length > 1) {
        keywords.push(match[i].trim());
      }
    }
    return keywords;
  }

  /**
   * 提取日历参数
   */
  private extractCalendarParams(text: string): Record<string, any> {
    const params: Record<string, any> = { type: 'create' };

    // 提取时间
    const timeMatch = text.match(/(\d{1,2})(?:点|:(\d{1,2}))?/);
    if (timeMatch) {
      params.hour = parseInt(timeMatch[1]);
      params.minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    }

    // 提取日期
    if (/明天/.test(text)) params.day = 'tomorrow';
    else if (/今天/.test(text)) params.day = 'today';
    else if (/后天/.test(text)) params.day = 'dayAfter';

    // 提取时段
    if (/上午|早上/.test(text)) params.period = 'morning';
    else if (/下午/.test(text)) params.period = 'afternoon';
    else if (/晚上/.test(text)) params.period = 'evening';

    return params;
  }

  /**
   * 提取位置
   */
  private extractLocation(text: string): Record<string, any> {
    const match = text.match(/(?:到|去|导到|导航到)(.+?)(?:怎么|多远|路线|$)/i);
    return {
      destination: match ? match[1].trim() : text.replace(/导航|到|去/g, '').trim(),
    };
  }

  /**
   * 提取时长
   */
  private extractDurationParams(text: string): Record<string, any> {
    const params: Record<string, any> = {};

    // 分钟
    const minMatch = text.match(/(\d+)(?:分钟|分钟后|分钟以后)/);
    if (minMatch) {
      params.duration = parseInt(minMatch[1]);
      params.unit = 'minute';
    }

    // 小时
    const hourMatch = text.match(/(\d+)(?:小时|小时后|小时以后)/);
    if (hourMatch) {
      params.duration = parseInt(hourMatch[1]) * 60;
      params.unit = 'hour';
    }

    return params;
  }

  /**
   * 提取时间点
   */
  private extractTimeParams(text: string): Record<string, any> {
    const params: Record<string, any> = {};

    const match = text.match(/(?:早上|上午|下午|晚上)?(\d{1,2})(?:点)/);
    if (match) {
      params.hour = parseInt(match[1]);
      if (/下午|晚上/.test(text) && params.hour < 12) {
        params.hour += 12;
      }
    }

    return params;
  }

  /**
   * 提取联系人
   */
  private extractContact(text: string): string {
    const match = text.match(/(?:给|打)(.+?)(?:电话|打)/);
    return match ? match[1].trim() : '';
  }

  /**
   * 提取消息内容
   */
  private extractMessageParams(text: string): Record<string, any> {
    const match = text.match(/(?:给|发)(.+?)(?:说|告诉)(.+)/);
    return {
      contact: match ? match[1].trim() : '',
      message: match ? match[2].trim() : '',
    };
  }

  /**
   * 提取关键词（通用）
   */
  private extractKeyword(text: string): string {
    return text
      .replace(/(?:帮我|搜一下|查下|看下|查找)/g, '')
      .trim();
  }

  /**
   * 提取情感
   */
  private extractEmotion(text: string): string {
    const emotions: Record<string, string[]> = {
      tired: ['累', '困', '疲惫', '乏力'],
      sad: ['难过', '伤心', '不开心', '郁闷', '不爽'],
      anxious: ['焦虑', '担心', '紧张', '压力大'],
      happy: ['开心', '高兴', '愉快', '兴奋'],
    };

    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(k => text.includes(k))) {
        return emotion;
      }
    }

    return 'unknown';
  }
}

// ============ 混合助手核心 ============

/**
 * 用户消息
 */
export interface UserMessage {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  source: 'app' | 'wechat' | 'phone' | 'watch';
  timestamp: Date;
  context?: {
    location?: { lat: number; lng: number; address?: string };
    recentMessages?: UserMessage[];
    userState?: {
      isDriving?: boolean;
      batteryLevel?: number;
    };
  };
}

/**
 * 结构化草案条目（阶段一：多实体复杂输入）
 */
export interface DraftItem {
  action: 'create_project' | 'create_task' | 'save_memory' | 'create_person';
  label: string;
  actionParams: Record<string, unknown>;
}

/**
 * 响应
 */
export interface AssistantResponse {
  id: string;

  /** 处理方式 */
  handler: 'direct' | 'ai' | 'hybrid';

  /** 场景分类 */
  category?: string;

  /** 响应类型 */
  type: 'execute' | 'confirm' | 'draft' | 'discuss' | 'question' | 'report' | 'greeting';

  /** 消息内容 */
  message: string;

  /** AI 调用信息（handler=ai 时用于验收和诊断） */
  ai?: {
    provider: string;
    model: string;
    latencyMs: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };

  /** 结构化草案条目（type=draft 时使用） */
  draftItems?: DraftItem[];

  /** 执行结果（如果有） */
  result?: unknown;

  /** 授权信息（如果有） */
  authorization?: {
    required: boolean;
    reason: string;
    operation: string;
    amount?: number;
    options: Array<{
      label: string;
      action: 'approve' | 'deny' | 'modify' | 'discuss';
    }>;
  };

  /** 执行动作标识（供 ConversationActionExecutor 使用） */
  action?: string;

  /** 动作参数（供 ConversationActionExecutor 使用） */
  actionParams?: Record<string, any>;

  /** 卡片（UI展示） */
  cards?: Array<{
    id: string;
    type: 'calendar' | 'map' | 'list' | 'confirm';
    title: string;
    data: unknown;
  }>;

  /** 后续行动 */
  followUp?: {
    type: 'reminder' | 'check';
    time?: Date;
    message: string;
  };
}

/**
 * 混合智能助手
 */
class HybridAssistant {
  private static instance: HybridAssistant | null = null;

  private intentMatcher: IntentMatcher;
  private aiProvider: AIProviderChain;

  // 场景处理器映射
  private handlers: Map<string, unknown> = new Map();

  private constructor() {
    this.intentMatcher = new IntentMatcher();
    this.aiProvider = new AIProviderChain();
    this.initializeHandlers();
  }

  public static getInstance(): HybridAssistant {
    if (!HybridAssistant.instance) {
      HybridAssistant.instance = new HybridAssistant();
    }
    return HybridAssistant.instance;
  }

  /**
   * 初始化处理器
   */
  private initializeHandlers(): void {
    // 这里注册实际的处理器
    // 实际项目中应该从其他地方导入
    logger.info('Handlers initialized');
  }

  /**
   * 注册处理器
   */
  public registerHandler(category: string, handler: unknown): void {
    this.handlers.set(category, handler);
  }

  private formatRecentConversationContext(message: UserMessage): string {
    const recentMessages = message.context?.recentMessages
      ?.filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
      .slice(-8);
    if (!recentMessages?.length) return '';

    return recentMessages
      .map((item) => `- ${item.content.trim().slice(0, 300)}`)
      .join('\n');
  }

  /**
   * 处理消息
   */
  public async processMessage(message: UserMessage, userId: string = 'default'): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    logger.info({
      messageId: message.id,
      content: message.content.substring(0, 50),
      source: message.source,
      userId,
    }, 'Processing message');

    try {
      // ========== 第0步：检查是否是授权命令 ==========
      const authCommand = this.isAuthorizationCommand(message.content);
      if (authCommand) {
        return this.handleAuthorizationCommand(message.content, userId, responseId);
      }

      const riskDecision = conversationRiskGuard.evaluate(message.content);
      if (riskDecision.level !== 'allow') {
        return this.handleRiskDecision(responseId, riskDecision);
      }

      if (this.isEmotionalConversationRequest(message.content)) {
        return this.handleEmotionalConversation(message.content, responseId);
      }

      // ========== 第0.5步：多实体结构化草案 ==========
      if (this.isComplexMultiEntityInput(message.content)) {
        return this.handleStructuredDraft(message, responseId, userId);
      }

      const coreAction = this.tryParseCoreAction(message.content, responseId);
      if (coreAction) {
        return coreAction;
      }

      // ========== 第1步：意图匹配 ==========
      const match = this.intentMatcher.match(message.content);

      if (match && match.confidence >= 0.7) {
        // 高置信度 → 分类处理
        return this.handleByCategory(message, match, responseId, userId);
      }

      // ========== 第2步：AI 处理 ==========
      return this.handleByAI(message, responseId, userId);

    } catch (error) {
      logger.error({ err: error }, 'Processing failed');
      return {
        id: responseId,
        handler: 'ai',
        type: 'report',
        message: '抱歉，处理失败了。请稍后重试。',
      };
    }
  }

  /**
   * 检查是否是授权命令
   */
  private isAuthorizationCommand(text: string): boolean {
    const patterns = [
      '交给你了',
      '以后都听你的',
      '交给你处理',
      '你决定就好',
      '你自己看着办',
      '以后这种事',
      '以后这类',
      '这次授权',
    ];

    return patterns.some(p => text.includes(p));
  }

  private isEmotionalConversationRequest(text: string): boolean {
    const hasEmotion = /烦|委屈|压力|焦虑|崩溃|难受|生气|不爽|心累|没底|担心|客户.*冲|语气.*冲/u.test(text);
    const asksForThinking = /理一下|梳理|怎么回应|怎么说|帮我想|先聊|先别|别急|不要.*任务|别.*任务|暂时.*别/u.test(text);
    const explicitExecution = /创建|新建|添加|保存|发给|发送|打电话|下单|支付|删除|提交/u.test(text);
    return (hasEmotion && asksForThinking) || (hasEmotion && !explicitExecution);
  }

  private handleEmotionalConversation(text: string, responseId: string): AssistantResponse {
    const emotion = /委屈/.test(text) ? '委屈' : /压力|焦虑|没底/.test(text) ? '压力' : /烦|不爽|生气/.test(text) ? '烦躁' : '情绪压力';
    return {
      id: responseId,
      handler: 'direct',
      category: '情绪陪伴',
      type: 'report',
      message: `我理解，你现在不是要我立刻创建任务，而是先把这股${emotion}接住、把回应思路理清楚。先别急着行动，也暂时别把话说重。\n\n可以先这样处理：第一，先把对方语气和事实分开，不急着反击；第二，回复里保留边界，例如“我理解你很着急，我先确认事实，10分钟内给你明确答复”；第三，如果对方继续冲，先暂停争辩，改成书面确认问题点。\n\n你可以把客户原话发我，我先帮你拆成“对方真正诉求、你要守住的边界、适合发出的回复”三段。`,
    };
  }

  /**
   * 处理授权命令
   */
  private handleAuthorizationCommand(text: string, userId: string, responseId: string): AssistantResponse {
    const result = authorizationManager.processFullAuthorization(userId, text);

    if (result.success) {
      return {
        id: responseId,
        handler: 'direct',
        type: 'execute',
        message: result.message || '好的，已经记下了！',
      };
    }

    return {
      id: responseId,
      handler: 'direct',
      type: 'question',
      message: result.message,
    };
  }

  private handleRiskDecision(
    responseId: string,
    riskDecision: ReturnType<typeof conversationRiskGuard.evaluate>,
  ): AssistantResponse {
    if (riskDecision.level === 'deny') {
      return {
        id: responseId,
        handler: 'direct',
        category: '安全守护',
        type: 'report',
        message: riskDecision.reason || '这个操作风险较高，我不能直接执行。',
      };
    }

    return {
      id: responseId,
      handler: 'direct',
      category: '安全守护',
      type: 'confirm',
      message: riskDecision.reason || '这个操作需要您确认后才能继续。',
      authorization: {
        required: true,
        reason: riskDecision.reason || '需要您确认',
        operation: riskDecision.operation || 'sensitive_action',
        options: [
          { label: '我确认，继续', action: 'approve' },
          { label: '修改一下', action: 'modify' },
          { label: '取消', action: 'deny' },
        ],
      },
    };
  }

  private isComplexMultiEntityInput(text: string): boolean {
    let count = 0;
    if (/(创建|新建|建立|新增|添加).{0,8}项目/.test(text)) count++;
    if (/(创建|新建|建立|新增|添加).{0,8}任务/.test(text) && !hasRecurringPattern(text)) count++;
    if (/(添加|新增|记录|保存).{0,6}(联系人|人脉)/.test(text)) count++;
    if (/(记住|记一下|保存记忆|存到记忆|帮我记下)/.test(text)) count++;
    return count >= 2;
  }

  private async handleStructuredDraft(
    message: UserMessage,
    responseId: string,
    userId: string,
  ): Promise<AssistantResponse> {
    const systemPrompt = `你是数据提取器。从业务描述中提取需要创建的所有内容。

规则：
1. 只提取明确提到的内容，不推测
2. 最多5个条目
3. action 只能是: create_project, create_task, save_memory, create_person
4. 只返回JSON数组，不要任何解释

输出格式（严格遵守）：
[
  { "action": "create_project", "label": "创建项目：项目名", "params": { "title": "项目名", "description": "描述" } },
  { "action": "create_task", "label": "创建任务：任务名", "params": { "name": "任务名", "description": "描述", "triggerType": "MANUAL" } },
  { "action": "save_memory", "label": "记住：内容摘要", "params": { "content": "要记住的内容" } },
  { "action": "create_person", "label": "添加联系人：姓名", "params": { "name": "姓名", "role": "职位", "organization": "公司" } }
]

业务描述："${message.content}"`;

    try {
      const response = await this.aiProvider.chat(message.content, systemPrompt, {
        temperature: 0.3,
        maxTokens: 600,
      });

      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\[[\s\S]*?\])/);
      if (jsonMatch) {
        const raw: Array<{ action: string; label: string; params: Record<string, unknown> }> =
          JSON.parse(jsonMatch[1] || jsonMatch[2]);

        if (Array.isArray(raw) && raw.length > 0) {
          const validActions = new Set(['create_project', 'create_task', 'save_memory', 'create_person']);
          const items: DraftItem[] = raw
            .filter(item => item.action && item.label && item.params && validActions.has(item.action))
            .slice(0, 5)
            .map(item => ({
              action: item.action as DraftItem['action'],
              label: item.label,
              actionParams: item.params,
            }));

          if (items.length > 0) {
            return {
              id: responseId,
              handler: 'ai',
              type: 'draft',
              message: `我理解了以下 ${items.length} 项内容，请确认后我来执行：`,
              draftItems: items,
            };
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Structured draft extraction failed, falling back to AI');
    }

    return this.handleByAI(message, responseId, userId);
  }

  private tryParseCoreAction(text: string, responseId: string): AssistantResponse | null {
    const normalized = text.trim();

    if (this.isPcExecutionRequest(normalized)) {
      const description = this.normalizePcExecutionDescription(normalized);
      return {
        id: responseId,
        handler: 'direct',
        category: 'PC执行',
        type: 'confirm',
        message: '我会把这条指令交给 PC 端执行，并把结果回传到这里。执行前需要你确认一次。',
        action: 'pc_execute',
        actionParams: {
          type: this.inferPcTaskType(description),
          description,
          params: {},
        },
        authorization: {
          required: true,
          reason: '这会让已绑定的 PC 端执行实际操作，需要确认后再开始。',
          operation: 'pc_execute',
          options: [
            { label: '确认执行', action: 'approve' },
            { label: '修改指令', action: 'modify' },
            { label: '取消', action: 'deny' },
          ],
        },
      };
    }

    if (this.isAcceptanceProbe(normalized)) {
      return {
        id: responseId,
        handler: 'direct',
        category: '验收',
        type: 'report',
        message: '收到，这条验收消息已送达并记录。',
      };
    }

    if (/(创建|新建|建立|新增|添加).{0,8}项目/.test(normalized)) {
      const title = this.extractEntityName(normalized, '项目') || '新项目';
      const description = this.extractDescription(normalized);
      return {
        id: responseId,
        handler: 'direct',
        category: '项目',
        type: 'execute',
        message: `好的，我来创建项目「${title}」。`,
        action: 'create_project',
        actionParams: { title, description },
      };
    }

    // 循环任务（CRON）— 在普通任务匹配前检测，避免被降级为 MANUAL
    if (hasRecurringPattern(normalized)) {
      const parsed = parseCronFromText(normalized);
      if (parsed) {
        const name = this.extractEntityName(normalized, '任务')
          || extractTaskNameFromRecurring(normalized);
        const description = this.extractDescription(normalized);
        return {
          id: responseId,
          handler: 'direct',
          category: '任务',
          type: 'execute',
          message: `好的，我来创建循环任务「${name}」（${parsed.humanReadable}）。`,
          action: 'create_task',
          actionParams: {
            name,
            description,
            triggerType: 'CRON',
            cronExpression: parsed.expression,
            cronTimezone: parsed.timezone,
          },
        };
      }
    }

    if (/(创建|新建|建立|新增|添加).{0,8}任务/.test(normalized)) {
      const name = this.extractEntityName(normalized, '任务') || '新任务';
      const description = this.extractDescription(normalized);
      return {
        id: responseId,
        handler: 'direct',
        category: '任务',
        type: 'execute',
        message: `好的，我来创建任务「${name}」。`,
        action: 'create_task',
        actionParams: { name, description, triggerType: 'MANUAL' },
      };
    }

    // 保险库语义搜索 — 「找上次那个合同照片」「帮我搜一下预算文件」
    const vaultSearchMatch = normalized.match(
      /(?:帮我)?(?:找|搜|查找|查一下|找一下|搜索|查看)(?:一下|下)?(?:上次|之前|以前|历史上?)?(?:那个|那份|的)?(.+?)(?:文件|照片|图片|合同|资料|记录|笔记|记忆|方案|报告|总结|报价单|清单)?(在哪|哪里|$)/u
    );
    if (vaultSearchMatch && /(文件|照片|图片|合同|资料|记录|笔记|记忆|方案|报告|总结|报价单|清单|保险库|vault)/i.test(normalized)) {
      const rawQuery = vaultSearchMatch[1]?.trim() || '';
      // 整理关键词：去掉泛化词，保留主体名词
      const query = (rawQuery + ' ' + normalized)
        .replace(/帮我|找|搜|查找|查一下|找一下|搜索|查看|上次|之前|以前|历史|那个|那份|一下/gu, '')
        .replace(/文件|照片|图片|合同|资料|记录|笔记|记忆|方案|报告|总结|报价单|清单|保险库|vault/giu, ' $& ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      if (query.length >= 2) {
        return {
          id: responseId,
          handler: 'direct',
          category: '知识库',
          type: 'execute',
          message: `好的，我来搜索「${query}」相关的资料。`,
          action: 'search_vault',
          actionParams: { query },
        };
      }
    }

    // 联系人创建 — 「添加联系人张三，职位是产品经理」「把李四加到联系人，他在ABC公司」
    if (/(添加|新增|记录|保存|加入|建立).{0,6}(联系人|人脉|联系)/.test(normalized)) {
      const name = this.extractPersonName(normalized);
      if (name) {
        const role = this.extractFieldValue(normalized, ['职位是', '职位:', '职务是', '是', '担任', '任']);
        const organization = this.extractFieldValue(normalized, ['公司是', '公司:', '在', '来自', '组织是']);
        return {
          id: responseId,
          handler: 'direct',
          category: '联系人',
          type: 'execute',
          message: `好的，我来添加联系人「${name}」。`,
          action: 'create_person',
          actionParams: { name, role, organization },
        };
      }
    }

    if (/(记住|记一下|保存记忆|存到记忆|帮我记下)/.test(normalized)) {
      const content = normalized
        .replace(/^(请)?(帮我)?(记住|记一下|保存记忆|存到记忆|帮我记下)[，,:：\s]*/u, '')
        .replace(/[。.!！]$/u, '')
        .trim();
      if (!content) return null;
      return {
        id: responseId,
        handler: 'direct',
        category: '记忆',
        type: 'execute',
        message: '好的，我已经准备保存这条记忆。',
        action: 'save_memory',
        actionParams: { content, tags: ['对话记忆'] },
      };
    }

    return null;
  }

  private isAcceptanceProbe(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    if (!compact) return false;

    const asksForWork = /(写|创建|新建|建立|新增|添加|生成|修复|优化|整理|执行|运行|查找|搜索|打开|做|帮我|让|记住|记一下|保存记忆|存到记忆|帮我记下)/u.test(compact);
    if (asksForWork) return false;

    const isShortProbe = compact.length <= 80;
    const hasProbeKeyword = /(验收|测试|探活|连通性|联通性|送达|真实测试|真实验收|smoke|acceptance|ping|healthcheck|health-check)/iu.test(compact);
    const isMessageProbe = /(消息|message)/iu.test(compact) && /(浏览器|前端|后端|手机|移动端|真实|测试|验收|probe)/iu.test(compact);

    return isShortProbe && (hasProbeKeyword || isMessageProbe);
  }

  private isPcExecutionRequest(text: string): boolean {
    return /(PC|pc|电脑|桌面|主机|Windows|Mac|电脑端|PC端)/u.test(text)
      && /(执行|处理|整理|生成|打开|查找|搜索|运行|清理|优化|写|创建|做|帮我|让)/u.test(text);
  }

  private normalizePcExecutionDescription(text: string): string {
    return text
      .replace(/^(?:\u8bf7|\u9ebb\u70e6)?(?:\u5e2e\u6211)?(?:\u8ba9|\u53eb)?(?:PC|pc)\u7aef[\uFF0C,:\uFF1A\s]*/u, '')
      .replace(/^(请|麻烦)?(帮我)?(让|叫)?(PC|pc|电脑|桌面|主机|电脑端|PC端)[，,:：\s]*/u, '')
      .replace(/^(在)?(PC|pc|电脑|桌面|主机|电脑端|PC端)(上|里)?[，,:：\s]*/u, '')
      .trim() || text.trim();
  }

  private inferPcTaskType(text: string): string {
    if (/(PPT|演示|幻灯片)/iu.test(text)) return 'ppt_create';
    if (/(文档|报告|合同|申报书|总结|计划)/u.test(text)) return 'document_generate';
    if (/(整理|归档|文件|桌面)/u.test(text)) return 'file_organize';
    if (/(代码|项目|程序|终端|仓库)/u.test(text)) return 'code_create';
    if (/(清理|优化|缓存|临时文件|系统|网络|连接|连通|连通性|诊断|ping)/iu.test(text)) return 'system_optimize';
    return 'custom';
  }

  private extractEntityName(text: string, entity: '项目' | '任务'): string | null {
    return this.extractNamedValue(text, ['名为', '名字叫', '叫', '名称是'])
      || this.extractNameAfterEntity(text, entity);
  }

  private extractNamedValue(text: string, markers: string[]): string | null {
    for (const marker of markers) {
      const index = text.indexOf(marker);
      if (index < 0) continue;
      const rest = text.slice(index + marker.length);
      const value = rest
        .split(/描述是|说明是|备注是|[，。,.！!；;]/u)[0]
        ?.replace(/的(项目|任务)$/u, '')
        .trim();
      if (value) return value;
    }
    return null;
  }

  private extractNameAfterEntity(text: string, entity: '项目' | '任务'): string | null {
    const pattern = new RegExp(`(?:创建|新建|建立|新增|添加)(?:一个|个)?${entity}[：:\\s，,]*(.+)`, 'u');
    const match = text.match(pattern);
    const value = match?.[1]
      ?.split(/描述是|说明是|备注是|[，。,.！!；;]/u)[0]
      ?.replace(/的(项目|任务)$/u, '')
      .trim();
    return value || null;
  }

  private extractDescription(text: string): string | undefined {
    const markers = ['描述是', '说明是', '备注是'];
    for (const marker of markers) {
      const index = text.indexOf(marker);
      if (index < 0) continue;
      const rest = text.slice(index + marker.length);
      const value = rest.replace(/[。.!！]$/u, '').trim();
      if (value) return value;
    }
    return undefined;
  }

  private extractPersonName(text: string): string | null {
    // 「联系人/人脉」后跟名字
    const afterContact = text.match(/(?:联系人|人脉|联系)[：:，,\s]*([^\s，,。！!；;，]{1,10})/u);
    if (afterContact?.[1]) return afterContact[1].trim();
    // 「把X加到/记录X」
    const baPattern = text.match(/(?:把|将)\s*([^\s，,。！!；;]{1,10})\s*(?:加到|加入|记录|保存)/u);
    if (baPattern?.[1]) return baPattern[1].trim();
    return null;
  }

  private extractFieldValue(text: string, markers: string[]): string | undefined {
    for (const marker of markers) {
      const idx = text.indexOf(marker);
      if (idx < 0) continue;
      const rest = text.slice(idx + marker.length);
      const value = rest
        .split(/[，,。！!；;\n]/u)[0]
        ?.replace(/[。.!！]$/u, '')
        .trim();
      if (value && value.length > 0 && value.length <= 40) return value;
    }
    return undefined;
  }

  /**
   * 根据分类处理
   */
  private async handleByCategory(
    message: UserMessage,
    match: IntentMatch,
    responseId: string,
    userId: string,
  ): Promise<AssistantResponse> {
    const category = SCENARIO_CATEGORIES[match.category];

    logger.info({
      category: match.category,
      confidence: match.confidence,
      handler: category?.handler
    }, 'Category matched');

    // 判断处理方式
    switch (category?.handler) {
      case 'direct':
        return this.handleDirect(message, match, responseId, userId);

      case 'hybrid':
        return this.handleHybrid(message, match, responseId, userId);

      case 'ai':
        return this.handleByAI(message, responseId, userId);

      default:
        return this.handleByAI(message, responseId, userId);
    }
  }

  /**
   * 直接处理（高频场景）
   */
  private async handleDirect(
    message: UserMessage,
    match: IntentMatch,
    responseId: string,
    userId: string,
  ): Promise<AssistantResponse> {
    const category = SCENARIO_CATEGORIES[match.category];

    // ========== 权限检查 ==========
    const authRequest: AuthorizationRequest = {
      operation: match.category,
      amount: match.params.amount,
      details: {
        description: message.content,
      },
    };

    const authResult = authorizationManager.checkAuthorization(userId, authRequest);

    // 如果有永久授权，直接执行
    if (!authResult.required) {
      const handler = this.handlers.get(match.category);
      if (handler) {
        const result = await handler.execute(match.params);
        return {
          id: responseId,
          handler: 'direct',
          category: match.category,
          type: 'execute',
          message: this.generateSuccessMessage(match.category, match.params),
          result,
        };
      }
      return {
        id: responseId,
        handler: 'direct',
        category: match.category,
        type: 'execute',
        message: this.generateSuccessMessage(match.category, match.params),
      };
    }

    // 需要确认/授权
    if (authResult.type === AuthorizationType.AUTHORIZE) {
      return this.requestAuthorization(message, match, responseId, authResult);
    }

    if (authResult.type === AuthorizationType.CONFIRM) {
      return this.requestConfirmation(message, match, responseId, authResult);
    }

    // DENY
    return {
      id: responseId,
      handler: 'direct',
      category: match.category,
      type: 'report',
      message: '抱歉，这个操作我不能执行。如有需要，请您在 App 中操作。',
    };
  }

  /**
   * 混合处理（中频场景）
   */
  private async handleHybrid(
    message: UserMessage,
    match: IntentMatch,
    responseId: string,
    userId: string,
  ): Promise<AssistantResponse> {
    // 中频场景：先 AI 理解，再路由执行
    const category = SCENARIO_CATEGORIES[match.category];

    // ========== 权限检查 ==========
    const authRequest: AuthorizationRequest = {
      operation: match.category,
      amount: match.params.amount,
      details: {
        description: message.content,
      },
    };

    const authResult = authorizationManager.checkAuthorization(userId, authRequest);

    // 如果有永久授权，直接执行
    if (!authResult.required) {
      const enhanced = await this.enhanceWithAI(message, match);
      const handler = this.handlers.get(match.category);
      if (handler) {
        const result = await handler.execute(enhanced.params);
        return {
          id: responseId,
          handler: 'hybrid',
          category: match.category,
          type: 'execute',
          message: this.generateSuccessMessage(match.category, enhanced.params),
          result,
        };
      }
      return {
        id: responseId,
        handler: 'hybrid',
        category: match.category,
        type: 'execute',
        message: this.generateSuccessMessage(match.category, enhanced.params),
      };
    }

    // 需要确认/授权
    if (authResult.type === AuthorizationType.AUTHORIZE) {
      return this.requestAuthorizationHybrid(message, match, responseId, authResult);
    }

    if (authResult.type === AuthorizationType.CONFIRM) {
      return this.requestConfirmationHybrid(message, match, responseId, authResult);
    }

    // DENY
    return {
      id: responseId,
      handler: 'hybrid',
      category: match.category,
      type: 'report',
      message: '抱歉，这个操作我不能执行。',
    };
  }

  /**
   * AI 处理（低频场景）
   */
  private async handleByAI(
    message: UserMessage,
    responseId: string,
    userId: string,
  ): Promise<AssistantResponse> {
    // 完整 AI 处理流程
    const recentConversationContext = this.formatRecentConversationContext(message);
    const systemPrompt = `你是生语助手，用户的个人AI助手。

你的能力：
- 项目管理：创建项目、查看项目进度
- 任务管理：创建任务、设置提醒、查看任务
- 记忆保存：记住重要信息、联系人、约定
- 日程管理：安排会议、设置闹钟
- 情感陪伴：倾听、建议、闲聊

你的原则：
- 不偷懒，主动服务
- 不说谎，有事直说
- 保护隐私安全
- 尊重用户决策
- 敏感操作（删除、支付、外发）必须请用户确认

${recentConversationContext ? `正在延续的历史会话（用于理解上下文，不要逐字复述）：
${recentConversationContext}
` : ''}
用户消息： "${message.content}"

请判断用户意图，用 JSON 回复：
{
  "type": "execute|confirm|question|chat|report",
  "message": "你对用户的自然语言回复",
  "category": "项目/任务/记忆/日程/闲聊 等",
  "action": "create_project|create_task|save_memory|search_vault|create_person|null（无需执行时填null）",
  "params": {
    // create_project: { "title": "项目名", "description": "描述" }
    // create_task 一次性: { "name": "任务名", "description": "描述", "triggerType": "MANUAL" }
    // create_task 循环(含每天/每周/每月/定时等): {
    //   "name": "任务名", "description": "描述", "triggerType": "CRON",
    //   "cronExpression": "0 9 * * 1",   // 标准 5 段 cron 表达式
    //   "cronTimezone": "Asia/Shanghai"
    // }
    // save_memory: { "content": "要记住的内容", "tags": ["标签"] }
    // search_vault: { "query": "搜索关键词" }  // 用于「找上次那个合同」「搜索预算文件」类意图
    // create_person: { "name": "人名", "role": "职位（可选）", "organization": "公司（可选）" }
    // 其他action: 根据实际情况填写
  },
  "needConfirm": false,
  "confirmReason": "（需要确认时说明原因）"
}`;

    const aiResult = await this.aiProvider.chatWithMetadata(message.content, systemPrompt, {
      temperature: 0.5,
      maxTokens: 800,
    });
    const response = aiResult.content;
    const ai = {
      provider: aiResult.provider,
      model: aiResult.model,
      latencyMs: aiResult.latencyMs,
      usage: aiResult.usage,
    };

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);

        if (parsed.needConfirm) {
          return {
            id: responseId,
            handler: 'ai',
            type: 'confirm',
            message: parsed.message || response,
            ai,
            authorization: {
              required: true,
              reason: parsed.confirmReason || '需要您确认',
              operation: parsed.action || '',
              options: [
                { label: '好的，去做吧', action: 'approve' },
                { label: '修改一下', action: 'modify' },
                { label: '算了', action: 'deny' },
              ],
            },
          };
        }

        return {
          id: responseId,
          handler: 'ai',
          type: parsed.type || 'execute',
          message: parsed.message || response,
          ai,
          category: parsed.category,
          action: parsed.action && parsed.action !== 'null' ? parsed.action : undefined,
          actionParams: parsed.params && typeof parsed.params === 'object' ? parsed.params : undefined,
        };
      }
    } catch {
      logger.warn({ response }, 'Failed to parse AI response');
    }

    return {
      id: responseId,
      handler: 'ai',
      type: 'report',
      message: response,
      ai,
    };
  }

  /**
   * AI 增强理解
   */
  private async enhanceWithAI(
    message: UserMessage,
    match: IntentMatch
  ): Promise<{ params: Record<string, unknown> }> {
    const systemPrompt = `用户输入： "${message.content}"
提取的参数： ${JSON.stringify(match.params)}

请补充完善这个参数，特别是：
1. 具体时间（今天是几号？）
2. 地点名称标准化
3. 联系人姓名
4. 其他隐含信息

只返回 JSON 格式的参数，不需要解释`;

    try {
      const response = await this.aiProvider.chat('', systemPrompt, {
        temperature: 0.3,
        maxTokens: 200,
      });

      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const enhanced = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return { ...match, ...enhanced };
      }
    } catch {
      logger.warn('Failed to enhance params');
    }

    return match as unknown as { params: Record<string, unknown> };
  }

  /**
   * 格式化参数
   */
  private formatParams(params: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        lines.push(`• ${key}: ${value}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * 生成成功消息
   */
  private generateSuccessMessage(category: string, params: Record<string, any>): string {
    switch (category) {
      case 'calendar':
        return `✅ 已安排日程：${params.day || ''} ${params.hour || ''}点`;
      case 'alarm':
        return `⏰ 好的，${params.duration || ''}分钟后提醒你`;
      case 'navigation':
        return `🗺️ 正在导航到：${params.destination}`;
      case 'search':
        return `🔍 搜索结果：${params.query}`;
      case 'communication':
        return `📞 正在${params.type === 'call' ? '拨打' : '发送消息给'}${params.contact}`;
      case 'media':
        return `🎵 ${params.action === 'play' ? '开始播放' : '已暂停'}`;
      default:
        return `✅ 已处理完成`;
    }
  }
}

// 导出
export const hybridAssistant = HybridAssistant.getInstance();
export default hybridAssistant;

// 导出类型
export type { IntentMatch, ScenarioCategory, UserMessage, AssistantResponse, DraftItem };
