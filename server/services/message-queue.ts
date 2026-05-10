/**
 * 消息队列服务 - MessageQueueService
 * 
 * 功能：
 * 1. 离线消息缓存
 * 2. 连接恢复后批量同步
 * 3. 消息优先级处理
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('MessageQueue');

export interface QueuedMessage {
  id: string;
  deviceId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  priority: number;
}

class MessageQueueService {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly PRIORITY_HIGH = 1;
  private readonly PRIORITY_NORMAL = 2;
  private readonly PRIORITY_LOW = 3;

  /**
   * 添加消息到队列
   */
  enqueue(deviceId: string, type: string, payload: unknown, priority: number = this.PRIORITY_NORMAL): string {
    const message: QueuedMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      deviceId,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      priority,
    };
    
    let queue = this.queues.get(deviceId);
    if (!queue) {
      queue = [];
      this.queues.set(deviceId, queue);
    }
    
    // 检查队列大小
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      // 移除最旧的低优先级消息
      this.pruneQueue(deviceId);
    }
    
    queue.push(message);
    
    // 按优先级排序
    queue.sort((a, b) => a.priority - b.priority);
    
    logger.info({ deviceId, messageId: message.id, type, queueSize: queue.length }, '消息已入队');
    
    return message.id;
  }

  /**
   * 获取设备队列中的消息
   */
  getMessages(deviceId: string, limit: number = 50): QueuedMessage[] {
    const queue = this.queues.get(deviceId) || [];
    return queue.slice(0, limit);
  }

  /**
   * 获取队列大小
   */
  getQueueSize(deviceId: string): number {
    return (this.queues.get(deviceId) || []).length;
  }

  /**
   * 移除指定消息
   */
  removeMessage(deviceId: string, messageId: string): boolean {
    const queue = this.queues.get(deviceId);
    if (!queue) return false;
    
    const index = queue.findIndex(m => m.id === messageId);
    if (index !== -1) {
      queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 清空设备队列
   */
  clearQueue(deviceId: string): void {
    this.queues.delete(deviceId);
    logger.info({ deviceId }, '队列已清空');
  }

  /**
   * 获取所有设备ID
   */
  getDeviceIds(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * 队列清理 - 移除过期的低优先级消息
   */
  private pruneQueue(deviceId: string): void {
    const queue = this.queues.get(deviceId);
    if (!queue) return;
    
    // 找到最低优先级的消息
    const lowPriorityIndex = queue.findIndex(m => m.priority === this.PRIORITY_LOW);
    if (lowPriorityIndex !== -1) {
      queue.splice(lowPriorityIndex, 1);
      logger.debug({ deviceId }, '已清理低优先级消息');
    }
  }

  /**
   * 更新消息重试计数
   */
  incrementRetry(messageId: string): boolean {
    for (const queue of this.queues.values()) {
      const message = queue.find(m => m.id === messageId);
      if (message) {
        message.retryCount++;
        if (message.retryCount >= this.MAX_RETRY_COUNT) {
          logger.warn({ messageId, retryCount: message.retryCount }, '消息重试次数过多，移除');
          this.removeMessage(message.deviceId, messageId);
          return false;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): {
    totalDevices: number;
    totalMessages: number;
    queues: Array<{ deviceId: string; size: number }>;
  } {
    const stats = {
      totalDevices: this.queues.size,
      totalMessages: 0,
      queues: [] as Array<{ deviceId: string; size: number }>,
    };
    
    for (const [deviceId, queue] of this.queues.entries()) {
      stats.totalMessages += queue.length;
      stats.queues.push({ deviceId, size: queue.length });
    }
    
    return stats;
  }
}

export const messageQueueService = new MessageQueueService();
export default messageQueueService;
