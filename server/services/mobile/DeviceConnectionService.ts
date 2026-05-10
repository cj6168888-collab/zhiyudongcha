/**
 * 设备连接管理服务
 *
 * 管理所有移动设备的连接状态、WebSocket通信和设备注册
 */

import { createServiceLogger } from '../../lib/logger';
import { createHmac } from 'crypto';
import type {
  DeviceInfo,
  DeviceCredentials,
  DeviceCapabilities,
  DevicePlatform,
  DeviceStatus,
  WebSocketMessage,
  MessageType,
  OperationError,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('DeviceConnection');

const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  screenCapture: false,
  touchInput: false,
  keyboardInput: false,
  fileSystem: false,
  sms: false,
  phone: false,
  contacts: false,
  location: false,
  camera: false,
  microphone: false,
  notifications: false,
  accessibility: false,
  adb: false,
  maxResolution: { width: 1080, height: 1920 },
};

export interface DeviceConnection {
  deviceInfo: DeviceInfo;
  ws?: WebSocket;
  credentials: DeviceCredentials;
  messageHandlers: Map<string, (payload: unknown) => void>;
  pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>;
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  osVersion: string;
  capabilities?: Partial<DeviceCapabilities>;
}

export interface AuthenticationRequest {
  deviceId: string;
  authToken: string;
}

export interface DeviceConfig {
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  requestTimeout: number;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: DeviceConfig = {
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  requestTimeout: 30000,
  enableLogging: true,
};

class DeviceConnectionService {
  private connections: Map<string, DeviceConnection> = new Map();
  private config: DeviceConfig;
  private messageListeners: Array<(deviceId: string, message: WebSocketMessage) => void> = [];

  constructor(config: Partial<DeviceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHeartbeatCheck();
  }

  private generateAuthToken(deviceId: string, secret: string): string {
    const timestamp = Date.now();
    const payload = `${deviceId}:${timestamp}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    return `${timestamp}:${hmac.digest('hex')}`;
  }

  private verifyAuthToken(deviceId: string, token: string, secret: string): boolean {
    try {
      const [timestamp, hash] = token.split(':');
      const timestampNum = parseInt(timestamp, 10);

      if (Date.now() - timestampNum > 24 * 60 * 60 * 1000) {
        return false;
      }

      const payload = `${deviceId}:${timestamp}`;
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const expectedHash = hmac.digest('hex');

      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  registerDevice(request: DeviceRegistrationRequest): DeviceCredentials {
    const { deviceId, deviceName, platform, osVersion, capabilities } = request;

    if (this.connections.has(deviceId)) {
      const existing = this.connections.get(deviceId)!;
      existing.deviceInfo.name = deviceName;
      existing.deviceInfo.osVersion = osVersion;
      if (capabilities) {
        existing.deviceInfo.capabilities = { ...DEFAULT_CAPABILITIES, ...capabilities };
      }
      logger.info({ deviceId, deviceName }, 'Device info updated');
      return existing.credentials;
    }

    const secret = process.env.MOBILE_DEVICE_SECRET || 'default-device-secret-change-in-production';
    const authToken = this.generateAuthToken(deviceId, secret);

    const deviceInfo: DeviceInfo = {
      id: deviceId,
      name: deviceName,
      platform,
      osVersion,
      capabilities: { ...DEFAULT_CAPABILITIES, ...capabilities },
      status: 'DISCONNECTED',
      lastSeen: Date.now(),
      registeredAt: Date.now(),
    };

    const credentials: DeviceCredentials = {
      deviceId,
      authToken,
    };

    const connection: DeviceConnection = {
      deviceInfo,
      credentials,
      messageHandlers: new Map(),
      pendingRequests: new Map(),
      lastHeartbeat: Date.now(),
      reconnectAttempts: 0,
    };

    this.connections.set(deviceId, connection);

    logger.info({ deviceId, deviceName, platform }, 'Device registered successfully');

    return credentials;
  }

  unregisterDevice(deviceId: string): boolean {
    const connection = this.connections.get(deviceId);

    if (!connection) {
      logger.warn({ deviceId }, 'Device not found for unregistration');
      return false;
    }

    if (connection.ws) {
      connection.ws.close(1000, 'Device unregistered');
    }

    this.connections.delete(deviceId);

    logger.info({ deviceId }, 'Device unregistered successfully');
    return true;
  }

  connectDevice(deviceId: string, ws: WebSocket): OperationError | null {
    const connection = this.connections.get(deviceId);

    if (!connection) {
      return createError(ERROR_CODES.DEVICE_NOT_FOUND, `Device not found: ${deviceId}`);
    }

    connection.ws = ws;
    connection.deviceInfo.status = 'CONNECTING';
    connection.lastHeartbeat = Date.now();

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(deviceId, message);
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to parse message');
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnect(deviceId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      logger.error({ deviceId, error }, 'WebSocket error');
      connection.deviceInfo.status = 'ERROR';
    });

    return null;
  }

  authenticateDevice(auth: AuthenticationRequest): OperationError | { success: boolean } {
    const connection = this.connections.get(auth.deviceId);

    if (!connection) {
      return createError(ERROR_CODES.DEVICE_NOT_FOUND, `Device not found: ${auth.deviceId}`);
    }

    const secret = process.env.MOBILE_DEVICE_SECRET || 'default-device-secret-change-in-production';

    if (!this.verifyAuthToken(auth.deviceId, auth.authToken, secret)) {
      connection.deviceInfo.status = 'ERROR';
      return createError(ERROR_CODES.AUTH_FAILED, 'Authentication failed: invalid token');
    }

    connection.deviceInfo.status = 'CONNECTED';
    connection.deviceInfo.lastSeen = Date.now();
    connection.reconnectAttempts = 0;

    logger.info({ deviceId: auth.deviceId }, 'Device authenticated successfully');

    return { success: true };
  }

  private handleMessage(deviceId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(deviceId);

    if (!connection) {
      logger.warn({ deviceId, messageType: message.type }, 'Message from unknown device');
      return;
    }

    connection.lastHeartbeat = Date.now();

    // 处理指令类消息 - 核心功能
    if (this.isCommandMessage(message.type)) {
      this.handleCommandMessage(deviceId, message);
      return;
    }

    if (this.isResponseMessage(message.type)) {
      const pending = connection.pendingRequests.get(message.messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        connection.pendingRequests.delete(message.messageId);
        pending.resolve(message.payload);
      }
    }

    for (const listener of this.messageListeners) {
      listener(deviceId, message);
    }

    const handler = connection.messageHandlers.get(message.type);
    if (handler) {
      handler(message.payload);
    }
  }

  /**
   * 处理指令消息 - 核心功能
   * 支持从服务器/PC端发送指令到手机端执行
   */
  private handleCommandMessage(deviceId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(deviceId);
    const payload = message.payload as Record<string, unknown>;

    logger.info({ deviceId, type: message.type, payload }, 'Processing command message');

    // 广播指令到所有监听器
    for (const listener of this.messageListeners) {
      listener(deviceId, message);
    }

    // 触发对应的消息处理器
    if (connection) {
      const handler = connection.messageHandlers.get(message.type);
      if (handler) {
        handler(payload);
      }
    }
  }

  /**
   * 判断是否是指令类消息
   */
  private isCommandMessage(type: MessageType): boolean {
    const commandTypes = [
      'COMMAND_EXECUTE',      // 执行命令
      'ACTION_EXECUTE',       // 执行动作
      'TASK_DISPATCH',        // 任务分发
      'APP_LAUNCH',           // 启动应用
      'APP_INSTALL',          // 安装应用
      'FILE_OPEN',            // 打开文件
      'URL_OPEN',             // 打开URL
      'DIAL_PHONE',           // 拨打电话
      'SEND_SMS',            // 发送短信
      'NAVIGATE_TO',          // 导航到
      'COPY_TO_CLIPBOARD',    // 复制到剪贴板
    ];
    return commandTypes.includes(type);
  }

  private isResponseMessage(type: MessageType): boolean {
    const responseTypes = [
      'AUTH_RESPONSE',
      'SCREENSHOT_RESPONSE',
      'ACTION_RESPONSE',
      'ELEMENTS_RESPONSE',
      'SMS_LIST_RESPONSE',
      'CALL_LOG_RESPONSE',
      'FILES_RESPONSE',
      'FILE_CONTENT_RESPONSE',
      'PERMISSIONS_RESPONSE',
      'HEARTBEAT_RESPONSE',
    ];
    return responseTypes.includes(type);
  }

  private handleDisconnect(deviceId: string, code: number, reason: string): void {
    const connection = this.connections.get(deviceId);

    if (!connection) return;

    connection.ws = undefined;

    if (code === 1000) {
      connection.deviceInfo.status = 'DISCONNECTED';
      logger.info({ deviceId, code, reason }, 'Device disconnected normally');
    } else if (connection.reconnectAttempts < this.config.maxReconnectAttempts) {
      connection.deviceInfo.status = 'CONNECTING';
      connection.reconnectAttempts++;
      logger.info({ deviceId, attempt: connection.reconnectAttempts }, 'Device reconnecting...');
    } else {
      connection.deviceInfo.status = 'ERROR';
      logger.error({ deviceId, code, reason }, 'Device reconnection failed');
    }

    for (const listener of this.messageListeners) {
      listener(deviceId, {
        type: 'DISCONNECT',
        payload: { code, reason },
        timestamp: Date.now(),
        messageId: `evt_${Date.now()}`,
      });
    }
  }

  private startHeartbeatCheck(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [deviceId, connection] of this.connections) {
        if (connection.deviceInfo.status !== 'CONNECTED') continue;

        if (now - connection.lastHeartbeat > this.config.heartbeatInterval * 2) {
          logger.warn({ deviceId, lastHeartbeat: connection.lastHeartbeat }, 'Device heartbeat timeout');
          connection.deviceInfo.status = 'ERROR';

          if (connection.reconnectAttempts < this.config.maxReconnectAttempts) {
            connection.reconnectAttempts++;
            connection.deviceInfo.status = 'CONNECTING';
          }
        }

        if (connection.ws && connection.ws.readyState === 1) {
          this.sendMessage(deviceId, 'HEARTBEAT', { timestamp: now });
        }
      }
    }, this.config.heartbeatInterval);
  }

  sendMessage<T>(deviceId: string, type: MessageType, payload: T): OperationError | string {
    const connection = this.connections.get(deviceId);

    if (!connection) {
      return 'Device not found';
    }

    if (!connection.ws || connection.ws.readyState !== 1) {
      return createError(ERROR_CODES.DEVICE_NOT_CONNECTED, `Device not connected: ${deviceId}`);
    }

    const messageId = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId,
    };

    try {
      connection.ws.send(JSON.stringify(message));
      return messageId;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to send message');
      return createError(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to send message',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async sendRequest<T>(
    deviceId: string,
    type: MessageType,
    payload: unknown,
    timeout?: number
  ): Promise<T> {
    const messageId = this.sendMessage(deviceId, type, payload);

    if (typeof messageId === 'object' && 'code' in messageId) {
      throw new Error(messageId.message);
    }

    return new Promise((resolve, reject) => {
      const connection = this.connections.get(deviceId);

      if (!connection) {
        reject(new Error('Device not found'));
        return;
      }

      const timeoutMs = timeout || this.config.requestTimeout;
      const timer = setTimeout(() => {
        connection.pendingRequests.delete(messageId);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      connection.pendingRequests.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timer,
      });
    });
  }

  getDevice(deviceId: string): DeviceInfo | null {
    return this.connections.get(deviceId)?.deviceInfo || null;
  }

  getAllDevices(): DeviceInfo[] {
    return Array.from(this.connections.values()).map(c => c.deviceInfo);
  }

  getConnectedDevices(): DeviceInfo[] {
    return this.getAllDevices().filter(d => d.status === 'CONNECTED');
  }

  onMessage(listener: (deviceId: string, message: WebSocketMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  isDeviceConnected(deviceId: string): boolean {
    const connection = this.connections.get(deviceId);
    return connection?.deviceInfo.status === 'CONNECTED';
  }

  /**
   * 发送指令到设备 - 核心功能
   * 支持从服务器/PC端发送指令到手机端执行
   */
  sendCommand(
    deviceId: string,
    command: string,
    parameters: Record<string, unknown> = {},
    timeout?: number
  ): OperationError | string {
    const messageId = this.sendMessage(deviceId, 'COMMAND_EXECUTE', {
      command,
      parameters,
      timestamp: Date.now(),
    });

    if (typeof messageId === 'object' && 'code' in messageId) {
      return messageId;
    }

    logger.info({ deviceId, command, messageId }, 'Command sent to device');
    return messageId;
  }

  /**
   * 发送动作执行请求到设备
   */
  sendAction(
    deviceId: string,
    action: string,
    parameters: Record<string, unknown> = {},
    taskId?: string
  ): OperationError | string {
    const messageId = this.sendMessage(deviceId, 'ACTION_EXECUTE', {
      action,
      parameters,
      taskId,
      timestamp: Date.now(),
    });

    if (typeof messageId === 'object' && 'code' in messageId) {
      return messageId;
    }

    logger.info({ deviceId, action, taskId, messageId }, 'Action sent to device');
    return messageId;
  }

  /**
   * 请求设备启动应用
   */
  launchApp(deviceId: string, packageName: string): OperationError | string {
    return this.sendCommand(deviceId, 'launch_app', { packageName });
  }

  /**
   * 请求设备打开URL
   */
  openUrl(deviceId: string, url: string): OperationError | string {
    return this.sendCommand(deviceId, 'open_url', { url });
  }

  /**
   * 请求设备导航
   */
  navigateTo(deviceId: string, address: string): OperationError | string {
    return this.sendCommand(deviceId, 'navigate_to', { address });
  }

  /**
   * 请求设备拨打电话
   */
  dialPhone(deviceId: string, phoneNumber: string): OperationError | string {
    return this.sendCommand(deviceId, 'dial_phone', { phoneNumber });
  }

  /**
   * 请求设备发送短信
   */
  sendSms(deviceId: string, phoneNumber: string, message: string): OperationError | string {
    return this.sendCommand(deviceId, 'send_sms', { phoneNumber, message });
  }

  /**
   * 请求设备复制到剪贴板
   */
  copyToClipboard(deviceId: string, text: string): OperationError | string {
    return this.sendCommand(deviceId, 'copy_to_clipboard', { text });
  }

  updateDeviceCapabilities(deviceId: string, capabilities: Partial<DeviceCapabilities>): boolean {
    const connection = this.connections.get(deviceId);

    if (!connection) {
      return false;
    }

    connection.deviceInfo.capabilities = { ...connection.deviceInfo.capabilities, ...capabilities };
    return true;
  }

  getStatistics(): {
    totalDevices: number;
    connectedDevices: number;
    disconnectedDevices: number;
    errorDevices: number;
  } {
    const devices = this.getAllDevices();
    return {
      totalDevices: devices.length,
      connectedDevices: devices.filter(d => d.status === 'CONNECTED').length,
      disconnectedDevices: devices.filter(d => d.status === 'DISCONNECTED').length,
      errorDevices: devices.filter(d => d.status === 'ERROR').length,
    };
  }
}

export const deviceConnectionService = new DeviceConnectionService();
export default deviceConnectionService;
