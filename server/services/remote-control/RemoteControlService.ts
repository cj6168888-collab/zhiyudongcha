/**
 * 远程控制服务 - 完整企业版 + 数据库持久化
 *
 * 提供PC端的远程控制能力，包括：
 * - 设备注册和管理 (支持数据库持久化)
 * - 屏幕截图
 * - 鼠标/键盘控制
 * - 文件传输
 * - WebSocket实时通信
 * - 命令执行
 *
 * @version 2.1.0
 * @author 架构组
 */

import { createServiceLogger } from '../../lib/logger';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import pcExecutorService from '../mobile/PCExecutorService';
import { pcDeviceRepository, pcSessionRepository } from '../../repositories';
import { createPathWebSocketServer } from '../../lib/websocket-path';

const logger = createServiceLogger('RemoteControl');

// ============================================
// 类型定义
// ============================================

export interface PCDeviceInfo {
  id: string;
  name: string;
  platform: 'WINDOWS' | 'MACOS' | 'LINUX';
  osVersion: string;
  capabilities: PCDeviceCapabilities;
  status: 'OFFLINE' | 'ONLINE' | 'BUSY' | 'ERROR';
  lastSeen: number;
  registeredAt: number;
  ipAddress?: string;
}

export interface PCDeviceCapabilities {
  screenCapture: boolean;
  mouseControl: boolean;
  keyboardControl: boolean;
  fileSystem: boolean;
  clipboard: boolean;
  notifications: boolean;
  maxResolution: {
    width: number;
    height: number;
  };
}

export interface RemoteSession {
  id: string;
  deviceId: string;
  userId?: string;
  ws: WebSocket;
  status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  createdAt: number;
  lastActivity: number;
  screenshotInterval?: NodeJS.Timeout;
}

export interface ControlCommand {
  type: 'MOUSE' | 'KEYBOARD' | 'SCREENSHOT' | 'FILE' | 'APP' | 'SYSTEM';
  action: string;
  params?: Record<string, unknown>;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface RemoteControlConfig {
  port: number;
  heartbeatInterval: number;
  screenshotQuality: number;
  maxSessions: number;
  screenshotInterval: number;
}

const DEFAULT_CONFIG: RemoteControlConfig = {
  port: 0,
  heartbeatInterval: 30000,
  screenshotQuality: 70,
  maxSessions: 10,
  screenshotInterval: 2000,
};

// ============================================
// 服务实现
// ============================================

export class RemoteControlService {
  private static instance: RemoteControlService | null = null;

  private wss: WebSocketServer | null = null;
  private config: RemoteControlConfig;
  private devices: Map<string, PCDeviceInfo> = new Map();
  private sessions: Map<string, RemoteSession> = new Map();
  private deviceSessions: Map<string, Set<string>> = new Map();
  private messageHandlers: Map<string, (session: RemoteSession, data: unknown) => Promise<CommandResult>> = new Map();

  private constructor(config: Partial<RemoteControlConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<RemoteControlConfig>): RemoteControlService {
    if (!RemoteControlService.instance) {
      RemoteControlService.instance = new RemoteControlService(config);
    }
    return RemoteControlService.instance;
  }

  /**
   * 初始化 WebSocket 服务器
   */
  public initialize(server: Server): void {
    if (this.wss) {
      logger.warn('RemoteControl WebSocket server already initialized');
      return;
    }

    this.wss = createPathWebSocketServer(server, '/ws/remote-control', {
      maxPayload: 10 * 1024 * 1024,
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error({ error }, 'WebSocket server error');
    });

    this.registerMessageHandlers();
    logger.info('RemoteControl WebSocket server initialized');
  }

  /**
   * 获取所有设备
   */
  public async getDevices(): Promise<PCDeviceInfo[]> {
    // 从数据库加载最新数据
    try {
      const dbDevices = await pcDeviceRepository.findAll();
      const deviceMap = new Map<string, PCDeviceInfo>();

      for (const dbDevice of dbDevices) {
        const device: PCDeviceInfo = {
          id: dbDevice.id,
          name: dbDevice.name,
          platform: dbDevice.platform as PCDeviceInfo['platform'],
          osVersion: dbDevice.osVersion || '',
          capabilities: dbDevice.capabilities as PCDeviceCapabilities,
          status: dbDevice.status as PCDeviceInfo['status'],
          lastSeen: dbDevice.lastSeen?.getTime() || 0,
          registeredAt: dbDevice.registeredAt?.getTime() || Date.now(),
          ipAddress: dbDevice.ipAddress || undefined,
        };
        deviceMap.set(device.id, device);
      }

      // 合并到内存缓存
      this.devices = deviceMap;
    } catch (error) {
      logger.error({ error }, 'Failed to load devices from database');
    }

    return Array.from(this.devices.values());
  }

  /**
   * 获取单个设备
   */
  public async getDevice(deviceId: string): Promise<PCDeviceInfo | undefined> {
    // 先从缓存获取
    const cached = this.devices.get(deviceId);
    if (cached) return cached;

    // 从数据库获取
    try {
      const dbDevice = await pcDeviceRepository.findById(deviceId);
      if (!dbDevice) return undefined;

      const device: PCDeviceInfo = {
        id: dbDevice.id,
        name: dbDevice.name,
        platform: dbDevice.platform as PCDeviceInfo['platform'],
        osVersion: dbDevice.osVersion || '',
        capabilities: dbDevice.capabilities as PCDeviceCapabilities,
        status: dbDevice.status as PCDeviceInfo['status'],
        lastSeen: dbDevice.lastSeen?.getTime() || 0,
        registeredAt: dbDevice.registeredAt?.getTime() || Date.now(),
        ipAddress: dbDevice.ipAddress || undefined,
      };

      this.devices.set(deviceId, device);
      return device;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to get device from database');
      return undefined;
    }
  }

  /**
   * 发送控制命令
   */
  public async sendCommand(deviceId: string, command: ControlCommand): Promise<CommandResult> {
    // 确保设备信息是最新的
    const device = await this.getDevice(deviceId);

    if (!device) {
      return {
        success: false,
        error: 'Device not found',
        duration: 0,
      };
    }

    if (device.status !== 'ONLINE') {
      return {
        success: false,
        error: 'Device is offline',
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      // 根据命令类型执行不同的操作
      switch (command.type) {
        case 'MOUSE':
          return await this.handleMouseCommand(command);
        case 'KEYBOARD':
          return await this.handleKeyboardCommand(command);
        case 'SCREENSHOT':
          return await this.handleScreenshotCommand(deviceId);
        case 'APP':
          return await this.handleAppCommand(command);
        case 'SYSTEM':
          return await this.handleSystemCommand(command);
        default:
          return {
            success: false,
            error: `Unknown command type: ${command.type}`,
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      logger.error({ deviceId, command, error }, 'Command execution failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 截图
   */
  public async takeScreenshot(deviceId: string): Promise<CommandResult> {
    // 确保设备信息是最新的
    const device = await this.getDevice(deviceId);

    if (!device) {
      return {
        success: false,
        error: 'Device not found',
        duration: 0,
      };
    }

    try {
      // 调用 PCExecutorService 进行截图
      const result = await pcExecutorService.execute({
        type: 'screenshot',
        params: {
          quality: this.config.screenshotQuality,
        },
      });

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        duration: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
        duration: 0,
      };
    }
  }

  /**
   * 获取活动会话
   */
  public getSessions(): RemoteSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    status: string;
    details: {
      serverInitialized: boolean;
      deviceCount: number;
      sessionCount: number;
      onlineDevices: number;
    };
  }> {
    const onlineDevices = Array.from(this.devices.values()).filter(
      (d) => d.status === 'ONLINE'
    ).length;

    return {
      status: this.wss ? 'running' : 'stopped',
      details: {
        serverInitialized: !!this.wss,
        deviceCount: this.devices.size,
        sessionCount: this.sessions.size,
        onlineDevices,
      },
    };
  }

  /**
   * 注册设备（手动）
   */
  public async registerDevice(device: PCDeviceInfo): Promise<void> {
    // 保存到数据库
    try {
      await pcDeviceRepository.create({
        id: device.id,
        name: device.name,
        platform: device.platform,
        osVersion: device.osVersion,
        capabilities: device.capabilities as unknown as Record<string, unknown>,
        status: device.status,
        ipAddress: device.ipAddress,
        lastSeen: device.lastSeen ? new Date(device.lastSeen) : new Date(),
        registeredAt: new Date(device.registeredAt),
      });
    } catch (error) {
      logger.error({ deviceId: device.id, error }, 'Failed to persist device to database');
    }

    // 保存到内存缓存
    this.devices.set(device.id, device);
    logger.info({ deviceId: device.id, deviceName: device.name }, 'Device registered');
  }

  /**
   * 更新设备状态
   */
  public async updateDeviceStatus(deviceId: string, status: PCDeviceInfo['status']): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.lastSeen = Date.now();

      // 更新数据库
      try {
        await pcDeviceRepository.updateStatus(deviceId, status);
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to update device status in database');
      }
    }
  }

  /**
   * 删除设备
   */
  public async deleteDevice(deviceId: string): Promise<boolean> {
    // 从数据库删除
    try {
      await pcDeviceRepository.delete(deviceId);
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to delete device from database');
    }

    // 从内存缓存删除
    return this.devices.delete(deviceId);
  }

  /**
   * 初始化 - 从数据库加载设备
   */
  public async initializeFromDatabase(): Promise<void> {
    try {
      const dbDevices = await pcDeviceRepository.findAll();
      for (const dbDevice of dbDevices) {
        const device: PCDeviceInfo = {
          id: dbDevice.id,
          name: dbDevice.name,
          platform: dbDevice.platform as PCDeviceInfo['platform'],
          osVersion: dbDevice.osVersion || '',
          capabilities: dbDevice.capabilities as PCDeviceCapabilities,
          status: 'OFFLINE', // 重置为离线状态
          lastSeen: dbDevice.lastSeen?.getTime() || 0,
          registeredAt: dbDevice.registeredAt?.getTime() || Date.now(),
          ipAddress: dbDevice.ipAddress || undefined,
        };
        this.devices.set(device.id, device);
      }
      logger.info({ deviceCount: dbDevices.length }, 'Devices loaded from database');
    } catch (error) {
      logger.error({ error }, 'Failed to load devices from database');
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private handleConnection(ws: WebSocket, req: { socket?: { remoteAddress?: string } }): void {
    const sessionId = randomUUID();
    const ipAddress = req.socket?.remoteAddress || 'unknown';

    logger.info({ sessionId, ipAddress }, 'New remote control connection');

    const session: RemoteSession = {
      id: sessionId,
      deviceId: '',
      ws,
      status: 'CONNECTING',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);

    ws.on('message', (data) => {
      this.handleMessage(session, data.toString());
    });

    ws.on('close', () => {
      this.handleDisconnect(session);
    });

    ws.on('error', (error) => {
      logger.error({ sessionId, error }, 'Session error');
    });

    // 发送欢迎消息
    this.sendToSession(session, {
      type: 'WELCOME',
      sessionId,
      timestamp: Date.now(),
    });
  }

  private handleDisconnect(session: RemoteSession): void {
    logger.info({ sessionId: session.id, deviceId: session.deviceId }, 'Session disconnected');

    // 停止截图定时器
    if (session.screenshotInterval) {
      clearInterval(session.screenshotInterval);
    }

    // 清理设备会话关联
    if (session.deviceId) {
      const deviceSessionIds = this.deviceSessions.get(session.deviceId);
      if (deviceSessionIds) {
        deviceSessionIds.delete(session.id);
        if (deviceSessionIds.size === 0) {
          this.deviceSessions.delete(session.deviceId);
          const device = this.devices.get(session.deviceId);
          if (device) {
            device.status = 'OFFLINE';
            device.lastSeen = Date.now();
          }
        }
      }
    }

    this.sessions.delete(session.id);
  }

  private registerMessageHandlers(): void {
    // 设备注册
    this.messageHandlers.set('REGISTER', async (session, data) => {
      const payload = data as {
        deviceId: string;
        deviceName: string;
        platform: 'WINDOWS' | 'MACOS' | 'LINUX';
        osVersion: string;
        capabilities?: Partial<PCDeviceCapabilities>;
      };

      const device: PCDeviceInfo = {
        id: payload.deviceId,
        name: payload.deviceName,
        platform: payload.platform,
        osVersion: payload.osVersion,
        capabilities: {
          screenCapture: true,
          mouseControl: true,
          keyboardControl: true,
          fileSystem: true,
          clipboard: true,
          notifications: true,
          maxResolution: { width: 1920, height: 1080 },
          ...payload.capabilities,
        },
        status: 'ONLINE',
        lastSeen: Date.now(),
        registeredAt: Date.now(),
      };

      this.devices.set(device.id, session.deviceId = device.id);
      session.status = 'CONNECTED';

      if (!this.deviceSessions.has(device.id)) {
        this.deviceSessions.set(device.id, new Set());
      }
      this.deviceSessions.get(device.id)!.add(session.id);

      logger.info({ deviceId: device.id, deviceName: device.name }, 'Device registered');

      return { success: true, data: { deviceId: device.id, sessionId: session.id }, duration: 0 };
    });

    // 心跳
    this.messageHandlers.set('HEARTBEAT', async (session, data) => {
      session.lastActivity = Date.now();
      if (session.deviceId) {
        const device = this.devices.get(session.deviceId);
        if (device) {
          device.lastSeen = Date.now();
        }
      }
      return { success: true, data: { timestamp: Date.now() }, duration: 0 };
    });

    // 鼠标移动
    this.messageHandlers.set('MOUSE_MOVE', async (_session, data) => {
      const { x, y } = data as { x: number; y: number };
      return await pcExecutorService.execute({ type: 'move_to', params: { x, y } });
    });

    // 鼠标点击
    this.messageHandlers.set('MOUSE_CLICK', async (_session, data) => {
      const { x, y, button = 'left', clicks = 1 } = data as { x?: number; y?: number; button?: string; clicks?: number };
      const actionType = clicks > 1 ? 'double_click' : 'click';
      return await pcExecutorService.execute({ type: actionType, params: { x, y, button } });
    });

    // 键盘输入
    this.messageHandlers.set('KEYBOARD_TYPE', async (_session, data) => {
      const { text } = data as { text: string };
      return await pcExecutorService.execute({ type: 'type', params: { text } });
    });

    // 键盘按键
    this.messageHandlers.set('KEYBOARD_PRESS', async (_session, data) => {
      const { key } = data as { key: string };
      return await pcExecutorService.execute({ type: 'press', params: { key } });
    });

    // 快捷键
    this.messageHandlers.set('KEYBOARD_HOTKEY', async (_session, data) => {
      const { keys } = data as { keys: string[] };
      return await pcExecutorService.execute({ type: 'hotkey', params: { keys } });
    });

    // 截图请求
    this.messageHandlers.set('SCREENSHOT', async (_session, _data) => {
      return await pcExecutorService.execute({ type: 'screenshot', params: {} });
    });
  }

  private async handleMessage(session: RemoteSession, message: string): Promise<void> {
    try {
      const payload = JSON.parse(message);
      const { type, ...data } = payload;

      const handler = this.messageHandlers.get(type);
      if (!handler) {
        logger.warn({ sessionId: session.id, type }, 'Unknown message type');
        this.sendToSession(session, {
          type: 'ERROR',
          error: `Unknown message type: ${type}`,
          timestamp: Date.now(),
        });
        return;
      }

      const result = await handler(session, data);

      this.sendToSession(session, {
        type: 'COMMAND_RESULT',
        commandType: type,
        result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ sessionId: session.id, error }, 'Failed to handle message');
      this.sendToSession(session, {
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Message handling failed',
        timestamp: Date.now(),
      });
    }
  }

  private sendToSession(session: RemoteSession, data: unknown): void {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(data));
    }
  }

  private async handleMouseCommand(command: ControlCommand): Promise<CommandResult> {
    const { action, params = {} } = command;

    switch (action) {
      case 'CLICK':
        return await pcExecutorService.execute({ type: 'click', params });
      case 'DOUBLE_CLICK':
        return await pcExecutorService.execute({ type: 'double_click', params });
      case 'RIGHT_CLICK':
        return await pcExecutorService.execute({ type: 'right_click', params });
      case 'MOVE':
        return await pcExecutorService.execute({ type: 'move_to', params });
      case 'DRAG':
        return await pcExecutorService.execute({ type: 'drag_to', params });
      case 'SCROLL':
        return await pcExecutorService.execute({ type: 'scroll', params });
      default:
        return { success: false, error: `Unknown mouse action: ${action}`, duration: 0 };
    }
  }

  private async handleKeyboardCommand(command: ControlCommand): Promise<CommandResult> {
    const { action, params = {} } = command;

    switch (action) {
      case 'TYPE':
        return await pcExecutorService.execute({ type: 'type', params });
      case 'PRESS':
        return await pcExecutorService.execute({ type: 'press', params });
      case 'HOTKEY':
        return await pcExecutorService.execute({ type: 'hotkey', params });
      default:
        return { success: false, error: `Unknown keyboard action: ${action}`, duration: 0 };
    }
  }

  private async handleScreenshotCommand(deviceId: string): Promise<CommandResult> {
    return await this.takeScreenshot(deviceId);
  }

  private async handleAppCommand(command: ControlCommand): Promise<CommandResult> {
    const { action, params = {} } = command;
    const appName = params.appName || params.app;

    switch (action) {
      case 'OPEN':
        if (!appName) {
          return { success: false, error: 'App name required', duration: 0 };
        }
        return await pcExecutorService.execute({
          type: 'run',
          params: { command: `start "" "${appName}"` }
        });
      case 'CLOSE':
        if (!appName) {
          return { success: false, error: 'App name required', duration: 0 };
        }
        return await pcExecutorService.execute({
          type: 'run',
          params: { command: `taskkill /IM "${appName}.exe" /F` }
        });
      default:
        return { success: false, error: `Unknown app action: ${action}`, duration: 0 };
    }
  }

  private async handleSystemCommand(command: ControlCommand): Promise<CommandResult> {
    const { action, params = {} } = command;

    switch (action) {
      case 'sleep':
        return await pcExecutorService.execute({
          type: 'run',
          params: { command: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0' }
        });
      case 'shutdown':
        return await pcExecutorService.execute({
          type: 'run',
          params: { command: 'shutdown /s /t 0' }
        });
      case 'restart':
        return await pcExecutorService.execute({
          type: 'run',
          params: { command: 'shutdown /r /t 0' }
        });
      default:
        return { success: false, error: `Unknown system action: ${action}`, duration: 0 };
    }
  }
}

// 导出单例
export const remoteControlService = RemoteControlService.getInstance();
export default remoteControlService;
