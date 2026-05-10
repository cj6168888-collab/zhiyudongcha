/**
 * 电话服务 - PhoneService
 * 
 * 提供电话拨打、通话记录查询、拨号控制功能
 * 需要Android伴侣应用支持 TelecomManager 权限
 */

import { createServiceLogger } from '../../lib/logger';
import deviceConnectionService from './DeviceConnectionService';
import mobileExecutorService from './MobileExecutorService';
import type {
  CallLogEntry,
  OperationError,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('PhoneService');

interface CallLogQueryOptions {
  limit?: number;
  offset?: number;
  phoneNumber?: string;
  type?: CallLogEntry['type'];
  dateFrom?: number;
  dateTo?: number;
}

interface DialOptions {
  number: string;
  simSlot?: number;
  blockUntilDialed?: boolean;
}

const CALL_TYPE_MAP: Record<number, CallLogEntry['type']> = {
  1: 'INCOMING',
  2: 'OUTGOING',
  3: 'MISSED',
  4: 'VOICEMAIL',
  5: 'REJECTED',
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

class PhoneService {
  async getCallLogs(deviceId: string, options: CallLogQueryOptions = {}): Promise<CallLogEntry[]> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'phone');
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
          phoneNumber: options.phoneNumber,
          type: options.type,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        },
      };

      const result = await deviceConnectionService.sendRequest<{ calls: Array<{
        id: string;
        number: string;
        contactName?: string;
        duration: number;
        date: number;
        type: number;
      }>}>(
        deviceId,
        'CALL_LOG',
        payload,
        15000
      );

      const callLogs: CallLogEntry[] = (result.calls || []).map(call => ({
        id: call.id,
        number: call.number,
        contactName: call.contactName,
        duration: call.duration,
        date: call.date,
        type: CALL_TYPE_MAP[call.type] || 'MISSED',
        durationFormatted: formatDuration(call.duration),
      }));

      logger.info({
        deviceId,
        count: callLogs.length,
      }, 'Call logs retrieved');

      return callLogs;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to get call logs');
      throw createError(
        ERROR_CODES.CALL_FAILED,
        'Failed to retrieve call logs',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getCallLogById(deviceId: string, callId: string): Promise<CallLogEntry | null> {
    const logs = await this.getCallLogs(deviceId, { limit: 1 });
    return logs.find(l => l.id === callId) || null;
  }

  async getMissedCalls(deviceId: string): Promise<CallLogEntry[]> {
    return this.getCallLogs(deviceId, { type: 'MISSED', limit: 50 });
  }

  async getCallsFromNumber(deviceId: string, phoneNumber: string): Promise<CallLogEntry[]> {
    return this.getCallLogs(deviceId, { phoneNumber, limit: 100 });
  }

  async getRecentCalls(deviceId: string, limit: number = 20): Promise<CallLogEntry[]> {
    return this.getCallLogs(deviceId, { limit });
  }

  async dialNumber(deviceId: string, options: DialOptions): Promise<{ success: boolean; callId?: string }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'phone');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!options.number) {
      throw createError(ERROR_CODES.CALL_FAILED, 'Phone number is required');
    }

    const cleanedNumber = options.number.replace(/[\s\-\(\)]/g, '');
    if (!this.validatePhoneNumber(cleanedNumber)) {
      throw createError(ERROR_CODES.CALL_FAILED, 'Invalid phone number format');
    }

    try {
      const payload = {
        number: cleanedNumber,
        simSlot: options.simSlot || 0,
        blockUntilDialed: options.blockUntilDialed ?? true,
      };

      const result = await deviceConnectionService.sendRequest<{ success: boolean; callId?: string }>(
        deviceId,
        'CALL_DIAL',
        payload,
        30000
      );

      logger.info({
        deviceId,
        number: cleanedNumber,
        success: result.success,
      }, 'Dial request sent');

      return result;
    } catch (error) {
      logger.error({ deviceId, number: options.number, error }, 'Failed to dial number');
      throw createError(
        ERROR_CODES.CALL_FAILED,
        'Failed to dial number',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async endCall(deviceId: string): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'phone');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'CALL_END',
        {},
        5000
      );

      logger.info({ deviceId }, 'Call ended');

      return result;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to end call');
      throw createError(
        ERROR_CODES.CALL_FAILED,
        'Failed to end call',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async answerCall(deviceId: string): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'phone');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'CALL_ANSWER',
        {},
        5000
      );

      logger.info({ deviceId }, 'Call answered');

      return result;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to answer call');
      throw createError(
        ERROR_CODES.CALL_FAILED,
        'Failed to answer call',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteCallLog(deviceId: string, callIds: string[]): Promise<{ deleted: number }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'phone');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!callIds || callIds.length === 0) {
      throw createError(ERROR_CODES.CALL_FAILED, 'No call IDs provided for deletion');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ deleted: number }>(
        deviceId,
        'CALL_LOG_DELETE',
        { callIds },
        10000
      );

      logger.info({ deviceId, deleted: result.deleted }, 'Call logs deleted');

      return result;
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to delete call logs');
      throw createError(
        ERROR_CODES.CALL_FAILED,
        'Failed to delete call logs',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getCallStatistics(deviceId: string, days: number = 7): Promise<{
    totalCalls: number;
    incomingCalls: number;
    outgoingCalls: number;
    missedCalls: number;
    totalDuration: number;
    averageDuration: number;
  }> {
    const dateFrom = Date.now() - (days * 24 * 60 * 60 * 1000);
    const calls = await this.getCallLogs(deviceId, { dateFrom, limit: 500 });

    const totalCalls = calls.length;
    const incomingCalls = calls.filter(c => c.type === 'INCOMING').length;
    const outgoingCalls = calls.filter(c => c.type === 'OUTGOING').length;
    const missedCalls = calls.filter(c => c.type === 'MISSED').length;
    const totalDuration = calls.reduce((sum, c) => sum + c.duration, 0);
    const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    return {
      totalCalls,
      incomingCalls,
      outgoingCalls,
      missedCalls,
      totalDuration,
      averageDuration,
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const chineseMobile = /^1[3-9]\d{9}$/;
    const international = /^\+?[1-9]\d{1,14}$/;
    const emergency = /^(110|119|120|122|10086|10010|10000)$/;
    return chineseMobile.test(cleaned) || international.test(cleaned) || emergency.test(cleaned);
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

export const phoneService = new PhoneService();
export default phoneService;
