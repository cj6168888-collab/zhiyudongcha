/**
 * 短信服务 - SmsService
 * 
 * 提供短信读取、发送、管理功能
 * 需要Android伴侣应用支持ContentResolver权限
 */

import { createServiceLogger } from '../../lib/logger';
import deviceConnectionService from './DeviceConnectionService';
import mobileExecutorService from './MobileExecutorService';
import type {
  SmsMessage,
  SmsConversation,
  OperationError,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('SmsService');

interface SmsQueryOptions {
  limit?: number;
  offset?: number;
  address?: string;
  threadId?: number;
  unreadOnly?: boolean;
  dateFrom?: number;
  dateTo?: number;
}

interface SendSmsOptions {
  to: string;
  body: string;
  simSlot?: number;
}

interface DeleteSmsOptions {
  messageIds: string[];
}

class SmsService {
  async getMessages(deviceId: string, options: SmsQueryOptions = {}): Promise<SmsMessage[]> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'sms');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const payload = {
        limit: options.limit || 50,
        offset: options.offset || 0,
        filter: {
          address: options.address,
          threadId: options.threadId,
          unreadOnly: options.unreadOnly,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        },
      };

      const result = await deviceConnectionService.sendRequest<{ messages: SmsMessage[] }>(
        deviceId,
        'SMS_LIST',
        payload,
        15000
      );

      logger.info({
        deviceId,
        count: result.messages?.length || 0,
      }, 'SMS messages retrieved');

      return result.messages || [];
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to get SMS messages');
      throw createError(
        ERROR_CODES.SMS_FAILED,
        'Failed to retrieve SMS messages',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getConversations(deviceId: string): Promise<SmsConversation[]> {
    const messages = await this.getMessages(deviceId, { limit: 500 });
    
    const conversationMap = new Map<number, SmsConversation>();
    
    for (const message of messages) {
      if (!message.threadId) continue;
      
      const existing = conversationMap.get(message.threadId);
      
      if (!existing) {
        conversationMap.set(message.threadId, {
          threadId: message.threadId,
          address: message.address,
          lastMessage: message.body,
          lastDate: message.date,
          messageCount: 1,
          unreadCount: message.read ? 0 : 1,
        });
      } else {
        existing.messageCount++;
        if (!message.read) {
          existing.unreadCount++;
        }
        if (message.date > existing.lastDate) {
          existing.lastMessage = message.body;
          existing.lastDate = message.date;
        }
      }
    }

    return Array.from(conversationMap.values()).sort((a, b) => b.lastDate - a.lastDate);
  }

  async getMessageById(deviceId: string, messageId: string): Promise<SmsMessage | null> {
    const messages = await this.getMessages(deviceId, { limit: 1 });
    return messages.find(m => m.id === messageId) || null;
  }

  async getUnreadMessages(deviceId: string): Promise<SmsMessage[]> {
    return this.getMessages(deviceId, { unreadOnly: true });
  }

  async getMessagesFromAddress(deviceId: string, address: string): Promise<SmsMessage[]> {
    return this.getMessages(deviceId, { address, limit: 100 });
  }

  async sendSms(deviceId: string, options: SendSmsOptions): Promise<{ success: boolean; messageId?: string }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'sms');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!options.to || !options.body) {
      throw createError(ERROR_CODES.SMS_FAILED, 'Phone number and message body are required');
    }

    try {
      const payload = {
        to: options.to,
        body: options.body,
        simSlot: options.simSlot || 0,
      };

      const result = await deviceConnectionService.sendRequest<{ success: boolean; messageId?: string }>(
        deviceId,
        'SMS_SEND',
        payload,
        30000
      );

      logger.info({
        deviceId,
        to: options.to,
        success: result.success,
      }, 'SMS sent');

      return result;
    } catch (error) {
      logger.error({ deviceId, to: options.to, error }, 'Failed to send SMS');
      throw createError(
        ERROR_CODES.SMS_FAILED,
        'Failed to send SMS',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteMessages(deviceId: string, options: DeleteSmsOptions): Promise<{ deleted: number }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'sms');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!options.messageIds || options.messageIds.length === 0) {
      throw createError(ERROR_CODES.SMS_FAILED, 'No message IDs provided for deletion');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ deleted: number }>(
        deviceId,
        'SMS_DELETE',
        { messageIds: options.messageIds },
        10000
      );

      logger.info({
        deviceId,
        deleted: result.deleted,
      }, 'SMS messages deleted');

      return result;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to delete SMS messages');
      throw createError(
        ERROR_CODES.SMS_FAILED,
        'Failed to delete SMS messages',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async markAsRead(deviceId: string, messageIds: string[]): Promise<{ marked: number }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'sms');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ marked: number }>(
        deviceId,
        'SMS_MARK_READ',
        { messageIds },
        10000
      );

      logger.info({ deviceId, marked: result.marked }, 'SMS messages marked as read');

      return result;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to mark SMS as read');
      throw createError(
        ERROR_CODES.SMS_FAILED,
        'Failed to mark messages as read',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getConversationMessages(deviceId: string, threadId: number): Promise<SmsMessage[]> {
    return this.getMessages(deviceId, { threadId, limit: 100 });
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const chineseMobile = /^1[3-9]\d{9}$/;
    const international = /^\+?[1-9]\d{1,14}$/;
    return chineseMobile.test(cleaned) || international.test(cleaned);
  }

  formatPhoneNumber(phoneNumber: string, countryCode: string = '86'): string {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    if (cleaned.startsWith(countryCode)) {
      return `+${cleaned}`;
    }
    
    if (cleaned.length === 11 && /^1[3-9]/.test(cleaned)) {
      return `+${countryCode}${cleaned}`;
    }
    
    return cleaned;
  }
}

export const smsService = new SmsService();
export default smsService;
