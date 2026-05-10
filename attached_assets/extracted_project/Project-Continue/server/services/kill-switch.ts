import { storage } from '../storage';
import { tieredAccessService } from './tiered-access';
import type { KillSwitchAction, SatelliteDevice, TeamMember } from '@shared/schema';

export interface KillSwitchResult {
  success: boolean;
  action: KillSwitchAction;
  targetId: string;
  targetType: 'DEVICE' | 'MEMBER';
  message: string;
  affectedModules?: string[];
  reversible: boolean;
  logId?: string;
}

class KillSwitchService {
  async revokeDeviceAccess(
    deviceId: string,
    reason: string,
    initiatedBy: string = 'MASTER'
  ): Promise<KillSwitchResult> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) {
      return {
        success: false,
        action: 'REVOKE_ACCESS',
        targetId: deviceId,
        targetType: 'DEVICE',
        message: '设备不存在',
        reversible: true,
      };
    }

    await storage.updateSatelliteDevice(device.id, {
      killSwitchActive: true,
      killSwitchReason: reason,
      killSwitchAt: new Date(),
      status: 'LOCKED',
      accessTier: 'RESTRICTED',
    });

    const log = await storage.createKillSwitchLog({
      action: 'REVOKE_ACCESS',
      targetType: 'DEVICE',
      targetId: device.id,
      targetName: device.deviceName,
      reason,
      severity: 'MEDIUM',
      initiatedBy,
      permissionsRevoked: true,
      deviceLocked: true,
      reversible: true,
    });

    return {
      success: true,
      action: 'REVOKE_ACCESS',
      targetId: device.id,
      targetType: 'DEVICE',
      message: `设备 ${device.deviceName} 权限已回收`,
      reversible: true,
      logId: log.id,
    };
  }

  async destroyLocalData(
    deviceId: string,
    reason: string,
    initiatedBy: string = 'MASTER'
  ): Promise<KillSwitchResult> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) {
      return {
        success: false,
        action: 'DESTROY_LOCAL',
        targetId: deviceId,
        targetType: 'DEVICE',
        message: '设备不存在',
        reversible: false,
      };
    }

    await storage.updateSatelliteDevice(device.id, {
      killSwitchActive: true,
      killSwitchReason: reason,
      killSwitchAt: new Date(),
      status: 'DESTROYED',
      accessTier: 'RESTRICTED',
      syncEnabled: false,
    });

    const log = await storage.createKillSwitchLog({
      action: 'DESTROY_LOCAL',
      targetType: 'DEVICE',
      targetId: device.id,
      targetName: device.deviceName,
      reason,
      severity: 'HIGH',
      initiatedBy,
      dataDestroyed: true,
      permissionsRevoked: true,
      deviceLocked: true,
      affectedModules: ['all'],
      reversible: false,
    });

    return {
      success: true,
      action: 'DESTROY_LOCAL',
      targetId: device.id,
      targetType: 'DEVICE',
      message: `设备 ${device.deviceName} 本地数据销毁指令已下发`,
      affectedModules: ['all'],
      reversible: false,
      logId: log.id,
    };
  }

  async lockDevice(
    deviceId: string,
    reason: string,
    initiatedBy: string = 'MASTER'
  ): Promise<KillSwitchResult> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) {
      return {
        success: false,
        action: 'LOCK_DEVICE',
        targetId: deviceId,
        targetType: 'DEVICE',
        message: '设备不存在',
        reversible: true,
      };
    }

    await storage.updateSatelliteDevice(device.id, {
      killSwitchActive: true,
      killSwitchReason: reason,
      killSwitchAt: new Date(),
      status: 'LOCKED',
    });

    const log = await storage.createKillSwitchLog({
      action: 'LOCK_DEVICE',
      targetType: 'DEVICE',
      targetId: device.id,
      targetName: device.deviceName,
      reason,
      severity: 'MEDIUM',
      initiatedBy,
      deviceLocked: true,
      reversible: true,
    });

    return {
      success: true,
      action: 'LOCK_DEVICE',
      targetId: device.id,
      targetType: 'DEVICE',
      message: `设备 ${device.deviceName} 已锁定`,
      reversible: true,
      logId: log.id,
    };
  }

  async fullWipe(
    deviceId: string,
    reason: string,
    initiatedBy: string = 'MASTER',
    authorizedBy?: string
  ): Promise<KillSwitchResult> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) {
      return {
        success: false,
        action: 'FULL_WIPE',
        targetId: deviceId,
        targetType: 'DEVICE',
        message: '设备不存在',
        reversible: false,
      };
    }

    await storage.updateSatelliteDevice(device.id, {
      killSwitchActive: true,
      killSwitchReason: reason,
      killSwitchAt: new Date(),
      status: 'DESTROYED',
      accessTier: 'RESTRICTED',
      syncEnabled: false,
      allowedModules: [],
      blockedModules: ['*'],
    });

    const log = await storage.createKillSwitchLog({
      action: 'FULL_WIPE',
      targetType: 'DEVICE',
      targetId: device.id,
      targetName: device.deviceName,
      reason,
      severity: 'CRITICAL',
      initiatedBy,
      authorizedBy,
      dataDestroyed: true,
      permissionsRevoked: true,
      deviceLocked: true,
      affectedModules: ['all'],
      reversible: false,
    });

    return {
      success: true,
      action: 'FULL_WIPE',
      targetId: device.id,
      targetType: 'DEVICE',
      message: `设备 ${device.deviceName} 完全清除指令已下发`,
      affectedModules: ['all'],
      reversible: false,
      logId: log.id,
    };
  }

  async revokeMemberAccess(
    memberId: string,
    reason: string,
    initiatedBy: string = 'MASTER'
  ): Promise<KillSwitchResult> {
    const member = await storage.getTeamMember(memberId);
    if (!member) {
      return {
        success: false,
        action: 'REVOKE_ACCESS',
        targetId: memberId,
        targetType: 'MEMBER',
        message: '成员不存在',
        reversible: true,
      };
    }

    await storage.updateTeamMember(memberId, {
      accessTier: 'RESTRICTED',
      isActive: false,
      riskFlags: [...(member.riskFlags || []), 'ACCESS_REVOKED'],
    });

    const devices = await storage.getAllSatelliteDevices();
    const memberDevices = devices.filter(d => d.ownerId === memberId);
    
    for (const device of memberDevices) {
      await storage.updateSatelliteDevice(device.id, {
        killSwitchActive: true,
        killSwitchReason: reason,
        status: 'LOCKED',
        accessTier: 'RESTRICTED',
      });
    }

    const log = await storage.createKillSwitchLog({
      action: 'REVOKE_ACCESS',
      targetType: 'MEMBER',
      targetId: memberId,
      targetName: member.name,
      reason,
      severity: 'HIGH',
      initiatedBy,
      permissionsRevoked: true,
      affectedData: { deviceCount: memberDevices.length },
      reversible: true,
    });

    return {
      success: true,
      action: 'REVOKE_ACCESS',
      targetId: memberId,
      targetType: 'MEMBER',
      message: `成员 ${member.name} 权限已回收，关联 ${memberDevices.length} 台设备已锁定`,
      reversible: true,
      logId: log.id,
    };
  }

  async restoreAccess(
    logId: string,
    restoredBy: string = 'MASTER'
  ): Promise<{ success: boolean; message: string }> {
    const logs = await storage.getKillSwitchLogs(100);
    const log = logs.find(l => l.id === logId);
    
    if (!log) {
      return { success: false, message: '熔断记录不存在' };
    }

    if (!log.reversible) {
      return { success: false, message: '此操作不可逆转' };
    }

    if (log.reversedAt) {
      return { success: false, message: '权限已恢复' };
    }

    if (log.targetType === 'DEVICE' && log.targetId) {
      await storage.updateSatelliteDevice(log.targetId, {
        killSwitchActive: false,
        killSwitchReason: null,
        status: 'OFFLINE',
        accessTier: 'BASIC',
      });
    } else if (log.targetType === 'MEMBER' && log.targetId) {
      await storage.updateTeamMember(log.targetId, {
        accessTier: 'BASIC',
        isActive: true,
      });
    }

    await storage.updateKillSwitchLog(logId, {
      reversedAt: new Date(),
      reversedBy: restoredBy,
    });

    return {
      success: true,
      message: `${log.targetName} 权限已恢复`,
    };
  }

  async getKillSwitchStatus(deviceId: string): Promise<{
    isActive: boolean;
    reason?: string;
    activatedAt?: Date;
    severity?: string;
  }> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) {
      return { isActive: false };
    }

    return {
      isActive: device.killSwitchActive || false,
      reason: device.killSwitchReason || undefined,
      activatedAt: device.killSwitchAt || undefined,
    };
  }

  async getLogs(limit: number = 50): Promise<any[]> {
    return await storage.getKillSwitchLogs(limit);
  }
}

export const killSwitchService = new KillSwitchService();
