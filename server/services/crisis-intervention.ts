/**
 * 小智 Crisis Intervention Service - 危机介入系统
 * 
 * 功能：
 * 1. 静默取证 - 隐蔽收集关键证据
 * 2. 物理封印 - 设备锁定与功能禁用
 * 3. 证据链保全 - 带时间戳和哈希的证据存储
 * 4. 远程设备控制 - 紧急远程操作
 * 
 * 危机级别：
 * - LEVEL_1_WATCH: 观察级，仅增强监控
 * - LEVEL_2_ALERT: 警戒级，开始取证
 * - LEVEL_3_ACTIVE: 主动级，锁定部分功能
 * - LEVEL_4_LOCKDOWN: 封锁级，完全锁定设备
 * - LEVEL_5_EXTRACTION: 撤离级，紧急数据转移
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CrisisIntervention');

import { getDatabase } from '../db';
import { auditLogs, satelliteDevices, teamMembers } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

export type CrisisLevel = 'LEVEL_1_WATCH' | 'LEVEL_2_ALERT' | 'LEVEL_3_ACTIVE' | 'LEVEL_4_LOCKDOWN' | 'LEVEL_5_EXTRACTION';

export type EvidenceType = 'SCREENSHOT' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'COMMUNICATION' | 'LOCATION' | 'APP_DATA' | 'SYSTEM_LOG';

interface Evidence {
  id: string;
  type: EvidenceType;
  deviceId: string;
  memberId?: string;
  hash: string;
  timestamp: Date;
  description: string;
  dataPath: string;
  metadata: Record<string, unknown>;
  chainHash: string;
  previousHash: string;
  verified: boolean;
}

interface CrisisCase {
  id: string;
  name: string;
  level: CrisisLevel;
  status: 'ACTIVE' | 'RESOLVED' | 'ESCALATED' | 'ARCHIVED';
  targetDevices: string[];
  targetMembers: string[];
  evidence: Evidence[];
  timeline: CrisisEvent[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  createdBy: string;
}

interface CrisisEvent {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
  result: 'SUCCESS' | 'FAILED' | 'PENDING';
}

interface DeviceLockdown {
  deviceId: string;
  lockLevel: 'PARTIAL' | 'FULL';
  lockedFunctions: string[];
  allowedFunctions: string[];
  lockMessage: string;
  unlockedAt?: Date;
}

interface RemoteCommand {
  id: string;
  deviceId: string;
  command: string;
  params: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'EXECUTED' | 'FAILED';
  result?: unknown;
  issuedAt: Date;
  executedAt?: Date;
}

const LEVEL_ACTIONS: Record<CrisisLevel, {
  autoEvidence: EvidenceType[];
  lockFunctions: string[];
  alertLevel: 'SILENT' | 'DISCRETE' | 'VISIBLE';
}> = {
  LEVEL_1_WATCH: {
    autoEvidence: ['SYSTEM_LOG', 'LOCATION'],
    lockFunctions: [],
    alertLevel: 'SILENT',
  },
  LEVEL_2_ALERT: {
    autoEvidence: ['SCREENSHOT', 'SYSTEM_LOG', 'LOCATION', 'APP_DATA'],
    lockFunctions: [],
    alertLevel: 'SILENT',
  },
  LEVEL_3_ACTIVE: {
    autoEvidence: ['SCREENSHOT', 'AUDIO', 'SYSTEM_LOG', 'LOCATION', 'APP_DATA', 'COMMUNICATION'],
    lockFunctions: ['USB_TRANSFER', 'BLUETOOTH', 'SCREEN_SHARE'],
    alertLevel: 'DISCRETE',
  },
  LEVEL_4_LOCKDOWN: {
    autoEvidence: ['SCREENSHOT', 'AUDIO', 'VIDEO', 'SYSTEM_LOG', 'LOCATION', 'APP_DATA', 'COMMUNICATION', 'DOCUMENT'],
    lockFunctions: ['USB_TRANSFER', 'BLUETOOTH', 'SCREEN_SHARE', 'CAMERA', 'MICROPHONE', 'NETWORK_EXTERNAL', 'CLIPBOARD'],
    alertLevel: 'DISCRETE',
  },
  LEVEL_5_EXTRACTION: {
    autoEvidence: ['SCREENSHOT', 'AUDIO', 'VIDEO', 'SYSTEM_LOG', 'LOCATION', 'APP_DATA', 'COMMUNICATION', 'DOCUMENT'],
    lockFunctions: ['ALL'],
    alertLevel: 'VISIBLE',
  },
};

class CrisisInterventionService {
  private activeCases: Map<string, CrisisCase> = new Map();
  private deviceLockdowns: Map<string, DeviceLockdown> = new Map();
  private pendingCommands: Map<string, RemoteCommand[]> = new Map();
  private evidenceChain: Evidence[] = [];
  private lastChainHash: string = '0'.repeat(64);

  async createCrisis(params: {
    name: string;
    level: CrisisLevel;
    targetDevices: string[];
    targetMembers?: string[];
    reason: string;
    createdBy: string;
  }): Promise<CrisisCase> {
    const crisisCase: CrisisCase = {
      id: `crisis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name: params.name,
      level: params.level,
      status: 'ACTIVE',
      targetDevices: params.targetDevices,
      targetMembers: params.targetMembers || [],
      evidence: [],
      timeline: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: params.createdBy,
    };

    this.addTimelineEvent(crisisCase, {
      action: 'CRISIS_CREATED',
      actor: params.createdBy,
      details: `危机案例创建: ${params.name}, 级别: ${params.level}, 原因: ${params.reason}`,
      result: 'SUCCESS',
    });

    this.activeCases.set(crisisCase.id, crisisCase);

    const levelActions = LEVEL_ACTIONS[params.level];
    for (const deviceId of params.targetDevices) {
      if (levelActions.lockFunctions.length > 0) {
        await this.lockDevice(crisisCase.id, deviceId, levelActions.lockFunctions, params.createdBy);
      }

      await this.startSilentEvidence(crisisCase.id, deviceId, levelActions.autoEvidence, params.createdBy);
    }

    await this.logCrisisAction(crisisCase.id, 'CREATE', params.createdBy, {
      name: params.name,
      level: params.level,
      targetDevices: params.targetDevices,
      reason: params.reason,
    });

    return crisisCase;
  }

  async escalateCrisis(crisisId: string, newLevel: CrisisLevel, reason: string, operatorId: string): Promise<boolean> {
    const crisis = this.activeCases.get(crisisId);
    if (!crisis || crisis.status !== 'ACTIVE') {
      return false;
    }

    const oldLevel = crisis.level;
    crisis.level = newLevel;
    crisis.updatedAt = new Date();

    this.addTimelineEvent(crisis, {
      action: 'CRISIS_ESCALATED',
      actor: operatorId,
      details: `危机升级: ${oldLevel} → ${newLevel}, 原因: ${reason}`,
      result: 'SUCCESS',
    });

    const levelActions = LEVEL_ACTIONS[newLevel];
    for (const deviceId of crisis.targetDevices) {
      if (levelActions.lockFunctions.length > 0) {
        await this.lockDevice(crisisId, deviceId, levelActions.lockFunctions, operatorId);
      }
    }

    await this.logCrisisAction(crisisId, 'ESCALATE', operatorId, {
      oldLevel,
      newLevel,
      reason,
    });

    return true;
  }

  async resolveCrisis(crisisId: string, resolution: string, operatorId: string): Promise<boolean> {
    const crisis = this.activeCases.get(crisisId);
    if (!crisis || crisis.status !== 'ACTIVE') {
      return false;
    }

    crisis.status = 'RESOLVED';
    crisis.resolvedAt = new Date();
    crisis.updatedAt = new Date();

    this.addTimelineEvent(crisis, {
      action: 'CRISIS_RESOLVED',
      actor: operatorId,
      details: `危机解除: ${resolution}`,
      result: 'SUCCESS',
    });

    for (const deviceId of crisis.targetDevices) {
      await this.unlockDevice(crisisId, deviceId, operatorId);
    }

    await this.logCrisisAction(crisisId, 'RESOLVE', operatorId, {
      resolution,
    });

    return true;
  }

  async startSilentEvidence(
    crisisId: string,
    deviceId: string,
    types: EvidenceType[],
    operatorId: string
  ): Promise<{ started: EvidenceType[]; failed: EvidenceType[] }> {
    const crisis = this.activeCases.get(crisisId);
    if (!crisis) {
      return { started: [], failed: types };
    }

    const started: EvidenceType[] = [];
    const failed: EvidenceType[] = [];

    for (const type of types) {
      try {
        const command = await this.issueRemoteCommand(deviceId, `START_EVIDENCE_${type}`, {
          crisisId,
          type,
          silent: true,
        });

        started.push(type);

        this.addTimelineEvent(crisis, {
          action: 'EVIDENCE_COLLECTION_STARTED',
          actor: operatorId,
          details: `开始收集证据: ${type} on ${deviceId}`,
          result: 'SUCCESS',
        });
      } catch (error) {
        failed.push(type);
      }
    }

    return { started, failed };
  }

  async collectEvidence(params: {
    crisisId: string;
    deviceId: string;
    type: EvidenceType;
    description: string;
    dataPath: string;
    metadata?: Record<string, unknown>;
    operatorId: string;
  }): Promise<Evidence> {
    const crisis = this.activeCases.get(params.crisisId);
    if (!crisis) {
      throw new Error('危机案例不存在');
    }

    const dataHash = crypto.createHash('sha256').update(params.dataPath + Date.now()).digest('hex');

    const chainInput = `${this.lastChainHash}${dataHash}${new Date().toISOString()}`;
    const chainHash = crypto.createHash('sha256').update(chainInput).digest('hex');

    const evidence: Evidence = {
      id: `evidence_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type: params.type,
      deviceId: params.deviceId,
      hash: dataHash,
      timestamp: new Date(),
      description: params.description,
      dataPath: params.dataPath,
      metadata: params.metadata || {},
      chainHash,
      previousHash: this.lastChainHash,
      verified: true,
    };

    this.lastChainHash = chainHash;
    this.evidenceChain.push(evidence);
    crisis.evidence.push(evidence);
    crisis.updatedAt = new Date();

    this.addTimelineEvent(crisis, {
      action: 'EVIDENCE_COLLECTED',
      actor: params.operatorId,
      details: `证据收集: ${params.type} - ${params.description}`,
      result: 'SUCCESS',
    });

    await this.logCrisisAction(params.crisisId, 'COLLECT_EVIDENCE', params.operatorId, {
      evidenceId: evidence.id,
      type: params.type,
      hash: dataHash,
    });

    return evidence;
  }

  async lockDevice(
    crisisId: string,
    deviceId: string,
    functions: string[],
    operatorId: string
  ): Promise<DeviceLockdown> {
    const isFullLock = functions.includes('ALL');

    const lockdown: DeviceLockdown = {
      deviceId,
      lockLevel: isFullLock ? 'FULL' : 'PARTIAL',
      lockedFunctions: isFullLock ? ['ALL'] : functions,
      allowedFunctions: isFullLock ? [] : ['EMERGENCY_CALL', 'BASIC_DISPLAY'],
      lockMessage: '设备已被安全系统锁定，请联系管理员',
    };

    this.deviceLockdowns.set(deviceId, lockdown);

    await this.issueRemoteCommand(deviceId, 'LOCK_DEVICE', {
      crisisId,
      lockLevel: lockdown.lockLevel,
      lockedFunctions: lockdown.lockedFunctions,
      message: lockdown.lockMessage,
    });

    const crisis = this.activeCases.get(crisisId);
    if (crisis) {
      this.addTimelineEvent(crisis, {
        action: 'DEVICE_LOCKED',
        actor: operatorId,
        details: `设备锁定: ${deviceId}, 级别: ${lockdown.lockLevel}`,
        result: 'SUCCESS',
      });
    }

    await this.logCrisisAction(crisisId, 'LOCK_DEVICE', operatorId, {
      deviceId,
      lockLevel: lockdown.lockLevel,
      functions,
    });

    return lockdown;
  }

  async unlockDevice(crisisId: string, deviceId: string, operatorId: string): Promise<boolean> {
    const lockdown = this.deviceLockdowns.get(deviceId);
    if (!lockdown) {
      return false;
    }

    lockdown.unlockedAt = new Date();
    this.deviceLockdowns.delete(deviceId);

    await this.issueRemoteCommand(deviceId, 'UNLOCK_DEVICE', {
      crisisId,
    });

    const crisis = this.activeCases.get(crisisId);
    if (crisis) {
      this.addTimelineEvent(crisis, {
        action: 'DEVICE_UNLOCKED',
        actor: operatorId,
        details: `设备解锁: ${deviceId}`,
        result: 'SUCCESS',
      });
    }

    await this.logCrisisAction(crisisId, 'UNLOCK_DEVICE', operatorId, {
      deviceId,
    });

    return true;
  }

  async issueRemoteCommand(
    deviceId: string,
    command: string,
    params: Record<string, unknown>
  ): Promise<RemoteCommand> {
    const cmd: RemoteCommand = {
      id: `cmd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      deviceId,
      command,
      params,
      status: 'PENDING',
      issuedAt: new Date(),
    };

    const deviceCommands = this.pendingCommands.get(deviceId) || [];
    deviceCommands.push(cmd);
    this.pendingCommands.set(deviceId, deviceCommands);

    return cmd;
  }

  async getPendingCommands(deviceId: string): Promise<RemoteCommand[]> {
    return this.pendingCommands.get(deviceId) || [];
  }

  async confirmCommandExecution(commandId: string, deviceId: string, result: unknown): Promise<boolean> {
    const commands = this.pendingCommands.get(deviceId);
    if (!commands) {
      return false;
    }

    const cmd = commands.find(c => c.id === commandId);
    if (!cmd) {
      return false;
    }

    cmd.status = 'EXECUTED';
    cmd.result = result;
    cmd.executedAt = new Date();

    return true;
  }

  async getActiveCrises(): Promise<CrisisCase[]> {
    return Array.from(this.activeCases.values()).filter(c => c.status === 'ACTIVE');
  }

  async getCrisisById(crisisId: string): Promise<CrisisCase | null> {
    return this.activeCases.get(crisisId) || null;
  }

  async getCrisisEvidence(crisisId: string): Promise<Evidence[]> {
    const crisis = this.activeCases.get(crisisId);
    return crisis?.evidence || [];
  }

  async verifyEvidenceChain(crisisId: string): Promise<{
    valid: boolean;
    totalEvidence: number;
    verifiedCount: number;
    brokenAt?: number;
  }> {
    const crisis = this.activeCases.get(crisisId);
    if (!crisis) {
      return { valid: false, totalEvidence: 0, verifiedCount: 0 };
    }

    let previousHash = '0'.repeat(64);
    let verifiedCount = 0;

    for (let i = 0; i < crisis.evidence.length; i++) {
      const evidence = crisis.evidence[i];

      if (evidence.previousHash !== previousHash) {
        return {
          valid: false,
          totalEvidence: crisis.evidence.length,
          verifiedCount,
          brokenAt: i,
        };
      }

      const chainInput = `${previousHash}${evidence.hash}${evidence.timestamp.toISOString()}`;
      const expectedChainHash = crypto.createHash('sha256').update(chainInput).digest('hex');

      if (evidence.chainHash !== expectedChainHash) {
        return {
          valid: false,
          totalEvidence: crisis.evidence.length,
          verifiedCount,
          brokenAt: i,
        };
      }

      previousHash = evidence.chainHash;
      verifiedCount++;
    }

    return {
      valid: true,
      totalEvidence: crisis.evidence.length,
      verifiedCount,
    };
  }

  getDeviceLockStatus(deviceId: string): DeviceLockdown | null {
    return this.deviceLockdowns.get(deviceId) || null;
  }

  async getCrisisStats(): Promise<{
    activeCrises: number;
    lockedDevices: number;
    totalEvidence: number;
    levelBreakdown: Record<CrisisLevel, number>;
  }> {
    const active = Array.from(this.activeCases.values()).filter(c => c.status === 'ACTIVE');

    const levelBreakdown: Record<CrisisLevel, number> = {
      LEVEL_1_WATCH: 0,
      LEVEL_2_ALERT: 0,
      LEVEL_3_ACTIVE: 0,
      LEVEL_4_LOCKDOWN: 0,
      LEVEL_5_EXTRACTION: 0,
    };

    let totalEvidence = 0;

    for (const crisis of active) {
      levelBreakdown[crisis.level]++;
      totalEvidence += crisis.evidence.length;
    }

    return {
      activeCrises: active.length,
      lockedDevices: this.deviceLockdowns.size,
      totalEvidence,
      levelBreakdown,
    };
  }

  private addTimelineEvent(crisis: CrisisCase, event: Omit<CrisisEvent, 'id' | 'timestamp'>): void {
    crisis.timeline.push({
      id: `event_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      ...event,
    });
  }

  private async logCrisisAction(
    crisisId: string,
    action: string,
    operatorId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await getDatabase().insert(auditLogs).values({
        actor: operatorId,
        action: `CRISIS_${action}`,
        targetType: 'CRISIS',
        targetId: crisisId,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
        },
        result: 'SUCCESS',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log action');
    }
  }

  getLevelDescription(level: CrisisLevel): string {
    const descriptions: Record<CrisisLevel, string> = {
      LEVEL_1_WATCH: '观察级 - 增强监控，被动收集信息',
      LEVEL_2_ALERT: '警戒级 - 开始静默取证，准备干预',
      LEVEL_3_ACTIVE: '主动级 - 主动取证，限制部分功能',
      LEVEL_4_LOCKDOWN: '封锁级 - 全面取证，锁定大部分功能',
      LEVEL_5_EXTRACTION: '撤离级 - 紧急数据转移，完全锁定',
    };
    return descriptions[level];
  }
}

export const crisisInterventionService = new CrisisInterventionService();
