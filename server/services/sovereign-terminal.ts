/**
 * 主权端机制 - Navigator-X 领航者系统 v1.0
 *
 * 设计理念：
 * - 主权端（SOVEREIGN）是唯一的领导核心
 * - 其他所有安装/注册的用户都自动创建为节点端（NODE）
 * - 节点端用户完全不知道自己是节点身份
 * - 对节点端用户呈现完全一致的界面和体验
 * - 只有主权端可以访问Navigator控制台
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SovereignTerminal');

import { navigatorCore } from './navigator-core';
import type { NavigatorNode, Capability } from './navigator-core';

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
  isSovereign: boolean;
  capabilities: Capability[];
  createdAt: number;
}

// 存储第一个注册的设备ID作为主权端
let sovereignDeviceId: string | null = null;
const deviceToEntityMap = new Map<string, string>();
const sessions = new Map<string, UserSession>();

// 默认节点能力 - 给普通用户的功能
const DEFAULT_NODE_CAPABILITIES: Capability[] = [
  'TEXT_CHAT',
  'VOICE_INTERACTION',
  'CALENDAR_MANAGE',
  'CONTACT_LOOKUP',
  'REMINDER_SET',
  'KNOWLEDGE_QUERY',
  'INSIGHT_VIEW',
  'DRAFT_GENERATION',
  'AUTHENTICITY_AUDIT',
];

// 完整能力 - 只有主权端拥有
const SOVEREIGN_CAPABILITIES: Capability[] = [
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
  'DRAFT_GENERATION',
  'AUTHENTICITY_AUDIT',
  'PREFERENCE_ADAPT',
];

/**
 * 处理设备注册/登录
 * 自动判断是主权端还是节点端
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

  // 判断是否是第一个设备（主权端）
  const isSovereign = sovereignDeviceId === null || sovereignDeviceId === deviceId;

  if (isSovereign && sovereignDeviceId === null) {
    // 第一个注册的设备成为主权端
    sovereignDeviceId = deviceId;
    logger.info(`🎖️ 主权端已确立: ${deviceId}`);

    // 主权端使用系统主体
    const sovereignEntity = navigatorCore.getNode('sovereign_entity');
    if (sovereignEntity) {
      const session = await createSession(sovereignEntity, deviceId, true);
      return session;
    }
  }

  // 为新设备创建节点端
  const nodeName = generateNodeName(platform, deviceInfo.deviceModel);

  const nodeEntity = await navigatorCore.createNode({
    name: nodeName,
    type: 'NODE',
    capabilities: DEFAULT_NODE_CAPABILITIES,
    expiresIn: null as any, // 永不过期
    maxSessions: 3,
    ownerId: 'SYSTEM',
  });

  deviceToEntityMap.set(deviceId, nodeEntity.id);

  const session = await createSession(nodeEntity, deviceId, false);

  logger.info(`🔵 节点端已创建: ${nodeName} (${nodeEntity.id}) for device ${deviceId}`);

  return session;
}

/**
 * 创建用户会话
 */
async function createSession(
  entity: NavigatorNode,
  deviceId: string,
  isSovereign: boolean
): Promise<UserSession> {
  // 签发访问令牌
  const accessToken = await navigatorCore.issueToken({
    entityId: entity.id,
    type: 'SESSION',
    expiresIn: 30 * 24 * 60 * 60 * 1000, // 30天
  });

  const session: UserSession = {
    entityId: entity.id,
    deviceId,
    token: accessToken.token,
    isSovereign,
    capabilities: entity.capabilities,
    createdAt: Date.now(),
  };

  sessions.set(entity.id, session);

  return session;
}

/**
 * 生成节点名称
 */
function generateNodeName(platform: string, deviceModel?: string): string {
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
 * 验证请求是否来自主权端
 */
export function isSovereignRequest(deviceId: string): boolean {
  return sovereignDeviceId === deviceId;
}

/**
 * 验证是否有权访问Navigator控制台
 */
export function canAccessNavigatorConsole(deviceId: string): boolean {
  return isSovereignRequest(deviceId);
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
 * 节点端用户看到的功能与主权端略有不同，但他们不知道
 */
export function getVisibleFeatures(session: UserSession): string[] {
  if (session.isSovereign) {
    // 主权端可以看到所有功能，包括Navigator控制台
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
      'navigator-console', // 只有主权端能看到
      'command-center',     // 审批与分派中枢
      'expert-center',     // 专家席位
    ];
  }

  // 节点端用户看到的功能列表（不包含Navigator控制台）
  return [
    'chat',
    'insight',
    'projects',
    'contacts',
    'calendar',
    'reminders',
    'knowledge',
    'node-terminal',  // 节点端功能
  ];
}

/**
 * 检查用户是否有特定能力
 */
export function hasCapability(session: UserSession, capability: Capability): boolean {
  return session.capabilities.includes(capability);
}

/**
 * 获取设备统计信息（仅主权端可用）
 */
export function getDeviceStats(): {
  totalDevices: number;
  sovereignDevice: string | null;
  nodeDevices: number;
  activeSessions: number;
} {
  return {
    totalDevices: deviceToEntityMap.size + (sovereignDeviceId ? 1 : 0),
    sovereignDevice: sovereignDeviceId,
    nodeDevices: deviceToEntityMap.size,
    activeSessions: sessions.size,
  };
}

/**
 * 中间件：检查Navigator控制台访问权限
 */
export function navigatorConsoleGuard(deviceId: string): { allowed: boolean; reason?: string } {
  if (!sovereignDeviceId) {
    return { allowed: true }; // 还没有主权端，允许访问
  }

  if (deviceId === sovereignDeviceId) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '您没有权限访问此功能'
  };
}

/**
 * 初始化主权端系统
 */
export function initSovereignTerminalSystem() {
  logger.info('主权端机制已初始化 (Navigator-X)');
  logger.info('等待第一个设备注册成为主权端...');
}

// 导出单例
export const sovereignTerminal = {
  registerDevice,
  isSovereignRequest,
  canAccessNavigatorConsole,
  getSession,
  getVisibleFeatures,
  hasCapability,
  getDeviceStats,
  navigatorConsoleGuard,
  init: initSovereignTerminalSystem,
};

// 向后兼容别名
export const transparentClone = sovereignTerminal;
