/**
 * 移动设备WebSocket服务器 - MobileWebSocketServer
 * 
 * 提供WebSocket服务器端，支持Android设备通过WebSocket连接
 * 实现设备注册、消息转发、心跳检测等功能
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServiceLogger } from '../../lib/logger';
import { createHmac, randomBytes } from 'crypto';
import deviceConnectionService from './DeviceConnectionService';
import type {
  DeviceInfo,
  WebSocketMessage,
  MessageType,
  OperationError,
  createError,
  ERROR_CODES,
} from './types';

const logger = createServiceLogger('MobileWS');

interface WSServerConfig {
  port: number;
  host: string;
  maxConnections: number;
  heartbeatInterval: number;
  authRequired: boolean;
}

const DEFAULT_CONFIG: WSServerConfig = {
  port: 8765,
  host: '0.0.0.0',
  maxConnections: 10,
  heartbeatInterval: 30000,
  authRequired: true,
};

interface WSConnection {
  ws: WebSocket;
  deviceId: string;
  authenticated: boolean;
  lastHeartbeat: number;
  messageCount: number;
}

class MobileWebSocketServer {
  private server: WebSocketServer | null = null;
  private connections: Map<string, WSConnection> = new Map();
  private config: WSServerConfig;
  private messageHandlers: Map<string, (deviceId: string, payload: unknown) => void> = new Map();

  constructor(config: Partial<WSServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): Promise<{ port: number; host: string }> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          host: this.config.host,
          port: this.config.port,
        });

        this.server.on('listening', () => {
          const address = this.server!.address();
          const port = typeof address === 'object' ? address?.port : this.config.port;
          const host = typeof address === 'object' ? address?.address : this.config.host;
          
          logger.info({ port, host }, 'Mobile WebSocket Server started');
          resolve({ port, host: host || '0.0.0.0' });
        });

        this.server.on('connection', (ws, req) => {
          this.handleConnection(ws, req);
        });

        this.server.on('error', (error) => {
          logger.error({ error }, 'WebSocket server error');
          reject(error);
        });

        this.startHeartbeatCheck();
      } catch (error) {
        logger.error({ error }, 'Failed to start WebSocket server');
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      for (const [deviceId, conn] of this.connections) {
        conn.ws.close(1000, 'Server shutting down');
      }
      this.connections.clear();

      this.server.close(() => {
        logger.info('Mobile WebSocket Server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  private handleConnection(ws: WebSocket, req: { url?: string; socket?: { remoteAddress?: string } }): void {
    const remoteAddress = req.socket?.remoteAddress || 'unknown';
    const connectionId = `conn_${Date.now()}_${randomBytes(4).toString('hex')}`;
    
    logger.info({ connectionId, remoteAddress }, 'New WebSocket connection');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(connectionId, ws, message);
      } catch (error) {
        logger.error({ connectionId, error }, 'Failed to parse message');
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { code: 'PARSE_ERROR', message: 'Invalid message format' },
          timestamp: Date.now(),
          messageId: `err_${Date.now()}`,
        }));
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(connectionId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      logger.error({ connectionId, error }, 'WebSocket connection error');
    });

    ws.on('pong', () => {
      const conn = Array.from(this.connections.values()).find(c => c.ws === ws);
      if (conn) {
        conn.lastHeartbeat = Date.now();
      }
    });
  }

  private handleMessage(connectionId: string, ws: WebSocket, message: WebSocketMessage): void {
    const { type, payload, messageId } = message;

    switch (type) {
      case 'CONNECT': {
        const connectPayload = payload as { deviceId?: string; platform?: string };
        
        if (!connectPayload?.deviceId) {
          ws.send(this.createErrorResponse(messageId, 'DEVICE_ID_REQUIRED', 'Device ID is required'));
          return;
        }

        const existingDevice = deviceConnectionService.getDevice(connectPayload.deviceId);
        
        if (existingDevice) {
          const conn: WSConnection = {
            ws,
            deviceId: connectPayload.deviceId,
            authenticated: false,
            lastHeartbeat: Date.now(),
            messageCount: 0,
          };
          
          this.connections.set(connectionId, conn);
          
          ws.send(JSON.stringify({
            type: 'CONNECT',
            payload: { 
              success: true, 
              connectionId,
              serverVersion: '1.0.0',
              requiresAuth: this.config.authRequired,
            },
            timestamp: Date.now(),
            messageId,
          }));
          
          logger.info({ connectionId, deviceId: connectPayload.deviceId }, 'Device connected');
        } else {
          ws.send(this.createErrorResponse(messageId, 'DEVICE_NOT_REGISTERED', 'Device not registered'));
        }
        break;
      }

      case 'AUTHENTICATE': {
        const conn = this.connections.get(connectionId);
        if (!conn) {
          ws.send(this.createErrorResponse(messageId, 'CONNECTION_NOT_FOUND', 'Connection not found'));
          return;
        }

        const authPayload = payload as { authToken?: string };
        
        const result = deviceConnectionService.authenticateDevice({
          deviceId: conn.deviceId,
          authToken: authPayload?.authToken || '',
        });

        if ('success' in result && result.success) {
          conn.authenticated = true;
          conn.lastHeartbeat = Date.now();
          
          ws.send(JSON.stringify({
            type: 'AUTH_RESPONSE',
            payload: { success: true },
            timestamp: Date.now(),
            messageId,
          }));
          
          logger.info({ connectionId, deviceId: conn.deviceId }, 'Device authenticated');
        } else {
          ws.send(this.createErrorResponse(
            messageId, 
            'AUTH_FAILED', 
            'code' in result ? result.message : 'Authentication failed'
          ));
        }
        break;
      }

      case 'SCREENSHOT': {
        this.handleAuthenticatedMessage(connectionId, messageId, () => {
          const handler = this.messageHandlers.get('SCREENSHOT');
          if (handler) {
            const conn = this.connections.get(connectionId);
            if (conn) {
              handler(conn.deviceId, payload);
            }
          }
          
          ws.send(JSON.stringify({
            type: 'SCREENSHOT_RESPONSE',
            payload: { received: true },
            timestamp: Date.now(),
            messageId,
          }));
        });
        break;
      }

      case 'ELEMENTS': {
        this.handleAuthenticatedMessage(connectionId, messageId, () => {
          const handler = this.messageHandlers.get('ELEMENTS');
          if (handler) {
            const conn = this.connections.get(connectionId);
            if (conn) {
              handler(conn.deviceId, payload);
            }
          }
          
          ws.send(JSON.stringify({
            type: 'ELEMENTS_RESPONSE',
            payload: { received: true },
            timestamp: Date.now(),
            messageId,
          }));
        });
        break;
      }

      case 'ACTION': {
        this.handleAuthenticatedMessage(connectionId, messageId, () => {
          const handler = this.messageHandlers.get('ACTION');
          if (handler) {
            const conn = this.connections.get(connectionId);
            if (conn) {
              handler(conn.deviceId, payload);
            }
          }
          
          ws.send(JSON.stringify({
            type: 'ACTION_RESPONSE',
            payload: { received: true },
            timestamp: Date.now(),
            messageId,
          }));
        });
        break;
      }

      case 'SMS_LIST':
      case 'SMS_SEND':
      case 'CALL_LOG':
      case 'CALL_DIAL':
      case 'FILES':
      case 'FILE_CONTENT':
      case 'FILE_WRITE':
      case 'FILE_DELETE': {
        this.handleAuthenticatedMessage(connectionId, messageId, () => {
          const handler = this.messageHandlers.get(type);
          if (handler) {
            const conn = this.connections.get(connectionId);
            if (conn) {
              handler(conn.deviceId, payload);
            }
          }
          
          ws.send(JSON.stringify({
            type: `${type}_RESPONSE`,
            payload: { received: true },
            timestamp: Date.now(),
            messageId,
          }));
        });
        break;
      }

      case 'HEARTBEAT': {
        const conn = this.connections.get(connectionId);
        if (conn) {
          conn.lastHeartbeat = Date.now();
          ws.send(JSON.stringify({
            type: 'HEARTBEAT_RESPONSE',
            payload: { timestamp: Date.now() },
            timestamp: Date.now(),
            messageId,
          }));
        }
        break;
      }

      default:
        logger.warn({ connectionId, type }, 'Unknown message type');
        ws.send(this.createErrorResponse(messageId, 'UNKNOWN_TYPE', `Unknown message type: ${type}`));
    }
  }

  private handleAuthenticatedMessage(
    connectionId: string,
    messageId: string,
    handler: () => void
  ): void {
    const conn = this.connections.get(connectionId);
    
    if (!conn) {
      const error = this.createErrorResponse(messageId, 'CONNECTION_NOT_FOUND', 'Connection not found');
      conn?.ws.send(JSON.stringify(error));
      return;
    }

    if (this.config.authRequired && !conn.authenticated) {
      const error = this.createErrorResponse(messageId, 'NOT_AUTHENTICATED', 'Authentication required');
      conn.ws.send(JSON.stringify(error));
      return;
    }

    conn.messageCount++;
    handler();
  }

  private handleClose(connectionId: string, code: number, reason: string): void {
    const conn = this.connections.get(connectionId);
    
    if (conn) {
      logger.info({ connectionId, deviceId: conn.deviceId, code, reason }, 'Connection closed');
      this.connections.delete(connectionId);
    }
  }

  private createErrorResponse(originalMessageId: string, code: string, message: string): WebSocketMessage {
    return {
      type: 'ERROR',
      payload: { code, message },
      timestamp: Date.now(),
      messageId: `err_${Date.now()}`,
    };
  }

  private startHeartbeatCheck(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [connectionId, conn] of this.connections) {
        if (now - conn.lastHeartbeat > this.config.heartbeatInterval * 2) {
          logger.warn({ connectionId, deviceId: conn.deviceId }, 'Connection heartbeat timeout');
          conn.ws.close(4001, 'Heartbeat timeout');
          this.connections.delete(connectionId);
        } else if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  sendMessage(connectionId: string, type: MessageType, payload: unknown): boolean {
    const conn = this.connections.get(connectionId);
    
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId: `${type}_${Date.now()}`,
    };

    try {
      conn.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error({ connectionId, type, error }, 'Failed to send message');
      return false;
    }
  }

  broadcast(type: MessageType, payload: unknown): number {
    let count = 0;
    
    for (const conn of this.connections.values()) {
      if (conn.authenticated && conn.ws.readyState === WebSocket.OPEN) {
        if (this.sendMessage(this.getConnectionId(conn.deviceId)!, type, payload)) {
          count++;
        }
      }
    }
    
    return count;
  }

  private getConnectionId(deviceId: string): string | undefined {
    for (const [connId, conn] of this.connections) {
      if (conn.deviceId === deviceId) {
        return connId;
      }
    }
    return undefined;
  }

  onMessage(type: string, handler: (deviceId: string, payload: unknown) => void): () => void {
    this.messageHandlers.set(type, handler);
    return () => {
      this.messageHandlers.delete(type);
    };
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getAuthenticatedCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.authenticated) count++;
    }
    return count;
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.config.port;
  }
}

export const mobileWebSocketServer = new MobileWebSocketServer();
export default mobileWebSocketServer;
