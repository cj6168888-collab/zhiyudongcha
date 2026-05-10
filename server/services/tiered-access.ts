import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('TieredAccess');

import { storage } from '../storage';
import type { AccessTier, TeamMember, SatelliteDevice } from '@shared/schema';

export interface TieredPermissions {
  allowedModules: string[];
  blockedModules: string[];
  maxHpPerDay: number;
  features: {
    negotiationAssist: boolean;
    lieDetection: boolean;
    contractBias: boolean;
    fullExpertAccess: boolean;
    dreamReview: boolean;
    killSwitchAccess: boolean;
    teamManagement: boolean;
    deviceManagement: boolean;
    loyaltyMonitor: boolean;
    cascadeSync: boolean;
  };
}

const TIER_PERMISSIONS: Record<AccessTier, TieredPermissions> = {
  PROFESSIONAL: {
    allowedModules: ['*'],
    blockedModules: [],
    maxHpPerDay: 10000,
    features: {
      negotiationAssist: true,
      lieDetection: true,
      contractBias: true,
      fullExpertAccess: true,
      dreamReview: true,
      killSwitchAccess: false,
      teamManagement: false,
      deviceManagement: false,
      loyaltyMonitor: false,
      cascadeSync: true,
    },
  },
  BASIC: {
    allowedModules: ['chat', 'document', 'schedule', 'translation'],
    blockedModules: ['expert', 'negotiation', 'lie-detection', 'contract-analysis'],
    maxHpPerDay: 1000,
    features: {
      negotiationAssist: false,
      lieDetection: false,
      contractBias: false,
      fullExpertAccess: false,
      dreamReview: false,
      killSwitchAccess: false,
      teamManagement: false,
      deviceManagement: false,
      loyaltyMonitor: false,
      cascadeSync: false,
    },
  },
  CUSTOM: {
    allowedModules: [],
    blockedModules: [],
    maxHpPerDay: 5000,
    features: {
      negotiationAssist: false,
      lieDetection: false,
      contractBias: false,
      fullExpertAccess: false,
      dreamReview: false,
      killSwitchAccess: false,
      teamManagement: false,
      deviceManagement: false,
      loyaltyMonitor: false,
      cascadeSync: false,
    },
  },
  RESTRICTED: {
    allowedModules: [],
    blockedModules: ['*'],
    maxHpPerDay: 0,
    features: {
      negotiationAssist: false,
      lieDetection: false,
      contractBias: false,
      fullExpertAccess: false,
      dreamReview: false,
      killSwitchAccess: false,
      teamManagement: false,
      deviceManagement: false,
      loyaltyMonitor: false,
      cascadeSync: false,
    },
  },
};

const MASTER_PERMISSIONS: TieredPermissions = {
  allowedModules: ['*'],
  blockedModules: [],
  maxHpPerDay: Infinity,
  features: {
    negotiationAssist: true,
    lieDetection: true,
    contractBias: true,
    fullExpertAccess: true,
    dreamReview: true,
    killSwitchAccess: true,
    teamManagement: true,
    deviceManagement: true,
    loyaltyMonitor: true,
    cascadeSync: true,
  },
};

class TieredAccessService {
  getTierPermissions(tier: AccessTier): TieredPermissions {
    return TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.BASIC;
  }

  getMasterPermissions(): TieredPermissions {
    return MASTER_PERMISSIONS;
  }

  getEffectivePermissions(
    tier: AccessTier,
    customPermissions?: string[],
    customModules?: { allowed?: string[]; blocked?: string[] }
  ): TieredPermissions {
    const base = { ...this.getTierPermissions(tier) };

    if (tier === 'CUSTOM' && customModules) {
      base.allowedModules = customModules.allowed || [];
      base.blockedModules = customModules.blocked || [];
    }

    if (customPermissions) {
      for (const perm of customPermissions) {
        const [feature, value] = perm.split(':');
        if (feature in base.features) {
          (base.features as any)[feature] = value === 'true';
        }
      }
    }

    return base;
  }

  canAccessModule(permissions: TieredPermissions, moduleName: string): boolean {
    if (permissions.blockedModules.includes('*')) {
      return false;
    }
    if (permissions.blockedModules.includes(moduleName)) {
      return false;
    }
    if (permissions.allowedModules.includes('*')) {
      return true;
    }
    return permissions.allowedModules.includes(moduleName);
  }

  hasFeature(permissions: TieredPermissions, feature: keyof TieredPermissions['features']): boolean {
    return permissions.features[feature] === true;
  }

  async getMemberPermissions(memberId: string): Promise<TieredPermissions | null> {
    const member = await storage.getTeamMember(memberId);
    if (!member) return null;

    return this.getEffectivePermissions(
      (member.accessTier as AccessTier) || 'BASIC',
      member.customPermissions || undefined,
      {
        allowed: member.industryKnowledge || undefined,
        blocked: undefined,
      }
    );
  }

  async getDevicePermissions(deviceId: string): Promise<TieredPermissions | null> {
    const device = await storage.getSatelliteDevice(deviceId);
    if (!device) return null;

    if (device.killSwitchActive) {
      return TIER_PERMISSIONS.RESTRICTED;
    }

    return this.getEffectivePermissions(
      (device.accessTier as AccessTier) || 'BASIC',
      undefined,
      {
        allowed: device.allowedModules || undefined,
        blocked: device.blockedModules || undefined,
      }
    );
  }

  async updateMemberTier(memberId: string, newTier: AccessTier): Promise<boolean> {
    const updated = await storage.updateTeamMember(memberId, {
      accessTier: newTier,
    });
    return !!updated;
  }

  async updateDeviceTier(deviceId: string, newTier: AccessTier): Promise<boolean> {
    const updated = await storage.updateSatelliteDevice(deviceId, {
      accessTier: newTier,
    });
    return !!updated;
  }

  async grantCustomPermission(memberId: string, permission: string): Promise<boolean> {
    const member = await storage.getTeamMember(memberId);
    if (!member) return false;

    const currentPerms = member.customPermissions || [];
    if (!currentPerms.includes(permission)) {
      currentPerms.push(permission);
      await storage.updateTeamMember(memberId, {
        customPermissions: currentPerms,
      });
    }
    return true;
  }

  async revokeCustomPermission(memberId: string, permission: string): Promise<boolean> {
    const member = await storage.getTeamMember(memberId);
    if (!member) return false;

    const currentPerms = member.customPermissions || [];
    const index = currentPerms.indexOf(permission);
    if (index > -1) {
      currentPerms.splice(index, 1);
      await storage.updateTeamMember(memberId, {
        customPermissions: currentPerms,
      });
    }
    return true;
  }

  getTierDisplayName(tier: AccessTier): string {
    const names: Record<AccessTier, string> = {
      PROFESSIONAL: '专业版 (Professional)',
      BASIC: '基础版 (Basic)',
      CUSTOM: '定制版 (Custom)',
      RESTRICTED: '受限版 (Restricted)',
    };
    return names[tier] || tier;
  }

  getTierDescription(tier: AccessTier): string {
    const descriptions: Record<AccessTier, string> = {
      PROFESSIONAL: '完整功能：谈判辅助、谎言识别、合同偏向性分析',
      BASIC: '基础功能：环境净化、文档整理、简单合规检查',
      CUSTOM: '定制功能：行业专属知识库，按需配置',
      RESTRICTED: '功能受限：等待审核或权限已被回收',
    };
    return descriptions[tier] || '';
  }
}

export const tieredAccessService = new TieredAccessService();
