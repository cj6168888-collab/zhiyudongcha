import { createServiceLogger } from '../lib/logger';
import { storageAdapter } from '../storage/adapter';
import type { 
  Device,
  InsertDevice,
  RemoteCommand,
  InsertRemoteCommand,
  Voiceprint 
} from '@shared/schema';

const logger = createServiceLogger('Z3DevicesService');

export class Z3DevicesService {
  /**
   * 获取所有设备
   */
  async getAllDevices(userId?: string): Promise<Device[]> {
    try {
      return await storageAdapter.getAllDevices(userId);
    } catch (error) {
      logger.error({ err: error, userId }, '获取所有设备失败');
      throw error;
    }
  }

  /**
   * 创建设备
   */
  async createDevice(deviceData: InsertDevice): Promise<Device> {
    try {
      return await storageAdapter.createDevice(deviceData);
    } catch (error) {
      logger.error({ err: error, deviceData }, '创建设备失败');
      throw error;
    }
  }

  /**
   * 获取设备
   */
  async getDevice(id: string): Promise<Device | undefined> {
    try {
      return await storageAdapter.getDevice(id);
    } catch (error) {
      logger.error({ err: error, id }, '获取设备失败');
      throw error;
    }
  }

  /**
   * 更新设备
   */
  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    try {
      return await storageAdapter.updateDevice(id, updates);
    } catch (error) {
      logger.error({ err: error, id, updates }, '更新设备失败');
      throw error;
    }
  }

  /**
   * 更新设备心跳
   */
  async updateDeviceHeartbeat(id: string): Promise<Device | undefined> {
    try {
      return await storageAdapter.updateDeviceHeartbeat(id);
    } catch (error) {
      logger.error({ err: error, id }, '更新设备心跳失败');
      throw error;
    }
  }

  /**
   * 删除设备
   */
  async deleteDevice(id: string): Promise<boolean> {
    try {
      return await storageAdapter.deleteDevice(id);
    } catch (error) {
      logger.error({ err: error, id }, '删除设备失败');
      throw error;
    }
  }

  /**
   * 获取待处理命令
   */
  async getPendingCommands(deviceId: string): Promise<RemoteCommand[]> {
    try {
      return await storageAdapter.getPendingCommands(deviceId);
    } catch (error) {
      logger.error({ err: error, deviceId }, '获取待处理命令失败');
      throw error;
    }
  }

  /**
   * 创建设备远程命令
   */
  async createRemoteCommand(commandData: InsertRemoteCommand): Promise<RemoteCommand> {
    try {
      return await storageAdapter.createRemoteCommand(commandData);
    } catch (error) {
      logger.error({ err: error, commandData }, '创建远程命令失败');
      throw error;
    }
  }

  /**
   * 获取设备命令
   */
  async getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]> {
    try {
      return await storageAdapter.getDeviceCommands(deviceId, limit);
    } catch (error) {
      logger.error({ err: error, deviceId, limit }, '获取设备命令失败');
      throw error;
    }
  }

  /**
   * 更新远程命令
   */
  async updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined> {
    try {
      return await storageAdapter.updateRemoteCommand(id, updates);
    } catch (error) {
      logger.error({ err: error, id, updates }, '更新远程命令失败');
      throw error;
    }
  }

  /**
   * 获取主语音特征
   */
  async getMasterVoiceprint(): Promise<Voiceprint | undefined> {
    try {
      // 使用可选链调用，因为getMasterVoiceprint可能不存在
      return await storageAdapter.getMasterVoiceprint?.();
    } catch (error) {
      logger.error({ err: error }, '获取主语音特征失败');
      throw error;
    }
  }

  /**
   * 批量更新设备状态
   */
  async batchUpdateDeviceStatus(deviceIds: string[], status: Device['status']): Promise<void> {
    try {
      await Promise.all(
        deviceIds.map(id => this.updateDevice(id, { status }))
      );
    } catch (error) {
      logger.error({ err: error, deviceIds, status }, '批量更新设备状态失败');
      throw error;
    }
  }
}

export const z3DevicesService = new Z3DevicesService();