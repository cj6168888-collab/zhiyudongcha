/**
 * MeetingAgent - 智能会议助手
 *
 * 功能：
 * - 智能理解会议需求
 * - 自动创建会议日程（支持循环）
 * - 收集会议资料
 * - 生成会议议程
 * - 通知参会人员
 * - 记录会议内容
 * - 跟进会议任务
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('MeetingAgent');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

export interface Meeting {
  id: string;

  // 基本信息
  title: string;
  description?: string;
  type: '周会' | '月会' | '项目会议' | '一对一' | '全员会' | '其他';

  // 时间
  startTime: Date;
  endTime: Date;
  timezone: string;

  // 循环规则
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;  // 每几周/天/月
    daysOfWeek?: number[];  // 周几 (0=周日, 1=周一...)
    endDate?: Date;
    count?: number;  // 重复次数
  };

  // 参与者
  organizer: string;
  participants: Participant[];

  // 会议资料
  materials: Material[];

  // 议程
  agenda: AgendaItem[];

  // 会议记录
  minutes?: string;
  tasks?: Task[];

  // 状态
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

  // 来源
  source?: string;  // 'command' | 'calendar' | 'email'
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: 'organizer' | 'required' | 'optional';
  status?: 'pending' | 'accepted' | 'declined' | 'tentative';
  responseTime?: Date;
}

export interface Material {
  id: string;
  title: string;
  type: 'report' | 'document' | 'slide' | 'data' | 'link';
  content?: string;
  url?: string;
  preparedBy?: string;
  preparedAt?: Date;
  status: 'pending' | 'ready' | 'shared';
}

export interface AgendaItem {
  id: string;
  title: string;
  duration: number;  // 分钟
  presenter?: string;
  description?: string;
  materials?: string[];
  completed: boolean;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface MeetingRequest {
  // 自然语言描述
  description?: string;

  // 明确参数
  title?: string;
  type?: string;
  startTime?: Date;
  duration?: number;
  participants?: string[];
  recurrence?: Partial<Meeting['recurrence']>;

  // 资料相关
  collectMaterials?: boolean;
  materialTypes?: string[];

  // 其他
  generateAgenda?: boolean;
  notifyParticipants?: boolean;
}

export interface MeetingResult {
  success: boolean;
  meeting?: Meeting;
  actions: Action[];
  messages: string[];
}

export interface Action {
  type: 'calendar' | 'notification' | 'email' | 'document' | 'suggest';
  title: string;
  description: string;
  params: Record<string, unknown>;
}

class MeetingAgent {
  private static instance: MeetingAgent | null = null;

  private aiProvider: AIProviderChain;

  // 用户团队信息
  private teamMembers: Map<string, { name: string; role?: string; email?: string }> = new Map();

  private constructor() {
    this.aiProvider = new AIProviderChain();
  }

  public static getInstance(): MeetingAgent {
    if (!MeetingAgent.instance) {
      MeetingAgent.instance = new MeetingAgent();
    }
    return MeetingAgent.instance;
  }

  /**
   * 设置团队成员
   */
  public setTeamMembers(members: Array<{ id: string; name: string; role?: string; email?: string }>): void {
    for (const member of members) {
      this.teamMembers.set(member.id, { name: member.name, role: member.role, email: member.email });
    }
    logger.info({ count: members.length }, 'Team members loaded');
  }

  /**
   * 主入口：处理会议请求
   */
  public async processRequest(request: MeetingRequest): Promise<MeetingResult> {
    const result: MeetingResult = {
      success: false,
      actions: [],
      messages: [],
    };

    logger.info({ request }, 'Processing meeting request');

    try {
      // 1. 解析需求
      const parsed = await this.parseRequest(request);

      // 2. 创建会议
      const meeting = this.createMeeting(parsed);
      result.meeting = meeting;

      // 3. 生成行动
      result.actions = this.generateActions(meeting, parsed);

      // 4. 执行自动行动
      for (const action of result.actions) {
        if (action.type !== 'suggest') {
          await this.executeAction(action);
        }
      }

      result.success = true;
      result.messages.push(`会议「${meeting.title}」已创建`);

      if (meeting.recurrence) {
        result.messages.push(`已设置每周${this.getDayName(meeting.recurrence.daysOfWeek?.[0])}重复`);
      }

      if (parsed.collectMaterials) {
        result.messages.push(`已向 ${meeting.participants.length} 位成员发送资料收集通知`);
      }

    } catch (error) {
      logger.error({ err: error }, 'Failed to process meeting request');
      result.messages.push(`处理失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * 解析会议需求
   */
  private async parseRequest(request: MeetingRequest): Promise<{
    title: string;
    type: string;
    startTime: Date;
    duration: number;
    participants: string[];
    recurrence?: Meeting['recurrence'];
    collectMaterials: boolean;
    generateAgenda: boolean;
    description: string;
  }> {
    // 如果有自然语言描述，用AI解析
    if (request.description) {
      return this.parseNaturalLanguage(request.description, request);
    }

    // 使用明确参数
    return {
      title: request.title || '团队会议',
      type: request.type || '周会',
      startTime: request.startTime || this.getNextWeekday(1, 9),  // 下周一上午9点
      duration: request.duration || 60,
      participants: request.participants || [],
      recurrence: request.recurrence,
      collectMaterials: request.collectMaterials !== false,
      generateAgenda: request.generateAgenda !== false,
      description: request.description || '',
    };
  }

  /**
   * 自然语言解析
   */
  private async parseNaturalLanguage(
    description: string,
    fallback: Partial<MeetingRequest>
  ): Promise<{
    title: string;
    type: string;
    startTime: Date;
    duration: number;
    participants: string[];
    recurrence?: Meeting['recurrence'];
    collectMaterials: boolean;
    generateAgenda: boolean;
    description: string;
  }> {
    const systemPrompt = `分析以下会议需求，提取关键信息：

需求描述：
${description}

请提取：
1. 会议类型（周会/月会/项目会议/一对一/全员会/其他）
2. 会议时间（具体时间或相对时间，如"明天上午"）
3. 会议时长（分钟）
4. 参会人员
5. 是否需要资料收集
6. 是否需要生成议程
7. 是否是循环会议
8. 会议目的/主题

返回JSON格式：
{
  "title": "会议标题",
  "type": "周会/月会/项目会议/一对一/全员会/其他",
  "startTime": "ISO时间格式",
  "duration": 分钟数,
  "participants": ["参会人员（如有）"],
  "recurrence": {
    "frequency": "weekly/monthly",
    "daysOfWeek": [1],  // 周一=1
    "endDate": "可选，循环结束日期"
  },
  "collectMaterials": true/false,
  "generateAgenda": true/false
}`;

    const response = await this.aiProvider.chat(description, systemPrompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);

        // 处理时间
        let startTime: Date;
        if (parsed.startTime) {
          startTime = new Date(parsed.startTime);
        } else {
          // 默认明天上午9点
          startTime = this.getNextWeekday(1, 9);
        }

        return {
          title: parsed.title || fallback.title || '团队会议',
          type: parsed.type || fallback.type || '周会',
          startTime,
          duration: parsed.duration || fallback.duration || 60,
          participants: parsed.participants || fallback.participants || [],
          recurrence: parsed.recurrence || fallback.recurrence,
          collectMaterials: parsed.collectMaterials !== false,
          generateAgenda: parsed.generateAgenda !== false,
          description,
        };
      }
    } catch {
      logger.warn({ response }, 'Failed to parse natural language');
    }

    // 默认解析
    return {
      title: '团队周会',
      type: '周会',
      startTime: this.getNextWeekday(1, 9),
      duration: 60,
      participants: [],
      recurrence: fallback.recurrence,
      collectMaterials: true,
      generateAgenda: true,
      description,
    };
  }

  /**
   * 创建会议
   */
  private createMeeting(parsed: ReturnType<typeof this.parseNaturalLanguage>): Meeting {
    const endTime = new Date(parsed.startTime.getTime() + parsed.duration * 60 * 1000);

    // 获取参与者
    const participants: Participant[] = parsed.participants.map((p, i) => ({
      id: `p_${i}`,
      name: p,
      role: i === 0 ? 'organizer' : 'required',
      status: 'pending',
    }));

    // 如果有团队成员且没有指定参与者，加入所有人
    if (this.teamMembers.size > 0 && participants.length === 0) {
      participants.length = 0;
      participants.push({
        id: 'organizer',
        name: '我',
        role: 'organizer',
        status: 'accepted',
      });
      for (const [id, member] of this.teamMembers) {
        participants.push({
          id,
          name: member.name,
          email: member.email,
          role: 'required',
          status: 'pending',
        });
      }
    }

    return {
      id: `mtg_${randomUUID().slice(0, 8)}`,
      title: parsed.title,
      type: parsed.type as Meeting['type'],
      description: parsed.description,
      startTime: parsed.startTime,
      endTime,
      timezone: 'Asia/Shanghai',
      recurrence: parsed.recurrence,
      organizer: '我',
      participants,
      materials: [],
      agenda: [],
      status: 'scheduled',
      source: 'command',
    };
  }

  /**
   * 生成行动
   */
  private generateActions(meeting: Meeting, parsed: { collectMaterials: boolean; generateAgenda: boolean }): Action[] {
    const actions: Action[] = [];

    // 1. 创建日历
    actions.push({
      type: 'calendar',
      title: '创建日历事件',
      description: `${meeting.title} - ${meeting.startTime.toLocaleString('zh-CN')}`,
      params: {
        meetingId: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        recurrence: meeting.recurrence,
        participants: meeting.participants.map(p => p.email || p.name),
      },
    });

    // 2. 通知参会者
    if (meeting.participants.length > 0) {
      actions.push({
        type: 'notification',
        title: '通知参会人员',
        description: `向 ${meeting.participants.length} 位成员发送会议邀请`,
        params: {
          meetingId: meeting.id,
          participants: meeting.participants,
          message: this.generateMeetingNotification(meeting),
        },
      });
    }

    // 3. 收集资料
    if (parsed.collectMaterials) {
      actions.push({
        type: 'notification',
        title: '收集会议资料',
        description: '请团队成员提交上周工作总结',
        params: {
          type: 'material_request',
          meetingId: meeting.id,
          request: this.generateMaterialRequest(meeting),
          recipients: meeting.participants.filter(p => p.role !== 'organizer').map(p => p.id),
        },
      });

      // 4. 收集我的总结
      actions.push({
        type: 'suggest',
        title: '准备工作总结',
        description: '请准备你的上周工作总结（由AI自动从项目数据中提取）',
        params: {
          type: 'my_report',
          meetingId: meeting.id,
          template: this.generateReportTemplate(meeting),
        },
      });
    }

    // 5. 生成议程
    if (parsed.generateAgenda) {
      actions.push({
        type: 'document',
        title: '生成会议议程',
        description: '根据会议类型和目的自动生成议程',
        params: {
          meetingId: meeting.id,
          type: meeting.type,
          purpose: meeting.description,
        },
      });
    }

    return actions;
  }

  /**
   * 生成会议通知消息
   */
  private generateMeetingNotification(meeting: Meeting): string {
    const time = meeting.startTime.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    let message = `📅 会议邀请\n\n`;
    message += `「${meeting.title}」\n\n`;
    message += `⏰ ${time}\n`;
    message += `⏱ ${meeting.duration || 60}分钟\n`;

    if (meeting.recurrence) {
      message += `🔄 每周${this.getDayName(meeting.recurrence.daysOfWeek?.[0])}重复\n`;
    }

    message += `\n请确认是否参加`;

    return message;
  }

  /**
   * 生成资料收集请求
   */
  private generateMaterialRequest(meeting: Meeting): string {
    let request = `📋 会议资料准备\n\n`;
    request += `「${meeting.title}」将于 ${meeting.startTime.toLocaleString('zh-CN')} 召开\n\n`;
    request += `请准备以下内容：\n\n`;

    switch (meeting.type) {
      case '周会':
        request += `1. 上周工作完成情况\n`;
        request += `2. 本周工作计划\n`;
        request += `3. 遇到的问题和需要的支持\n`;
        break;
      case '月会':
        request += `1. 本月工作总结\n`;
        request += `2. KPI完成情况\n`;
        request += `3. 下月工作计划\n`;
        break;
      default:
        request += `1. 相关工作汇报\n`;
        request += `2. 需要讨论的问题\n`;
    }

    request += `\n请在会议前提交到共享文档`;

    return request;
  }

  /**
   * 生成汇报模板
   */
  private generateReportTemplate(meeting: Meeting): string {
    switch (meeting.type) {
      case '周会':
        return `# 上周工作总结

## 1. 完成的工作
-

## 2. 关键成果
-

## 3. 遇到的问题
-

## 4. 下周计划
-

---
*此模板由AI辅助生成`;
      default:
        return `# 工作汇报

## 内容
-
`;
    }
  }

  /**
   * 执行行动
   */
  private async executeAction(action: Action): Promise<void> {
    logger.info({ type: action.type, title: action.title }, 'Executing action');

    switch (action.type) {
      case 'calendar':
        // 创建日历事件
        await this.createCalendarEvent(action.params);
        break;

      case 'notification':
        // 发送通知
        await this.sendNotification(action.params);
        break;

      case 'document':
        // 生成文档
        await this.generateDocument(action.params);
        break;
    }
  }

  /**
   * 创建日历事件
   */
  private async createCalendarEvent(params: Record<string, unknown>): Promise<void> {
    logger.info(params, 'Creating calendar event');
    // 实际应该调用日历API
  }

  /**
   * 发送通知
   */
  private async sendNotification(params: Record<string, unknown>): Promise<void> {
    logger.info(params, 'Sending notification');
    // 实际应该调用消息推送服务
  }

  /**
   * 生成文档
   */
  private async generateDocument(params: Record<string, unknown>): Promise<{ agenda: AgendaItem[] }> {
    const agenda = this.generateDefaultAgenda(params.type);
    logger.info({ agendaLength: agenda.length }, 'Generated agenda');
    return { agenda };
  }

  /**
   * 生成默认议程
   */
  private generateDefaultAgenda(type: string): AgendaItem[] {
    switch (type) {
      case '周会':
        return [
          { id: '1', title: '上周工作总结', duration: 20, completed: false },
          { id: '2', title: '本周工作安排', duration: 15, completed: false },
          { id: '3', title: '问题与支持需求', duration: 10, completed: false },
          { id: '4', title: '任务分配与确认', duration: 10, completed: false },
          { id: '5', title: '自由讨论', duration: 5, completed: false },
        ];
      case '月会':
        return [
          { id: '1', title: '本月工作汇报', duration: 25, completed: false },
          { id: '2', title: 'KPI完成情况', duration: 15, completed: false },
          { id: '3', title: '问题分析', duration: 15, completed: false },
          { id: '4', title: '下月计划', duration: 10, completed: false },
        ];
      default:
        return [
          { id: '1', title: '开场', duration: 5, completed: false },
          { id: '2', title: '主题讨论', duration: 40, completed: false },
          { id: '3', title: '总结与下一步', duration: 15, completed: false },
        ];
    }
  }

  /**
   * 获取下周几的日期
   */
  private getNextWeekday(dayOfWeek: number, hour: number): Date {
    const now = new Date();
    const result = new Date();
    result.setHours(hour, 0, 0, 0);

    // 计算距离下一个目标星期几的天数
    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;

    // 如果是今天，检查是否已过时间
    if (daysUntil === 0 && now.getHours() >= hour) {
      daysUntil = 7;  // 推到下周的这一天
    } else if (daysUntil < 0) {
      daysUntil += 7;
    }

    result.setDate(now.getDate() + daysUntil);
    return result;
  }

  /**
   * 获取星期几的名称
   */
  private getDayName(dayOfWeek?: number): string {
    if (dayOfWeek === undefined) return '';
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[dayOfWeek] || '';
  }

  /**
   * 生成会议纪要
   */
  public async generateMinutes(meetingId: string, discussions: string[]): Promise<string> {
    const systemPrompt = `根据以下会议讨论内容，生成会议纪要：

讨论内容：
${discussions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

要求：
1. 结构清晰，分点总结
2. 突出决策和结论
3. 明确任务和负责人
4. 简洁明了，适合阅读`;

    const minutes = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.5,
      maxTokens: 2000,
    });

    return minutes;
  }

  /**
   * 从项目数据提取工作总结
   */
  public async extractWorkSummary(userId: string, weekNumber?: number): Promise<string> {
    // 实际应该从项目管理系统、代码仓库、文档等提取
    logger.info({ userId, weekNumber }, 'Extracting work summary');

    return `# 上周工作总结

## 已完成
- 项目A: 完成模块开发
- 项目B: 修复3个bug

## 进行中
- 项目C: 开发中 (60%)

## 待处理
- 项目D: 等待设计稿`;
  }
}

export const meetingAgent = MeetingAgent.getInstance();
export default meetingAgent;
