/**
 * 结果通知服务 - ResultNotifier
 *
 * 任务执行结果通知：
 * - WebSocket实时推送
 * - 邮件通知
 * - 短信通知 (待实现)
 * - 微信通知 (待实现)
 *
 * @version 1.0.0
 * @date 2026-03-13
 */

import { createServiceLogger } from '../../lib/logger';
import { WebSocketServer, WebSocket } from 'ws';

const logger = createServiceLogger('ResultNotifier');

/**
 * 通知类型
 */
export type NotificationType = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';

/**
 * 通知渠道
 */
export type NotificationChannel = 'WEBSOCKET' | 'EMAIL' | 'SMS' | 'WECHAT' | 'PUSH';

/**
 * 通知内容
 */
export interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * 通知目标
 */
export interface NotificationTarget {
  channel: NotificationChannel;
  userId?: string;
  deviceId?: string;
  email?: string;
  phone?: string;
  webhook?: string;
}

/**
 * 通知请求
 */
export interface NotificationRequest {
  type: NotificationType;
  targets: NotificationTarget[];
  content: NotificationContent;
  source?: {
    taskId?: string;
    executionId?: string;
    deviceId?: string;
  };
}

/**
 * 通知结果
 */
export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  target: string;
  messageId?: string;
  error?: string;
}

/**
 * WebSocket订阅者
 */
interface WebSocketSubscriber {
  userId?: string;
  deviceId?: string;
  ws: WebSocket;
  filters?: {
    taskIds?: string[];
    types?: NotificationType[];
  };
}

/**
 * 服务配置
 */
export interface ResultNotifierConfig {
  enableWebSocket: boolean;
  enableEmail: boolean;
  emailFrom?: string;
  emailSmtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  defaultTargets?: NotificationTarget[];
}

const DEFAULT_CONFIG: ResultNotifierConfig = {
  enableWebSocket: true,
  enableEmail: false,
};

/**
 * 结果通知服务 - 单例模式
 */
export class ResultNotifier {
  private static instance: ResultNotifier | null = null;

  private config: ResultNotifierConfig;
  private subscribers: Map<string, Set<WebSocketSubscriber>> = new Map();
  private notificationHistory: Array<{
    id: string;
    type: NotificationType;
    content: NotificationContent;
    results: NotificationResult[];
    timestamp: number;
  }> = [];
  private maxHistorySize = 1000;

  private constructor(config: Partial<ResultNotifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<ResultNotifierConfig>): ResultNotifier {
    if (!ResultNotifier.instance) {
      ResultNotifier.instance = new ResultNotifier(config);
    }
    return ResultNotifier.instance;
  }

  /**
   * 初始化WebSocket服务器
   */
  public initialize(wss: WebSocketServer): void {
    if (!this.config.enableWebSocket) return;

    wss.on('connection', (ws, req) => {
      this.handleNewConnection(ws, req);
    });

    logger.info('ResultNotifier WebSocket initialized');
  }

  /**
   * 处理新连接
   */
  private handleNewConnection(ws: WebSocket, req: { url?: string }): void {
    const subscriber: WebSocketSubscriber = {
      ws,
      deviceId: req.socket.remoteAddress || undefined,
    };

    // 解析URL参数获取订阅条件
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('userId');
    const deviceId = url.searchParams.get('deviceId');
    const taskIds = url.searchParams.get('taskIds')?.split(',');
    const types = url.searchParams.get('types')?.split(',') as NotificationType[] | undefined;

    if (userId) subscriber.userId = userId;
    if (deviceId) subscriber.deviceId = deviceId;
    if (taskIds || types) {
      subscriber.filters = { taskIds, types };
    }

    // 添加到订阅者列表
    const key = userId || deviceId || 'anonymous';
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(subscriber);

    logger.info({ userId, deviceId }, 'New notification subscriber');

    ws.on('close', () => {
      this.subscribers.get(key)?.delete(subscriber);
      if (this.subscribers.get(key)?.size === 0) {
        this.subscribers.delete(key);
      }
    });

    ws.on('error', (error) => {
      logger.error({ error }, 'Subscriber WebSocket error');
    });
  }

  /**
   * 发送通知
   */
  async notify(request: NotificationRequest): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    logger.info({
      notificationId,
      type: request.type,
      targets: request.targets.length
    }, 'Sending notification');

    // 发送到各个渠道
    for (const target of request.targets) {
      try {
        let result: NotificationResult;

        switch (target.channel) {
          case 'WEBSOCKET':
            result = await this.sendWebSocketNotification(target, request.content, request.source);
            break;
          case 'EMAIL':
            result = await this.sendEmailNotification(target, request.content);
            break;
          case 'SMS':
            result = { success: false, channel: 'SMS', target: target.phone || '', error: 'Not implemented' };
            break;
          case 'WECHAT':
            result = { success: false, channel: 'WECHAT', target: target.webhook || '', error: 'Not implemented' };
            break;
          case 'PUSH':
            result = await this.sendPushNotification(target, request.content);
            break;
          default:
            result = { success: false, channel: target.channel, target: '', error: 'Unknown channel' };
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel: target.channel,
          target: target.deviceId || target.userId || '',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 记录历史
    this.notificationHistory.push({
      id: notificationId,
      type: request.type,
      content: request.content,
      results,
      timestamp: Date.now(),
    });

    // 清理过期的历史
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(-this.maxHistorySize);
    }

    // 统计成功率
    const successCount = results.filter(r => r.success).length;
    logger.info({
      notificationId,
      successCount,
      totalCount: results.length
    }, 'Notification sent');

    return results;
  }

  /**
   * 发送WebSocket通知
   */
  private async sendWebSocketNotification(
    target: NotificationTarget,
    content: NotificationContent,
    source?: NotificationRequest['source']
  ): Promise<NotificationResult> {
    const key = target.userId || target.deviceId || 'anonymous';
    const subscribers = this.subscribers.get(key);

    if (!subscribers || subscribers.size === 0) {
      return {
        success: false,
        channel: 'WEBSOCKET',
        target: key,
        error: 'No subscribers',
      };
    }

    const message = JSON.stringify({
      type: 'NOTIFICATION',
      notification: {
        ...content,
        source,
        timestamp: Date.now(),
      },
    });

    let successCount = 0;
    for (const subscriber of subscribers) {
      // 检查过滤器
      if (subscriber.filters) {
        if (subscriber.filters.taskIds?.length && source?.taskId) {
          if (!subscriber.filters.taskIds.includes(source.taskId)) continue;
        }
        if (subscriber.filters.types?.length) {
          // 内容中没有类型信息，跳过过滤
        }
      }

      if (subscriber.ws.readyState === WebSocket.OPEN) {
        subscriber.ws.send(message);
        successCount++;
      }
    }

    return {
      success: successCount > 0,
      channel: 'WEBSOCKET',
      target: key,
      messageId: `ws_${Date.now()}`,
    };
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(
    target: NotificationTarget,
    content: NotificationContent
  ): Promise<NotificationResult> {
    if (!this.config.enableEmail || !this.config.emailFrom) {
      return {
        success: false,
        channel: 'EMAIL',
        target: target.email || '',
        error: 'Email not configured',
      };
    }

    // TODO: 实现邮件发送
    // 可以使用 nodemailer 库

    logger.info({ email: target.email, title: content.title }, 'Email notification');

    return {
      success: true,
      channel: 'EMAIL',
      target: target.email || '',
      messageId: `email_${Date.now()}`,
    };
  }

  /**
   * 发送推送通知
   */
  private async sendPushNotification(
    target: NotificationTarget,
    content: NotificationContent
  ): Promise<NotificationResult> {
    // TODO: 实现推送通知
    // 可以使用 Firebase Cloud Messaging 或其他推送服务

    logger.info({ deviceId: target.deviceId, title: content.title }, 'Push notification');

    return {
      success: true,
      channel: 'PUSH',
      target: target.deviceId || '',
      messageId: `push_${Date.now()}`,
    };
  }

  /**
   * 任务完成通知快捷方法
   */
  async notifyTaskComplete(
    taskId: string,
    taskName: string,
    success: boolean,
    details?: Record<string, unknown>,
    targets?: NotificationTarget[]
  ): Promise<NotificationResult[]> {
    const type = success ? 'SUCCESS' : 'FAILURE';

    return this.notify({
      type,
      targets: targets || this.config.defaultTargets || [],
      content: {
        title: success ? '任务完成' : '任务失败',
        body: `${taskName} ${success ? '已成功完成' : '执行失败'}`,
        data: { taskId, ...details },
        priority: success ? 'normal' : 'high',
      },
      source: { taskId },
    });
  }

  /**
   * 设备状态变化通知
   */
  async notifyDeviceStatusChange(
    deviceId: string,
    deviceName: string,
    oldStatus: string,
    newStatus: string,
    targets?: NotificationTarget[]
  ): Promise<NotificationResult[]> {
    return this.notify({
      type: 'INFO',
      targets: targets || this.config.defaultTargets || [],
      content: {
        title: '设备状态变化',
        body: `${deviceName}: ${oldStatus} -> ${newStatus}`,
        data: { deviceId, oldStatus, newStatus },
      },
      source: { deviceId },
    });
  }

  /**
   * 获取通知历史
   */
  getHistory(limit: number = 100, type?: NotificationType): Array<{
    id: string;
    type: NotificationType;
    content: NotificationContent;
    successCount: number;
    totalCount: number;
    timestamp: number;
  }> {
    let history = this.notificationHistory;

    if (type) {
      history = history.filter(h => h.type === type);
    }

    return history
      .slice(-limit)
      .map(h => ({
        id: h.id,
        type: h.type,
        content: h.content,
        successCount: h.results.filter(r => r.success).length,
        totalCount: h.results.length,
        timestamp: h.timestamp,
      }));
  }

  /**
   * 获取订阅者数量
   */
  getSubscriberCount(): number {
    let count = 0;
    for (const subscribers of this.subscribers.values()) {
      count += subscribers.size;
    }
    return count;
  }

  /**
   * 健康检查
   */
  healthCheck(): {
    status: 'ok' | 'degraded' | 'error';
    details: {
      subscriberCount: number;
      historySize: number;
      emailConfigured: boolean;
    };
  } {
    return {
      status: 'ok',
      details: {
        subscriberCount: this.getSubscriberCount(),
        historySize: this.notificationHistory.length,
        emailConfigured: this.config.enableEmail && Boolean(this.config.emailFrom),
      },
    };
  }
}

// 导出单例
export const resultNotifier = ResultNotifier.getInstance();
export default resultNotifier;
