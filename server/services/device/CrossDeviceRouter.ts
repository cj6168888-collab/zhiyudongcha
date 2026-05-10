/**
 * CrossDeviceRouter - 跨设备任务路由器
 *
 * 功能：
 * - 智能分析用户意图
 * - 选择最佳设备执行
 * - 编排跨设备任务
 * - 监控执行状态
 *
 * 支持：
 * - 手机端：微信、短信、电话、导航等
 * - 电脑端：文件整理、办公自动化、编程辅助、系统操作等
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('CrossDeviceRouter');

import { cloudHub } from '../cloud/CloudHub';
import { deviceRegistry, KNOWN_PROGRAMS } from './DeviceRegistry';
import { DeviceType, DeviceStatus, Task, SubTask } from '../cloud/CloudHub';
import { pcAgent } from '../pc-agent/PCAgent';
import { fileOrganizerService } from '../pc-agent/FileOrganizerService';
import { officeAutomationService } from '../pc-agent/OfficeAutomationService';

// ============ 类型定义 ============

/**
 * 任务请求
 */
export interface TaskRequest {
  description: string;
  userId: string;
  sourceDevice?: string;
  preferences?: {
    preferDevice?: DeviceType;
    avoidDevices?: DeviceType[];
    maxWaitTime?: number;
  };
}

/**
 * 任务计划
 */
export interface TaskPlan {
  taskId: string;
  description: string;
  subtasks: SubTaskPlan[];
  estimatedTime: number;
  requiresCrossDevice: boolean;
  executionStrategy: 'sequential' | 'parallel';
}

/**
 * 子任务计划
 */
export interface SubTaskPlan {
  id: string;
  description: string;
  targetDevice: {
    id: string;
    name: string;
    type: DeviceType;
  } | null;
  targetProgram: {
    name: string;
    packageName: string;
  } | null;
  action: {
    name: string;
    invocation: unknown;
    parameters: Record<string, unknown>;
  } | null;
  dependsOn: string[];
  estimatedTime: number;
  canExecute: boolean;
  reason?: string;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  taskId: string;
  completedSubtasks: string[];
  failedSubtasks: Array<{
    id: string;
    error: string;
  }>;
  summary: string;
  duration: number;
}

// ============ 核心类 ============

class CrossDeviceRouter {
  private static instance: CrossDeviceRouter | null = null;

  // 任务到设备的映射
  private activeExecutions: Map<string, {
    taskId: string;
    subtaskId: string;
    deviceId: string;
    startedAt: Date;
  }> = new Map();

  private constructor() {}

  public static getInstance(): CrossDeviceRouter {
    if (!CrossDeviceRouter.instance) {
      CrossDeviceRouter.instance = new CrossDeviceRouter();
    }
    return CrossDeviceRouter.instance;
  }

  /**
   * 规划任务
   *
   * 分析用户请求，生成执行计划
   */
  public async planTask(request: TaskRequest): Promise<TaskPlan> {
    logger.info({ description: request.description, userId: request.userId }, 'Planning task');

    // 1. 理解用户意图
    const understanding = this.understandIntent(request.description);

    // 2. 识别需要的设备和程序
    const requirements = this.identifyRequirements(understanding);

    // 3. 选择执行设备
    const deviceAssignments = this.assignDevices(requirements, request.userId, request.preferences);

    // 4. 生成子任务
    const subtasks = this.generateSubtasks(understanding, deviceAssignments);

    // 5. 确定执行策略
    const strategy = this.determineStrategy(subtasks);

    return {
      taskId: `plan_${Date.now()}`,
      description: request.description,
      subtasks,
      estimatedTime: subtasks.reduce((sum, t) => sum + t.estimatedTime, 0),
      requiresCrossDevice: subtasks.some(t => t.targetDevice) &&
        new Set(subtasks.filter(s => s.targetDevice).map(s => s.targetDevice!.type)).size > 1,
      executionStrategy: strategy,
    };
  }

  /**
   * 执行任务
   */
  public async executeTask(plan: TaskPlan): Promise<ExecutionResult> {
    const startTime = Date.now();
    const completedSubtasks: string[] = [];
    const failedSubtasks: Array<{ id: string; error: string }> = [];

    logger.info({ planId: plan.taskId, subtaskCount: plan.subtasks.length }, 'Executing task plan');

    // 按依赖顺序执行
    const pending = [...plan.subtasks];
    const executing: Map<string, Promise<void>> = new Map();

    while (pending.length > 0 || executing.size > 0) {
      // 查找可以执行的子任务
      const ready = pending.filter(st => {
        // 检查依赖是否都已完成
        const depsDone = st.dependsOn.every(depId => completedSubtasks.includes(depId));
        // 检查是否没有正在执行
        const notExecuting = !executing.has(st.id);
        return depsDone && notExecuting;
      });

      if (ready.length === 0 && executing.size === 0) {
        // 没有可执行的任务，可能有循环依赖
        logger.warn({ pending: pending.map(s => s.id) }, 'No executable subtasks');
        break;
      }

      // 启动可执行的任务
      for (const subtask of ready.slice(0, plan.executionStrategy === 'parallel' ? 10 : 1)) {
        const index = pending.indexOf(subtask);
        if (index > -1) {
          pending.splice(index, 1);

          const promise = this.executeSubtask(subtask).then(result => {
            executing.delete(subtask.id);
            if (result.success) {
              completedSubtasks.push(subtask.id);
            } else {
              failedSubtasks.push({ id: subtask.id, error: result.error || 'Unknown error' });
            }
          });

          executing.set(subtask.id, promise);
        }
      }

      // 等待一个任务完成
      if (executing.size > 0) {
        await Promise.race(executing.values());
      }
    }

    return {
      success: failedSubtasks.length === 0,
      taskId: plan.taskId,
      completedSubtasks,
      failedSubtasks,
      summary: `${completedSubtasks.length}/${plan.subtasks.length} 完成`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 执行单个子任务
   */
  private async executeSubtask(subtask: SubTaskPlan): Promise<{ success: boolean; error?: string }> {
    if (!subtask.targetDevice || !subtask.action) {
      return { success: false, error: '无法执行：未指定设备或动作' };
    }

    if (!subtask.canExecute) {
      return { success: false, error: `无法执行：${subtask.reason}` };
    }

    const deviceId = subtask.targetDevice.id;
    const device = cloudHub.getDevice(deviceId);

    if (!device || device.status !== DeviceStatus.ONLINE) {
      return { success: false, error: `设备 ${subtask.targetDevice.name} 不在线` };
    }

    logger.info({
      subtaskId: subtask.id,
      device: subtask.targetDevice.name,
      action: subtask.action.name
    }, 'Executing subtask');

    // 发送到设备执行
    const sent = cloudHub.sendToDevice(deviceId, {
      type: 'action:execute',
      subtaskId: subtask.id,
      action: subtask.action,
      parameters: subtask.action.parameters,
    });

    if (!sent) {
      return { success: false, error: '无法连接到设备' };
    }

    // 记录执行状态
    this.activeExecutions.set(`${deviceId}:${subtask.id}`, {
      taskId: subtask.id,
      subtaskId: subtask.id,
      deviceId,
      startedAt: new Date(),
    });

    // 等待结果（简化版本，实际应该用事件或轮询）
    return new Promise(resolve => {
      setTimeout(() => {
        this.activeExecutions.delete(`${deviceId}:${subtask.id}`);
        // 模拟成功
        resolve({ success: true });
      }, 1000);
    });
  }

  /**
   * 理解用户意图
   */
  private understandIntent(description: string): {
    intent: string;
    entities: {
      persons?: string[];
      locations?: string[];
      programs?: string[];
      files?: string[];
      amounts?: number[];
    };
    actions: string[];
    device: 'phone' | 'desktop' | 'any' | null;
    urgency: 'low' | 'normal' | 'high' | 'urgent';
  } {
    const text = description.toLowerCase();
    const entities: { persons?: string[]; locations?: string[]; programs?: string[]; files?: string[]; amounts?: number[] } = {};
    const actions: string[] = [];
    let device: 'phone' | 'desktop' | 'any' | null = null;
    let urgency: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

    // 识别设备
    if (text.includes('手机') || text.includes('微信') || text.includes('打电话') || text.includes('短信')) {
      device = 'phone';
      if (text.includes('微信')) actions.push('wechat');
      if (text.includes('电话') || text.includes('打电话')) actions.push('call');
      if (text.includes('短信')) actions.push('sms');
    }
    if (text.includes('电脑') || text.includes('文件') || text.includes('编程') || text.includes('vscode')) {
      device = 'desktop';
      if (text.includes('文件')) actions.push('file');
      if (text.includes('编程') || text.includes('代码')) actions.push('coding');
      if (text.includes('vscode')) actions.push('vscode');
    }
    if (text.includes('手机') && text.includes('电脑')) {
      device = 'any';
    }

    // 识别人员
    const personMatches = description.match(/(?:给|告诉|找|联系)(.+?)(?:说|发|一下)/g);
    if (personMatches) {
      entities.persons = personMatches.map(m => m.replace(/(?:给|告诉|找|联系)/g, '').trim());
    }

    // 识别金额
    const amountMatches = description.match(/(\d+)(?:块|元|块钱)/g);
    if (amountMatches) {
      entities.amounts = amountMatches.map(a => parseInt(a));
    }

    // 识别动作
    if (text.includes('发') || text.includes('发送')) actions.push('send');
    if (text.includes('打开') || text.includes('启动')) actions.push('open');
    if (text.includes('整理') || text.includes('归类')) actions.push('organize');
    if (text.includes('写') || text.includes('创建')) actions.push('create');
    if (text.includes('查') || text.includes('搜索')) actions.push('search');
    if (text.includes('排版') || text.includes('格式化')) actions.push('format');

    // 识别紧急程度
    if (text.includes('紧急') || text.includes('马上') || text.includes('立刻')) urgency = 'urgent';
    if (text.includes('不急') || text.includes('以后')) urgency = 'low';

    return {
      intent: description,
      entities,
      actions,
      device,
      urgency,
    };
  }

  /**
   * 识别需求
   */
  private identifyRequirements(understanding: ReturnType<typeof this.understandIntent>): {
    requiredCapabilities: string[];
    requiredPrograms: string[];
    requiredDeviceTypes: DeviceType[];
  } {
    const capabilities: string[] = [];
    const programs: string[] = [];
    const deviceTypes: DeviceType[] = [];

    const text = understanding.intent.toLowerCase();

    // 微信相关
    if (text.includes('微信')) {
      programs.push('com.tencent.mm');
      programs.push('WeChat');
      capabilities.push('social');
    }

    // 文件操作
    if (text.includes('文件') || text.includes('整理')) {
      capabilities.push('file_operation');
      deviceTypes.push(DeviceType.DESKTOP);
    }

    // 编程相关
    if (text.includes('编程') || text.includes('代码') || text.includes('vscode')) {
      programs.push('Code');
      capabilities.push('coding');
      deviceTypes.push(DeviceType.DESKTOP);
    }

    // Office文档
    if (text.includes('word') || text.includes('文档') || text.includes('排版')) {
      programs.push('WINWORD');
      capabilities.push('document');
      deviceTypes.push(DeviceType.DESKTOP);
    }
    if (text.includes('excel') || text.includes('表格') || text.includes('数据')) {
      programs.push('EXCEL');
      capabilities.push('spreadsheet');
      deviceTypes.push(DeviceType.DESKTOP);
    }

    // 钉钉
    if (text.includes('钉钉') || text.includes('工作')) {
      programs.push('com.alibaba.android.rimet');
      programs.push('DingTalk');
      capabilities.push('work');
      deviceTypes.push(DeviceType.PHONE);
      deviceTypes.push(DeviceType.DESKTOP);
    }

    // 导航
    if (text.includes('导航') || text.includes('地图')) {
      capabilities.push('navigation');
      deviceTypes.push(DeviceType.PHONE);
    }

    // 浏览器
    if (text.includes('浏览器') || text.includes('上网') || text.includes('查')) {
      programs.push('chrome');
      programs.push('msedge');
      capabilities.push('browsing');
    }

    // 电话/短信
    if (text.includes('电话') || text.includes('短信')) {
      capabilities.push('communication');
      deviceTypes.push(DeviceType.PHONE);
    }

    return {
      requiredCapabilities: capabilities,
      requiredPrograms: programs,
      requiredDeviceTypes: deviceTypes.length > 0 ? deviceTypes : [DeviceType.PHONE, DeviceType.DESKTOP],
    };
  }

  /**
   * 分配设备
   */
  private assignDevices(
    requirements: ReturnType<typeof this.identifyRequirements>,
    userId: string,
    preferences?: TaskRequest['preferences']
  ): Map<string, { device: { id: string; name: string; type: DeviceType }; program: { name: string; category: string } | null } | null> {
    const assignments = new Map<string, { device: { id: string; name: string; type: DeviceType }; program: { name: string; category: string } | null } | null>();

    // 获取用户的所有设备
    const userDevices = cloudHub.getAllDevices()
      .filter(d => d.metadata.owner === userId && d.status === DeviceStatus.ONLINE);

    if (userDevices.length === 0) {
      logger.warn({ userId }, 'No online devices for user');
      return assignments;
    }

    // 按设备类型分组
    const desktop = userDevices.find(d => d.type === DeviceType.DESKTOP);
    const phone = userDevices.find(d => d.type === DeviceType.PHONE);

    // 桌面设备适合
    const desktopPrograms = requirements.requiredPrograms
      .map(p => KNOWN_PROGRAMS[p])
      .filter(p => p && ['work', 'tool', 'system'].includes(p.category));

    if (desktop && desktopPrograms.length > 0) {
      assignments.set('desktop', {
        device: { id: desktop.id, name: desktop.name, type: desktop.type },
        program: desktopPrograms[0]
      });
    }

    // 手机设备适合
    const phonePrograms = requirements.requiredPrograms
      .map(p => KNOWN_PROGRAMS[p])
      .filter(p => p && ['social', 'media', 'other'].includes(p.category));

    if (phone && phonePrograms.length > 0) {
      assignments.set('phone', {
        device: { id: phone.id, name: phone.name, type: phone.type },
        program: phonePrograms[0]
      });
    }

    // 默认分配
    if (assignments.size === 0) {
      // 选择最合适的设备
      const device = desktop || phone || userDevices[0];
      assignments.set('default', {
        device: { id: device.id, name: device.name, type: device.type },
        program: null
      });
    }

    return assignments;
  }

  /**
   * 生成子任务
   */
  private generateSubtasks(
    understanding: ReturnType<typeof this.understandIntent>,
    deviceAssignments: Map<string, { device: { id: string; name: string; type: DeviceType }; program: { name: string; category: string } | null } | null>
  ): SubTaskPlan[] {
    const subtasks: SubTaskPlan[] = [];
    const text = understanding.intent.toLowerCase();

    let subtaskId = 1;

    // 微信发消息
    if (text.includes('微信') && (text.includes('发') || text.includes('告诉'))) {
      const assignment = deviceAssignments.get('phone');
      const contact = understanding.entities.persons?.[0] || '联系人';
      const message = this.extractMessage(text);

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: `发送微信消息给 ${contact}`,
        targetDevice: assignment?.device || null,
        targetProgram: assignment?.program ? {
          name: assignment.program.name,
          packageName: assignment.program.name
        } : null,
        action: assignment?.program ? {
          name: '发送消息',
          invocation: { type: 'intent', value: 'weixin://' },
          parameters: { contact, message },
        } : null,
        dependsOn: [],
        estimatedTime: 5000,
        canExecute: !!assignment?.device,
        reason: !assignment?.device ? '手机不在线' : undefined,
      });
    }

    // 微信充值
    if (text.includes('微信') && (text.includes('话费') || text.includes('充值'))) {
      const assignment = deviceAssignments.get('phone');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '微信充值话费',
        targetDevice: assignment?.device || null,
        targetProgram: assignment?.program ? {
          name: assignment.program.name,
          packageName: assignment.program.name
        } : null,
        action: assignment?.program ? {
          name: '充值话费',
          invocation: { type: 'intent', value: 'weixin://updatablebill' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 30000,
        canExecute: !!assignment?.device,
        reason: !assignment?.device ? '手机不在线' : undefined,
      });
    }

    // 打开应用
    if (text.includes('打开') || text.includes('启动')) {
      const appName = this.extractAppName(text);
      const assignment = deviceAssignments.get('desktop') || deviceAssignments.get('default');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: `打开 ${appName}`,
        targetDevice: assignment?.device || null,
        targetProgram: assignment?.program || null,
        action: assignment?.device ? {
          name: '打开应用',
          invocation: { type: 'command', value: `start ${appName}` },
          parameters: { app: appName },
        } : null,
        dependsOn: [],
        estimatedTime: 3000,
        canExecute: !!assignment?.device,
      });
    }

    // 文件操作
    if (text.includes('文件') && (text.includes('整理') || text.includes('归类'))) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '整理文件',
        targetDevice: assignment?.device || null,
        targetProgram: { name: '文件管理器', packageName: 'Explorer' },
        action: assignment?.device ? {
          name: '整理文件',
          invocation: { type: 'command', value: 'organize' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 60000,
        canExecute: !!assignment?.device,
      });
    }

    // 编程任务
    if (text.includes('编程') || text.includes('代码') || text.includes('vscode')) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '打开VSCode进行编程',
        targetDevice: assignment?.device || null,
        targetProgram: { name: 'VSCode', packageName: 'Code' },
        action: assignment?.device ? {
          name: '打开VSCode',
          invocation: { type: 'command', value: 'code' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 5000,
        canExecute: !!assignment?.device,
      });
    }

    // 文档排版
    if (text.includes('排版') || text.includes('文档')) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '使用AI排版文档',
        targetDevice: assignment?.device || null,
        targetProgram: { name: '扣子AI', packageName: 'coze' },
        action: assignment?.device ? {
          name: '文档排版',
          invocation: { type: 'api', value: 'coze-api' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 30000,
        canExecute: !!assignment?.device,
      });
    }

    // 科技局申报 - 查找文件
    if ((text.includes('科技局') || text.includes('申报')) && text.includes('文件')) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '查找科技局申报相关文件',
        targetDevice: assignment?.device || null,
        targetProgram: { name: '文件管理器', packageName: 'Explorer' },
        action: assignment?.device ? {
          name: '查找申报文件',
          invocation: { type: 'pc-agent', value: 'file_organize' },
          parameters: { type: 'government' },
        } : null,
        dependsOn: [],
        estimatedTime: 10000,
        canExecute: !!assignment?.device,
      });
    }

    // 生成报告/文档
    if (text.includes('生成') && (text.includes('报告') || text.includes('文档') || text.includes('申报'))) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '生成申报文档',
        targetDevice: assignment?.device || null,
        targetProgram: { name: '文档生成', packageName: 'Office' },
        action: assignment?.device ? {
          name: '生成文档',
          invocation: { type: 'pc-agent', value: 'document_generate' },
          parameters: { description: understanding.intent },
        } : null,
        dependsOn: [],
        estimatedTime: 60000,
        canExecute: !!assignment?.device,
      });
    }

    // PPT制作
    if (text.includes('PPT') || text.includes('演示') || (text.includes('制作') && text.includes('幻灯'))) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '制作PPT演示文稿',
        targetDevice: assignment?.device || null,
        targetProgram: { name: 'PPT制作', packageName: 'PowerPoint' },
        action: assignment?.device ? {
          name: '创建PPT',
          invocation: { type: 'pc-agent', value: 'ppt_create' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 120000,
        canExecute: !!assignment?.device,
      });
    }

    // 系统优化/清理
    if (text.includes('优化') || text.includes('清理') || text.includes('清理电脑')) {
      const assignment = deviceAssignments.get('desktop');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: '执行系统优化',
        targetDevice: assignment?.device || null,
        targetProgram: { name: '系统优化', packageName: 'System' },
        action: assignment?.device ? {
          name: '系统优化',
          invocation: { type: 'pc-agent', value: 'system_optimize' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 30000,
        canExecute: !!assignment?.device,
      });
    }

    // 安装软件
    if (text.includes('安装') && text.includes('软件')) {
      const assignment = deviceAssignments.get('desktop');
      const softwareName = this.extractAppName(text.replace('安装', ''));

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: `安装软件: ${softwareName}`,
        targetDevice: assignment?.device || null,
        targetProgram: { name: '软件安装', packageName: 'System' },
        action: assignment?.device ? {
          name: '安装软件',
          invocation: { type: 'pc-agent', value: 'software_install' },
          parameters: { name: softwareName },
        } : null,
        dependsOn: [],
        estimatedTime: 180000,
        canExecute: !!assignment?.device,
      });
    }

    // 如果没有生成任何子任务，创建一个通用任务
    if (subtasks.length === 0) {
      const assignment = deviceAssignments.get('default') || deviceAssignments.get('desktop') || deviceAssignments.get('phone');

      subtasks.push({
        id: `subtask_${subtaskId++}`,
        description: understanding.intent,
        targetDevice: assignment?.device || null,
        targetProgram: assignment?.program || null,
        action: assignment?.device && assignment?.program ? {
          name: understanding.actions[0] || '执行',
          invocation: { type: 'command', value: 'execute' },
          parameters: {},
        } : null,
        dependsOn: [],
        estimatedTime: 10000,
        canExecute: !!assignment?.device,
        reason: !assignment?.device ? '没有可用设备' : undefined,
      });
    }

    return subtasks;
  }

  /**
   * 确定执行策略
   */
  private determineStrategy(subtasks: SubTaskPlan[]): 'sequential' | 'parallel' {
    // 检查是否有依赖关系
    const hasDependencies = subtasks.some(st => st.dependsOn.length > 0);
    if (hasDependencies) return 'sequential';

    // 检查是否涉及多个设备
    const devices = new Set(subtasks.map(st => st.targetDevice?.id).filter(Boolean));
    if (devices.size > 1) return 'parallel';

    // 检查任务数量
    if (subtasks.length > 3) return 'parallel';

    return 'sequential';
  }

  /**
   * 提取消息内容
   */
  private extractMessage(text: string): string {
    const match = text.match(/(?:说|告诉|内容[:：])["']?(.+?)["']?$/);
    return match ? match[1].trim() : '';
  }

  /**
   * 提取应用名称
   */
  private extractAppName(text: string): string {
    const match = text.match(/(?:打开|启动)(.+?)(?:\s|$)/);
    return match ? match[1].trim() : '应用';
  }

  /**
   * 获取执行状态
   */
  public getExecutionStatus(deviceId: string): Array<{ subtaskId: string; startedAt: Date }> {
    const status: Array<{ subtaskId: string; startedAt: Date }> = [];

    for (const [key, exec] of this.activeExecutions) {
      if (key.startsWith(`${deviceId}:`)) {
        status.push({ subtaskId: exec.subtaskId, startedAt: exec.startedAt });
      }
    }

    return status;
  }

  /**
   * 取消执行
   */
  public cancelExecution(taskId: string): boolean {
    let cancelled = false;

    for (const [key, exec] of this.activeExecutions) {
      if (exec.taskId === taskId) {
        // 发送取消命令到设备
        cloudHub.sendToDevice(exec.deviceId, {
          type: 'action:cancel',
          subtaskId: exec.subtaskId,
        });
        this.activeExecutions.delete(key);
        cancelled = true;
      }
    }

    return cancelled;
  }
}

// 导出
export const crossDeviceRouter = CrossDeviceRouter.getInstance();
export default crossDeviceRouter;
