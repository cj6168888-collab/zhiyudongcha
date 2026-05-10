/**
 * 小智 Privacy Grading Service - 动态隐私分级系统
 * 
 * 功能：
 * 1. 绿区模式 - 全透明，完整监控
 * 2. 红区模式 - 隐私保护，最小化采集
 * 3. 动态切换 - 根据时间/地点/活动自动调整
 * 4. 设备级别控制 - 不同设备可有不同隐私等级
 * 
 * 隐私分级：
 * - GREEN_FULL: 全透明模式，采集所有数据
 * - GREEN_WORK: 工作时间模式，采集工作相关数据
 * - AMBER_LIMITED: 有限采集模式，仅关键数据
 * - RED_MINIMAL: 最小采集模式，仅安全相关
 * - RED_BLACKOUT: 完全隐私，不采集任何数据
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('PrivacyGrading');

import { getDatabase } from '../db';
import { satelliteDevices, teamMembers, auditLogs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type PrivacyLevel = 'GREEN_FULL' | 'GREEN_WORK' | 'AMBER_LIMITED' | 'RED_MINIMAL' | 'RED_BLACKOUT';

interface PrivacyRule {
  id: string;
  name: string;
  level: PrivacyLevel;
  conditions: {
    timeRanges?: Array<{ start: string; end: string }>;
    locations?: string[];
    activities?: string[];
    weekdays?: number[];
  };
  priority: number;
  isActive: boolean;
}

interface PrivacyConfig {
  defaultLevel: PrivacyLevel;
  rules: PrivacyRule[];
  overrideUntil?: Date;
  overrideLevel?: PrivacyLevel;
}

interface DataCollectionPolicy {
  collectLocation: boolean;
  collectScreenshots: boolean;
  collectAppUsage: boolean;
  collectCommunication: boolean;
  collectBiometrics: boolean;
  screenshotInterval: number;
  locationPrecision: 'high' | 'medium' | 'low' | 'none';
}

const LEVEL_POLICIES: Record<PrivacyLevel, DataCollectionPolicy> = {
  GREEN_FULL: {
    collectLocation: true,
    collectScreenshots: true,
    collectAppUsage: true,
    collectCommunication: true,
    collectBiometrics: true,
    screenshotInterval: 60,
    locationPrecision: 'high',
  },
  GREEN_WORK: {
    collectLocation: true,
    collectScreenshots: true,
    collectAppUsage: true,
    collectCommunication: false,
    collectBiometrics: false,
    screenshotInterval: 300,
    locationPrecision: 'medium',
  },
  AMBER_LIMITED: {
    collectLocation: true,
    collectScreenshots: false,
    collectAppUsage: true,
    collectCommunication: false,
    collectBiometrics: false,
    screenshotInterval: 0,
    locationPrecision: 'low',
  },
  RED_MINIMAL: {
    collectLocation: true,
    collectScreenshots: false,
    collectAppUsage: false,
    collectCommunication: false,
    collectBiometrics: false,
    screenshotInterval: 0,
    locationPrecision: 'low',
  },
  RED_BLACKOUT: {
    collectLocation: false,
    collectScreenshots: false,
    collectAppUsage: false,
    collectCommunication: false,
    collectBiometrics: false,
    screenshotInterval: 0,
    locationPrecision: 'none',
  },
};

class PrivacyGradingService {
  private deviceConfigs: Map<string, PrivacyConfig> = new Map();
  private globalRules: PrivacyRule[] = [];

  async initializeDevice(deviceId: string, memberId?: string): Promise<PrivacyConfig> {
    let defaultLevel: PrivacyLevel = 'GREEN_WORK';
    
    if (memberId) {
      const [member] = await getDatabase().select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
      if (member) {
        defaultLevel = this.getTierDefaultLevel(member.accessTier as string);
      }
    }

    const config: PrivacyConfig = {
      defaultLevel,
      rules: [...this.globalRules],
    };

    this.deviceConfigs.set(deviceId, config);
    return config;
  }

  private getTierDefaultLevel(tier: string): PrivacyLevel {
    switch (tier) {
      case 'CORE': return 'GREEN_WORK';
      case 'TRUSTED': return 'GREEN_WORK';
      case 'STANDARD': return 'AMBER_LIMITED';
      case 'PROBATION': return 'GREEN_FULL';
      case 'RESTRICTED': return 'GREEN_FULL';
      default: return 'GREEN_WORK';
    }
  }

  async getCurrentLevel(deviceId: string): Promise<{
    level: PrivacyLevel;
    policy: DataCollectionPolicy;
    reason: string;
    activeRule?: string;
  }> {
    const config = this.deviceConfigs.get(deviceId);
    
    if (!config) {
      return {
        level: 'GREEN_WORK',
        policy: LEVEL_POLICIES['GREEN_WORK'],
        reason: '设备未注册，使用默认模式',
      };
    }

    if (config.overrideUntil && new Date() < config.overrideUntil && config.overrideLevel) {
      return {
        level: config.overrideLevel,
        policy: LEVEL_POLICIES[config.overrideLevel],
        reason: `临时覆盖模式，有效期至 ${config.overrideUntil.toLocaleString()}`,
      };
    }

    const activeRule = this.findActiveRule(config.rules);
    if (activeRule) {
      return {
        level: activeRule.level,
        policy: LEVEL_POLICIES[activeRule.level],
        reason: `规则触发: ${activeRule.name}`,
        activeRule: activeRule.id,
      };
    }

    return {
      level: config.defaultLevel,
      policy: LEVEL_POLICIES[config.defaultLevel],
      reason: '使用默认隐私等级',
    };
  }

  private findActiveRule(rules: PrivacyRule[]): PrivacyRule | null {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const currentWeekday = now.getDay();

    const activeRules = rules
      .filter(rule => rule.isActive)
      .filter(rule => {
        if (rule.conditions.weekdays && rule.conditions.weekdays.length > 0) {
          if (!rule.conditions.weekdays.includes(currentWeekday)) {
            return false;
          }
        }

        if (rule.conditions.timeRanges && rule.conditions.timeRanges.length > 0) {
          const inTimeRange = rule.conditions.timeRanges.some(range => {
            return currentTime >= range.start && currentTime <= range.end;
          });
          if (!inTimeRange) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    return activeRules.length > 0 ? activeRules[0] : null;
  }

  async setTemporaryOverride(
    deviceId: string,
    level: PrivacyLevel,
    durationMinutes: number,
    reason: string,
    operatorId: string
  ): Promise<boolean> {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      return false;
    }

    config.overrideLevel = level;
    config.overrideUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await this.logPrivacyChange(deviceId, level, reason, operatorId, 'OVERRIDE');

    return true;
  }

  async clearOverride(deviceId: string, operatorId: string): Promise<boolean> {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      return false;
    }

    const previousLevel = config.overrideLevel;
    config.overrideLevel = undefined;
    config.overrideUntil = undefined;

    await this.logPrivacyChange(deviceId, config.defaultLevel, '取消临时覆盖', operatorId, 'CLEAR_OVERRIDE');

    return true;
  }

  async addRule(deviceId: string, rule: Omit<PrivacyRule, 'id'>): Promise<PrivacyRule> {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      throw new Error('设备未注册');
    }

    const newRule: PrivacyRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    config.rules.push(newRule);
    return newRule;
  }

  async removeRule(deviceId: string, ruleId: string): Promise<boolean> {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      return false;
    }

    const index = config.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      config.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  async addGlobalRule(rule: Omit<PrivacyRule, 'id'>): Promise<PrivacyRule> {
    const newRule: PrivacyRule = {
      ...rule,
      id: `global_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.globalRules.push(newRule);

    for (const [, config] of Array.from(this.deviceConfigs.entries())) {
      config.rules.push({ ...newRule });
    }

    return newRule;
  }

  async getDeviceStatus(deviceId: string): Promise<{
    deviceId: string;
    currentLevel: PrivacyLevel;
    policy: DataCollectionPolicy;
    hasOverride: boolean;
    overrideExpiry?: Date;
    ruleCount: number;
  } | null> {
    const current = await this.getCurrentLevel(deviceId);
    const config = this.deviceConfigs.get(deviceId);

    if (!config) {
      return null;
    }

    return {
      deviceId,
      currentLevel: current.level,
      policy: current.policy,
      hasOverride: !!(config.overrideUntil && new Date() < config.overrideUntil),
      overrideExpiry: config.overrideUntil,
      ruleCount: config.rules.length,
    };
  }

  async getAllDevicesStatus(): Promise<Array<{
    deviceId: string;
    currentLevel: PrivacyLevel;
    hasOverride: boolean;
  }>> {
    const results = [];

    for (const [deviceId] of Array.from(this.deviceConfigs.entries())) {
      const current = await this.getCurrentLevel(deviceId);
      const config = this.deviceConfigs.get(deviceId);

      results.push({
        deviceId,
        currentLevel: current.level,
        hasOverride: !!(config?.overrideUntil && new Date() < config.overrideUntil),
      });
    }

    return results;
  }

  async emergencyBlackout(deviceIds: string[], reason: string, operatorId: string): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const deviceId of deviceIds) {
      const result = await this.setTemporaryOverride(
        deviceId,
        'RED_BLACKOUT',
        60,
        `紧急隐私保护: ${reason}`,
        operatorId
      );
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  async emergencyFullAccess(deviceIds: string[], reason: string, operatorId: string): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const deviceId of deviceIds) {
      const result = await this.setTemporaryOverride(
        deviceId,
        'GREEN_FULL',
        60,
        `紧急监控: ${reason}`,
        operatorId
      );
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  private async logPrivacyChange(
    deviceId: string,
    newLevel: PrivacyLevel,
    reason: string,
    operatorId: string,
    action: string
  ): Promise<void> {
    try {
      await getDatabase().insert(auditLogs).values({
        actor: operatorId,
        action: `PRIVACY_${action}`,
        targetType: 'DEVICE',
        targetId: deviceId,
        details: {
          newLevel,
          reason,
          timestamp: new Date().toISOString(),
        },
        result: 'SUCCESS',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log privacy change');
    }
  }

  getPolicy(level: PrivacyLevel): DataCollectionPolicy {
    return LEVEL_POLICIES[level];
  }

  getLevelDescription(level: PrivacyLevel): string {
    const descriptions: Record<PrivacyLevel, string> = {
      GREEN_FULL: '全透明模式 - 采集所有数据用于安全监控',
      GREEN_WORK: '工作模式 - 采集工作相关数据，保护个人通讯',
      AMBER_LIMITED: '有限模式 - 仅采集位置和应用使用情况',
      RED_MINIMAL: '最小模式 - 仅采集基本安全数据',
      RED_BLACKOUT: '完全隐私 - 不采集任何数据',
    };
    return descriptions[level];
  }
}

export const privacyGradingService = new PrivacyGradingService();
