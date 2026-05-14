/**
 * 单元测试 - 消息队列
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface QueuedMessage {
  id: string;
  deviceId: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  priority: number;
}

class MessageQueue {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private readonly MAX_QUEUE_SIZE = 1000;

  enqueue(deviceId: string, type: string, payload: any, priority: number = 2): string {
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
    
    queue.push(message);
    queue.sort((a, b) => a.priority - b.priority);
    
    return message.id;
  }

  getMessages(deviceId: string, limit: number = 50): QueuedMessage[] {
    return (this.queues.get(deviceId) || []).slice(0, limit);
  }

  getQueueSize(deviceId: string): number {
    return (this.queues.get(deviceId) || []).length;
  }

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

  clearQueue(deviceId: string): void {
    this.queues.delete(deviceId);
  }

  getDeviceIds(): string[] {
    return Array.from(this.queues.keys());
  }

  getStats() {
    let totalMessages = 0;
    const queues: Array<{ deviceId: string; size: number }> = [];
    for (const [deviceId, queue] of this.queues.entries()) {
      totalMessages += queue.length;
      queues.push({ deviceId, size: queue.length });
    }
    return { totalDevices: this.queues.size, totalMessages, queues };
  }
}

const queue = new MessageQueue();

describe('消息队列 E2E 测试', () => {
  beforeEach(() => {
    queue.clearQueue('test-device');
    queue.clearQueue('device-1');
    queue.clearQueue('device-2');
  });

  it('添加消息', () => {
    const id = queue.enqueue('test-device', 'TEST', { data: 'hello' });
    expect(id).toContain('msg-');
    expect(queue.getQueueSize('test-device')).toBe(1);
  });

  it('优先级排序', () => {
    queue.enqueue('test-device', 'LOW', {}, 3);
    queue.enqueue('test-device', 'HIGH', {}, 1);
    queue.enqueue('test-device', 'NORMAL', {}, 2);
    
    const msgs = queue.getMessages('test-device');
    expect(msgs[0].type).toBe('HIGH');
    expect(msgs[1].type).toBe('NORMAL');
    expect(msgs[2].type).toBe('LOW');
  });

  it('删除消息', () => {
    const id = queue.enqueue('test-device', 'TEST', {});
    const removed = queue.removeMessage('test-device', id);
    expect(removed).toBe(true);
    expect(queue.getQueueSize('test-device')).toBe(0);
  });

  it('清空队列', () => {
    queue.enqueue('test-device', 'TEST', {});
    queue.enqueue('test-device', 'TEST', {});
    queue.clearQueue('test-device');
    expect(queue.getQueueSize('test-device')).toBe(0);
  });

  it('统计信息', () => {
    queue.enqueue('device-1', 'TEST', {});
    queue.enqueue('device-2', 'TEST', {});
    const stats = queue.getStats();
    expect(stats.totalDevices).toBe(2);
  });
});
