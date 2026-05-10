import { createServiceLogger } from '../lib/logger';
import { storageAdapter } from '../storage/adapter';
import type { 
  TeamMember,
  InsertTeamMember,
  SatelliteDevice,
  InsertSatelliteDevice,
  BattleReport,
  LoyaltyEvent,
  InsertLoyaltyEvent
} from '@shared/schema';

const logger = createServiceLogger('CommandCenterService');

export class CommandCenterService {
  /**
   * 创建团队成员
   */
  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    try {
      return await storageAdapter.createTeamMember(data);
    } catch (error) {
      logger.error({ err: error, data }, '创建团队成员失败');
      throw error;
    }
  }

  /**
   * 获取所有团队成员
   */
  async getAllTeamMembers(isActive?: boolean): Promise<TeamMember[]> {
    try {
      return await storageAdapter.getAllTeamMembers(isActive);
    } catch (error) {
      logger.error({ err: error, isActive }, '获取团队成员失败');
      throw error;
    }
  }

  /**
   * 获取团队成员
   */
  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    try {
      return await storageAdapter.getTeamMember(id);
    } catch (error) {
      logger.error({ err: error, id }, '获取团队成员详情失败');
      throw error;
    }
  }

  /**
   * 更新团队成员
   */
  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    try {
      return await storageAdapter.updateTeamMember(id, updates);
    } catch (error) {
      logger.error({ err: error, id, updates }, '更新团队成员失败');
      throw error;
    }
  }

  /**
   * 创建卫星设备
   */
  async createSatelliteDevice(data: InsertSatelliteDevice): Promise<SatelliteDevice> {
    try {
      return await storageAdapter.createSatelliteDevice(data);
    } catch (error) {
      logger.error({ err: error, data }, '创建卫星设备失败');
      throw error;
    }
  }

  /**
   * 获取所有卫星设备
   */
  async getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]> {
    try {
      return await storageAdapter.getAllSatelliteDevices(status);
    } catch (error) {
      logger.error({ err: error, status }, '获取卫星设备失败');
      throw error;
    }
  }

  /**
   * 根据设备ID获取卫星设备
   */
  async getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined> {
    try {
      return await storageAdapter.getSatelliteDeviceByDeviceId(deviceId);
    } catch (error) {
      logger.error({ err: error, deviceId }, '获取卫星设备失败');
      throw error;
    }
  }

  /**
   * 更新卫星设备
   */
  async updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined> {
    try {
      return await storageAdapter.updateSatelliteDevice(id, updates);
    } catch (error) {
      logger.error({ err: error, id, updates }, '更新卫星设备失败');
      throw error;
    }
  }

  /**
   * 获取所有战斗报告
   */
  async getAllBattleReports(limit?: number): Promise<BattleReport[]> {
    try {
      return await storageAdapter.getAllBattleReports(limit);
    } catch (error) {
      logger.error({ err: error, limit }, '获取战斗报告失败');
      throw error;
    }
  }

  /**
   * 获取所有忠诚度事件
   */
  async getAllLoyaltyEvents(status?: string): Promise<LoyaltyEvent[]> {
    try {
      return await storageAdapter.getAllLoyaltyEvents(status);
    } catch (error) {
      logger.error({ err: error, status }, '获取忠诚度事件失败');
      throw error;
    }
  }

  /**
   * 创建忠诚度事件
   */
  async createLoyaltyEvent(data: InsertLoyaltyEvent): Promise<LoyaltyEvent> {
    try {
      return await storageAdapter.createLoyaltyEvent(data);
    } catch (error) {
      logger.error({ err: error, data }, '创建忠诚度事件失败');
      throw error;
    }
  }

  /**
   * 更新忠诚度事件
   */
  async updateLoyaltyEvent(id: string, updates: Partial<InsertLoyaltyEvent>): Promise<LoyaltyEvent | undefined> {
    try {
      return await storageAdapter.updateLoyaltyEvent(id, updates);
    } catch (error) {
      logger.error({ err: error, id, updates }, '更新忠诚度事件失败');
      throw error;
    }
  }
}

export const commandCenterService = new CommandCenterService();