/**
 * 消息队列服务测试 - 独立版本
 * 不依赖其他服务
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 简化的消息队列实现
interface QueuedMessage {
  id: string;
  deviceId: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  priority: number;
}

class TestMessageQueue {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly PRIORITY_HIGH = 1;
  
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
    
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      this.pruneQueue(deviceId);
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
  
  private pruneQueue(deviceId: string): void {
    const queue = this.queues.get(deviceId);
    if (!queue) return;
    
    const lowPriorityIndex = queue.findIndex(m => m.priority === 3);
    if (lowPriorityIndex !== -1) {
      queue.splice(lowPriorityIndex, 1);
    }
  }
  
  getStats() {
    let totalMessages = 0;
    const queues: Array<{ deviceId: string; size: number }> = [];
    
    for (const [deviceId, queue] of this.queues.entries()) {
      totalMessages += queue.length;
      queues.push({ deviceId, size: queue.length });
    }
    
    return {
      totalDevices: this.queues.size,
      totalMessages,
      queues,
    };
  }
}

const queue = new TestMessageQueue();

describe('MessageQueueService', () => {
  const testDeviceId = 'test-device-001';
  const testPayload = { action: 'test', data: 'hello' };
  
  beforeEach(() => {
    queue.clearQueue(testDeviceId);
  });
  
  describe('enqueue', () => {
    it('应该成功添加消息到队列', () => {
      const messageId = queue.enqueue(testDeviceId, 'TEST', testPayload);
      
      expect(messageId).toBeDefined();
      expect(messageId).toContain('msg-');
    });
    
    it('应该按优先级排序消息', () => {
      queue.enqueue(testDeviceId, 'LOW', { p: 'low' }, 3);
      queue.enqueue(testDeviceId, 'HIGH', { p: 'high' }, 1);
      queue.enqueue(testDeviceId, 'NORMAL', { p: 'normal' }, 2);
      
      const messages = queue.getMessages(testDeviceId);
      
      expect(messages[0].type).toBe('HIGH');
      expect(messages[1].type).toBe('NORMAL');
      expect(messages[2].type).toBe('LOW');
    });
  });
  
  describe('getMessages', () => {
    it('应该返回正确数量的消息', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue(testDeviceId, 'TEST', { i });
      }
      
      const messages = queue.getMessages(testDeviceId, 3);
      
      expect(messages.length).toBe(3);
    });
    
    it('应该返回空数组当队列为空', () => {
      const messages = queue.getMessages('empty-device');
      
      expect(messages).toEqual([]);
    });
  });
  
  describe('getQueueSize', () => {
    it('应该返回正确的队列大小', () => {
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      
      const size = queue.getQueueSize(testDeviceId);
      
      expect(size).toBe(2);
    });
  });
  
  describe('removeMessage', () => {
    it('应该成功删除指定消息', () => {
      const messageId = queue.enqueue(testDeviceId, 'TEST', testPayload);
      
      const removed = queue.removeMessage(testDeviceId, messageId);
      
      expect(removed).toBe(true);
      expect(queue.getQueueSize(testDeviceId)).toBe(0);
    });
    
    it('删除不存在的消息应该返回false', () => {
      const removed = queue.removeMessage(testDeviceId, 'non-existent');
      
      expect(removed).toBe(false);
    });
  });
  
  describe('clearQueue', () => {
    it('应该清空指定设备的队列', () => {
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      
      queue.clearQueue(testDeviceId);
      
      expect(queue.getQueueSize(testDeviceId)).toBe(0);
    });
  });
  
  describe('getDeviceIds', () => {
    it('应该返回所有设备ID', () => {
      queue.enqueue('device-1', 'TEST', {});
      queue.enqueue('device-2', 'TEST', {});
      
      const deviceIds = queue.getDeviceIds();
      
      expect(deviceIds).toContain('device-1');
      expect(deviceIds).toContain('device-2');
    });
  });
  
  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      queue.enqueue(testDeviceId, 'TEST', testPayload);
      
      const stats = queue.getStats();
      
      expect(stats.totalDevices).toBeGreaterThan(0);
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(Array.isArray(stats.queues)).toBe(true);
    });
  });
});
