/**
 * XiaoXing Cloud Hub - 跨设备智能助手云端协调中心
 *
 * 功能：
 * - 设备注册与管理
 * - 任务分发与协调
 * - 设备能力聚合
 * - 跨设备任务编排
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('CloudHub');

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============ 类型定义 ============

interface WsConnection {
  send(data: string): void;
}

interface DeviceMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * 设备类型
 */
export enum DeviceType {
  PHONE = 'phone',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  WATCH = 'watch',
  CAR = 'car',
  IOT = 'iot',
}

/**
 * 设备状态
 */
export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  SLEEP = 'sleep',
}

/**
 * 设备信息
 */
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;

  // 连接信息
  connection: {
    protocol: 'websocket' | 'http' | 'mqtt';
    endpoint: string;
    lastHeartbeat: Date;
  };

  // 能力描述
  capabilities: DeviceCapabilities;

  // 资源状态
  resources: DeviceResources;

  // 安装的程序
  programs: InstalledProgram[];

  // 元数据
  metadata: {
    os: string;
    osVersion: string;
    model?: string;
    manufacturer?: string;
    owner: string;
    tags: string[];
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 设备能力
 */
export interface DeviceCapabilities {
  // 输入能力
  input: {
    voice: boolean;
    text: boolean;
    camera: boolean;
    fingerprint: boolean;
    face: boolean;
  };

  // 输出能力
  output: {
    screen: boolean;
    speaker: boolean;
    vibration: boolean;
    led: boolean;
  };

  // 传感器
  sensors: {
    gps: boolean;
    accelerometer: boolean;
    gyroscope: boolean;
    nfc: boolean;
    bluetooth: boolean;
    wifi: boolean;
  };

  // 执行能力
  execution: {
    // 可以执行命令
    canExecuteCommand: boolean;
    // 可以控制其他设备
    canControlOther: boolean;
    // 支持自动化
    canAutomate: boolean;
    // 屏幕大小
    screenSize?: { width: number; height: number };
  };

  // 网络能力
  network: {
    hasInternet: boolean;
    localNetwork: boolean;
    mobileData: boolean;
  };

  // 权限能力
  permissions: {
    admin: boolean;
    root: boolean;
  };
}

/**
 * 设备资源状态
 */
export interface DeviceResources {
  cpu: number;           // CPU 使用率 0-100
  memory: {
    used: number;        // MB
    total: number;       // MB
  };
  storage: {
    used: number;        // GB
    total: number;       // GB
  };
  battery?: {
    level: number;       // 0-100
    charging: boolean;
  };
  network: {
    type: 'wifi' | 'mobile' | 'ethernet' | 'offline';
    signal?: number;     // 信号强度 0-100
  };
}

/**
 * 已安装程序
 */
export interface InstalledProgram {
  id: string;
  name: string;
  packageName: string;     // 包名 (Android) / Bundle ID (iOS) / Process Name (Desktop)
  version: string;

  // 分类
  category: 'social' | 'work' | 'tool' | 'media' | 'system' | 'game' | 'other';

  // 功能描述（小星需要理解这个程序能做什么）
  description: string;

  // 可执行的动作
  actions: ProgramAction[];

  // 状态
  enabled: boolean;
  installedAt: Date;
}

/**
 * 程序可执行动作
 */
export interface ProgramAction {
  id: string;
  name: string;
  description: string;

  // 调用方式
  invocation: {
    type: 'intent' | 'deeplink' | 'shortcut' | 'command' | 'api';
    value: string;
    params?: Record<string, string>;
  };

  // 需要的参数
  parameters?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'file' | 'location';
    required: boolean;
    description: string;
    defaultValue?: unknown;
  }>;

  // 返回值
  returns?: {
    type: 'text' | 'file' | 'data' | 'none';
    description: string;
  };
}

/**
 * 任务
 */
export interface Task {
  id: string;

  // 任务描述
  description: string;

  // 执行策略
  strategy: TaskStrategy;

  // 子任务
  subtasks: SubTask[];

  // 状态
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

  // 结果
  result?: TaskResult;

  // 上下文
  context: {
    userId: string;
    conversationId?: string;
    sourceDevice?: string;
    createdAt: Date;
  };

  // 优先级
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // 超时时间
  timeout?: number;  // 毫秒
}

/**
 * 子任务
 */
export interface SubTask {
  id: string;

  // 描述
  description: string;

  // 分配给哪个设备
  targetDevice?: string;

  // 分配给哪个程序
  targetProgram?: string;

  // 调用的动作
  action?: {
    program: string;
    action: string;
    params: Record<string, unknown>;
  };

  // 状态
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'skipped';

  // 执行结果
  result?: unknown;
  error?: string;

  // 依赖
  dependsOn?: string[];  // 依赖的其他子任务ID
}

/**
 * 任务策略
 */
export interface TaskStrategy {
  // 分配策略
  assignment: 'auto' | 'preferred' | 'any' | 'specific';
  preferredDevices?: string[];
  preferredPrograms?: string[];

  // 执行策略
  execution: 'sequential' | 'parallel' | 'smart';

  // 失败处理
  onFailure: 'retry' | 'skip' | 'abort' | 'fallback';
  maxRetries?: number;
  fallbackDevice?: string;
}

/**
 * 任务结果
 */
export interface TaskResult {
  success: boolean;
  output?: unknown;
  summary: string;
  duration: number;  // 毫秒
  executedBy: string[];
  errors?: Array<{ device: string; error: string }>;
}

/**
 * 知识库条目
 */
export interface KnowledgeEntry {
  id: string;
  category: 'device' | 'program' | 'action' | 'skill' | 'workflow';

  // 内容
  title: string;
  content: string;

  // 标签
  tags: string[];

  // 关联
  relatesTo?: {
    device?: string;
    program?: string;
    action?: string;
  };

  // 置信度
  confidence: number;

  // 使用统计
  usage: {
    timesUsed: number;
    successRate: number;
    lastUsed?: Date;
  };

  updatedAt: Date;
}

// ============ 核心类 ============

class CloudHub extends EventEmitter {
  private static instance: CloudHub | null = null;

  // 设备注册表
  private devices: Map<string, Device> = new Map();

  // 任务队列
  private taskQueue: Map<string, Task> = new Map();

  // 知识库
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();

  // WebSocket 连接（设备连接）
  private connections: Map<string, WsConnection> = new Map();

  // 外部服务引用
  private externalDeviceService: unknown = null;
  private remoteControlService: unknown = null;

  private constructor() {
    super();
    this.initializeKnowledgeBase();
    this.connectToExternalServices();
    logger.info('CloudHub initialized');
  }

  public static getInstance(): CloudHub {
    if (!CloudHub.instance) {
      CloudHub.instance = new CloudHub();
    }
    return CloudHub.instance;
  }

  /**
   * 连接到外部设备服务
   * 集成现有的 DeviceConnectionService 和 RemoteControlService
   */
  private connectToExternalServices(): void {
    try {
      // 延迟导入避免循环依赖
      import('../mobile/DeviceConnectionService').then(({ deviceConnectionService }) => {
        if (deviceConnectionService) {
          this.externalDeviceService = deviceConnectionService;

          // 监听设备消息
          deviceConnectionService.onMessage((deviceId: string, message: DeviceMessage) => {
            this.handleDeviceMessage(deviceId, message);
          });

          logger.info('Connected to DeviceConnectionService');
        }
      }).catch(() => {
        logger.warn('DeviceConnectionService not available');
      });

      import('../remote-control/RemoteControlService').then(({ remoteControlService }) => {
        if (remoteControlService && typeof remoteControlService.getInstance === 'function') {
          this.remoteControlService = remoteControlService.getInstance();
          logger.info('Connected to RemoteControlService');
        }
      }).catch(() => {
        logger.warn('RemoteControlService not available');
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to connect to external services');
    }
  }

  /**
   * 注册外部设备到 CloudHub
   * 用于将 DeviceConnectionService 中的设备同步过来
   */
  public syncExternalDevice(externalDevice: {
    id: string;
    name: string;
    type: 'PHONE' | 'DESKTOP' | 'TABLET';
    status: string;
    platform?: string;
    capabilities?: DeviceCapabilities;
  }): void {
    // 转换为 CloudHub Device 格式
    const device: Device = {
      id: externalDevice.id,
      name: externalDevice.name,
      type: this.mapDeviceType(externalDevice.type),
      status: this.mapDeviceStatus(externalDevice.status),
      connection: {
        protocol: 'websocket',
        endpoint: '',
        lastHeartbeat: new Date(),
      },
      capabilities: externalDevice.capabilities || this.getDefaultCapabilities(),
      resources: {
        cpu: 0,
        memory: { used: 0, total: 0 },
        storage: { used: 0, total: 0 },
      },
      programs: [],
      metadata: {
        os: externalDevice.platform || 'unknown',
        osVersion: '',
        owner: 'default',
        tags: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.registerDevice(device);
    logger.info({ deviceId: device.id, source: 'external' }, 'Synced external device');
  }

  /**
   * 映射设备类型
   */
  private mapDeviceType(type: string): DeviceType {
    switch (type) {
      case 'PHONE': return DeviceType.PHONE;
      case 'DESKTOP': return DeviceType.DESKTOP;
      case 'TABLET': return DeviceType.TABLET;
      default: return DeviceType.PHONE;
    }
  }

  /**
   * 映射设备状态
   */
  private mapDeviceStatus(status: string): DeviceStatus {
    switch (status) {
      case 'ONLINE': return DeviceStatus.ONLINE;
      case 'OFFLINE': return DeviceStatus.OFFLINE;
      case 'BUSY': return DeviceStatus.BUSY;
      default: return DeviceStatus.OFFLINE;
    }
  }

  /**
   * 获取默认设备能力
   */
  private getDefaultCapabilities(): DeviceCapabilities {
    return {
      input: { voice: true, text: true, camera: false, fingerprint: false, face: false },
      output: { screen: true, speaker: true, vibration: true, led: false },
      sensors: { gps: false, accelerometer: false, gyroscope: false, nfc: false, bluetooth: false, wifi: true },
      execution: { canExecuteCommand: true, canControlOther: false, canAutomate: true },
      network: { hasInternet: true, localNetwork: true, mobileData: true },
      permissions: { admin: false, root: false },
    };
  }

  /**
   * 初始化知识库
   */
  private initializeKnowledgeBase(): void {
    // 默认技能库
    const defaultSkills: KnowledgeEntry[] = [
      {
        id: 'skill_file_operation',
        category: 'skill',
        title: '文件操作',
        content: '文件操作包括：复制、移动、删除、重命名、查看、搜索等。可以使用文件管理器或命令行完成。',
        tags: ['文件', '电脑', '操作'],
        confidence: 0.9,
        usage: { timesUsed: 0, successRate: 1.0 },
        updatedAt: new Date(),
      },
      {
        id: 'skill_wechat_operation',
        category: 'skill',
        title: '微信操作',
        content: '微信可以发送消息、查看朋友圈、转账、发红包、视频通话等。通过微信应用或网页版操作。',
        tags: ['微信', '社交', '支付'],
        confidence: 0.9,
        usage: { timesUsed: 0, successRate: 1.0 },
        updatedAt: new Date(),
      },
      {
        id: 'skill_office_operation',
        category: 'skill',
        title: '办公软件操作',
        content: 'Office包括Word、Excel、PowerPoint。常用操作：创建文档、编辑内容、格式调整、数据分析、制作幻灯片。',
        tags: ['office', 'word', 'excel', 'ppt', '办公'],
        confidence: 0.9,
        usage: { timesUsed: 0, successRate: 1.0 },
        updatedAt: new Date(),
      },
      {
        id: 'skill_programming',
        category: 'skill',
        title: '编程开发',
        content: '编程开发包括：写代码、调试、运行、部署等。常用工具：VSCode、IDE、命令行、Git等。',
        tags: ['编程', '代码', '开发', 'vscode'],
        confidence: 0.9,
        usage: { timesUsed: 0, successRate: 1.0 },
        updatedAt: new Date(),
      },
      {
        id: 'skill_coze',
        category: 'skill',
        title: '扣子AI集成',
        content: '扣子(Coze)是字节跳动的AI平台，可以调用AI能力进行内容生成、文档排版、翻译、总结等任务。通过API调用。',
        tags: ['扣子', 'coze', 'ai', '排版', '文档'],
        confidence: 0.9,
        usage: { timesUsed: 0, successRate: 1.0 },
        updatedAt: new Date(),
      },
    ];

    for (const entry of defaultSkills) {
      this.knowledgeBase.set(entry.id, entry);
    }

    logger.info({ count: defaultSkills.length }, 'Knowledge base initialized');
  }

  // ============ 设备管理 ============

  /**
   * 注册设备
   */
  public registerDevice(device: Device): void {
    this.devices.set(device.id, device);
    logger.info({ deviceId: device.id, type: device.type, name: device.name }, 'Device registered');
    this.emit('device:registered', device);
  }

  /**
   * 注销设备
   */
  public unregisterDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.delete(deviceId);
      this.connections.delete(deviceId);
      logger.info({ deviceId }, 'Device unregistered');
      this.emit('device:unregistered', device);
    }
  }

  /**
   * 更新设备状态
   */
  public updateDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.updatedAt = new Date();
      this.devices.set(deviceId, device);
      logger.debug({ deviceId, status }, 'Device status updated');
      this.emit('device:status', device);
    }
  }

  /**
   * 更新设备资源
   */
  public updateDeviceResources(deviceId: string, resources: DeviceResources): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.resources = resources;
      device.updatedAt = new Date();
      this.devices.set(deviceId, device);
    }
  }

  /**
   * 更新设备程序列表
   */
  public updateDevicePrograms(deviceId: string, programs: InstalledProgram[]): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.programs = programs;
      device.updatedAt = new Date();
      this.devices.set(deviceId, device);
      logger.info({ deviceId, count: programs.length }, 'Device programs updated');
      this.emit('device:programs', { deviceId, programs });
    }
  }

  /**
   * 获取设备
   */
  public getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * 获取所有设备
   */
  public getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * 获取在线设备
   */
  public getOnlineDevices(): Device[] {
    return this.getAllDevices().filter(d => d.status === DeviceStatus.ONLINE);
  }

  /**
   * 按类型获取设备
   */
  public getDevicesByType(type: DeviceType): Device[] {
    return this.getAllDevices().filter(d => d.type === type && d.status === DeviceStatus.ONLINE);
  }

  /**
   * 保存设备连接
   */
  public saveConnection(deviceId: string, connection: WsConnection): void {
    this.connections.set(deviceId, connection);
  }

  public getConnection(deviceId: string): WsConnection | undefined {
    return this.connections.get(deviceId);
  }

  // ============ 任务管理 ============

  /**
   * 创建任务
   */
  public createTask(task: Omit<Task, 'id' | 'status'>): Task {
    const fullTask: Task = {
      ...task,
      id: `task_${randomUUID().slice(0, 8)}`,
      status: 'pending',
    };

    this.taskQueue.set(fullTask.id, fullTask);
    logger.info({ taskId: fullTask.id, description: task.description.substring(0, 50) }, 'Task created');
    this.emit('task:created', fullTask);

    return fullTask;
  }

  /**
   * 提交任务
   */
  public submitTask(description: string, strategy: TaskStrategy, context: Task['context']): Task {
    return this.createTask({
      description,
      strategy,
      subtasks: [],
      context,
      priority: 'normal',
    });
  }

  /**
   * 更新任务状态
   */
  public updateTaskStatus(taskId: string, status: Task['status']): void {
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.status = status;
      this.taskQueue.set(taskId, task);
      logger.debug({ taskId, status }, 'Task status updated');
      this.emit('task:status', task);
    }
  }

  /**
   * 添加子任务
   */
  public addSubtask(taskId: string, subtask: Omit<SubTask, 'id' | 'status'>): SubTask | null {
    const task = this.taskQueue.get(taskId);
    if (task) {
      const fullSubtask: SubTask = {
        ...subtask,
        id: `subtask_${randomUUID().slice(0, 8)}`,
        status: 'pending',
      };
      task.subtasks.push(fullSubtask);
      this.taskQueue.set(taskId, task);
      return fullSubtask;
    }
    return null;
  }

  /**
   * 分配子任务到设备
   */
  public assignSubtask(taskId: string, subtaskId: string, deviceId: string): boolean {
    const task = this.taskQueue.get(taskId);
    if (task) {
      const subtask = task.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        subtask.targetDevice = deviceId;
        subtask.status = 'assigned';
        this.taskQueue.set(taskId, task);

        // 发送到设备
        this.sendToDevice(deviceId, {
          type: 'task:execute',
          taskId,
          subtaskId,
          subtask,
        });

        return true;
      }
    }
    return false;
  }

  /**
   * 获取任务
   */
  public getTask(taskId: string): Task | undefined {
    return this.taskQueue.get(taskId);
  }

  /**
   * 获取用户的所有任务
   */
  public getUserTasks(userId: string): Task[] {
    return Array.from(this.taskQueue.values())
      .filter(t => t.context.userId === userId);
  }

  // ============ 知识库 ============

  /**
   * 添加知识条目
   */
  public addKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'updatedAt'>): KnowledgeEntry {
    const fullEntry: KnowledgeEntry = {
      ...entry,
      id: `knowledge_${randomUUID().slice(0, 8)}`,
      updatedAt: new Date(),
    };
    this.knowledgeBase.set(fullEntry.id, fullEntry);
    return fullEntry;
  }

  /**
   * 搜索知识
   */
  public searchKnowledge(query: string, category?: KnowledgeEntry['category']): KnowledgeEntry[] {
    const results: KnowledgeEntry[] = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.knowledgeBase.values()) {
      if (category && entry.category !== category) continue;

      // 标题匹配
      if (entry.title.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // 内容匹配
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // 标签匹配
      if (entry.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        results.push(entry);
        continue;
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取设备能力描述
   */
  public getDeviceCapabilityDescription(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return '';

    const parts: string[] = [];

    // 基础信息
    parts.push(`${device.name}（${device.type}）`);
    parts.push(`操作系统：${device.metadata.os} ${device.metadata.osVersion}`);

    // 输入输出
    const inputs = [];
    if (device.capabilities.input.voice) inputs.push('语音');
    if (device.capabilities.input.camera) inputs.push('摄像头');
    if (inputs.length) parts.push(`输入：${inputs.join('、')}`);

    const outputs = [];
    if (device.capabilities.output.screen) outputs.push('屏幕');
    if (device.capabilities.output.speaker) outputs.push('扬声器');
    if (outputs.length) parts.push(`输出：${outputs.join('、')}`);

    // 传感器
    const sensors = [];
    if (device.capabilities.sensors.gps) sensors.push('GPS');
    if (device.capabilities.sensors.nfc) sensors.push('NFC');
    if (device.capabilities.sensors.bluetooth) sensors.push('蓝牙');
    if (sensors.length) parts.push(`传感器：${sensors.join('、')}`);

    // 程序数量
    parts.push(`已安装 ${device.programs.length} 个应用`);

    // 程序列表（简要）
    const programsByCategory = this.groupProgramsByCategory(device.programs);
    for (const [category, programs] of Object.entries(programsByCategory)) {
      parts.push(`${category}：${programs.map(p => p.name).join('、')}`);
    }

    return parts.join('\n');
  }

  /**
   * 获取所有设备的综合能力描述
   */
  public getAllCapabilitiesDescription(userId: string): string {
    const devices = this.getAllDevices().filter(d => d.metadata.owner === userId);

    if (devices.length === 0) {
      return '暂无已连接的设备';
    }

    const parts: string[] = ['您已连接的设备：\n'];

    for (const device of devices) {
      parts.push(`\n${this.getDeviceCapabilityDescription(device.id)}`);
    }

    return parts.join('\n');
  }

  /**
   * 按分类分组程序
   */
  private groupProgramsByCategory(programs: InstalledProgram[]): Record<string, InstalledProgram[]> {
    const groups: Record<string, InstalledProgram[]> = {};

    for (const program of programs) {
      if (!groups[program.category]) {
        groups[program.category] = [];
      }
      groups[program.category].push(program);
    }

    return groups;
  }

  // ============ 设备通信 ============

  /**
   * 发送消息到设备
   */
  public sendToDevice(deviceId: string, message: DeviceMessage): boolean {
    const connection = this.connections.get(deviceId);
    if (connection) {
      try {
        connection.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to send to device');
        return false;
      }
    }
    return false;
  }

  /**
   * 广播到所有设备
   */
  public broadcast(message: DeviceMessage): void {
    for (const [deviceId, connection] of this.connections) {
      try {
        connection.send(JSON.stringify(message));
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to broadcast');
      }
    }
  }

  /**
   * 从设备接收消息
   */
  public async handleDeviceMessage(deviceId: string, message: DeviceMessage): Promise<void> {
    logger.debug({ deviceId, type: message.type }, 'Device message received');

    switch (message.type) {
      case 'heartbeat':
        this.handleHeartbeat(deviceId, message);
        break;
      case 'task:result':
        this.handleTaskResult(deviceId, message);
        break;
      case 'capability:update':
        this.handleCapabilityUpdate(deviceId, message);
        break;
      case 'program:list':
        this.handleProgramList(deviceId, message);
        break;
      default:
        logger.warn({ deviceId, type: message.type }, 'Unknown message type');
    }
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(deviceId: string, message: DeviceMessage): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.connection.lastHeartbeat = new Date();
      if (message.resources) {
        device.resources = message.resources;
      }
      this.devices.set(deviceId, device);
    }
  }

  /**
   * 处理任务结果
   */
  private handleTaskResult(deviceId: string, message: DeviceMessage): void {
    const { taskId, subtaskId, result, error } = message;
    const task = this.taskQueue.get(taskId);

    if (task) {
      const subtask = task.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        subtask.status = error ? 'failed' : 'completed';
        subtask.result = result;
        subtask.error = error;

        // 检查是否所有子任务都完成
        const allDone = task.subtasks.every(s =>
          s.status === 'completed' || s.status === 'skipped' || s.status === 'failed'
        );

        if (allDone) {
          task.status = task.subtasks.some(s => s.status === 'failed') ? 'failed' : 'completed';
          task.result = this.generateTaskResult(task);
        }

        this.taskQueue.set(taskId, task);
        this.emit('task:updated', task);
      }
    }
  }

  /**
   * 处理能力更新
   */
  private handleCapabilityUpdate(deviceId: string, message: DeviceMessage): void {
    const device = this.devices.get(deviceId);
    if (device && message.capabilities) {
      device.capabilities = { ...device.capabilities, ...message.capabilities };
      device.updatedAt = new Date();
      this.devices.set(deviceId, device);
    }
  }

  /**
   * 处理程序列表更新
   */
  private handleProgramList(deviceId: string, message: DeviceMessage): void {
    this.updateDevicePrograms(deviceId, message.programs || []);
  }

  /**
   * 生成任务结果
   */
  private generateTaskResult(task: Task): TaskResult {
    const completed = task.subtasks.filter(s => s.status === 'completed');
    const failed = task.subtasks.filter(s => s.status === 'failed');

    return {
      success: failed.length === 0,
      summary: `${completed.length}/${task.subtasks.length} 个子任务完成`,
      duration: Date.now() - task.context.createdAt.getTime(),
      executedBy: Array.from(new Set(task.subtasks.map(s => s.targetDevice).filter(Boolean))) as string[],
      errors: failed.map(s => ({
        device: s.targetDevice || 'unknown',
        error: s.error || 'Unknown error',
      })),
    };
  }

  // ============ 智能任务规划 ============

  /**
   * 智能规划任务
   *
   * 根据用户描述，自动拆解任务并分配到合适的设备
   */
  public async planTask(description: string, context: Task['context']): Promise<Task> {
    // 1. 理解任务
    const understanding = await this.understandTask(description, context);

    // 2. 分解子任务
    const subtasks = await this.decomposeTask(understanding, context);

    // 3. 分配设备
    const assignments = await this.assignTasks(subtasks, context);

    // 4. 创建任务
    const task = this.createTask({
      description,
      strategy: {
        assignment: 'auto',
        execution: understanding.parallelizable ? 'parallel' : 'sequential',
        onFailure: 'retry',
        maxRetries: 2,
      },
      subtasks: assignments,
      context,
      priority: understanding.priority,
    });

    return task;
  }

  /**
   * 理解任务
   */
  private async understandTask(description: string, context: Task['context']): Promise<{
    intent: string;
    requirements: string[];
    devices: ('phone' | 'desktop' | 'any')[];
    programs: string[];
    parallelizable: boolean;
    priority: 'low' | 'normal' | 'high' | 'urgent';
  }> {
    // 简单的关键词分析（实际应该用AI）
    const descLower = description.toLowerCase();

    const requirements: string[] = [];
    let devices: ('phone' | 'desktop' | 'any')[] = ['any'];
    let parallelizable = false;
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

    // 设备需求
    if (descLower.includes('手机') || descLower.includes('微信') || descLower.includes('打电话')) {
      devices = ['phone'];
    }
    if (descLower.includes('电脑') || descLower.includes('文件') || descLower.includes('vscode') || descLower.includes('office')) {
      devices = ['desktop'];
    }
    if (descLower.includes('手机') && descLower.includes('电脑')) {
      devices = ['phone', 'desktop'];
    }

    // 需求识别
    if (descLower.includes('发微信') || descLower.includes('微信')) {
      requirements.push('wechat');
    }
    if (descLower.includes('文件') || descLower.includes('整理')) {
      requirements.push('file_operation');
    }
    if (descLower.includes('编程') || descLower.includes('代码')) {
      requirements.push('programming');
    }
    if (descLower.includes('排版') || descLower.includes('文档')) {
      requirements.push('document_processing');
    }

    // 优先级
    if (descLower.includes('紧急') || descLower.includes('马上') || descLower.includes('立刻')) {
      priority = 'urgent';
    } else if (descLower.includes('不急') || descLower.includes('以后')) {
      priority = 'low';
    }

    // 可并行
    if (descLower.includes('同时') || descLower.includes('一并')) {
      parallelizable = true;
    }

    return {
      intent: description,
      requirements,
      devices,
      programs: [],
      parallelizable,
      priority,
    };
  }

  /**
   * 分解任务
   */
  private async decomposeTask(understanding: ReturnType<typeof this.understandTask>, context: Task['context']): Promise<Omit<SubTask, 'id' | 'status'>[]> {
    const subtasks: Omit<SubTask, 'id' | 'status'>[] = [];
    const descLower = understanding.intent.toLowerCase();

    // 发微信相关
    if (descLower.includes('微信') && descLower.includes('手机')) {
      subtasks.push({
        description: '在手机上打开微信',
        targetDevice: 'phone',
        action: {
          program: 'wechat',
          action: 'open',
          params: {},
        },
      });

      if (descLower.includes('发消息') || descLower.includes('告诉')) {
        const contact = this.extractContact(descLower);
        const message = this.extractMessage(descLower);
        subtasks.push({
          description: `发送微信消息给${contact}`,
          targetDevice: 'phone',
          action: {
            program: 'wechat',
            action: 'send_message',
            params: { contact, message },
          },
        });
      }

      if (descLower.includes('交话费') || descLower.includes('充值')) {
        subtasks.push({
          description: '微信充值话费',
          targetDevice: 'phone',
          action: {
            program: 'wechat',
            action: 'pay_phone_bill',
            params: {},
          },
        });
      }
    }

    // 电脑文件操作
    if (descLower.includes('文件') && descLower.includes('电脑')) {
      if (descLower.includes('整理') || descLower.includes('归类')) {
        subtasks.push({
          description: '整理电脑文件',
          targetDevice: 'desktop',
          action: {
            program: 'file_manager',
            action: 'organize_files',
            params: {},
          },
        });
      }

      if (descLower.includes('打开') || descLower.includes('运行')) {
        const app = this.extractAppName(descLower);
        subtasks.push({
          description: `打开${app}`,
          targetDevice: 'desktop',
          action: {
            program: 'system',
            action: 'launch_app',
            params: { app },
          },
        });
      }
    }

    // 编程相关
    if (descLower.includes('编程') || descLower.includes('代码') || descLower.includes('vscode')) {
      subtasks.push({
        description: '打开VSCode',
        targetDevice: 'desktop',
        action: {
          program: 'vscode',
          action: 'open',
          params: {},
        },
      });

      if (descLower.includes('写') || descLower.includes('创建')) {
        subtasks.push({
          description: '编写代码',
          targetDevice: 'desktop',
          action: {
            program: 'vscode',
            action: 'write_code',
            params: {},
          },
        });
      }
    }

    // 文档排版
    if (descLower.includes('排版') || descLower.includes('文档')) {
      subtasks.push({
        description: '使用AI排版文档',
        targetDevice: 'desktop',
        action: {
          program: 'coze',
          action: 'format_document',
          params: {},
        },
      });
    }

    // 如果没有匹配到具体操作，创建一个通用子任务
    if (subtasks.length === 0) {
      subtasks.push({
        description: understanding.intent,
        targetDevice: understanding.devices[0] === 'any' ? undefined : understanding.devices[0],
      });
    }

    return subtasks;
  }

  /**
   * 分配任务到设备
   */
  private async assignTasks(subtasks: Omit<SubTask, 'id' | 'status'>[], context: Task['context']): Promise<Omit<SubTask, 'id' | 'status'>[]> {
    const assignments = [];

    for (const subtask of subtasks) {
      let targetDevice = subtask.targetDevice;

      // 如果没有指定设备，自动选择
      if (!targetDevice) {
        // 根据任务类型选择设备
        const device = this.selectBestDevice(subtask, context);
        targetDevice = device?.id;
      }

      assignments.push({
        ...subtask,
        targetDevice,
      });
    }

    return assignments;
  }

  /**
   * 选择最佳设备
   */
  private selectBestDevice(subtask: Omit<SubTask, 'id' | 'status'>, context: Task['context']): Device | undefined {
    // 获取用户的所有在线设备
    const userDevices = this.getAllDevices()
      .filter(d => d.metadata.owner === context.userId && d.status === DeviceStatus.ONLINE);

    if (userDevices.length === 0) return undefined;

    // 根据任务类型选择
    const descLower = subtask.description.toLowerCase();

    // 优先使用桌面设备
    const desktop = userDevices.find(d => d.type === DeviceType.DESKTOP);
    const phone = userDevices.find(d => d.type === DeviceType.PHONE);

    // 微信相关 → 手机
    if (descLower.includes('微信') || descLower.includes('手机')) {
      return phone || desktop;
    }

    // 文件/编程 → 电脑
    if (descLower.includes('文件') || descLower.includes('编程') || descLower.includes('代码')) {
      return desktop || phone;
    }

    // 默认返回桌面设备
    return desktop || phone;
  }

  /**
   * 提取联系人
   */
  private extractContact(text: string): string {
    // 简单的模式匹配
    const match = text.match(/(?:给|发|告诉)(.+?)(?:说|发)/);
    return match ? match[1] : '未知联系人';
  }

  /**
   * 提取消息内容
   */
  private extractMessage(text: string): string {
    const match = text.match(/(?:说|告诉|内容是)["'"]?(.+?)["'"]?$/);
    return match ? match[1] : '';
  }

  /**
   * 提取应用名称
   */
  private extractAppName(text: string): string {
    const match = text.match(/(?:打开|运行)(.+)/);
    return match ? match[1] : '';
  }
}

// 导出
export const cloudHub = CloudHub.getInstance();
export default cloudHub;

// 导出类型
export {
  Device, DeviceCapabilities, DeviceResources,
  InstalledProgram, ProgramAction, Task, SubTask, TaskStrategy, TaskResult,
  KnowledgeEntry
};
