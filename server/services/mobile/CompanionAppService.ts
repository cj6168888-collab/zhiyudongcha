/**
 * Android Companion App 通信服务
 * 
 * 处理与Android Companion App的WebSocket通信
 * 实现文件监控、实时推送、命令下发等功能
 */

import { createServiceLogger } from '../../lib/logger';
import { randomBytes } from 'crypto';
import deviceConnectionService from './DeviceConnectionService';
import type {
  DeviceInfo,
  WebSocketMessage,
  MessageType,
  OperationError,
  createError,
  ERROR_CODES,
} from './types';

const logger = createServiceLogger('CompanionApp');

export interface CompanionAppMessage {
  type: 'FILE_DETECTED' | 'FILE_UPLOAD' | 'SCREENSHOT' | 'NOTIFICATION' | 'STATUS' | 'COMMAND_RESULT';
  payload: CompanionPayload;
  timestamp: number;
  messageId: string;
}

export interface CompanionPayload {
  source?: string;
  filePath?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  content?: string;
  base64?: string;
  notification?: {
    package: string;
    title: string;
    content: string;
    timestamp: number;
  };
  status?: {
    battery: number;
    running: boolean;
    version: string;
  };
  commandId?: string;
  success?: boolean;
  error?: string;
}

export interface FileWatchConfig {
  enabled: boolean;
  watchPaths: string[];
  fileTypes: string[];
  autoUpload: boolean;
  notifyOnDetect: boolean;
}

export interface CompanionAppConfig {
  deviceId: string;
  fileWatch: FileWatchConfig;
  notificationMonitor: boolean;
  screenshotOnDemand: boolean;
  autoStart: boolean;
}

const DEFAULT_FILE_WATCH_CONFIG: FileWatchConfig = {
  enabled: true,
  watchPaths: [
    '/sdcard/Tencent/MicroMsg/',
    '/sdcard/Download/',
    '/sdcard/Documents/',
  ],
  fileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'],
  autoUpload: true,
  notifyOnDetect: true,
};

interface CompanionConnection {
  deviceId: string;
  ws: WebSocket;
  config: CompanionAppConfig;
  authenticated: boolean;
  lastHeartbeat: number;
  fileWatchers: Map<string, NodeJS.Timeout>;
}

class CompanionAppService {
  private connections: Map<string, CompanionConnection> = new Map();
  private messageHandlers: Map<string, (deviceId: string, payload: CompanionPayload) => void> = new Map();
  private fileProcessQueue: Array<{ deviceId: string; payload: CompanionPayload }> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.startQueueProcessor();
  }

  async registerCompanionApp(
    deviceId: string,
    deviceName: string,
    config?: Partial<CompanionAppConfig>
  ): Promise<{ credentials: { deviceId: string; authToken: string }; config: CompanionAppConfig }> {
    const deviceInfo = deviceConnectionService.getDevice(deviceId);

    if (!deviceInfo) {
      const credentials = deviceConnectionService.registerDevice({
        deviceId,
        deviceName,
        platform: 'ANDROID',
        osVersion: 'Unknown',
        capabilities: {
          screenCapture: true,
          touchInput: true,
          fileSystem: true,
          notifications: true,
        },
      });

      deviceConnectionService.updateDeviceCapabilities(deviceId, {
        sms: true,
        phone: true,
        contacts: true,
        microphone: true,
      });
    }

    const fullConfig: CompanionAppConfig = {
      deviceId,
      fileWatch: config?.fileWatch || DEFAULT_FILE_WATCH_CONFIG,
      notificationMonitor: config?.notificationMonitor ?? true,
      screenshotOnDemand: config?.screenshotOnDemand ?? true,
      autoStart: config?.autoStart ?? true,
    };

    const credentials = deviceConnectionService.registerDevice({
      deviceId,
      deviceName,
      platform: 'ANDROID',
      osVersion: 'Companion App',
      capabilities: {
        screenCapture: true,
        touchInput: true,
        keyboardInput: true,
        fileSystem: true,
        sms: true,
        phone: true,
        contacts: true,
        notifications: true,
        camera: true,
        microphone: true,
        accessibility: true,
      },
    });

    logger.info({ deviceId, deviceName, config: fullConfig }, 'Companion app registered');

    return { credentials, config: fullConfig };
  }

  connectCompanionApp(deviceId: string, ws: WebSocket): OperationError | null {
    const connection: CompanionConnection = {
      deviceId,
      ws,
      config: {
        deviceId,
        fileWatch: DEFAULT_FILE_WATCH_CONFIG,
        notificationMonitor: true,
        screenshotOnDemand: true,
        autoStart: true,
      },
      authenticated: false,
      lastHeartbeat: Date.now(),
      fileWatchers: new Map(),
    };

    this.connections.set(deviceId, connection);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as CompanionAppMessage;
        this.handleMessage(deviceId, message);
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to parse companion message');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(deviceId);
    });

    ws.on('error', (error: Error) => {
      logger.error({ deviceId, error }, 'Companion connection error');
    });

    return null;
  }

  private handleMessage(deviceId: string, message: CompanionAppMessage): void {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      logger.warn({ deviceId }, 'Message from unknown device');
      return;
    }

    const { type, payload, messageId } = message;

    switch (type) {
      case 'STATUS':
        connection.lastHeartbeat = Date.now();
        logger.info({ deviceId, battery: payload.status?.battery }, 'Companion status update');
        this.sendCommandResponse(deviceId, messageId, { received: true });
        break;

      case 'FILE_DETECTED':
        logger.info({
          deviceId,
          filePath: payload.filePath,
          fileType: payload.fileType,
        }, 'File detected by companion');
        
        if (connection.config.fileWatch.notifyOnDetect) {
          this.notifyFileDetected(deviceId, payload);
        }
        
        if (connection.config.fileWatch.autoUpload) {
          this.queueFileForProcessing(deviceId, payload);
        }
        break;

      case 'FILE_UPLOAD':
        logger.info({ deviceId, fileName: payload.fileName }, 'File uploaded from companion');
        this.handleFileUpload(deviceId, payload);
        break;

      case 'NOTIFICATION':
        logger.info({
          deviceId,
          package: payload.notification?.package,
          title: payload.notification?.title,
        }, 'Notification received');
        this.handleNotification(deviceId, payload);
        break;

      case 'SCREENSHOT':
        logger.info({ deviceId }, 'Screenshot received from companion');
        this.handleScreenshot(deviceId, payload);
        break;

      case 'COMMAND_RESULT':
        logger.info({
          deviceId,
          commandId: payload.commandId,
          success: payload.success,
        }, 'Command result received');
        this.handleCommandResult(deviceId, payload);
        break;

      default:
        logger.warn({ deviceId, type }, 'Unknown companion message type');
    }

    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private handleDisconnect(deviceId: string): void {
    const connection = this.connections.get(deviceId);
    
    if (connection) {
      for (const watcher of connection.fileWatchers.values()) {
        clearInterval(watcher);
      }
      connection.fileWatchers.clear();
    }

    this.connections.delete(deviceId);
    logger.info({ deviceId }, 'Companion disconnected');
  }

  private notifyFileDetected(deviceId: string, payload: CompanionPayload): void {
    const handler = this.messageHandlers.get('FILE_DETECTED');
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private queueFileForProcessing(deviceId: string, payload: CompanionPayload): void {
    this.fileProcessQueue.push({ deviceId, payload });
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.isProcessingQueue) {
      const item = this.fileProcessQueue.shift();
      
      if (item) {
        try {
          await this.processQueuedFile(item.deviceId, item.payload);
        } catch (error) {
          logger.error({ deviceId: item.deviceId, error }, 'Failed to process queued file');
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processQueuedFile(deviceId: string, payload: CompanionPayload): Promise<void> {
    logger.info({ deviceId, filePath: payload.filePath }, 'Processing queued file');
  }

  private handleFileUpload(deviceId: string, payload: CompanionPayload): void {
    const handler = this.messageHandlers.get('FILE_UPLOAD');
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private handleNotification(deviceId: string, payload: CompanionPayload): void {
    const handler = this.messageHandlers.get('NOTIFICATION');
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private handleScreenshot(deviceId: string, payload: CompanionPayload): void {
    const handler = this.messageHandlers.get('SCREENSHOT');
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private handleCommandResult(deviceId: string, payload: CompanionPayload): void {
    const handler = this.messageHandlers.get('COMMAND_RESULT');
    if (handler) {
      handler(deviceId, payload);
    }
  }

  private sendCommandResponse(deviceId: string, originalMessageId: string, response: Record<string, unknown>): void {
    const connection = this.connections.get(deviceId);
    
    if (!connection || !connection.ws || connection.ws.readyState !== 1) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'ACTION_RESPONSE',
      payload: response,
      timestamp: Date.now(),
      messageId: `resp_${originalMessageId}`,
    };

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to send command response');
    }
  }

  sendCommand(deviceId: string, command: {
    type: 'START_FILE_WATCH' | 'STOP_FILE_WATCH' | 'UPLOAD_FILE' | 'TAKE_SCREENSHOT' | 'GET_STATUS';
    params?: Record<string, unknown>;
  }): string | null {
    const connection = this.connections.get(deviceId);
    
    if (!connection || !connection.ws || connection.ws.readyState !== 1) {
      logger.warn({ deviceId }, 'Companion not connected');
      return null;
    }

    const messageId = `cmd_${Date.now()}_${randomBytes(4).toString('hex')}`;
    
    const message: WebSocketMessage = {
      type: 'ACTION',
      payload: { command, messageId },
      timestamp: Date.now(),
      messageId,
    };

    try {
      connection.ws.send(JSON.stringify(message));
      return messageId;
    } catch (error) {
      logger.error({ deviceId, command: command.type, error }, 'Failed to send command');
      return null;
    }
  }

  updateConfig(deviceId: string, config: Partial<CompanionAppConfig>): boolean {
    const connection = this.connections.get(deviceId);
    
    if (!connection) {
      return false;
    }

    connection.config = { ...connection.config, ...config };
    
    this.sendCommand(deviceId, {
      type: 'START_FILE_WATCH',
      params: { config: connection.config.fileWatch },
    });

    logger.info({ deviceId, config: connection.config }, 'Companion config updated');
    return true;
  }

  onMessage(type: string, handler: (deviceId: string, payload: CompanionPayload) => void): () => void {
    this.messageHandlers.set(type, handler);
    return () => {
      this.messageHandlers.delete(type);
    };
  }

  isConnected(deviceId: string): boolean {
    const connection = this.connections.get(deviceId);
    return !!connection && connection.ws.readyState === 1;
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connections.keys());
  }

  getDeviceConfig(deviceId: string): CompanionAppConfig | null {
    return this.connections.get(deviceId)?.config || null;
  }

  getStatistics(): {
    totalConnections: number;
    queueLength: number;
  } {
    return {
      totalConnections: this.connections.size,
      queueLength: this.fileProcessQueue.length,
    };
  }
}

export const companionAppService = new CompanionAppService();
export default companionAppService;
