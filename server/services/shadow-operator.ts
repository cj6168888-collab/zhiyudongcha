/**
 * Project Unbound - Shadow Operator (影子操作模块)
 * 
 * 实现三大执行路径：
 * 1. Android 上帝模式 - AccessibilityService + ADB 双通道
 * 2. PC OS级驱动接管 - Interception/uinput + RPC 指令集
 * 3. 视觉驱动后备 - V-LLM Grounding 坐标识别
 * 
 * 设计理念：
 * - 设备无关的统一指令接口
 * - 多通道冗余，自动降级
 * - 人类行为模拟，规避检测
 * - 视觉反馈闭环，确保执行成功
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ShadowOperator');

import { parseActionFromText, ScreenAction, ActionResult, ExecutorCapabilities } from './mock-op-layer';
import { feedbackLogger } from './feedback-logger';
import { vllmGrounding } from './vllm-grounding';

// ==================== 类型定义 ====================

export type DeviceType = 'ANDROID' | 'WINDOWS' | 'MACOS' | 'LINUX' | 'WEB';
export type ChannelType = 'ACCESSIBILITY' | 'ADB' | 'INTERCEPTION' | 'UINPUT' | 'RPC' | 'WEBSOCKET' | 'VLLM';
export type OperatorStatus = 'IDLE' | 'CONNECTED' | 'EXECUTING' | 'WAITING_CONFIRM' | 'ERROR' | 'DISCONNECTED';

export interface DeviceSession {
  id: string;
  deviceId: string;
  deviceType: DeviceType;
  name: string;
  channels: ChannelCapability[];
  status: OperatorStatus;
  lastHeartbeat: number;
  capabilities: ExecutorCapabilities;
  metadata: Record<string, any>;
}

export interface ChannelCapability {
  type: ChannelType;
  available: boolean;
  priority: number;  // 优先级，数字越小优先级越高
  latencyMs?: number;
  lastError?: string;
}

export interface ShadowCommand {
  id: string;
  sessionId: string;
  action: ScreenAction;
  channel?: ChannelType;  // 指定通道，否则自动选择
  humanSimulation: HumanSimulationConfig;
  verification: VerificationConfig;
  createdAt: number;
  executedAt?: number;
  completedAt?: number;
  status: 'QUEUED' | 'DISPATCHED' | 'EXECUTING' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'RETRY';
  attempts: number;
  maxAttempts: number;
  result?: CommandResult;
}

export interface HumanSimulationConfig {
  enabled: boolean;
  positionJitter: number;      // 位置随机偏移 (像素)
  delayBase: number;           // 基础延迟 (ms)
  delayVariance: number;       // 延迟随机范围 (ms)
  movementCurve: 'LINEAR' | 'BEZIER' | 'NATURAL';  // 移动轨迹
  typeSpeed: number;           // 打字速度 (字符/秒)
  typeVariance: number;        // 打字速度随机范围
}

export interface VerificationConfig {
  enabled: boolean;
  screenshotBefore: boolean;
  screenshotAfter: boolean;
  diffThreshold: number;       // 变化阈值
  timeout: number;             // 验证超时 (ms)
  retryOnFailure: boolean;
  maxRetries: number;
}

export interface CommandResult {
  success: boolean;
  channel: ChannelType;
  screenshotBefore?: string;
  screenshotAfter?: string;
  changeDetected?: boolean;
  changeScore?: number;
  coordinates?: { x: number; y: number };
  error?: string;
  duration: number;
}

// ==================== 默认配置 ====================

const DEFAULT_HUMAN_SIMULATION: HumanSimulationConfig = {
  enabled: true,
  positionJitter: 3,
  delayBase: 150,
  delayVariance: 100,
  movementCurve: 'NATURAL',
  typeSpeed: 8,
  typeVariance: 2,
};

const DEFAULT_VERIFICATION: VerificationConfig = {
  enabled: true,
  screenshotBefore: true,
  screenshotAfter: true,
  diffThreshold: 0.05,
  timeout: 5000,
  retryOnFailure: true,
  maxRetries: 3,
};

// ==================== Android 通道适配器 ====================

interface AndroidBridge {
  executeAccessibility(action: ScreenAction, jitter: { x: number; y: number; delay: number }): Promise<boolean>;
  executeADB(action: ScreenAction): Promise<boolean>;
  captureScreen(): Promise<string>;
  getDeviceInfo(): Promise<any>;
}

class AndroidChannelAdapter {
  private bridge: AndroidBridge | null = null;
  private adbConnected: boolean = false;
  private accessibilityConnected: boolean = false;

  async connect(deviceId: string, config: { adbHost?: string; wsEndpoint?: string }): Promise<boolean> {
    logger.info(`[ShadowOperator] Connecting to Android device: ${deviceId}`);
    
    // 在实际实现中，这里会：
    // 1. 通过 WebSocket 连接到 Android 伴侣应用
    // 2. 验证 AccessibilityService 是否已启用
    // 3. 尝试建立 ADB 无线连接
    
    // 模拟连接成功
    this.accessibilityConnected = true;
    this.adbConnected = config.adbHost ? true : false;
    
    return this.accessibilityConnected || this.adbConnected;
  }

  async executeAction(
    action: ScreenAction,
    channel: 'ACCESSIBILITY' | 'ADB',
    humanSim: HumanSimulationConfig
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 应用人类行为模拟
      const jitter = humanSim.enabled ? this.calculateJitter(humanSim) : { x: 0, y: 0, delay: 0 };
      
      // 添加随机延迟
      if (jitter.delay > 0) {
        await this.sleep(jitter.delay);
      }

      let success = false;

      if (channel === 'ACCESSIBILITY' && this.accessibilityConnected) {
        // 通过无障碍服务执行
        success = await this.executeViaAccessibility(action, jitter);
      } else if (channel === 'ADB' && this.adbConnected) {
        // 通过 ADB 执行
        success = await this.executeViaADB(action, jitter);
      }

      return {
        success,
        channel,
        duration: Date.now() - startTime,
        coordinates: action.params?.x && action.params?.y 
          ? { x: action.params.x + jitter.x, y: action.params.y + jitter.y }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        channel,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeViaAccessibility(action: ScreenAction, jitter: { x: number; y: number; delay: number }): Promise<boolean> {
    // 实际实现会通过 WebSocket 发送指令到 Android 伴侣应用
    const command = this.buildAccessibilityCommand(action, jitter);
    logger.info(`[Android/Accessibility] Executing: ${JSON.stringify(command)}`);
    
    // 模拟执行
    await this.sleep(50 + Math.random() * 50);
    return true;
  }

  private async executeViaADB(action: ScreenAction, jitter: { x: number; y: number; delay: number }): Promise<boolean> {
    // 实际实现会通过 ADB 发送 input 命令
    const adbCommand = this.buildADBCommand(action, jitter);
    logger.info(`[Android/ADB] Executing: ${adbCommand}`);
    
    // 模拟执行
    await this.sleep(100 + Math.random() * 50);
    return true;
  }

  private buildAccessibilityCommand(action: ScreenAction, jitter: { x: number; y: number; delay: number }): object {
    const x = (action.params?.x ?? 0) + jitter.x;
    const y = (action.params?.y ?? 0) + jitter.y;

    switch (action.type) {
      case 'CLICK':
        return { type: 'click', x, y, nodeId: action.target };
      case 'LONG_PRESS':
        return { type: 'longClick', x, y, duration: action.params?.duration ?? 500 };
      case 'INPUT':
        return { type: 'setText', text: action.params?.text ?? action.target };
      case 'SWIPE':
        return { 
          type: 'swipe', 
          fromX: x, 
          fromY: y, 
          toX: x + (action.params?.distance ?? 200) * (action.params?.direction === 'right' ? 1 : action.params?.direction === 'left' ? -1 : 0),
          toY: y + (action.params?.distance ?? 200) * (action.params?.direction === 'down' ? 1 : action.params?.direction === 'up' ? -1 : 0),
          duration: action.params?.duration ?? 300,
        };
      case 'SCROLL':
        return { type: 'scroll', direction: action.params?.direction ?? 'down', distance: action.params?.distance ?? 500 };
      case 'BACK':
        return { type: 'pressKey', keyCode: 'BACK' };
      case 'HOME':
        return { type: 'pressKey', keyCode: 'HOME' };
      default:
        return { type: action.type.toLowerCase(), target: action.target };
    }
  }

  private buildADBCommand(action: ScreenAction, jitter: { x: number; y: number; delay: number }): string {
    const x = (action.params?.x ?? 0) + jitter.x;
    const y = (action.params?.y ?? 0) + jitter.y;

    switch (action.type) {
      case 'CLICK':
        return `adb shell input tap ${x} ${y}`;
      case 'LONG_PRESS':
        return `adb shell input swipe ${x} ${y} ${x} ${y} ${action.params?.duration ?? 500}`;
      case 'INPUT':
        const text = (action.params?.text ?? action.target).replace(/\s/g, '%s').replace(/'/g, "\\'");
        return `adb shell input text '${text}'`;
      case 'SWIPE':
        const dx = (action.params?.distance ?? 200) * (action.params?.direction === 'right' ? 1 : action.params?.direction === 'left' ? -1 : 0);
        const dy = (action.params?.distance ?? 200) * (action.params?.direction === 'down' ? 1 : action.params?.direction === 'up' ? -1 : 0);
        return `adb shell input swipe ${x} ${y} ${x + dx} ${y + dy} ${action.params?.duration ?? 300}`;
      case 'BACK':
        return `adb shell input keyevent KEYCODE_BACK`;
      case 'HOME':
        return `adb shell input keyevent KEYCODE_HOME`;
      case 'SCREENSHOT':
        return `adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png`;
      default:
        return `adb shell input keyevent ${action.type}`;
    }
  }

  private calculateJitter(config: HumanSimulationConfig): { x: number; y: number; delay: number } {
    return {
      x: Math.round((Math.random() - 0.5) * 2 * config.positionJitter),
      y: Math.round((Math.random() - 0.5) * 2 * config.positionJitter),
      delay: config.delayBase + Math.round((Math.random() - 0.5) * 2 * config.delayVariance),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async captureScreen(): Promise<string> {
    // 实际实现会请求屏幕截图
    logger.info('[Android] Capturing screen...');
    return 'base64_screenshot_data';
  }

  getStatus(): { accessibility: boolean; adb: boolean } {
    return {
      accessibility: this.accessibilityConnected,
      adb: this.adbConnected,
    };
  }
}

// ==================== PC 通道适配器 ====================

class PCChannelAdapter {
  private rpcConnected: boolean = false;
  private platform: 'WINDOWS' | 'MACOS' | 'LINUX' = 'WINDOWS';
  private rpcEndpoint: string = '';

  async connect(config: { rpcEndpoint: string; platform: 'WINDOWS' | 'MACOS' | 'LINUX' }): Promise<boolean> {
    logger.info(`[ShadowOperator] Connecting to PC: ${config.platform} at ${config.rpcEndpoint}`);
    
    this.platform = config.platform;
    this.rpcEndpoint = config.rpcEndpoint;
    
    // 在实际实现中，这里会：
    // 1. 连接到 PC 守护进程的 RPC 端点
    // 2. 验证驱动级模拟器是否可用 (Interception/uinput)
    // 3. 获取屏幕分辨率等信息
    
    this.rpcConnected = true;
    return this.rpcConnected;
  }

  async executeAction(
    action: ScreenAction,
    humanSim: HumanSimulationConfig
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const jitter = humanSim.enabled ? this.calculateJitter(humanSim) : { x: 0, y: 0, delay: 0 };
      
      if (jitter.delay > 0) {
        await this.sleep(jitter.delay);
      }

      // 构建 RPC 指令
      const rpcCommand = this.buildRPCCommand(action, jitter, humanSim);
      
      // 发送到 PC 守护进程
      const success = await this.sendRPCCommand(rpcCommand);

      return {
        success,
        channel: this.platform === 'WINDOWS' ? 'INTERCEPTION' : 'UINPUT',
        duration: Date.now() - startTime,
        coordinates: action.params?.x && action.params?.y 
          ? { x: action.params.x + jitter.x, y: action.params.y + jitter.y }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'RPC',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private buildRPCCommand(action: ScreenAction, jitter: { x: number; y: number; delay: number }, humanSim: HumanSimulationConfig): object {
    const x = (action.params?.x ?? 0) + jitter.x;
    const y = (action.params?.y ?? 0) + jitter.y;

    const baseCommand = {
      platform: this.platform,
      useDriverLevel: true,  // 使用驱动级模拟
      humanSimulation: {
        movementCurve: humanSim.movementCurve,
        typeSpeed: humanSim.typeSpeed,
        typeVariance: humanSim.typeVariance,
      },
    };

    switch (action.type) {
      case 'CLICK':
        return {
          ...baseCommand,
          type: 'mouse_click',
          x, y,
          button: 'left',
        };
      case 'LONG_PRESS':
        return {
          ...baseCommand,
          type: 'mouse_hold',
          x, y,
          duration: action.params?.duration ?? 500,
        };
      case 'INPUT':
        return {
          ...baseCommand,
          type: 'keyboard_type',
          text: action.params?.text ?? action.target,
        };
      case 'SWIPE':
        const dx = (action.params?.distance ?? 200) * (action.params?.direction === 'right' ? 1 : action.params?.direction === 'left' ? -1 : 0);
        const dy = (action.params?.distance ?? 200) * (action.params?.direction === 'down' ? 1 : action.params?.direction === 'up' ? -1 : 0);
        return {
          ...baseCommand,
          type: 'mouse_drag',
          fromX: x,
          fromY: y,
          toX: x + dx,
          toY: y + dy,
          duration: action.params?.duration ?? 300,
        };
      case 'SCROLL':
        return {
          ...baseCommand,
          type: 'mouse_scroll',
          x, y,
          direction: action.params?.direction ?? 'down',
          amount: action.params?.distance ?? 3,
        };
      default:
        return {
          ...baseCommand,
          type: action.type.toLowerCase(),
          target: action.target,
        };
    }
  }

  private async sendRPCCommand(command: object): Promise<boolean> {
    // 实际实现会通过 HTTP/WebSocket 发送到 PC 守护进程
    logger.info(`[PC/RPC] Sending command: ${JSON.stringify(command)}`);
    
    // 模拟网络延迟
    await this.sleep(30 + Math.random() * 30);
    return true;
  }

  private calculateJitter(config: HumanSimulationConfig): { x: number; y: number; delay: number } {
    return {
      x: Math.round((Math.random() - 0.5) * 2 * config.positionJitter),
      y: Math.round((Math.random() - 0.5) * 2 * config.positionJitter),
      delay: config.delayBase + Math.round((Math.random() - 0.5) * 2 * config.delayVariance),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async captureScreen(): Promise<string> {
    logger.info('[PC] Capturing screen...');
    return 'base64_screenshot_data';
  }

  getStatus(): { connected: boolean; platform: string } {
    return {
      connected: this.rpcConnected,
      platform: this.platform,
    };
  }
}

// ==================== Shadow Operator 主服务 ====================

class ShadowOperatorService {
  private sessions: Map<string, DeviceSession> = new Map();
  private commandQueue: Map<string, ShadowCommand[]> = new Map();
  private androidAdapters: Map<string, AndroidChannelAdapter> = new Map();
  private pcAdapters: Map<string, PCChannelAdapter> = new Map();
  private onCommandComplete?: (command: ShadowCommand) => void;

  constructor() {
    logger.info('[ShadowOperator] Service initialized');
  }

  // ==================== 设备会话管理 ====================

  async registerDevice(
    deviceId: string,
    deviceType: DeviceType,
    name: string,
    config: Record<string, any>
  ): Promise<DeviceSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const channels: ChannelCapability[] = this.getDefaultChannels(deviceType);
    
    // 尝试连接设备
    if (deviceType === 'ANDROID') {
      const adapter = new AndroidChannelAdapter();
      const connected = await adapter.connect(deviceId, config);
      if (connected) {
        const status = adapter.getStatus();
        channels.find(c => c.type === 'ACCESSIBILITY')!.available = status.accessibility;
        channels.find(c => c.type === 'ADB')!.available = status.adb;
        this.androidAdapters.set(sessionId, adapter);
      }
    } else if (deviceType === 'WINDOWS' || deviceType === 'MACOS' || deviceType === 'LINUX') {
      const adapter = new PCChannelAdapter();
      const connected = await adapter.connect({
        rpcEndpoint: config.rpcEndpoint ?? 'http://localhost:9527',
        platform: deviceType,
      });
      if (connected) {
        channels.find(c => c.type === (deviceType === 'WINDOWS' ? 'INTERCEPTION' : 'UINPUT'))!.available = true;
        channels.find(c => c.type === 'RPC')!.available = true;
        this.pcAdapters.set(sessionId, adapter);
      }
    }

    const session: DeviceSession = {
      id: sessionId,
      deviceId,
      deviceType,
      name,
      channels,
      status: 'CONNECTED',
      lastHeartbeat: Date.now(),
      capabilities: this.getDefaultCapabilities(deviceType),
      metadata: config,
    };

    this.sessions.set(sessionId, session);
    this.commandQueue.set(sessionId, []);

    logger.info(`[ShadowOperator] Device registered: ${name} (${deviceType}) -> ${sessionId}`);
    return session;
  }

  async unregisterDevice(sessionId: string): Promise<boolean> {
    if (!this.sessions.has(sessionId)) {
      return false;
    }

    this.sessions.delete(sessionId);
    this.commandQueue.delete(sessionId);
    this.androidAdapters.delete(sessionId);
    this.pcAdapters.delete(sessionId);

    logger.info(`[ShadowOperator] Device unregistered: ${sessionId}`);
    return true;
  }

  getSession(sessionId: string): DeviceSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): DeviceSession[] {
    return Array.from(this.sessions.values());
  }

  // ==================== 命令执行 ====================

  async executeCommand(
    sessionId: string,
    action: ScreenAction,
    options?: {
      channel?: ChannelType;
      humanSimulation?: Partial<HumanSimulationConfig>;
      verification?: Partial<VerificationConfig>;
    }
  ): Promise<ShadowCommand> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const command: ShadowCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      action,
      channel: options?.channel,
      humanSimulation: { ...DEFAULT_HUMAN_SIMULATION, ...options?.humanSimulation },
      verification: { ...DEFAULT_VERIFICATION, ...options?.verification },
      createdAt: Date.now(),
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: options?.verification?.maxRetries ?? DEFAULT_VERIFICATION.maxRetries,
    };

    // 添加到队列
    const queue = this.commandQueue.get(sessionId) ?? [];
    queue.push(command);
    this.commandQueue.set(sessionId, queue);

    // 立即执行
    await this.processCommand(command);

    return command;
  }

  async executeCommands(
    sessionId: string,
    actions: ScreenAction[],
    options?: {
      humanSimulation?: Partial<HumanSimulationConfig>;
      verification?: Partial<VerificationConfig>;
    }
  ): Promise<ShadowCommand[]> {
    const commands: ShadowCommand[] = [];
    
    for (const action of actions) {
      const command = await this.executeCommand(sessionId, action, options);
      commands.push(command);
      
      // 如果失败且未成功重试，停止后续命令
      if (command.status === 'FAILED') {
        break;
      }
    }
    
    return commands;
  }

  private async processCommand(command: ShadowCommand): Promise<void> {
    const session = this.sessions.get(command.sessionId);
    if (!session) {
      command.status = 'FAILED';
      command.result = { success: false, channel: 'WEBSOCKET', error: 'Session not found', duration: 0 };
      return;
    }

    command.status = 'DISPATCHED';
    session.status = 'EXECUTING';

    // 选择最佳通道
    const channel = command.channel ?? this.selectBestChannel(session);
    
    // 截图 (执行前)
    let screenshotBefore: string | undefined;
    if (command.verification.screenshotBefore) {
      screenshotBefore = await this.captureScreen(session);
    }

    // 执行操作
    command.executedAt = Date.now();
    command.attempts++;
    command.status = 'EXECUTING';

    let result: CommandResult;

    try {
      if (session.deviceType === 'ANDROID') {
        const adapter = this.androidAdapters.get(command.sessionId);
        if (!adapter) {
          throw new Error('Android adapter not found');
        }
        result = await adapter.executeAction(
          command.action,
          channel as 'ACCESSIBILITY' | 'ADB',
          command.humanSimulation
        );
      } else {
        const adapter = this.pcAdapters.get(command.sessionId);
        if (!adapter) {
          throw new Error('PC adapter not found');
        }
        result = await adapter.executeAction(command.action, command.humanSimulation);
      }
    } catch (error) {
      result = {
        success: false,
        channel,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - (command.executedAt ?? Date.now()),
      };
    }

    // 截图 (执行后)
    let screenshotAfter: string | undefined;
    if (command.verification.screenshotAfter) {
      screenshotAfter = await this.captureScreen(session);
    }

    // 验证执行结果
    command.status = 'VERIFYING';
    
    if (command.verification.enabled && screenshotBefore && screenshotAfter) {
      const changeScore = this.calculateChangeScore(screenshotBefore, screenshotAfter);
      result.changeDetected = changeScore > command.verification.diffThreshold;
      result.changeScore = changeScore;
      
      // 如果期望有变化但没检测到，可能执行失败
      if (!result.changeDetected && result.success) {
        logger.info(`[ShadowOperator] Warning: No visual change detected after action`);
      }
    }

    result.screenshotBefore = screenshotBefore;
    result.screenshotAfter = screenshotAfter;
    command.result = result;
    command.completedAt = Date.now();

    // 判断是否成功
    if (result.success) {
      command.status = 'SUCCESS';
    } else {
      // 【自主进化逻辑】记录失败到 FeedbackLogger
      const failureRecord = feedbackLogger.logFailure({
        actionType: command.action.type,
        actionTarget: command.action.target || '',
        actionParams: command.action.params || {},
        errorMessage: result.error || 'Unknown execution error',
        screenshotBefore,
        screenshotAfter,
        deviceId: session.deviceId,
        deviceType: session.deviceType,
        channel: command.channel || 'AUTO',
        attemptNumber: command.attempts,
        maxAttempts: command.maxAttempts,
        sessionId: session.id,
        commandId: command.id,
      });
      
      // 【边界穿透逻辑】检查是否应该切换到视觉后备
      const fallbackSuggestion = feedbackLogger.suggestVisualFallback(failureRecord);
      
      if (fallbackSuggestion.shouldFallback && command.channel !== 'VLLM') {
        logger.info(`[ShadowOperator] ${fallbackSuggestion.reason}`);
        logger.info(`[ShadowOperator] 切换到 VLLM 视觉识别模式...`);
        
        // 尝试使用 VLLM 视觉定位重新执行
        try {
          if (screenshotAfter && command.action.target) {
            const groundingResult = await vllmGrounding.findElement(
              screenshotAfter,
              command.action.target
            );
            
            if (groundingResult.found && groundingResult.coordinates) {
              // 更新命令使用 VLLM 通道和新坐标
              command.channel = 'VLLM';
              command.action.params = {
                ...command.action.params,
                x: groundingResult.coordinates.x,
                y: groundingResult.coordinates.y,
              };
              command.status = 'RETRY';
              logger.info(`[ShadowOperator] VLLM 定位成功，坐标: (${groundingResult.coordinates.x}, ${groundingResult.coordinates.y})`);
              await this.processCommand(command);
              return;
            }
          }
        } catch (vllmError) {
          logger.info(`[ShadowOperator] VLLM 后备也失败: ${vllmError}`);
        }
      }
      
      // 常规重试逻辑
      if (command.verification.retryOnFailure && command.attempts < command.maxAttempts) {
        command.status = 'RETRY';
        logger.info(`[ShadowOperator] Retrying command (${command.attempts}/${command.maxAttempts})`);
        await this.processCommand(command);
        return;
      }
      command.status = 'FAILED';
    }

    session.status = 'CONNECTED';
    
    // 回调
    if (this.onCommandComplete) {
      this.onCommandComplete(command);
    }
  }

  private selectBestChannel(session: DeviceSession): ChannelType {
    const availableChannels = session.channels
      .filter(c => c.available)
      .sort((a, b) => a.priority - b.priority);
    
    if (availableChannels.length === 0) {
      return 'WEBSOCKET';  // 后备方案
    }
    
    return availableChannels[0].type;
  }

  private async captureScreen(session: DeviceSession): Promise<string> {
    if (session.deviceType === 'ANDROID') {
      const adapter = this.androidAdapters.get(session.id);
      if (adapter) {
        return adapter.captureScreen();
      }
    } else {
      const adapter = this.pcAdapters.get(session.id);
      if (adapter) {
        return adapter.captureScreen();
      }
    }
    return '';
  }

  private calculateChangeScore(before: string, after: string): number {
    // 简化实现：比较 base64 字符串
    // 实际应使用图像差异算法
    if (!before || !after) return 0;
    if (before === after) return 0;
    
    const lenDiff = Math.abs(before.length - after.length) / Math.max(before.length, after.length);
    return Math.min(lenDiff + 0.1, 1.0);  // 至少有些变化
  }

  // ==================== 辅助方法 ====================

  private getDefaultChannels(deviceType: DeviceType): ChannelCapability[] {
    switch (deviceType) {
      case 'ANDROID':
        return [
          { type: 'ACCESSIBILITY', available: false, priority: 1 },
          { type: 'ADB', available: false, priority: 2 },
          { type: 'VLLM', available: true, priority: 3 },
          { type: 'WEBSOCKET', available: true, priority: 4 },
        ];
      case 'WINDOWS':
        return [
          { type: 'INTERCEPTION', available: false, priority: 1 },
          { type: 'RPC', available: false, priority: 2 },
          { type: 'VLLM', available: true, priority: 3 },
          { type: 'WEBSOCKET', available: true, priority: 4 },
        ];
      case 'MACOS':
      case 'LINUX':
        return [
          { type: 'UINPUT', available: false, priority: 1 },
          { type: 'RPC', available: false, priority: 2 },
          { type: 'VLLM', available: true, priority: 3 },
          { type: 'WEBSOCKET', available: true, priority: 4 },
        ];
      default:
        return [
          { type: 'WEBSOCKET', available: true, priority: 1 },
          { type: 'VLLM', available: true, priority: 2 },
        ];
    }
  }

  private getDefaultCapabilities(deviceType: DeviceType): ExecutorCapabilities {
    return {
      platform: deviceType.toLowerCase() as ExecutorCapabilities['platform'],
      accessibilityEnabled: deviceType === 'ANDROID',
      ocrEnabled: true,
      screenWidth: deviceType === 'ANDROID' ? 1080 : 1920,
      screenHeight: deviceType === 'ANDROID' ? 2400 : 1080,
      features: deviceType === 'ANDROID' 
        ? ['accessibility', 'adb', 'media_projection', 'ocr']
        : ['driver_input', 'rpc', 'ocr'],
    };
  }

  setCommandCompleteCallback(callback: (command: ShadowCommand) => void): void {
    this.onCommandComplete = callback;
  }

  // ==================== 便捷执行方法 ====================

  async click(sessionId: string, target: string | { x: number; y: number }): Promise<ShadowCommand> {
    const action: ScreenAction = {
      id: `action_${Date.now()}`,
      type: 'CLICK',
      target: typeof target === 'string' ? target : `${target.x},${target.y}`,
      params: typeof target === 'object' ? { x: target.x, y: target.y } : undefined,
      priority: 'NORMAL',
      timeout: 5000,
      retryCount: 0,
      createdAt: Date.now(),
      status: 'pending',
    };
    return this.executeCommand(sessionId, action);
  }

  async type(sessionId: string, text: string): Promise<ShadowCommand> {
    const action: ScreenAction = {
      id: `action_${Date.now()}`,
      type: 'INPUT',
      target: text,
      params: { text },
      priority: 'NORMAL',
      timeout: 10000,
      retryCount: 0,
      createdAt: Date.now(),
      status: 'pending',
    };
    return this.executeCommand(sessionId, action);
  }

  async swipe(
    sessionId: string,
    direction: 'up' | 'down' | 'left' | 'right',
    distance?: number
  ): Promise<ShadowCommand> {
    const action: ScreenAction = {
      id: `action_${Date.now()}`,
      type: 'SWIPE',
      target: direction,
      params: { direction, distance: distance ?? 500 },
      priority: 'NORMAL',
      timeout: 5000,
      retryCount: 0,
      createdAt: Date.now(),
      status: 'pending',
    };
    return this.executeCommand(sessionId, action);
  }

  async screenshot(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return this.captureScreen(session);
  }
}

// ==================== 导出单例 ====================

export const shadowOperator = new ShadowOperatorService();

export default shadowOperator;
