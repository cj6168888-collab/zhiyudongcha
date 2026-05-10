/**
 * 小智 Cross-Platform Context Service - 跨平台上下文关联
 * Project Synergy (协同协议) - 全域信息流治理
 * 
 * 功能：
 * 1. 统一消息格式 - 将不同平台消息标准化
 * 2. 上下文关联 - 关联相同联系人跨平台对话
 * 3. 碎片信息聚合 - 打破软件壁垒，聚合分散信息
 * 4. 跨App提醒 - 基于上下文生成智能提醒
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CrossPlatformContext');

import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export type Platform = 'wechat' | 'dingtalk' | 'wecom' | 'feishu' | 'email' | 'sms' | 'phone' | 'other';

export interface UnifiedMessage {
  id: string;
  platform: Platform;
  platformMessageId: string;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
  direction: 'incoming' | 'outgoing';
  messageType: 'text' | 'image' | 'file' | 'voice' | 'video' | 'link' | 'other';
  content: string;
  rawContent?: unknown;
  timestamp: Date;
  isRead: boolean;
  isImportant: boolean;
  extractedEntities: ExtractedEntity[];
  relatedContextIds: string[];
}

export interface ExtractedEntity {
  type: 'date' | 'time' | 'money' | 'phone' | 'email' | 'address' | 'person' | 'company' | 'project' | 'task';
  value: string;
  normalizedValue?: string;
  confidence: number;
}

export interface ContactContext {
  contactId: string;
  contactName: string;
  platforms: Platform[];
  lastInteraction: Date;
  totalMessages: number;
  pendingItems: PendingItem[];
  recentTopics: string[];
  relationshipStrength: number;
}

export interface PendingItem {
  id: string;
  type: 'promise' | 'request' | 'deadline' | 'follow_up';
  description: string;
  sourceMessage: UnifiedMessage;
  deadline?: Date;
  status: 'pending' | 'completed' | 'overdue';
  createdAt: Date;
}

export interface CrossPlatformReminder {
  type: 'follow_up' | 'deadline' | 'context_switch' | 'promise_due';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  relatedContact: string;
  relatedPlatforms: Platform[];
  suggestedAction?: string;
  contextSummary?: string;
  createdAt: Date;
}

export interface ContextAnalysis {
  contactId: string;
  platforms: Platform[];
  summary: string;
  pendingItems: PendingItem[];
  suggestedReminders: CrossPlatformReminder[];
  topicsDiscussed: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

const CONTEXT_ANALYSIS_PROMPT = `你是小智的跨平台上下文分析模块。分析以下多平台对话，识别待办事项和智能提醒。

【分析维度】
1. 对话主题：识别讨论的核心话题
2. 待办事项：识别承诺、请求、截止日期
3. 情感基调：判断对话氛围
4. 智能提醒：基于上下文生成跨平台提醒建议

【输出格式】
{
  "summary": "对话摘要（2-3句话）",
  "topicsDiscussed": ["话题1", "话题2"],
  "sentiment": "positive/neutral/negative/mixed",
  "pendingItems": [
    {
      "type": "promise/request/deadline/follow_up",
      "description": "描述",
      "deadline": "YYYY-MM-DD或null"
    }
  ],
  "suggestedReminders": [
    {
      "type": "follow_up/deadline/context_switch/promise_due",
      "priority": "low/normal/high/urgent",
      "title": "提醒标题",
      "message": "提醒内容",
      "suggestedAction": "建议操作"
    }
  ]
}

【联系人】
姓名: {contactName}
平台: {platforms}

【对话记录】
{messages}`;

async function callDashScopeAPI(prompt: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured');
  }

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: '你是跨平台通讯分析助手，擅长整合不同平台的对话上下文。' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.3,
        max_tokens: 1500,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DashScope API error: ${error}`);
  }

  const data = await response.json();
  return data.output?.choices?.[0]?.message?.content || '';
}

function parseJSONResponse(text: string): Record<string, unknown> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      logger.error({ err: e }, '[CrossPlatformContext] Failed to parse JSON');
      return null;
    }
  }
  return null;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class CrossPlatformContextService {
  private messageStore: Map<string, UnifiedMessage[]> = new Map();
  private contactContexts: Map<string, ContactContext> = new Map();

  normalizeMessage(
    platform: Platform,
    platformMessageId: string,
    contactId: string,
    contactName: string,
    content: string,
    direction: 'incoming' | 'outgoing',
    timestamp: Date,
    messageType: 'text' | 'image' | 'file' | 'voice' | 'video' | 'link' | 'other' = 'text',
    rawContent?: unknown
  ): UnifiedMessage {
    const entities = this.extractEntities(content);
    
    const message: UnifiedMessage = {
      id: generateMessageId(),
      platform,
      platformMessageId,
      contactId,
      contactName,
      direction,
      messageType,
      content,
      rawContent,
      timestamp,
      isRead: false,
      isImportant: this.checkImportance(content, entities),
      extractedEntities: entities,
      relatedContextIds: [],
    };

    this.storeMessage(message);
    this.updateContactContext(message);
    
    return message;
  }

  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    const datePatterns = [
      /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/g,
      /(明天|后天|下周[一二三四五六日]|本周[一二三四五六日]|周末)/g,
      /(\d{1,2}月\d{1,2}[日号])/g,
    ];
    
    for (const pattern of datePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(m => {
          entities.push({ type: 'date', value: m, confidence: 0.9 });
        });
      }
    }
    
    const timePattern = /(\d{1,2}[点:：]\d{0,2}分?|上午|下午|晚上|早上)\s*(\d{1,2}[点:：]\d{0,2}分?)?/g;
    const timeMatches = content.match(timePattern);
    if (timeMatches) {
      timeMatches.forEach(m => {
        entities.push({ type: 'time', value: m.trim(), confidence: 0.85 });
      });
    }
    
    const moneyPattern = /[￥$]\s*[\d,]+\.?\d*|[\d,]+\.?\d*\s*(元|万|块|美元|刀)/g;
    const moneyMatches = content.match(moneyPattern);
    if (moneyMatches) {
      moneyMatches.forEach(m => {
        entities.push({ type: 'money', value: m, confidence: 0.9 });
      });
    }
    
    const phonePattern = /1[3-9]\d{9}|(\d{3,4}[-\s]?)?\d{7,8}/g;
    const phoneMatches = content.match(phonePattern);
    if (phoneMatches) {
      phoneMatches.forEach(m => {
        entities.push({ type: 'phone', value: m, confidence: 0.8 });
      });
    }
    
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
    const emailMatches = content.match(emailPattern);
    if (emailMatches) {
      emailMatches.forEach(m => {
        entities.push({ type: 'email', value: m, confidence: 0.95 });
      });
    }
    
    return entities;
  }

  private checkImportance(content: string, entities: ExtractedEntity[]): boolean {
    const importantKeywords = ['紧急', '重要', 'urgent', '马上', '立即', 'ASAP', '截止', '付款', '合同'];
    const hasImportantKeyword = importantKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()));
    const hasMoneyEntity = entities.some(e => e.type === 'money');
    const hasDeadline = entities.some(e => e.type === 'date' || e.type === 'time');
    
    return hasImportantKeyword || (hasMoneyEntity && hasDeadline);
  }

  private storeMessage(message: UnifiedMessage): void {
    const key = message.contactId;
    if (!this.messageStore.has(key)) {
      this.messageStore.set(key, []);
    }
    this.messageStore.get(key)!.push(message);
    
    const messages = this.messageStore.get(key)!;
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }
  }

  private updateContactContext(message: UnifiedMessage): void {
    let context = this.contactContexts.get(message.contactId);
    
    if (!context) {
      context = {
        contactId: message.contactId,
        contactName: message.contactName,
        platforms: [message.platform],
        lastInteraction: message.timestamp,
        totalMessages: 0,
        pendingItems: [],
        recentTopics: [],
        relationshipStrength: 0.5,
      };
      this.contactContexts.set(message.contactId, context);
    }
    
    if (!context.platforms.includes(message.platform)) {
      context.platforms.push(message.platform);
    }
    
    context.lastInteraction = message.timestamp;
    context.totalMessages++;
    context.relationshipStrength = Math.min(1, context.relationshipStrength + 0.01);
  }

  async analyzeContactContext(contactId: string): Promise<ContextAnalysis | null> {
    const messages = this.messageStore.get(contactId);
    if (!messages || messages.length === 0) {
      return null;
    }
    
    const context = this.contactContexts.get(contactId);
    if (!context) {
      return null;
    }

    const recentMessages = messages.slice(-20);
    const messagesText = recentMessages.map(m => 
      `[${m.platform}] ${m.direction === 'incoming' ? m.contactName : '我'}: ${m.content}`
    ).join('\n');

    const prompt = CONTEXT_ANALYSIS_PROMPT
      .replace('{contactName}', context.contactName)
      .replace('{platforms}', context.platforms.join(', '))
      .replace('{messages}', messagesText);

    try {
      const response = await callDashScopeAPI(prompt);
      const parsed = parseJSONResponse(response);

      if (!parsed) {
        return this.createFallbackAnalysis(contactId, context, messages);
      }

      const pendingItemsRaw = (parsed.pendingItems as Array<{ type?: string; description?: string; deadline?: string }>) || [];
      const suggestedRemindersRaw = (parsed.suggestedReminders as Array<{ type?: string; priority?: string; title?: string; message?: string; suggestedAction?: string }>) || [];
      const topicsDiscussedRaw = (parsed.topicsDiscussed as string[]) || [];
      const sentimentRaw = parsed.sentiment as string | undefined;

      return {
        contactId,
        platforms: context.platforms,
        summary: (parsed.summary as string) || '暂无摘要',
        pendingItems: pendingItemsRaw.map((p, i: number) => ({
          id: `pending_${contactId}_${i}`,
          type: (p.type as PendingItem['type']) || 'follow_up',
          description: p.description || '',
          sourceMessage: recentMessages[recentMessages.length - 1],
          deadline: p.deadline ? new Date(p.deadline) : undefined,
          status: 'pending' as const,
          createdAt: new Date(),
        })),
        suggestedReminders: suggestedRemindersRaw.map((r) => ({
          type: (r.type as CrossPlatformReminder['type']) || 'follow_up',
          priority: (r.priority as CrossPlatformReminder['priority']) || 'normal',
          title: r.title || '提醒',
          message: r.message || '',
          relatedContact: context.contactName,
          relatedPlatforms: context.platforms,
          suggestedAction: r.suggestedAction,
          createdAt: new Date(),
        })),
        topicsDiscussed: topicsDiscussedRaw,
        sentiment: (sentimentRaw as ContextAnalysis['sentiment']) || 'neutral',
      };
    } catch (error) {
      logger.error({ err: error }, '[CrossPlatformContext] Analysis failed');
      return this.createFallbackAnalysis(contactId, context, messages);
    }
  }

  private createFallbackAnalysis(
    contactId: string,
    context: ContactContext,
    messages: UnifiedMessage[]
  ): ContextAnalysis {
    return {
      contactId,
      platforms: context.platforms,
      summary: `与${context.contactName}的最近对话（${messages.length}条消息）`,
      pendingItems: [],
      suggestedReminders: [],
      topicsDiscussed: [],
      sentiment: 'neutral',
    };
  }

  generateCrossAppReminder(
    contexts: ContextAnalysis[]
  ): CrossPlatformReminder[] {
    const reminders: CrossPlatformReminder[] = [];

    for (const ctx of contexts) {
      for (const pending of ctx.pendingItems) {
        if (pending.deadline && pending.deadline <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
          reminders.push({
            type: 'deadline',
            priority: 'high',
            title: `截止日期提醒`,
            message: `与${ctx.contactId}相关: ${pending.description}`,
            relatedContact: ctx.contactId,
            relatedPlatforms: ctx.platforms,
            suggestedAction: `在${ctx.platforms[0]}上跟进`,
            createdAt: new Date(),
          });
        }
      }

      reminders.push(...ctx.suggestedReminders);
    }

    return reminders.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getContactMessages(contactId: string, limit: number = 50): UnifiedMessage[] {
    const messages = this.messageStore.get(contactId) || [];
    return messages.slice(-limit);
  }

  getContactContext(contactId: string): ContactContext | undefined {
    return this.contactContexts.get(contactId);
  }

  getAllContacts(): ContactContext[] {
    return Array.from(this.contactContexts.values());
  }

  searchMessages(query: string, platform?: Platform): UnifiedMessage[] {
    const results: UnifiedMessage[] = [];
    const lowerQuery = query.toLowerCase();

    this.messageStore.forEach((messages) => {
      for (const msg of messages) {
        if (platform && msg.platform !== platform) continue;
        if (msg.content.toLowerCase().includes(lowerQuery)) {
          results.push(msg);
        }
      }
    });

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 100);
  }

  clearContext(contactId?: string): void {
    if (contactId) {
      this.messageStore.delete(contactId);
      this.contactContexts.delete(contactId);
    } else {
      this.messageStore.clear();
      this.contactContexts.clear();
    }
  }
}

export const crossPlatformContext = new CrossPlatformContextService();
