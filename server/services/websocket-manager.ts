/**
 * WebSocket连接管理器 - 技术债务清理 + 重连增强
 *
 * 功能：
 * 1. 心跳检测 - 定期ping/pong保活
 * 2. 连接池管理 - 统一管理所有WebSocket连接
 * 3. 自动重连 - 客户端断线重连支持
 * 4. 连接限制 - 防止连接过多
 * 5. 连接监控 - 实时统计和告警
 * 6. 优雅关闭 - 平滑断开所有连接
 * 7. 重连队列 - 支持待重连的客户端自动重连
 * 8. 重连状态追踪 - 追踪重连次数和状态
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('WebsocketManager');

import WebSocket, { WebSocket as WS } from 'ws';
import { EventEmitter } from 'events';

export interface ConnectionInfo {
  id: string;
  ws: WebSocket;
  userId?: string;
  deviceId?: string;
  type: 'z3' | 'realtime-voice' | 'asr' | 'insight' | 'general';
  connectedAt: number;
  lastPingAt: number;
  lastPongAt: number;
  pingCount: number;
  missedPongs: number;
  metadata: Record<string, unknown>;
  isAlive: boolean;
  // 重连相关
  reconnectEnabled: boolean;
  reconnectToken?: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface PoolConfig {
  maxConnections: number;
  maxConnectionsPerUser: number;
  heartbeatInterval: number;      // ms
  heartbeatTimeout: number;       // ms
  maxMissedPongs: number;
  cleanupInterval: number;        // ms
  connectionTimeout: number;      // ms
  // 重连配置
  enableReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;     // ms
  reconnectMaxDelay: number;      // ms
  reconnectTokenExpiry: number;   // ms
}

const DEFAULT_CONFIG: PoolConfig = {
  maxConnections: 1000,
  maxConnectionsPerUser: 10,
  heartbeatInterval: 30000,       // 30秒
  heartbeatTimeout: 10000,        // 10秒超时
  maxMissedPongs: 3,              // 3次未响应断开
  cleanupInterval: 60000,         // 1分钟清理
  connectionTimeout: 300000,      // 5分钟无活动超时
  // 重连配置
  enableReconnect: true,
  maxReconnectAttempts: 5,
  reconnectBaseDelay: 1000,      // 1秒基础延迟
  reconnectMaxDelay: 30000,       // 30秒最大延迟
  reconnectTokenExpiry: 300000,   // 5分钟令牌过期
};

function generateConnectionId(): string {
  return 'conn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function generateReconnectToken(): string {
  return 'rt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
}

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [WSManager] ${message}`);
}

class WebSocketManager extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private config: PoolConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private reconnectTokens: Map<string, {
    connectionId: string;
    userId?: string;
    deviceId?: string;
    type: ConnectionInfo['type'];
    expiresAt: number;
    metadata: Record<string, unknown>;
  }> = new Map();
  private isShuttingDown = false;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHeartbeat();
    this.startCleanup();
    this.startReconnectTokenCleanup();
    log('WebSocket连接管理器已初始化');
  }

  register(
    ws: WebSocket,
    type: ConnectionInfo['type'],
    options: {
      userId?: string;
      deviceId?: string;
      metadata?: Record<string, unknown>;
      enableReconnect?: boolean;
    } = {}
  ): ConnectionInfo | null {
    // 检查总连接数
    if (this.connections.size >= this.config.maxConnections) {
      log(`连接数已达上限: ${this.connections.size}/${this.config.maxConnections}`);
      ws.close(1013, '服务器繁忙，请稍后重试');
      return null;
    }

    // 检查用户连接数
    if (options.userId) {
      const userConns = this.userConnections.get(options.userId);
      if (userConns && userConns.size >= this.config.maxConnectionsPerUser) {
        log(`用户 ${options.userId} 连接数已达上限`);
        ws.close(1013, '连接数过多，请关闭其他设备');
        return null;
      }
    }

    const id = generateConnectionId();
    const now = Date.now();

    const info: ConnectionInfo = {
      id,
      ws,
      userId: options.userId,
      deviceId: options.deviceId,
      type,
      connectedAt: now,
      lastPingAt: now,
      lastPongAt: now,
      pingCount: 0,
      missedPongs: 0,
      metadata: options.metadata || {},
      isAlive: true,
      // 重连相关
      reconnectEnabled: options.enableReconnect ?? this.config.enableReconnect,
      reconnectAttempts: 0,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
    };

    this.connections.set(id, info);

    // 更新用户连接索引
    if (options.userId) {
      if (!this.userConnections.has(options.userId)) {
        this.userConnections.set(options.userId, new Set());
      }
      this.userConnections.get(options.userId)!.add(id);
    }

    // 设置pong处理
    ws.on('pong', () => {
      info.lastPongAt = Date.now();
      info.missedPongs = 0;
      info.isAlive = true;
    });

    // 设置关闭处理
    ws.on('close', (code, reason) => {
      this.handleDisconnect(id, code, reason?.toString());
    });

    // 设置错误处理
    ws.on('error', (error) => {
      log(`连接错误 ${id}: ${error.message}`);
      this.handleDisconnect(id, 1006, error.message);
    });

    log(`新连接注册: ${id} (${type}), 用户: ${options.userId || 'anonymous'}, 总连接: ${this.connections.size}`);
    this.emit('connection', info);

    return info;
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(connectionId: string, code: number, reason?: string): void {
    const info = this.connections.get(connectionId);
    if (!info) return;

    const wasAbnormal = code !== 1000 && code !== 1001;
    const canReconnect = info.reconnectEnabled && wasAbnormal && info.reconnectAttempts < info.maxReconnectAttempts;

    // 生成重连令牌
    if (canReconnect) {
      const token = generateReconnectToken();
      this.reconnectTokens.set(token, {
        connectionId,
        userId: info.userId,
        deviceId: info.deviceId,
        type: info.type,
        expiresAt: Date.now() + this.config.reconnectTokenExpiry,
        metadata: info.metadata,
      });
      info.reconnectToken = token;
      info.reconnectAttempts++;

      log(`重连令牌已生成: ${token}, 剩余尝试: ${info.maxReconnectAttempts - info.reconnectAttempts}`);

      // 通知客户端重连
      this.send(connectionId, {
        type: 'reconnect_token',
        token,
        reconnectAfter: this.getReconnectDelay(info.reconnectAttempts),
        maxAttempts: info.maxReconnectAttempts,
        remainingAttempts: info.maxReconnectAttempts - info.reconnectAttempts,
      });
    }

    this.unregister(connectionId);
  }

  /**
   * 获取重连延迟
   */
  private getReconnectDelay(attempt: number): number {
    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, attempt - 1),
      this.config.reconnectMaxDelay
    );
    return delay;
  }

  /**
   * 使用重连令牌验证并恢复连接
   */
  validateReconnect(token: string): {
    valid: boolean;
    userId?: string;
    deviceId?: string;
    type?: ConnectionInfo['type'];
    metadata?: Record<string, unknown>;
    remainingAttempts?: number;
    delay?: number;
  } | null {
    const tokenData = this.reconnectTokens.get(token);
    if (!tokenData) {
      return { valid: false };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.reconnectTokens.delete(token);
      return { valid: false };
    }

    return {
      valid: true,
      userId: tokenData.userId,
      deviceId: tokenData.deviceId,
      type: tokenData.type,
      metadata: tokenData.metadata,
      remainingAttempts: this.config.maxReconnectAttempts - 1,
      delay: this.config.reconnectBaseDelay,
    };
  }

  /**
   * 消耗重连令牌
   */
  consumeReconnectToken(token: string): boolean {
    return this.reconnectTokens.delete(token);
  }

  /**
   * 清理过期重连令牌
   */
  private startReconnectTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.reconnectTokens.entries()) {
        if (now > data.expiresAt) {
          this.reconnectTokens.delete(token);
        }
      }
    }, 60000); // 每分钟清理
  }

  unregister(connectionId: string): boolean {
    const info = this.connections.get(connectionId);
    if (!info) return false;

    // 清理用户连接索引
    if (info.userId) {
      const userConns = this.userConnections.get(info.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(info.userId);
        }
      }
    }

    // 清理重连令牌
    if (info.reconnectToken) {
      this.reconnectTokens.delete(info.reconnectToken);
    }

    // 关闭WebSocket
    if (info.ws.readyState === WebSocket.OPEN || info.ws.readyState === WebSocket.CONNECTING) {
      info.ws.close(1000, '连接已关闭');
    }

    this.connections.delete(connectionId);

    log(`连接已注销: ${connectionId}, 剩余连接: ${this.connections.size}`);
    this.emit('disconnection', info);

    return true;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const connections = Array.from(this.connections.entries());

      for (const [id, info] of connections) {
        // 检查是否超时
        if (now - info.lastPongAt > this.config.heartbeatTimeout) {
          info.missedPongs++;
          info.isAlive = false;

          if (info.missedPongs >= this.config.maxMissedPongs) {
            log(`连接心跳超时: ${id} (missed: ${info.missedPongs})`);
            this.unregister(id);
            continue;
          }
        }

        // 发送ping
        if (info.ws.readyState === WebSocket.OPEN) {
          try {
            info.ws.ping();
            info.lastPingAt = now;
            info.pingCount++;
          } catch (error) {
            log(`发送ping失败: ${id}`);
            this.unregister(id);
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const connections = Array.from(this.connections.entries());
      let cleaned = 0;

      for (const [id, info] of connections) {
        // 检查连接是否过期
        if (now - info.lastPongAt > this.config.connectionTimeout) {
          log(`连接超时清理: ${id}`);
          this.unregister(id);
          cleaned++;
        }

        // 检查WebSocket状态
        if (info.ws.readyState === WebSocket.CLOSED || info.ws.readyState === WebSocket.CLOSING) {
          this.unregister(id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        log(`清理过期连接: ${cleaned}个`);
      }
    }, this.config.cleanupInterval);
  }

  send(connectionId: string, data: unknown): boolean {
    const info = this.connections.get(connectionId);
    if (!info || info.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      info.ws.send(message);
      return true;
    } catch (error) {
      log(`发送消息失败: ${connectionId}`);
      return false;
    }
  }

  broadcast(data: unknown, filter?: (info: ConnectionInfo) => boolean): number {
    let sent = 0;
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    const connections = Array.from(this.connections.values());

    for (const info of connections) {
      if (info.ws.readyState !== WebSocket.OPEN) continue;
      if (filter && !filter(info)) continue;

      try {
        info.ws.send(message);
        sent++;
      } catch (error) {
        // 忽略发送失败
      }
    }

    return sent;
  }

  broadcastToUser(userId: string, data: unknown): number {
    return this.broadcast(data, info => info.userId === userId);
  }

  broadcastToType(type: ConnectionInfo['type'], data: unknown): number {
    return this.broadcast(data, info => info.type === type);
  }

  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionsByUser(userId: string): ConnectionInfo[] {
    const connIds = this.userConnections.get(userId);
    if (!connIds) return [];

    return Array.from(connIds)
      .map(id => this.connections.get(id))
      .filter((info): info is ConnectionInfo => info !== undefined);
  }

  getConnectionsByType(type: ConnectionInfo['type']): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(info => info.type === type);
  }

  getStats(): {
    total: number;
    byType: Record<string, number>;
    byUser: number;
    alive: number;
    avgPingCount: number;
    avgConnectionTime: number;
    reconnectTokens: number;
  } {
    const connections = Array.from(this.connections.values());
    const now = Date.now();

    const byType: Record<string, number> = {};
    let alive = 0;
    let totalPings = 0;
    let totalTime = 0;

    for (const info of connections) {
      byType[info.type] = (byType[info.type] || 0) + 1;
      if (info.isAlive) alive++;
      totalPings += info.pingCount;
      totalTime += now - info.connectedAt;
    }

    return {
      total: connections.length,
      byType,
      byUser: this.userConnections.size,
      alive,
      avgPingCount: connections.length > 0 ? Math.round(totalPings / connections.length) : 0,
      avgConnectionTime: connections.length > 0 ? Math.round(totalTime / connections.length) : 0,
      reconnectTokens: this.reconnectTokens.size,
    };
  }

  /**
   * 获取重连状态
   */
  getReconnectStats(): {
    activeTokens: number;
    tokens: Array<{
      token: string;
      expiresIn: number;
      type: string;
      userId?: string;
    }>;
  } {
    const now = Date.now();
    const tokens: Array<{
      token: string;
      expiresIn: number;
      type: string;
      userId?: string;
    }> = [];

    for (const [token, data] of this.reconnectTokens.entries()) {
      tokens.push({
        token,
        expiresIn: Math.max(0, data.expiresAt - now),
        type: data.type,
        userId: data.userId,
      });
    }

    return {
      activeTokens: tokens.length,
      tokens,
    };
  }

  async gracefulShutdown(timeout = 5000): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    log(`开始优雅关闭，${this.connections.size}个连接...`);

    // 停止定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 清空重连令牌
    this.reconnectTokens.clear();

    // 发送关闭通知
    this.broadcast({
      type: 'server_shutdown',
      message: '服务器正在重启，请稍后重连',
      reconnectAfter: 5000,
      allowReconnect: false,
    });

    // 等待一段时间后关闭所有连接
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000)));

    // 关闭所有连接
    const connectionIds = Array.from(this.connections.keys());
    for (const id of connectionIds) {
      this.unregister(id);
    }

    log('所有连接已关闭');
    this.emit('shutdown');
  }

  updateConfig(config: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...config };
    log(`配置已更新: ${JSON.stringify(config)}`);
  }

  getConfig(): PoolConfig {
    return { ...this.config };
  }
}

export const wsManager = new WebSocketManager();

// 注册进程退出处理
process.on('SIGTERM', () => {
  wsManager.gracefulShutdown();
});

process.on('SIGINT', () => {
  wsManager.gracefulShutdown();
});

logger.info('[WSManager] WebSocket连接管理器 v1.0 已加载');
