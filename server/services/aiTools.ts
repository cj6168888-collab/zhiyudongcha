import { createServiceLogger } from '../lib/logger';
import type { IStorage } from '../storage';

const logger = createServiceLogger('AiTools');

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface ToolParameterProperty {
  type: string;
  description: string;
}

interface EmailRecord {
  isRead?: boolean;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  category?: string;
  snippet?: string;
}

interface ProjectRecord {
  id?: number;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
}

interface PersonRecord {
  id?: number;
  name: string;
  role?: string;
  organization?: string;
  accessLevel?: string;
  weakness?: string;
  interestChain?: string[] | Record<string, unknown>;
  decisionDna?: string;
  decisionStyle?: string;
}

interface InspirationRecord {
  id?: number;
  content?: string;
  source?: string;
  status?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameterProperty>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export const AVATAR_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_emails',
      description: '获取邮件列表，可按条件筛选',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回数量限制，默认10' },
          category: { type: 'string', description: '邮件分类，如invoice/notification等' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: '获取项目列表',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '项目状态: PENDING_REVIEW, IN_PROGRESS, COMPLETED, CANCELLED' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_persons',
      description: '获取人脉网络列表',
      parameters: {
        type: 'object',
        properties: {
          accessLevel: { type: 'string', description: '访问级别: ZONE_RED (核心), ZONE_BLUE (重要), ZONE_GREEN (普通)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_person_details',
      description: '获取特定人物的详细信息',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '人物姓名' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: '搜索邮件，根据关键词查找',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词' },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: '创建新项目',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '项目标题' },
          description: { type: 'string', description: '项目描述' },
          priority: { type: 'string', description: '优先级: HIGH, MEDIUM, LOW' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_person',
      description: '添加新人脉',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '姓名' },
          role: { type: 'string', description: '角色/职位' },
          organization: { type: 'string', description: '所属组织' },
          accessLevel: { type: 'string', description: '访问级别: ZONE_RED, ZONE_BLUE, ZONE_GREEN' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inspirations',
      description: '获取灵感/待办事项列表',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '状态: pending, processed' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: '发送紧急通知/提醒',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '通知标题' },
          content: { type: 'string', description: '通知内容' },
          priority: { type: 'string', description: '紧急程度: IMMEDIATE, HIGH, MEDIUM' },
          target: { type: 'string', description: '通知对象' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_schedule',
      description: '创建日程/预约',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '日程标题' },
          description: { type: 'string', description: '日程描述' },
          datetime: { type: 'string', description: '日期时间' },
          priority: { type: 'string', description: '优先级' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_action',
      description: '执行通用紧急动作',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: '动作描述' },
          target: { type: 'string', description: '目标对象' },
          priority: { type: 'string', description: '紧急程度' },
        },
        required: ['action'],
      },
    },
  },
];

export async function executeToolCall(
  toolCall: ToolCall,
  storage: IStorage
): Promise<string> {
  const { name, arguments: argsString } = toolCall.function;
  let args: Record<string, unknown> = {};
  
  try {
    args = JSON.parse(argsString || '{}') as Record<string, unknown>;
  } catch {
    logger.error({ argsString }, 'Failed to parse arguments');
    args = {};
  }

  logger.info(`[ToolCall] Executing: ${name}`, args);

  try {
    switch (name) {
      case 'list_emails': {
        const emails = await storage.getAllEmails?.({
          limit: (args.limit as number) || 10,
          category: args.category as string | undefined,
        });
        if (!emails || emails.length === 0) {
          return '当前没有邮件记录。';
        }
        return emails.map((e: EmailRecord) => 
          `[${e.isRead ? '已读' : '未读'}] ${e.fromName || e.fromEmail}: ${e.subject || '(无主题)'} - ${e.category || '未分类'}`
        ).join('\n');
      }

      case 'list_projects': {
        const projects = await storage.getProjects?.(args.status as string | undefined);
        if (!projects || projects.length === 0) {
          return '当前没有项目。';
        }
        return projects.map((p: ProjectRecord) => 
          `[${p.status}] ${p.title} - ${p.description || '无描述'}`
        ).join('\n');
      }

      case 'list_persons': {
        const persons = await storage.getAllPersons?.(args.accessLevel as string | undefined);
        if (!persons || persons.length === 0) {
          return '人脉网络为空。';
        }
        return persons.map((p: PersonRecord) => 
          `[${p.accessLevel}] ${p.name} - ${p.role || '未设置角色'} - 弱点: ${p.weakness || '未知'}`
        ).join('\n');
      }

      case 'get_person_details': {
        const persons = await storage.getAllPersons?.();
        if (!persons) return '无法获取人脉数据。';
        const searchName = String(args.name || '').toLowerCase();
        const person = persons.find((p: PersonRecord) => 
          p.name.toLowerCase().includes(searchName)
        );
        if (!person) {
          return `未找到名为"${args.name}"的人物。`;
        }
        const interestChain = Array.isArray(person.interestChain) 
          ? person.interestChain.join(', ') 
          : (typeof person.interestChain === 'object' ? JSON.stringify(person.interestChain) : '未分析');
        return `姓名: ${person.name}
角色: ${person.role || '未设置'}
组织: ${person.organization || '未设置'}
访问级别: ${person.accessLevel}
弱点: ${person.weakness || '未分析'}
利益链: ${interestChain}
决策DNA: ${person.decisionDna || '未分析'}
决策风格: ${person.decisionStyle || '未分析'}`;
      }

      case 'search_emails': {
        const emails = await storage.getAllEmails?.({ limit: 50 });
        if (!emails) return '无法获取邮件数据。';
        const keyword = String(args.keyword || '').toLowerCase();
        const matched = emails.filter((e: EmailRecord) => 
          (e.subject || '').toLowerCase().includes(keyword) ||
          (e.fromName || '').toLowerCase().includes(keyword) ||
          (e.fromEmail || '').toLowerCase().includes(keyword) ||
          (e.snippet || '').toLowerCase().includes(keyword)
        );
        if (matched.length === 0) {
          return `未找到包含"${args.keyword}"的邮件。`;
        }
        return matched.slice(0, 10).map((e: EmailRecord) => 
          `${e.fromName || e.fromEmail}: ${e.subject || '(无主题)'}`
        ).join('\n');
      }

      case 'create_project': {
        const priorityMap: Record<string, number> = { 'HIGH': 9, 'MEDIUM': 5, 'LOW': 1 };
        const priorityStr = String(args.priority || '').toUpperCase();
        const priorityValue = priorityMap[priorityStr] || 5;
        const project = await storage.createProject({
          title: String(args.title || ''),
          description: String(args.description || ''),
          priority: priorityValue,
          status: 'PENDING_REVIEW',
        });
        return `项目「${project.title}」已创建，ID: ${project.id}`;
      }

      case 'add_person': {
        const person = await storage.createPerson({
          name: String(args.name || ''),
          role: args.role ? String(args.role) : null,
          organization: args.organization ? String(args.organization) : null,
          accessLevel: String(args.accessLevel || 'ZONE_GREEN'),
        });
        return `人脉「${person.name}」已添加，访问级别: ${person.accessLevel}`;
      }

      case 'get_inspirations': {
        const inspirations = await storage.getAllInspirations?.(undefined, args.status as string | undefined);
        if (!inspirations || inspirations.length === 0) {
          return '当前没有待处理的灵感/任务。';
        }
        return inspirations.map((i: InspirationRecord) => 
          `[${i.status}] ${i.content} - ${i.source || '未知来源'}`
        ).join('\n');
      }

      // ====== 紧急动作工具 - 感知即执行 ======
      case 'send_notification': {
        // 创建灵感/待办作为通知记录
        const title = String(args.title || '');
        const content = String(args.content || args.description || '');
        const priority = String(args.priority || '');
        const notification = await storage.createInspiration?.({
          content: `[通知] ${title}: ${content}`,
          source: 'critical_action',
          category: 'notification',
          status: 'pending',
          priority: priority === 'IMMEDIATE' ? 10 : priority === 'HIGH' ? 8 : 5,
        });
        logger.info(`[ExecuteAction] 通知已记录: ${title}`);
        return `紧急通知「${title}」已发送并记录，ID: ${notification?.id || 'N/A'}`;
      }

      case 'create_schedule': {
        // 创建项目作为日程记录
        const title = String(args.title || '');
        const description = String(args.description || '');
        const datetime = String(args.datetime || '待定');
        const priority = String(args.priority || '');
        const schedule = await storage.createProject?.({
          title: `[日程] ${title}`,
          description: `${description}\n时间: ${datetime}`,
          priority: priority === 'IMMEDIATE' ? 10 : priority === 'HIGH' ? 9 : 7,
          status: 'PENDING_REVIEW',
        });
        logger.info(`[ExecuteAction] 日程已创建: ${title}`);
        return `日程「${title}」已安排，ID: ${schedule?.id || 'N/A'}`;
      }

      case 'execute_action': {
        // 通用紧急动作 - 创建高优先级项目记录
        const actionStr = String(args.action || '');
        const target = String(args.target || '未指定');
        const action = await storage.createProject?.({
          title: `[紧急执行] ${actionStr}`,
          description: `目标: ${target}\n原始请求: ${actionStr}`,
          priority: 10, // 最高优先级
          status: 'IN_PROGRESS',
        });
        logger.info(`[ExecuteAction] 紧急动作已执行: ${actionStr}`);
        return `紧急动作「${actionStr}」已执行并记录，ID: ${action?.id || 'N/A'}`;
      }

      default:
        return `未知工具: ${name}`;
    }
  } catch (error: unknown) {
    logger.error({ err: error, toolName: name }, 'Error executing tool');
    return `执行${name}时出错: ${getErrorMessage(error)}`;
  }
}
