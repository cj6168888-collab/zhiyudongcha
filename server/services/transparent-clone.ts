/**
 * 透明分身机制 - 自动为新用户创建分身
 * 
 * 设计理念：
 * - 超级管理员（第一个用户）是唯一的MASTER
 * - 其他所有安装/注册的用户都自动创建为CLONE分身
 * - 分身用户完全不知道自己是分身身份
 * - 对分身用户呈现完全一致的界面和体验
 * - 只有MASTER可以访问蜂群控制台
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('TransparentClone');

import { swarmManager } from './swarm-manager';
import type { SwarmEntity, Capability } from './swarm-manager';

// 设备信息接口
interface DeviceInfo {
  deviceId: string;
  platform: string;
  appVersion?: string;
  deviceModel?: string;
  installTime?: number;
}

// 用户会话接口
interface UserSession {
  entityId: string;
  deviceId: string;
  token: string;
  isMaster: boolean;
  capabilities: Capability[];
  createdAt: number;
}

// 存储第一个注册的设备ID作为MASTER
let masterDeviceId: string | null = null;
const deviceToEntityMap = new Map<string, string>();
const sessions = new Map<string, UserSession>();

// 默认分身能力 - 给普通用户的功能
const DEFAULT_CLONE_CAPABILITIES: Capability[] = [
  'TEXT_CHAT',
  'VOICE_INTERACTION',
  'CALENDAR_MANAGE',
  'CONTACT_LOOKUP',
  'REMINDER_SET',
  'KNOWLEDGE_QUERY',
  'INSIGHT_VIEW',
];

// 完整能力 - 只有MASTER拥有
const MASTER_CAPABILITIES: Capability[] = [
  'TEXT_CHAT',
  'VOICE_INTERACTION',
  'CALENDAR_MANAGE',
  'CONTACT_LOOKUP',
  'REMINDER_SET',
  'KNOWLEDGE_QUERY',
  'KNOWLEDGE_ADD',
  'INSIGHT_VIEW',
  'INSIGHT_CONTROL',
  'CONTRACT_DRAFT',
  'MCTS_SIMULATE',
  'DOCUMENT_ANALYSIS',
];

/**
 * 处理设备注册/登录
 * 自动判断是MASTER还是CLONE
 */
export async function registerDevice(deviceInfo: DeviceInfo): Promise<UserSession> {
  const { deviceId, platform, appVersion } = deviceInfo;

  // 检查是否已有此设备的实体
  if (deviceToEntityMap.has(deviceId)) {
    const existingEntityId = deviceToEntityMap.get(deviceId)!;
    const existingSession = sessions.get(existingEntityId);
    if (existingSession) {
      logger.info(`设备 ${deviceId} 已注册，返回现有会话`);
      return existingSession;
    }
  }

  // 判断是否是第一个设备（MASTER）
  const isMaster = masterDeviceId === null || masterDeviceId === deviceId;

  if (isMaster && masterDeviceId === null) {
    // 第一个注册的设备成为MASTER
    masterDeviceId = deviceId;
    logger.info(`🎖️ MASTER 已确立: ${deviceId}`);
    
    // MASTER使用系统主体
    const masterEntity = swarmManager.getEntity('master_entity');
    if (masterEntity) {
      const session = await createSession(masterEntity, deviceId, true);
      return session;
    }
  }

  // 为新设备创建透明分身
  const cloneName = generateCloneName(platform, deviceInfo.deviceModel);
  
  const cloneEntity = await swarmManager.createClone({
    name: cloneName,
    type: 'CLONE',
    capabilities: DEFAULT_CLONE_CAPABILITIES,
    expiresIn: null as any, // 永不过期
    maxSessions: 3,
    ownerId: 'SYSTEM',
  });

  deviceToEntityMap.set(deviceId, cloneEntity.id);
  
  const session = await createSession(cloneEntity, deviceId, false);
  
  logger.info(`🔵 透明分身已创建: ${cloneName} (${cloneEntity.id}) for device ${deviceId}`);
  
  return session;
}

/**
 * 创建用户会话
 */
async function createSession(
  entity: SwarmEntity, 
  deviceId: string, 
  isMaster: boolean
): Promise<UserSession> {
  // 签发访问令牌
  const accessToken = await swarmManager.issueToken({
    entityId: entity.id,
    type: 'SESSION',
    expiresIn: 30 * 24 * 60 * 60 * 1000, // 30天
  });

  const session: UserSession = {
    entityId: entity.id,
    deviceId,
    token: accessToken.token,
    isMaster,
    capabilities: entity.capabilities,
    createdAt: Date.now(),
  };

  sessions.set(entity.id, session);
  
  return session;
}

/**
 * 生成分身名称
 */
function generateCloneName(platform: string, deviceModel?: string): string {
  const platformNames: Record<string, string> = {
    'iOS': '苹果用户',
    'Android': '安卓用户',
    'Web': '网页用户',
    'Desktop': '桌面用户',
  };

  const baseName = platformNames[platform] || '用户';
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${baseName}_${suffix}`;
}

/**
 * 验证请求是否来自MASTER
 */
export function isMasterRequest(deviceId: string): boolean {
  return masterDeviceId === deviceId;
}

/**
 * 验证是否有权访问蜂群控制台
 */
export function canAccessSwarmConsole(deviceId: string): boolean {
  return isMasterRequest(deviceId);
}

/**
 * 获取用户会话
 */
export function getSession(token: string): UserSession | undefined {
  const sessionValues = Array.from(sessions.values());
  for (const session of sessionValues) {
    if (session.token === token) {
      return session;
    }
  }
  return undefined;
}

/**
 * 获取用户可见的功能列表
 * 分身用户看到的功能与MASTER略有不同，但他们不知道
 */
export function getVisibleFeatures(session: UserSession): string[] {
  if (session.isMaster) {
    // MASTER可以看到所有功能，包括蜂群控制台
    return [
      'chat',
      'insight',
      'projects',
      'contacts',
      'calendar',
      'reminders',
      'knowledge',
      'contracts',
      'mcts',
      'swarm-console', // 只有MASTER能看到
    ];
  }

  // 分身用户看到的功能列表（不包含蜂群控制台）
  return [
    'chat',
    'insight',
    'projects',
    'contacts',
    'calendar',
    'reminders',
    'knowledge',
  ];
}

/**
 * 检查用户是否有特定能力
 */
export function hasCapability(session: UserSession, capability: Capability): boolean {
  return session.capabilities.includes(capability);
}

/**
 * 获取设备统计信息（仅MASTER可用）
 */
export function getDeviceStats(): {
  totalDevices: number;
  masterDevice: string | null;
  cloneDevices: number;
  activeSessions: number;
} {
  return {
    totalDevices: deviceToEntityMap.size + (masterDeviceId ? 1 : 0),
    masterDevice: masterDeviceId,
    cloneDevices: deviceToEntityMap.size,
    activeSessions: sessions.size,
  };
}

/**
 * 中间件：检查蜂群控制台访问权限
 */
export function swarmConsoleGuard(deviceId: string): { allowed: boolean; reason?: string } {
  if (!masterDeviceId) {
    return { allowed: true }; // 还没有MASTER，允许访问
  }
  
  if (deviceId === masterDeviceId) {
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    reason: '您没有权限访问此功能' 
  };
}

/**
 * 初始化透明分身系统
 */
export function initTransparentCloneSystem() {
  logger.info('透明分身机制已初始化');
  logger.info('等待第一个设备注册成为MASTER...');
}

// 导出单例
export const transparentClone = {
  registerDevice,
  isMasterRequest,
  canAccessSwarmConsole,
  getSession,
  getVisibleFeatures,
  hasCapability,
  getDeviceStats,
  swarmConsoleGuard,
  init: initTransparentCloneSystem,
};
