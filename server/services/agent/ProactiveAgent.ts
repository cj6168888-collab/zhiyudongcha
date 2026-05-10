/**
 * ProactiveAgent - 主动式 AI 助手
 *
 * 核心理念：不需要用户下命令，AI 主动理解上下文、预测需求、提前行动
 *
 * 功能：
 * - 自动识别对话中的约定、任务、时间点
 * - 主动创建日历和提醒
 * - 提前规划行程和导航
 * - 智能预判用户需求
 * - 主动推送提醒和建议
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('ProactiveAgent');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

export interface ConversationContext {
  source: 'wechat' | 'whatsapp' | 'sms' | 'phone' | 'meeting' | 'other';
  participants: string[];
  time?: Date;
  location?: string;
  topic?: string;
}

export interface ExtractedCommitment {
  id: string;

  // 基本信息
  type: 'meeting' | 'pickup' | 'appointment' | 'deadline' | 'reminder' | 'promise';
  title: string;
  description: string;

  // 时间
  startTime?: Date;
  endTime?: Date;
  allDay?: boolean;

  // 地点
  location?: string;
  address?: string;

  // 关联人
  participants: string[];

  // 物品/备注
  items?: string[];  // 车牌号、文件等
  notes?: string;

  // 置信度
  confidence: number;

  // 行动建议
  suggestedActions: Action[];
}

export interface Action {
  type: 'calendar' | 'reminder' | 'navigation' | 'booking' | 'notify' | 'suggest';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  executeAutomatically?: boolean;
  params: Record<string, unknown>;
}

export interface ProactiveResult {
  commitments: ExtractedCommitment[];
  actions: Action[];
  suggestions: string[];
}

class ProactiveAgent {
  private static instance: ProactiveAgent | null = null;

  private aiProvider: AIProviderChain;

  // 通知回调
  private notifyCallback?: (type: string, title: string, body: string, data?: unknown) => Promise<void>;

  private constructor() {
    this.aiProvider = new AIProviderChain();
  }

  public static getInstance(): ProactiveAgent {
    if (!ProactiveAgent.instance) {
      ProactiveAgent.instance = new ProactiveAgent();
    }
    return ProactiveAgent.instance;
  }

  /**
   * 设置通知回调
   */
  public setNotifyCallback(
    callback: (type: string, title: string, body: string, data?: unknown) => Promise<void>
  ): void {
    this.notifyCallback = callback;
  }

  /**
   * 处理对话内容（自动调用）
   */
  public async processConversation(
    content: string,
    context: ConversationContext
  ): Promise<ProactiveResult> {
    logger.info({ source: context.source, contentLength: content.length }, 'Processing conversation');

    const result: ProactiveResult = {
      commitments: [],
      actions: [],
      suggestions: [],
    };

    // 使用 AI 分析对话内容
    const analysis = await this.analyzeConversation(content, context);

    result.commitments = analysis.commitments;

    // 为每个承诺生成行动建议
    for (const commitment of result.commitments) {
      const actions = this.generateActions(commitment);
      result.actions.push(...actions);

      // 执行高优先级自动操作
      for (const action of actions) {
        if (action.executeAutomatically && action.priority === 'high') {
          await this.executeAction(action);
        }
      }
    }

    // 生成建议
    result.suggestions = this.generateSuggestions(result);

    return result;
  }

  /**
   * 分析对话，提取承诺和约定
   */
  private async analyzeConversation(
    content: string,
    context: ConversationContext
  ): Promise<{ commitments: ExtractedCommitment[] }> {
    const systemPrompt = `你是一个智能助手，能够从对话中自动识别：

1. **约定/承诺** - 双方约定要做的事
2. **时间点** - 具体的时间
3. **地点** - 具体的地址
4. **联系人** - 相关的人
5. **物品/备注** - 车牌号、文件等特殊信息

支持的约定类型：
- meeting: 会议/会面
- pickup: 接人
- appointment: 预约/办事
- deadline: 截止时间
- reminder: 提醒事项
- promise: 承诺

请分析以下对话，提取所有约定信息。

返回JSON格式：
{
  "commitments": [
    {
      "type": "meeting|pickup|appointment|deadline|reminder|promise",
      "title": "简短标题",
      "description": "详细描述",
      "startTime": "ISO时间格式（如有）",
      "endTime": "ISO时间格式（如有）",
      "location": "地点名称",
      "address": "详细地址（如有）",
      "participants": ["参与人"],
      "items": ["特殊物品，如车牌号"],
      "confidence": 0.0-1.0
    }
  ]
}`;

    const conversationText = `
对话来源: ${context.source}
参与者: ${context.participants.join(', ')}

对话内容:
${content}
`;

    const response = await this.aiProvider.chat(conversationText, systemPrompt, {
      temperature: 0.3,
      maxTokens: 2000,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return {
          commitments: (parsed.commitments || []).map((c: Record<string, unknown>) => ({
            id: `commit_${randomUUID().slice(0, 8)}`,
            ...c,
            suggestedActions: [],
          })),
        };
      }
    } catch {
      logger.warn({ response }, 'Failed to parse conversation analysis');
    }

    return { commitments: [] };
  }

  /**
   * 为约定生成行动建议
   */
  private generateActions(commitment: ExtractedCommitment): Action[] {
    const actions: Action[] = [];

    // 日历事件
    if (commitment.startTime) {
      actions.push({
        type: 'calendar',
        title: '创建日历事件',
        description: `为「${commitment.title}」创建日历`,
        priority: 'high',
        executeAutomatically: true,
        params: {
          title: commitment.title,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
          location: commitment.location,
          description: commitment.description,
        },
      });

      // 提醒
      const reminderTime = new Date(commitment.startTime.getTime() - 30 * 60 * 1000); // 提前30分钟
      if (reminderTime > new Date()) {
        actions.push({
          type: 'reminder',
          title: '设置提醒',
          description: `提前30分钟提醒`,
          priority: 'high',
          executeAutomatically: true,
          params: {
            time: reminderTime,
            title: commitment.title,
            message: this.buildReminderMessage(commitment),
          },
        });
      }
    }

    // 导航
    if (commitment.location) {
      actions.push({
        type: 'navigation',
        title: '设置导航',
        description: `导航到 ${commitment.location}`,
        priority: 'medium',
        executeAutomatically: false,
        params: {
          destination: commitment.location,
          arrivalTime: commitment.startTime,
        },
      });
    }

    // 物品提醒
    if (commitment.items && commitment.items.length > 0) {
      actions.push({
        type: 'reminder',
        title: '物品提醒',
        description: `提醒带上: ${commitment.items.join(', ')}`,
        priority: 'medium',
        executeAutomatically: true,
        params: {
          time: commitment.startTime,
          title: '别忘了带这些',
          items: commitment.items,
        },
      });
    }

    // 主动建议
    const suggestions = this.generateCommitmentSuggestions(commitment);
    for (const suggestion of suggestions) {
      actions.push({
        type: 'suggest',
        title: suggestion.title,
        description: suggestion.description,
        priority: 'low',
        executeAutomatically: false,
        params: suggestion.params || {},
      });
    }

    return actions;
  }

  /**
   * 生成约定相关的建议
   */
  private generateCommitmentSuggestions(commitment: ExtractedCommitment): { title: string; description: string; params?: Record<string, unknown> }[] {
    const suggestions: { title: string; description: string; params?: Record<string, unknown> }[] = [];

    // 接人场景
    if (commitment.type === 'pickup') {
      suggestions.push({
        title: '预订酒店',
        description: '你们要喝酒，建议提前预订酒店',
        params: { type: 'hotel', location: commitment.location },
      });

      suggestions.push({
        title: '查询天气',
        description: '查看今晚目的地的天气',
        params: { type: 'weather', location: commitment.location },
      });
    }

    // 会议场景
    if (commitment.type === 'meeting') {
      suggestions.push({
        title: '准备材料',
        description: '是否需要准备相关材料',
      });
    }

    return suggestions;
  }

  /**
   * 生成综合建议
   */
  private generateSuggestions(result: ProactiveResult): string[] {
    const suggestions: string[] = [];

    if (result.commitments.length > 0) {
      suggestions.push(`发现 ${result.commitments.length} 个约定/承诺`);
    }

    if (result.actions.some(a => a.type === 'navigation')) {
      suggestions.push('已设置导航目的地');
    }

    if (result.actions.some(a => a.type === 'reminder')) {
      suggestions.push('已设置提醒');
    }

    return suggestions;
  }

  /**
   * 构建提醒消息
   */
  private buildReminderMessage(commitment: ExtractedCommitment): string {
    let message = commitment.title;

    if (commitment.location) {
      message += `\n📍 ${commitment.location}`;
    }

    if (commitment.participants.length > 0) {
      message += `\n👤 ${commitment.participants.join(', ')}`;
    }

    if (commitment.items && commitment.items.length > 0) {
      message += `\n📦 带上: ${commitment.items.join(', ')}`;
    }

    return message;
  }

  /**
   * 执行行动
   */
  private async executeAction(action: Action): Promise<void> {
    logger.info({ actionType: action.type, title: action.title }, 'Executing action');

    switch (action.type) {
      case 'calendar':
        await this.createCalendarEvent(action.params);
        break;

      case 'reminder':
        await this.createReminder(action.params);
        break;

      case 'navigation':
        await this.setupNavigation(action.params);
        break;

      case 'notify':
        await this.sendNotification(action.params);
        break;
    }
  }

  /**
   * 创建日历事件
   */
  private async createCalendarEvent(params: Record<string, unknown>): Promise<void> {
    logger.info({ title: params.title, time: params.startTime }, 'Creating calendar event');
    // 这里应该调用日历服务
    // await calendarService.createEvent(params);
  }

  /**
   * 创建提醒
   */
  private async createReminder(params: Record<string, unknown>): Promise<void> {
    logger.info({ title: params.title, time: params.time }, 'Creating reminder');
    // 这里应该调用提醒服务
    // await reminderService.create(params);
  }

  /**
   * 设置导航
   */
  private async setupNavigation(params: Record<string, unknown>): Promise<void> {
    logger.info({ destination: params.destination }, 'Setting up navigation');
    // 这里应该调用导航服务
    // await navigationService.setDestination(params);
  }

  /**
   * 发送通知
   */
  private async sendNotification(params: Record<string, unknown>): Promise<void> {
    if (this.notifyCallback) {
      await this.notifyCallback(
        (params.type as string) || 'info',
        params.title as string,
        params.message as string,
        params.data
      );
    }
  }

  /**
   * 主动推送提醒（定时检查）
   */
  public async checkAndRemind(): Promise<void> {
    const now = new Date();

    // 检查是否有即将到来的事件需要提醒
    // 这里应该查询数据库中的日历事件
    // 如果有匹配的事件，发送推送

    logger.debug({ now }, 'Checking for pending reminders');
  }

  /**
   * 处理语音消息
   */
  public async processVoiceMessage(
    audioUrl: string,
    context: ConversationContext
  ): Promise<ProactiveResult> {
    // 实际应该先调用语音转文字
    // const text = await speechToText(audioUrl);

    // 暂时用模拟数据
    const text = '模拟的语音转文字结果';

    return this.processConversation(text, context);
  }

  /**
   * 处理消息摘要（用于显示通知）
   */
  public generateNotificationSummary(result: ProactiveResult): string {
    if (result.commitments.length === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const commitment of result.commitments) {
      const timeStr = commitment.startTime
        ? commitment.startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '';

      lines.push(`${timeStr} ${commitment.title}`);
    }

    return lines.join('\n');
  }
}

export const proactiveAgent = ProactiveAgent.getInstance();
export default proactiveAgent;
