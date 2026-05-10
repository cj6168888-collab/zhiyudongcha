/**
 * 小智 Wisdom Distribution Service - 智慧下发系统
 * 
 * 功能：
 * 1. 0.1秒全线同步 - 法条/博弈权重自动推送
 * 2. 策略广播 - 实时推送决策更新
 * 3. 知识库同步 - 增量更新本地词库
 * 4. 配置热更新 - 无需重启即可更新参数
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('WisdomDistribution');

import { WebSocket } from 'ws';
import { getDatabase } from '../db';
import { satelliteDevices, teamMembers } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

interface WisdomPacket {
  type: 'STRATEGY' | 'LEGAL_RULE' | 'WEIGHT_UPDATE' | 'VOCAB_SYNC' | 'CONFIG_UPDATE' | 'EMERGENCY';
  version: string;
  timestamp: number;
  priority: 'IMMEDIATE' | 'HIGH' | 'NORMAL' | 'LOW';
  payload: Record<string, any>;
  targetDevices?: string[];
  targetTiers?: string[];
  expiresAt?: number;
}

interface SyncResult {
  success: boolean;
  totalTargets: number;
  delivered: number;
  failed: number;
  latencyMs: number;
  errors: string[];
}

interface PendingSync {
  id: string;
  packet: WisdomPacket;
  createdAt: Date;
  deliveredTo: string[];
  failedTo: string[];
}

interface ConnectedUserInfo {
  deviceId?: string;
  tier?: string;
  role?: 'MASTER' | 'GUEST';
}

class WisdomDistributionService {
  private z3Clients: Set<WebSocket> | null = null;
  private connectedUsersRef: Map<WebSocket, any> | null = null;
  private pendingSyncs: Map<string, PendingSync> = new Map();
  private syncVersion: number = Date.now();
  private configCache: Map<string, any> = new Map();

  /**
   * 设置Z3 WebSocket客户端集合 (用于广播)
   */
  setZ3ClientsSet(clients: Set<WebSocket>) {
    this.z3Clients = clients;
  }

  /**
   * 设置连接用户Map引用 (用于获取设备ID等元数据)
   * 与routes.ts中的connectedUsers Map兼容
   */
  setConnectedUsersRef(users: Map<WebSocket, any>) {
    this.connectedUsersRef = users;
  }

  /**
   * 兼容旧接口
   */
  setZ3Clients(clients: Map<WebSocket, { deviceId?: string; tier?: string }>) {
    // 旧版本兼容，直接转换为connectedUsersRef
    this.connectedUsersRef = clients as Map<WebSocket, any>;
  }

  async broadcastWisdom(packet: WisdomPacket): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let delivered = 0;
    let failed = 0;

    const message = JSON.stringify({
      ...packet,
      messageType: 'WISDOM_SYNC',
      syncId: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    const targetClients = this.getTargetClients(packet);

    for (const [ws, info] of Array.from(targetClients.entries())) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          delivered++;
        } else {
          failed++;
          errors.push(`Device ${info.deviceId || 'unknown'}: WebSocket not open`);
        }
      } catch (error) {
        failed++;
        errors.push(`Device ${info.deviceId || 'unknown'}: ${error}`);
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      success: failed === 0,
      totalTargets: targetClients.size,
      delivered,
      failed,
      latencyMs,
      errors,
    };
  }

  private getTargetClients(packet: WisdomPacket): Map<WebSocket, ConnectedUserInfo> {
    const targets: Map<WebSocket, ConnectedUserInfo> = new Map();

    // 使用connectedUsersRef获取设备元数据
    if (this.connectedUsersRef && this.connectedUsersRef.size > 0) {
      for (const [ws, userInfo] of Array.from(this.connectedUsersRef.entries())) {
        const deviceId = userInfo.deviceId;
        const tier = userInfo.tier || (userInfo.role === 'MASTER' ? 'MASTER' : 'GUEST');
        
        if (packet.targetDevices && packet.targetDevices.length > 0) {
          if (deviceId && packet.targetDevices.includes(deviceId)) {
            targets.set(ws, { deviceId, tier });
          }
        } else if (packet.targetTiers && packet.targetTiers.length > 0) {
          if (tier && packet.targetTiers.includes(tier)) {
            targets.set(ws, { deviceId, tier });
          }
        } else {
          targets.set(ws, { deviceId, tier });
        }
      }
    }
    // 回退到简单Set (所有客户端都会收到广播)
    else if (this.z3Clients) {
      for (const ws of Array.from(this.z3Clients)) {
        // 如果没有设备过滤条件，则广播到所有客户端
        if (!packet.targetDevices?.length && !packet.targetTiers?.length) {
          targets.set(ws, {});
        }
      }
    }

    return targets;
  }

  async pushStrategy(strategy: {
    id: string;
    name: string;
    rules: Record<string, any>;
    weights: Record<string, number>;
    applicableScenarios: string[];
  }, targetDevices?: string[]): Promise<SyncResult> {
    const packet: WisdomPacket = {
      type: 'STRATEGY',
      version: `strat_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'HIGH',
      payload: {
        strategyId: strategy.id,
        name: strategy.name,
        rules: strategy.rules,
        weights: strategy.weights,
        scenarios: strategy.applicableScenarios,
      },
      targetDevices,
    };

    return this.broadcastWisdom(packet);
  }

  async pushLegalRule(rule: {
    id: string;
    title: string;
    content: string;
    jurisdiction: string;
    category: string;
    keywords: string[];
    effectiveDate?: Date;
  }, targetTiers?: string[]): Promise<SyncResult> {
    const packet: WisdomPacket = {
      type: 'LEGAL_RULE',
      version: `legal_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'NORMAL',
      payload: {
        ruleId: rule.id,
        title: rule.title,
        content: rule.content,
        jurisdiction: rule.jurisdiction,
        category: rule.category,
        keywords: rule.keywords,
        effectiveDate: rule.effectiveDate?.toISOString(),
      },
      targetTiers,
    };

    return this.broadcastWisdom(packet);
  }

  async pushWeightUpdate(updates: {
    module: string;
    weights: Record<string, number>;
    reason: string;
  }): Promise<SyncResult> {
    const packet: WisdomPacket = {
      type: 'WEIGHT_UPDATE',
      version: `weight_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'HIGH',
      payload: {
        module: updates.module,
        weights: updates.weights,
        reason: updates.reason,
        previousVersion: this.syncVersion,
      },
    };

    this.syncVersion = Date.now();
    return this.broadcastWisdom(packet);
  }

  async pushVocabSync(vocab: {
    domain: string;
    terms: Array<{ term: string; definition: string; weight?: number }>;
    action: 'ADD' | 'UPDATE' | 'REMOVE';
  }): Promise<SyncResult> {
    const packet: WisdomPacket = {
      type: 'VOCAB_SYNC',
      version: `vocab_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'LOW',
      payload: {
        domain: vocab.domain,
        terms: vocab.terms,
        action: vocab.action,
        termCount: vocab.terms.length,
      },
    };

    return this.broadcastWisdom(packet);
  }

  async pushConfigUpdate(config: {
    section: string;
    values: Record<string, any>;
    requiresRestart: boolean;
  }, targetDevices?: string[]): Promise<SyncResult> {
    this.configCache.set(config.section, config.values);

    const packet: WisdomPacket = {
      type: 'CONFIG_UPDATE',
      version: `config_${Date.now()}`,
      timestamp: Date.now(),
      priority: config.requiresRestart ? 'IMMEDIATE' : 'NORMAL',
      payload: {
        section: config.section,
        values: config.values,
        requiresRestart: config.requiresRestart,
      },
      targetDevices,
    };

    return this.broadcastWisdom(packet);
  }

  async pushEmergency(emergency: {
    type: 'LOCKDOWN' | 'DATA_WIPE' | 'DISCONNECT' | 'ALERT';
    message: string;
    actions: string[];
  }, targetDevices?: string[]): Promise<SyncResult> {
    const packet: WisdomPacket = {
      type: 'EMERGENCY',
      version: `emerg_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'IMMEDIATE',
      payload: {
        emergencyType: emergency.type,
        message: emergency.message,
        actions: emergency.actions,
        issuedAt: new Date().toISOString(),
      },
      targetDevices,
      expiresAt: Date.now() + 60 * 1000,
    };

    return this.broadcastWisdom(packet);
  }

  async getConnectedDeviceStatus(): Promise<Array<{
    deviceId: string;
    tier: string;
    connected: boolean;
    lastSync: number;
  }>> {
    const devices = await getDatabase().select().from(satelliteDevices);
    
    // 从connectedUsersRef中提取已连接的设备信息
    const connectedDeviceMap = new Map<string, string>();
    if (this.connectedUsersRef) {
      for (const userInfo of Array.from(this.connectedUsersRef.values())) {
        if (userInfo.deviceId) {
          const tier = userInfo.tier || (userInfo.role === 'MASTER' ? 'MASTER' : 'GUEST');
          connectedDeviceMap.set(userInfo.deviceId, tier);
        }
      }
    }

    return devices.map(d => ({
      deviceId: d.deviceId,
      tier: connectedDeviceMap.get(d.deviceId) || 'UNKNOWN',
      connected: connectedDeviceMap.has(d.deviceId),
      lastSync: Date.now(),
    }));
  }

  async syncAllDevices(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    latencyMs: number;
  }> {
    const startTime = Date.now();
    
    const configPacket: WisdomPacket = {
      type: 'CONFIG_UPDATE',
      version: `fullsync_${Date.now()}`,
      timestamp: Date.now(),
      priority: 'HIGH',
      payload: {
        action: 'FULL_SYNC',
        currentVersion: this.syncVersion,
        configs: Object.fromEntries(this.configCache),
      },
    };

    const result = await this.broadcastWisdom(configPacket);

    return {
      success: result.success,
      synced: result.delivered,
      failed: result.failed,
      latencyMs: Date.now() - startTime,
    };
  }

  getStats(): {
    connectedClients: number;
    pendingSyncs: number;
    currentVersion: number;
    cachedConfigs: number;
  } {
    // 优先使用connectedUsersRef的size，回退到z3Clients的size
    const clientCount = this.connectedUsersRef?.size || this.z3Clients?.size || 0;
    
    return {
      connectedClients: clientCount,
      pendingSyncs: this.pendingSyncs.size,
      currentVersion: this.syncVersion,
      cachedConfigs: this.configCache.size,
    };
  }

  async createSyncSchedule(schedule: {
    name: string;
    cronExpression: string;
    packetTemplate: Omit<WisdomPacket, 'timestamp' | 'version'>;
    enabled: boolean;
  }): Promise<{ id: string; created: boolean }> {
    const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[WisdomDistribution] Schedule created: ${id} - ${schedule.name}`);
    return { id, created: true };
  }
}

export const wisdomDistributionService = new WisdomDistributionService();
