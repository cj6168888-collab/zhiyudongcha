/**
 * 消息队列服务测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { messageQueueService } from '../../services/message-queue';

describe('MessageQueueService', () => {
  const testDeviceId = 'test-device-001';
  const testPayload = { action: 'test', data: 'hello' };
  
  beforeEach(() => {
    messageQueueService.clearQueue(testDeviceId);
  });
  
  describe('enqueue', () => {
    it('应该成功添加消息到队列', () => {
      const messageId = messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      
      expect(messageId).toBeDefined();
      expect(messageId).toContain('msg-');
    });
    
    it('应该按优先级排序消息', () => {
      messageQueueService.enqueue(testDeviceId, 'LOW', { p: 'low' }, 3);
      messageQueueService.enqueue(testDeviceId, 'HIGH', { p: 'high' }, 1);
      messageQueueService.enqueue(testDeviceId, 'NORMAL', { p: 'normal' }, 2);
      
      const messages = messageQueueService.getMessages(testDeviceId);
      
      expect(messages[0].type).toBe('HIGH');
      expect(messages[1].type).toBe('NORMAL');
      expect(messages[2].type).toBe('LOW');
    });
  });
  
  describe('getMessages', () => {
    it('应该返回正确数量的消息', () => {
      for (let i = 0; i < 5; i++) {
        messageQueueService.enqueue(testDeviceId, 'TEST', { i });
      }
      
      const messages = messageQueueService.getMessages(testDeviceId, 3);
      
      expect(messages.length).toBe(3);
    });
    
    it('应该返回空数组当队列为空', () => {
      const messages = messageQueueService.getMessages('empty-device');
      
      expect(messages).toEqual([]);
    });
  });
  
  describe('getQueueSize', () => {
    it('应该返回正确的队列大小', () => {
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      
      const size = messageQueueService.getQueueSize(testDeviceId);
      
      expect(size).toBe(2);
    });
  });
  
  describe('removeMessage', () => {
    it('应该成功删除指定消息', () => {
      const messageId = messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      
      const removed = messageQueueService.removeMessage(testDeviceId, messageId);
      
      expect(removed).toBe(true);
      expect(messageQueueService.getQueueSize(testDeviceId)).toBe(0);
    });
    
    it('删除不存在的消息应该返回false', () => {
      const removed = messageQueueService.removeMessage(testDeviceId, 'non-existent');
      
      expect(removed).toBe(false);
    });
  });
  
  describe('clearQueue', () => {
    it('应该清空指定设备的队列', () => {
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      
      messageQueueService.clearQueue(testDeviceId);
      
      expect(messageQueueService.getQueueSize(testDeviceId)).toBe(0);
    });
  });
  
  describe('getDeviceIds', () => {
    it('应该返回所有设备ID', () => {
      messageQueueService.enqueue('device-1', 'TEST', {});
      messageQueueService.enqueue('device-2', 'TEST', {});
      
      const deviceIds = messageQueueService.getDeviceIds();
      
      expect(deviceIds).toContain('device-1');
      expect(deviceIds).toContain('device-2');
    });
  });
  
  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      messageQueueService.enqueue(testDeviceId, 'TEST', testPayload);
      
      const stats = messageQueueService.getStats();
      
      expect(stats.totalDevices).toBeGreaterThan(0);
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(Array.isArray(stats.queues)).toBe(true);
    });
  });
});
