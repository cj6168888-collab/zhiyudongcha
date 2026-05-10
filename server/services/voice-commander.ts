/**
 * 语音指挥官 - 系统级语音控制中枢
 * 
 * 核心能力：
 * - 深度理解系统所有功能模块
 * - 持续监听，免触屏操作
 * - 支持导航、创建、删除、整理、生成等所有操作
 * - 不理解时主动询问确认
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('VoiceCommander');

import type { IStorage } from '../storage';
import { AIProviderChain } from '../lib/ai-provider';

// ============ 系统功能知识库 ============

export interface SystemModule {
  id: string;
  name: string;
  aliases: string[];
  route: string;
  description: string;
  capabilities: ModuleCapability[];
  examples: string[];
}

export interface ModuleCapability {
  action: CommandAction;
  description: string;
  requiresConfirm?: boolean;
  handler?: string;
}

export type CommandAction = 
  | 'navigate'    // 跳转到页面
  | 'create'      // 创建新条目
  | 'list'        // 列出/查看
  | 'search'      // 搜索
  | 'delete'      // 删除
  | 'update'      // 修改/更新
  | 'generate'    // 生成内容
  | 'organize'    // 整理/归档
  | 'start'       // 开始/启动
  | 'stop'        // 停止/关闭
  | 'analyze'     // 分析
  | 'export'      // 导出
  | 'import'      // 导入
  | 'sync'        // 同步
  | 'remind'      // 提醒
  | 'schedule'    // 安排日程
  | 'call'        // 拨打电话
  | 'send'        // 发送消息
  | 'play'        // 播放
  | 'pause'       // 暂停
  | 'resume';     // 继续

// 系统功能模块完整知识库
export const SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'swarm',
    name: '蜂群控制台',
    aliases: ['分身管理', '蜂群', '子体管理', '克隆管理', '分身', '子体'],
    route: '/swarm',
    description: '管理小智分身实体，签发令牌，查看审计日志',
    capabilities: [
      { action: 'navigate', description: '打开蜂群控制台' },
      { action: 'create', description: '创建新分身', handler: 'createClone' },
      { action: 'list', description: '查看所有分身' },
      { action: 'delete', description: '召回/删除分身', requiresConfirm: true },
      { action: 'stop', description: '暂停分身' },
      { action: 'start', description: '激活分身' },
    ],
    examples: ['打开分身管理', '创建一个新分身', '暂停所有分身', '查看分身列表'],
  },
  {
    id: 'insight',
    name: '智语洞察',
    aliases: ['洞察', '监听', '会议监听', '谈话监听', '洞察系统', '智语'],
    route: '/insight',
    description: '实时会议/谈话监听，智能场景识别，实体抽取，情绪分析',
    capabilities: [
      { action: 'navigate', description: '打开洞察监听' },
      { action: 'start', description: '开始监听', handler: 'startInsight' },
      { action: 'stop', description: '停止监听', handler: 'stopInsight' },
      { action: 'analyze', description: '分析对话内容' },
      { action: 'export', description: '导出洞察记录' },
    ],
    examples: ['开始监听', '打开智语洞察', '分析刚才的对话', '停止监听'],
  },
  {
    id: 'chat',
    name: '对话',
    aliases: ['聊天', '小智', '对话', '语音助手'],
    route: '/chat',
    description: '与小智进行自然对话',
    capabilities: [
      { action: 'navigate', description: '打开对话界面' },
    ],
    examples: ['打开聊天', '和小智说话'],
  },
  {
    id: 'network',
    name: '人脉网络',
    aliases: ['人脉', '联系人', '关系网', '人际关系', '通讯录'],
    route: '/network',
    description: '管理人脉关系，记录联系人信息和互动历史',
    capabilities: [
      { action: 'navigate', description: '打开人脉网络' },
      { action: 'create', description: '添加联系人', handler: 'createPerson' },
      { action: 'list', description: '查看联系人列表' },
      { action: 'search', description: '搜索联系人' },
      { action: 'update', description: '更新联系人信息' },
      { action: 'delete', description: '删除联系人', requiresConfirm: true },
      { action: 'analyze', description: '分析人脉关系' },
    ],
    examples: ['添加联系人张三', '查看所有联系人', '搜索王总', '分析我的人脉'],
  },
  {
    id: 'projects',
    name: '项目中心',
    aliases: ['项目', '项目管理', '任务', '工作'],
    route: '/projects',
    description: '智能项目管理，任务分解，进度追踪，风险预警',
    capabilities: [
      { action: 'navigate', description: '打开项目中心' },
      { action: 'create', description: '创建新项目', handler: 'createProject' },
      { action: 'list', description: '查看项目列表' },
      { action: 'search', description: '搜索项目' },
      { action: 'update', description: '更新项目状态' },
      { action: 'analyze', description: '分析项目风险' },
      { action: 'generate', description: '生成项目报告' },
    ],
    examples: ['创建新项目', '查看进行中的项目', '分析项目风险', '生成项目周报'],
  },
  {
    id: 'calendar',
    name: '日程安排',
    aliases: ['日程', '日历', '安排', '行程', '时间表'],
    route: '/calendar',
    description: '智能日程管理，会议安排，时间规划',
    capabilities: [
      { action: 'navigate', description: '打开日程' },
      { action: 'create', description: '创建日程', handler: 'createCalendarEvent' },
      { action: 'list', description: '查看今日日程' },
      { action: 'schedule', description: '安排会议' },
      { action: 'remind', description: '设置提醒' },
      { action: 'update', description: '修改日程' },
      { action: 'delete', description: '取消日程', requiresConfirm: true },
    ],
    examples: ['今天有什么安排', '安排明天下午三点开会', '取消今天的会议', '提醒我下午喝水'],
  },
  {
    id: 'reminders',
    name: '提醒事项',
    aliases: ['提醒', '备忘', '待办', '待办事项'],
    route: '/reminders',
    description: '智能提醒系统，支持时间/事件/智能触发',
    capabilities: [
      { action: 'navigate', description: '打开提醒' },
      { action: 'create', description: '创建提醒', handler: 'createReminder' },
      { action: 'list', description: '查看提醒列表' },
      { action: 'delete', description: '删除提醒' },
    ],
    examples: ['提醒我明天10点开会', '三小时后提醒我吃药', '查看所有提醒'],
  },
  {
    id: 'contracts',
    name: '合同管理',
    aliases: ['合同', '协议', '法务'],
    route: '/contracts',
    description: 'AI辅助合同起草，风险分析，谈判要点',
    capabilities: [
      { action: 'navigate', description: '打开合同管理' },
      { action: 'create', description: '起草合同', handler: 'draftContract' },
      { action: 'list', description: '查看合同列表' },
      { action: 'analyze', description: '分析合同风险' },
      { action: 'generate', description: '生成合同文本' },
    ],
    examples: ['起草一份销售合同', '分析这份合同的风险', '查看待签合同'],
  },
  {
    id: 'knowledge',
    name: '知识库',
    aliases: ['知识', '资料', '文档', '学习'],
    route: '/knowledge',
    description: 'RAG知识库，语义搜索，智能问答',
    capabilities: [
      { action: 'navigate', description: '打开知识库' },
      { action: 'search', description: '搜索知识' },
      { action: 'create', description: '添加知识' },
      { action: 'organize', description: '整理知识库' },
    ],
    examples: ['搜索关于合同法的知识', '添加这份资料到知识库'],
  },
  {
    id: 'reports',
    name: '每日战报',
    aliases: ['报告', '战报', '日报', '周报', '总结'],
    route: '/daily-report',
    description: '每日战略简报，系统状态，风险预警，趋势分析',
    capabilities: [
      { action: 'navigate', description: '打开战报' },
      { action: 'generate', description: '生成战报', handler: 'generateReport' },
      { action: 'list', description: '查看历史战报' },
    ],
    examples: ['生成今日战报', '查看昨天的报告', '总结本周工作'],
  },
  {
    id: 'evolution',
    name: '进化成长',
    aliases: ['进化', '成长', '学习进度', '能力提升'],
    route: '/evolution',
    description: '小智的进化轨迹，能力成长，学习记录',
    capabilities: [
      { action: 'navigate', description: '打开进化面板' },
      { action: 'list', description: '查看成长记录' },
    ],
    examples: ['查看小智的成长', '打开进化面板'],
  },
  {
    id: 'dream',
    name: '梦境日志',
    aliases: ['梦境', '做梦', '梦', '睡眠'],
    route: '/dream',
    description: '小智的梦境模拟，自我进化',
    capabilities: [
      { action: 'navigate', description: '打开梦境日志' },
      { action: 'list', description: '查看梦境记录' },
    ],
    examples: ['查看小智做了什么梦', '打开梦境日志'],
  },
  {
    id: 'oracle',
    name: '预言机',
    aliases: ['预言', '预测', '算命', '未来'],
    route: '/oracle',
    description: '风险预测，趋势分析，未来推演',
    capabilities: [
      { action: 'navigate', description: '打开预言机' },
      { action: 'analyze', description: '预测趋势' },
    ],
    examples: ['预测一下这个项目的风险', '分析市场趋势'],
  },
  {
    id: 'command',
    name: '指挥中心',
    aliases: ['指挥', '命令', '控制中心', '总控'],
    route: '/command',
    description: '系统总控台，统一指挥调度',
    capabilities: [
      { action: 'navigate', description: '打开指挥中心' },
    ],
    examples: ['打开指挥中心', '进入控制台'],
  },
  {
    id: 'settings',
    name: '系统设置',
    aliases: ['设置', '配置', '偏好', '选项'],
    route: '/settings',
    description: '系统配置，个人偏好设置',
    capabilities: [
      { action: 'navigate', description: '打开设置' },
      { action: 'update', description: '修改设置' },
    ],
    examples: ['打开设置', '修改语音配置'],
  },
  {
    id: 'email',
    name: '邮件管理',
    aliases: ['邮件', '邮箱', '收件箱'],
    route: '/email',
    description: '智能邮件管理，邮件分析',
    capabilities: [
      { action: 'navigate', description: '打开邮件' },
      { action: 'list', description: '查看邮件' },
      { action: 'send', description: '发送邮件' },
      { action: 'analyze', description: '分析邮件' },
    ],
    examples: ['查看新邮件', '发送邮件给张三'],
  },
  {
    id: 'expense',
    name: '费用管理',
    aliases: ['费用', '支出', '报销', '财务'],
    route: '/expense',
    description: '费用跟踪，报销管理',
    capabilities: [
      { action: 'navigate', description: '打开费用管理' },
      { action: 'create', description: '记录费用' },
      { action: 'list', description: '查看费用记录' },
      { action: 'analyze', description: '分析支出' },
    ],
    examples: ['记录一笔费用', '查看本月支出', '分析消费情况'],
  },
];

// ============ 动作关键词映射 ============

const ACTION_KEYWORDS: Record<CommandAction, string[]> = {
  navigate: ['打开', '去', '进入', '跳转', '切换到', '看看', '显示'],
  create: ['创建', '新建', '添加', '建立', '录入', '加一个', '写一个', '起草'],
  list: ['查看', '列出', '显示', '看', '有哪些', '有什么', '多少个', '全部'],
  search: ['搜索', '查找', '找', '搜', '查询'],
  delete: ['删除', '移除', '去掉', '取消', '清除', '召回'],
  update: ['修改', '更新', '编辑', '改', '调整'],
  generate: ['生成', '制作', '产出', '写', '总结', '归纳'],
  organize: ['整理', '归档', '分类', '收纳', '清理'],
  start: ['开始', '启动', '开启', '打开', '运行'],
  stop: ['停止', '关闭', '结束', '暂停', '退出'],
  analyze: ['分析', '评估', '检查', '审查', '研究'],
  export: ['导出', '输出', '保存', '下载'],
  import: ['导入', '上传', '加载'],
  sync: ['同步', '刷新', '更新'],
  remind: ['提醒', '通知', '告诉我'],
  schedule: ['安排', '预约', '约', '订'],
  call: ['打电话', '拨打', '呼叫', '联系'],
  send: ['发送', '发', '寄'],
  play: ['播放', '放', '听'],
  pause: ['暂停', '停'],
  resume: ['继续', '恢复'],
};

// ============ 指令解析结果 ============

export interface ParsedCommand {
  understood: boolean;
  confidence: number;
  action?: CommandAction;
  module?: SystemModule;
  target?: string;
  params?: Record<string, any>;
  clarificationNeeded?: string;
  suggestedResponse?: string;
}

// ============ 智能指令解析 ============

export function parseVoiceCommand(text: string): ParsedCommand {
  const normalizedText = text.toLowerCase().trim();
  
  // 1. 识别动作
  let detectedAction: CommandAction | undefined;
  let actionConfidence = 0;
  
  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        detectedAction = action as CommandAction;
        actionConfidence = 0.8;
        break;
      }
    }
    if (detectedAction) break;
  }
  
  // 2. 识别目标模块
  let detectedModule: SystemModule | undefined;
  let moduleConfidence = 0;
  
  for (const module of SYSTEM_MODULES) {
    // 检查模块名称
    if (normalizedText.includes(module.name.toLowerCase())) {
      detectedModule = module;
      moduleConfidence = 1.0;
      break;
    }
    // 检查别名
    for (const alias of module.aliases) {
      if (normalizedText.includes(alias.toLowerCase())) {
        detectedModule = module;
        moduleConfidence = 0.9;
        break;
      }
    }
    if (detectedModule) break;
  }
  
  // 3. 提取目标参数（如名字）
  let target: string | undefined;
  
  // 尝试多种格式匹配
  // 格式1: "创建联系人李四" / "添加联系人张三"
  const directNameMatch = text.match(/(?:联系人|人脉|项目|提醒|日程|合同)\s*[「『"']?([^\s」』"',，。的]{1,10})/);
  if (directNameMatch && directNameMatch[1]) {
    target = directNameMatch[1];
  }
  
  // 格式2: "叫李四" / "名字是张三"
  if (!target) {
    const namedMatch = text.match(/(?:叫|名字是|名为|：|给|关于)\s*[「『"']?([^」』"'\s,，。的]+)/);
    if (namedMatch) {
      target = namedMatch[1];
    }
  }
  
  // 格式3: 动作后直接跟名字 "创建李四" / "添加王总"
  if (!target && detectedAction === 'create') {
    const createMatch = text.match(/(?:创建|新建|添加|建立)\s*[「『"']?([^\s」』"',，。的]{1,10})/);
    if (createMatch && createMatch[1] && !SYSTEM_MODULES.some(m => 
      m.aliases.includes(createMatch[1]) || m.name.includes(createMatch[1])
    )) {
      target = createMatch[1];
    }
  }
  
  logger.debug({ text, target, detectedAction, detectedModule: detectedModule?.name }, '解析结果');
  
  // 4. 计算总体置信度
  const overallConfidence = (actionConfidence + moduleConfidence) / 2;
  
  // 5. 判断是否需要澄清
  if (!detectedAction && !detectedModule) {
    return {
      understood: false,
      confidence: 0,
      clarificationNeeded: '我不太确定你想做什么，能再说详细一点吗？比如"打开项目管理"或"创建一个联系人"',
      suggestedResponse: '你可以试试说："打开XX"、"创建XX"、"查看XX"等',
    };
  }
  
  if (detectedAction && !detectedModule) {
    // 有动作但没有目标
    const actionName = getActionName(detectedAction);
    return {
      understood: false,
      confidence: actionConfidence * 0.5,
      action: detectedAction,
      clarificationNeeded: `你想${actionName}什么呢？`,
      suggestedResponse: `我可以帮你${actionName}：项目、联系人、日程、提醒、合同等`,
    };
  }
  
  if (!detectedAction && detectedModule) {
    // 有目标但没有明确动作，默认打开
    detectedAction = 'navigate';
    actionConfidence = 0.6;
  }
  
  // 6. 检查模块是否支持该动作
  if (detectedModule && detectedAction) {
    const capability = detectedModule.capabilities.find(c => c.action === detectedAction);
    if (!capability) {
      return {
        understood: false,
        confidence: overallConfidence * 0.5,
        action: detectedAction,
        module: detectedModule,
        clarificationNeeded: `${detectedModule.name}不支持这个操作哦`,
        suggestedResponse: `${detectedModule.name}可以：${detectedModule.capabilities.map(c => c.description).join('、')}`,
      };
    }
  }
  
  return {
    understood: true,
    confidence: overallConfidence,
    action: detectedAction,
    module: detectedModule,
    target,
    params: target ? { name: target } : undefined,
  };
}

function getActionName(action: CommandAction): string {
  const names: Record<CommandAction, string> = {
    navigate: '打开',
    create: '创建',
    list: '查看',
    search: '搜索',
    delete: '删除',
    update: '修改',
    generate: '生成',
    organize: '整理',
    start: '开始',
    stop: '停止',
    analyze: '分析',
    export: '导出',
    import: '导入',
    sync: '同步',
    remind: '提醒',
    schedule: '安排',
    call: '打电话',
    send: '发送',
    play: '播放',
    pause: '暂停',
    resume: '继续',
  };
  return names[action] || action;
}

// ============ 执行指令 ============

export interface CommandResult {
  success: boolean;
  message: string;
  action?: CommandAction;
  navigateTo?: string;
  data?: unknown;
  requiresConfirm?: boolean;
  confirmMessage?: string;
  continueListen?: boolean;
}

export async function executeVoiceCommand(
  command: ParsedCommand,
  storage: IStorage,
  context?: { userId?: string }
): Promise<CommandResult> {
  
  if (!command.understood) {
    return {
      success: false,
      message: command.clarificationNeeded || '我没听明白，能再说一遍吗？',
      continueListen: true,
    };
  }
  
  const { action, module, target, params } = command;
  
  // 导航操作
  if (action === 'navigate' && module) {
    return {
      success: true,
      message: `好的，正在打开${module.name}`,
      action: 'navigate',
      navigateTo: module.route,
      continueListen: true,
    };
  }
  
  // 创建操作
  if (action === 'create' && module) {
    if (!target && module.id !== 'reminders') {
      return {
        success: false,
        message: `创建${module.name}需要一个名字，叫什么呢？`,
        continueListen: true,
      };
    }
    
    try {
      switch (module.id) {
        case 'network':
          if (storage.createPerson) {
            const person = await storage.createPerson({
              name: target!,
              accessLevel: 'ZONE_GREEN',
              approvalStatus: 'APPROVED',
              addedBy: 'AI',
            });
            logger.info({ person, target }, '语音创建联系人成功');
            return {
              success: true,
              message: `好的，已经帮你添加了联系人「${target}」`,
              data: person,
              navigateTo: '/network',
              continueListen: true,
            };
          } else {
            logger.error('storage.createPerson 方法不存在');
            return {
              success: false,
              message: '创建联系人功能暂时不可用',
              continueListen: true,
            };
          }
          
        case 'projects':
          if (storage.createProject) {
            const project = await storage.createProject({
              title: target!,
              description: '由小智语音创建',
              status: 'PENDING_REVIEW',
              priority: 5,
            });
            logger.info({ project, target }, '语音创建项目成功');
            return {
              success: true,
              message: `项目「${target}」已创建，正在打开项目中心`,
              data: project,
              navigateTo: '/projects',
              continueListen: true,
            };
          } else {
            return {
              success: false,
              message: '创建项目功能暂时不可用',
              continueListen: true,
            };
          }
          
        default:
          return {
            success: true,
            message: `正在创建${module.name}...`,
            navigateTo: module.route,
            continueListen: true,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `创建失败了，稍后再试试？`,
        continueListen: true,
      };
    }
  }
  
  // 查看/列表操作
  if (action === 'list' && module) {
    return {
      success: true,
      message: `好的，正在查看${module.name}`,
      navigateTo: module.route,
      continueListen: true,
    };
  }
  
  // 开始/停止操作
  if ((action === 'start' || action === 'stop') && module) {
    if (module.id === 'insight') {
      return {
        success: true,
        message: action === 'start' ? '好的，开始监听' : '好的，已停止监听',
        navigateTo: '/insight',
        data: { insightAction: action },
        continueListen: true,
      };
    }
  }
  
  // 删除操作（需要确认）
  if (action === 'delete' && module) {
    return {
      success: true,
      message: `确定要删除吗？这个操作不可恢复哦`,
      requiresConfirm: true,
      confirmMessage: `确认删除${target || '这个内容'}？`,
      continueListen: true,
    };
  }
  
  // 生成操作
  if (action === 'generate' && module) {
    return {
      success: true,
      message: `好的，正在生成${module.name}...`,
      navigateTo: module.route,
      data: { generateAction: true },
      continueListen: true,
    };
  }
  
  // 提醒操作
  if (action === 'remind') {
    return {
      success: true,
      message: `好的，我会提醒你的`,
      data: { reminderText: target },
      continueListen: true,
    };
  }
  
  // 默认处理
  return {
    success: true,
    message: `收到，${getActionName(action!)}${module?.name || ''}`,
    navigateTo: module?.route,
    continueListen: true,
  };
}

// ============ 生成系统提示词 ============

export function generateSystemKnowledgePrompt(): string {
  let prompt = `【小智系统功能知识库】\n\n你是小智，一个智能数字生命助手。你深度理解以下所有系统功能模块，可以帮用户执行各种操作：\n\n`;
  
  for (const module of SYSTEM_MODULES) {
    prompt += `## ${module.name} (${module.route})\n`;
    prompt += `别名: ${module.aliases.join('、')}\n`;
    prompt += `功能: ${module.description}\n`;
    prompt += `支持操作:\n`;
    for (const cap of module.capabilities) {
      prompt += `- ${cap.description}${cap.requiresConfirm ? '（需确认）' : ''}\n`;
    }
    prompt += `示例: ${module.examples.join('；')}\n\n`;
  }
  
  prompt += `\n【回复规则】\n`;
  prompt += `1. 用户说"打开X"、"去X"、"进入X"时，返回导航指令\n`;
  prompt += `2. 用户说"创建X"、"添加X"时，询问名称后执行创建\n`;
  prompt += `3. 用户说"查看X"、"看X"时，打开对应页面\n`;
  prompt += `4. 不确定时主动询问，不要猜测执行\n`;
  prompt += `5. 所有操作后保持语音监听，等待下一个指令\n`;
  prompt += `6. 用简短友好的语气回复\n`;
  
  return prompt;
}

// 导出模块查找函数
export function findModuleByKeyword(keyword: string): SystemModule | undefined {
  const normalizedKeyword = keyword.toLowerCase();
  
  for (const module of SYSTEM_MODULES) {
    if (module.name.toLowerCase().includes(normalizedKeyword)) {
      return module;
    }
    for (const alias of module.aliases) {
      if (alias.toLowerCase().includes(normalizedKeyword)) {
        return module;
      }
    }
  }
  return undefined;
}

// 导出所有模块路由
export function getAllRoutes(): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const module of SYSTEM_MODULES) {
    routes[module.id] = module.route;
    for (const alias of module.aliases) {
      routes[alias] = module.route;
    }
  }
  return routes;
}

// ============ AI 智能推理 ============

const aiProvider = new AIProviderChain();

interface AIIntentResult {
  understood: boolean;
  action?: CommandAction;
  moduleId?: string;
  target?: string;
  confidence: number;
  explanation?: string;
}

/**
 * 使用AI分析用户意图
 * 当规则解析失败时调用
 */
export async function analyzeWithAI(text: string): Promise<AIIntentResult> {
  const systemPrompt = `你是小智的语音理解模块。分析用户的语音指令，输出JSON格式的理解结果。

可用的功能模块(moduleId):
${SYSTEM_MODULES.map(m => `- ${m.id}: ${m.name} (${m.aliases.join('、')})`).join('\n')}

可用的操作类型(action):
- navigate: 打开/跳转到某个页面
- create: 创建新条目（联系人、项目、提醒等）
- list: 查看/列出内容
- search: 搜索某些内容
- delete: 删除某些内容
- update: 修改/更新内容
- generate: 生成报告/总结
- start: 开始某个任务（如开始监听）
- stop: 停止某个任务
- analyze: 分析数据
- remind: 设置提醒

请分析以下指令，返回JSON：
{
  "understood": true/false,  // 是否理解了用户意图
  "action": "操作类型",      // navigate/create/list/search等
  "moduleId": "模块ID",      // 如network/projects/insight等
  "target": "目标名称",      // 如有具体名字则提取，没有则为null
  "confidence": 0.0-1.0,     // 理解置信度
  "explanation": "简短解释"  // 对用户说的话
}

重要：
1. 如果用户说的是闲聊或无关指令，understood设为false
2. 尽可能理解模糊表达，如"看看项目"→list+projects
3. 提取具体的名字/标题，如"帮我记住王总的手机号"→target="王总"`;

  try {
    const result = await aiProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      maxTokens: 500,
      timeout: 8000,
    });

    // 解析AI返回的JSON
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      logger.info({ text, aiResult: parsed }, 'AI推理结果');
      return {
        understood: parsed.understood ?? false,
        action: parsed.action as CommandAction,
        moduleId: parsed.moduleId,
        target: parsed.target,
        confidence: parsed.confidence ?? 0.5,
        explanation: parsed.explanation,
      };
    }

    return { understood: false, confidence: 0 };
  } catch (error) {
    logger.error({ err: error, text }, 'AI推理失败');
    return { understood: false, confidence: 0 };
  }
}

/**
 * 带AI增强的完整指令解析
 */
export async function parseVoiceCommandWithAI(text: string): Promise<ParsedCommand> {
  // 1. 先尝试规则解析
  const ruleResult = parseVoiceCommand(text);
  
  // 2. 如果规则解析成功且置信度够高，直接返回
  if (ruleResult.understood && ruleResult.confidence >= 0.7) {
    logger.debug({ text, method: 'rules', confidence: ruleResult.confidence }, '规则解析成功');
    return ruleResult;
  }
  
  // 3. 规则解析失败或置信度低，调用AI推理
  logger.info({ text, ruleConfidence: ruleResult.confidence }, '规则解析不足，启用AI推理');
  
  const aiResult = await analyzeWithAI(text);
  
  if (!aiResult.understood) {
    // AI也不理解，返回询问
    return {
      understood: false,
      confidence: 0,
      clarificationNeeded: aiResult.explanation || '我没太听懂，能再说一遍吗？',
      suggestedResponse: '你可以说"打开项目"、"创建联系人张三"、"查看今日日程"等',
    };
  }
  
  // 4. AI理解成功，构建解析结果
  const module = aiResult.moduleId 
    ? SYSTEM_MODULES.find(m => m.id === aiResult.moduleId)
    : undefined;
    
  return {
    understood: true,
    confidence: aiResult.confidence,
    action: aiResult.action,
    module,
    target: aiResult.target || undefined,
    params: aiResult.target ? { name: aiResult.target } : undefined,
    suggestedResponse: aiResult.explanation,
  };
}

/**
 * 带AI增强的指令执行
 */
export async function executeVoiceCommandWithAI(
  text: string,
  storage: IStorage,
  context?: { userId?: string }
): Promise<CommandResult> {
  // 使用AI增强解析
  const parsed = await parseVoiceCommandWithAI(text);
  
  // 执行解析后的指令
  return executeVoiceCommand(parsed, storage, context);
}
