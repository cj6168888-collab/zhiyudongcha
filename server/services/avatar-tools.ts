/**
 * 小智业务工具集 - 扩展Function Calling能力
 * 
 * 提供联系人、项目、提醒、日程等核心业务功能的工具定义
 * 通过语音或文字指令即可触发执行
 */

import { functionCallingService, type ToolDefinition } from './function-calling';
import { getDatabase } from '../db';
import { persons, projects, reminderRules, calendarEvents } from '@shared/schema';
import { eq, ilike, desc, sql } from 'drizzle-orm';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('AvatarTools');

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function registerAvatarTools(): void {
  logger.info('注册小智业务工具集...');

  functionCallingService.registerTool({
    name: 'create_contact',
    description: '创建新联系人。当用户说"帮我记住某人"、"添加联系人"、"新建联系人"时调用',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '联系人姓名' },
        organization: { type: 'string', description: '所属组织/公司' },
        role: { type: 'string', description: '职位/角色' },
        phone: { type: 'string', description: '电话号码' },
        email: { type: 'string', description: '电子邮箱' },
        notes: { type: 'string', description: '备注信息' },
        tags: { type: 'array', description: '标签列表' },
      },
      required: ['name'],
    },
    handler: async (args) => {
      const [person] = await getDatabase().insert(persons).values({
        name: args.name as string,
        organization: args.organization as string | undefined,
        role: args.role as string | undefined,
        tags: args.tags as string[] | undefined,
        notes: args.notes as string | undefined,
        addedBy: 'VOICE_COMMAND',
      }).returning();
      
      logger.info({ personId: person.id, name: args.name }, '语音创建联系人');
      return {
        success: true,
        message: `已创建联系人: ${args.name}`,
        person: { id: person.id, name: person.name, organization: person.organization },
      };
    },
    category: 'contacts',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'search_contacts',
    description: '搜索联系人。当用户说"找一下某人"、"查询联系人"、"某人的信息"时调用',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词（姓名、组织或标签）' },
        limit: { type: 'number', description: '返回数量限制，默认5' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const query = args.query as string;
      const limit = (args.limit as number) || 5;
      
      const results = await getDatabase().select()
        .from(persons)
        .where(ilike(persons.name, `%${query}%`))
        .limit(limit);
      
      if (results.length === 0) {
        const orgResults = await getDatabase().select()
          .from(persons)
          .where(ilike(persons.organization, `%${query}%`))
          .limit(limit);
        
        if (orgResults.length > 0) {
          return {
            success: true,
            message: `找到 ${orgResults.length} 个相关联系人`,
            contacts: orgResults.map(p => ({
              id: p.id,
              name: p.name,
              organization: p.organization,
              role: p.role,
            })),
          };
        }
      }
      
      return {
        success: true,
        message: results.length > 0 ? `找到 ${results.length} 个联系人` : '未找到匹配的联系人',
        contacts: results.map(p => ({
          id: p.id,
          name: p.name,
          organization: p.organization,
          role: p.role,
        })),
      };
    },
    category: 'contacts',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'create_project',
    description: '创建新项目。当用户说"新建项目"、"开始一个项目"、"创建任务"时调用',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '项目标题' },
        description: { type: 'string', description: '项目描述' },
        category: { type: 'string', description: '项目类别', enum: ['BUSINESS', 'PERSONAL', 'LEGAL', 'TECHNICAL', 'GENERAL'] },
        priority: { type: 'number', description: '优先级1-10' },
        deadline: { type: 'string', description: '截止日期' },
      },
      required: ['title'],
    },
    handler: async (args) => {
      const [project] = await getDatabase().insert(projects).values({
        title: args.title as string,
        description: args.description as string | undefined,
        category: (args.category as string) || 'GENERAL',
        priority: (args.priority as number) || 5,
        status: 'PENDING_REVIEW',
      }).returning();
      
      logger.info({ projectId: project.id, title: args.title }, '语音创建项目');
      return {
        success: true,
        message: `已创建项目: ${args.title}`,
        project: { id: project.id, title: project.title, status: project.status },
      };
    },
    category: 'projects',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'search_projects',
    description: '搜索项目。当用户说"查看项目"、"项目进度"、"有什么项目"时调用',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        status: { type: 'string', description: '项目状态筛选' },
        limit: { type: 'number', description: '返回数量限制' },
      },
    },
    handler: async (args) => {
      const limit = (args.limit as number) || 5;
      let query = getDatabase().select().from(projects).orderBy(desc(projects.createdAt)).limit(limit);
      
      const results = await query;
      
      return {
        success: true,
        message: results.length > 0 ? `找到 ${results.length} 个项目` : '暂无项目',
        projects: results.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          priority: p.priority,
        })),
      };
    },
    category: 'projects',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'create_reminder',
    description: '创建提醒。当用户说"提醒我"、"别忘了"、"记得"时调用',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提醒内容' },
        time: { type: 'string', description: '提醒时间，如"明天下午3点"、"10分钟后"' },
        repeat: { type: 'string', description: '重复规则', enum: ['once', 'daily', 'weekly', 'monthly'] },
        priority: { type: 'string', description: '优先级', enum: ['low', 'medium', 'high'] },
      },
      required: ['message'],
    },
    handler: async (args) => {
      const timeStr = args.time as string || '稍后';
      
      const [reminder] = await getDatabase().insert(reminderRules).values({
        title: args.message as string,
        ruleType: 'VOICE_REMINDER',
        triggerType: 'TIME',
        triggerConfig: { timeDescription: timeStr },
        enabled: true,
      }).returning();
      
      logger.info({ reminderId: reminder.id, message: args.message }, '语音创建提醒');
      return {
        success: true,
        message: `好的，我会${timeStr}提醒你: ${args.message}`,
        reminder: { id: reminder.id, title: reminder.title },
      };
    },
    category: 'productivity',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'create_calendar_event',
    description: '创建日程。当用户说"安排会议"、"添加日程"、"预约"时调用',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '日程标题' },
        startTime: { type: 'string', description: '开始时间' },
        endTime: { type: 'string', description: '结束时间' },
        location: { type: 'string', description: '地点' },
        description: { type: 'string', description: '描述' },
        participants: { type: 'array', description: '参与者列表' },
      },
      required: ['title'],
    },
    handler: async (args) => {
      const now = new Date();
      
      const [event] = await getDatabase().insert(calendarEvents).values({
        title: args.title as string,
        description: args.description as string | undefined,
        location: args.location as string | undefined,
        startTime: now,
        endTime: new Date(now.getTime() + 3600000),
        eventType: 'MEETING',
      }).returning();
      
      logger.info({ eventId: event.id, title: args.title }, '语音创建日程');
      return {
        success: true,
        message: `已安排日程: ${args.title}`,
        event: { id: event.id, title: event.title },
      };
    },
    category: 'calendar',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'get_daily_summary',
    description: '获取今日概览。当用户说"今天有什么安排"、"今日概览"、"有什么要做的"时调用',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const projectCount = await getDatabase().select({ count: sql<number>`count(*)` }).from(projects);
      const contactCount = await getDatabase().select({ count: sql<number>`count(*)` }).from(persons);
      const reminderCount = await getDatabase().select({ count: sql<number>`count(*)` }).from(reminderRules).where(eq(reminderRules.enabled, true));
      
      return {
        success: true,
        message: '今日概览',
        summary: {
          date: today.toLocaleDateString('zh-CN'),
          projects: projectCount[0]?.count || 0,
          contacts: contactCount[0]?.count || 0,
          activeReminders: reminderCount[0]?.count || 0,
        },
      };
    },
    category: 'productivity',
    riskLevel: 'low',
  });

  functionCallingService.registerTool({
    name: 'general_chat',
    description: '通用对话。当用户进行日常闲聊、问候、或其他不涉及具体功能的对话时使用',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '用户的消息' },
      },
      required: ['message'],
    },
    handler: async (args) => {
      return {
        success: true,
        type: 'chat',
        message: args.message,
      };
    },
    category: 'chat',
    riskLevel: 'low',
  });

  logger.info(`小智业务工具集注册完成，共 ${functionCallingService.getToolsForOpenAI().length} 个工具`);
}

export default { registerAvatarTools };
