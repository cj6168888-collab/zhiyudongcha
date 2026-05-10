/**
 * 聚合存储入口
 *
 * ⚠️ 架构提示：
 * - 推荐直接导入领域存储: import { userStorage, vaultStorage } from './storage/domains'
 * - 旧方式 (已废弃): import { storage, IStorage } from './storage'
 *
 * 领域存储:
 * - userStorage: 用户、声纹、设置
 * - personStorage: 人物关系
 * - vaultStorage: 保险库
 * - deviceStorage: 设备管理
 * - projectStorage: 项目管理
 * - conversationStorage: 对话管理
 * - systemStorage: 系统日志、审计
 * - integrationStorage: 第三方集成
 */

import { userStorage } from './domains/user';
import { personStorage } from './domains/person';
import { vaultStorage } from './domains/vault';
import { deviceStorage } from './domains/device';
import { projectStorage } from './domains/project';
import { conversationStorage } from './domains/conversation';
import { systemStorage } from './domains/system';
import { integrationStorage } from './domains/integration';

// 导出领域存储 (推荐使用)
export {
  userStorage,
  personStorage,
  vaultStorage,
  deviceStorage,
  projectStorage,
  conversationStorage,
  systemStorage,
  integrationStorage,
};

// 导出领域存储接口
export type {
  IUserStorage,
  IPersonStorage,
  IVaultStorage,
  IDeviceStorage,
  IProjectStorage,
  IConversationStorage,
  ISystemStorage,
  IIntegrationStorage,
  IMemoryStorage,
  IJobStorage,
  IVaultStats,
} from './domains/types';

// 聚合对象
export const domainStorages = {
  user: userStorage,
  person: personStorage,
  vault: vaultStorage,
  device: deviceStorage,
  project: projectStorage,
  conversation: conversationStorage,
  system: systemStorage,
  integration: integrationStorage,
};

// 向后兼容导出
export type { IStorage } from '../interfaces/storage.interface';
export { storageAdapter as storage } from './adapter';
