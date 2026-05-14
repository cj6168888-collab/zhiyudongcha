/**
 * 用户服务
 * Service层示例，封装用户相关的业务逻辑
 * 使用Domain Storage而非直接使用Repository或旧版Storage
 */

import { createServiceLogger } from '../lib/logger';
import { userStorage } from '../storage/domains';
import type {
  User,
  InsertUser,
  UserSettings,
  InsertUserSettings,
  Voiceprint,
  InsertVoiceprint,
  VoiceAuthorization,
  InsertVoiceAuthorization,
} from '@shared/schema';
import { BusinessError, ErrorCode } from '../lib/errors';
import crypto from 'crypto';
import { promisify } from 'util';

// 延迟导入以避免循环依赖
let cozeAPI: unknown = null;
const getCozeAPI = () => {
  if (!cozeAPI) {
    try {
      cozeAPI = require('../lib/coze-api').cozeAPI;
    } catch {
      // Coze API未安装
    }
  }
  return cozeAPI;
};

const logger = createServiceLogger('UserService');
const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_HASH_PREFIX = 'scrypt';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `${PASSWORD_HASH_PREFIX}:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  if (!storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}:`)) {
    return storedPassword === password;
  }

  const [, salt, hash] = storedPassword.split(':');
  if (!salt || !hash) return false;

  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
}

function validatePasswordPolicy(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new BusinessError('密码长度需为 8-72 位', ErrorCode.VALIDATION_ERROR, 400);
  }
}

export class UserService {
  /**
   * 获取用户信息
   */
  async getUser(id: string): Promise<User> {
    const user = await userStorage.getUser(id);
    if (!user) {
      throw new BusinessError(`用户 ${id} 不存在`, ErrorCode.NOT_FOUND, 404);
    }
    return user;
  }

  /**
   * 根据ID获取用户，未找到时返回 null。
   * 供调用方需要自行处理空值的轻量路径使用。
   */
  async getUserById(id: string): Promise<User | null> {
    const user = await userStorage.getUser(id);
    return user ?? null;
  }

  /**
   * 根据用户名获取用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const user = await userStorage.getUserByUsername(username);
    return user ?? null;
  }

  /**
   * 创建用户
   */
  async createUser(data: InsertUser): Promise<User> {
    // 检查用户名是否已存在
    const existingUser = await userStorage.getUserByUsername(data.username);
    if (existingUser) {
      throw new BusinessError(
        `用户名 ${data.username} 已存在`,
        ErrorCode.CONFLICT,
        409
      );
    }

    // 创建用户
    const user = await userStorage.createUser(data);

    logger.info({ userId: user.id, username: user.username }, '用户创建成功');
    return user;
  }

  /**
   * 创建账号密码用户。手机号注册时 username 使用规范化手机号。
   */
  async createUserWithPassword(username: string, password: string): Promise<User> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      throw new BusinessError('用户名不能为空', ErrorCode.VALIDATION_ERROR, 400);
    }
    validatePasswordPolicy(password);

    return await this.createUser(({
      username: normalizedUsername,
      password: await hashPassword(password),
    } as unknown) as InsertUser);
  }

  /**
   * 验证账号密码，兼容旧明文密码数据并优先使用 scrypt 哈希。
   */
  async validatePassword(username: string, password: string): Promise<User | null> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      return null;
    }

    const user = await userStorage.getUserByUsername(normalizedUsername);
    if (!user) {
      return null;
    }

    const valid = await verifyPassword(password, user.password);
    return valid ? user : null;
  }

  async resetPassword(username: string, newPassword: string): Promise<User> {
    const normalizedUsername = username.trim();
    validatePasswordPolicy(newPassword);

    const user = await userStorage.getUserByUsername(normalizedUsername);
    if (!user) {
      throw new BusinessError('账号不存在', ErrorCode.NOT_FOUND, 404);
    }

    const updated = await userStorage.updateUser(user.id, ({
      password: await hashPassword(newPassword),
    } as unknown) as Partial<InsertUser>);
    if (!updated) {
      throw new BusinessError('密码更新失败', ErrorCode.INTERNAL_ERROR, 500);
    }

    logger.info({ userId: user.id, username: normalizedUsername }, '用户密码已重置');
    return updated;
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const user = await userStorage.updateUser(id, updates);
    if (!user) {
      throw new BusinessError(`用户 ${id} 不存在`, ErrorCode.NOT_FOUND, 404);
    }

    logger.info({ userId: id, updates }, '用户信息更新成功');
    return user;
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    const deleted = await userStorage.deleteUser(id);
    if (!deleted) {
      throw new BusinessError(`用户 ${id} 不存在`, ErrorCode.NOT_FOUND, 404);
    }

    logger.info({ userId: id }, '用户删除成功');
  }

  /**
   * 获取用户设置
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    const settings = await userStorage.getUserSettings(userId);
    if (!settings) {
      // 返回默认设置
      return ({
        id: userId,
        userId,
        realName: null,
        avatarName: '小智',
        avatarEmoji: '🤖',
        wakeWords: ['小智', '小智小智'],
        primaryWakeWord: '小智',
        wakeWordSensitivity: 0.8,
        voiceEnabled: 'true',
        voiceGender: 'female',
        voiceSpeed: 1.0,
        notificationLevel: 'important',
        autoAnalyze: 'true',
        screenMonitorInterval: 1000,
        expertMode: 'LV5',
        preferredLanguage: 'zh-CN',
        hpBalance: 1000,
        hpMaxBalance: 1000,
        hpTotalConsumed: 0,
        hpTotalRecharged: 0,
        hpLastRechargeAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown) as UserSettings;
    }
    return settings;
  }

  /**
   * 更新用户设置
   */
  async updateUserSettings(
    userId: string,
    updates: Partial<InsertUserSettings>
  ): Promise<UserSettings> {
    let settings = await userStorage.getUserSettings(userId);

    if (settings) {
      // 更新现有设置
      const updated = await userStorage.updateUserSettings(userId, updates);
      if (!updated) {
        throw new BusinessError(
          '用户设置更新失败',
          ErrorCode.INTERNAL_ERROR,
          500
        );
      }

      // 同步Coze API配置（如果是master用户更新了Coze相关设置）
      if (userId === 'master') {
        const coze = getCozeAPI() as { updateFromSettings?: (settings: Record<string, string>) => void } | null;
        if (coze?.updateFromSettings && this.hasCozeUpdates(updates)) {
          coze.updateFromSettings(updates as Record<string, string>);
          logger.info('Coze API settings synced from user settings');
        }
      }

      return updated;
    } else {
      // 创建新设置
      const defaultInsertSettings = ({
        userId,
        realName: null,
        avatarName: '小智',
        avatarEmoji: '🤖',
        wakeWords: ['小智', '小智小智'],
        primaryWakeWord: '小智',
        wakeWordSensitivity: 0.8,
        voiceEnabled: 'true',
        voiceGender: 'female',
        voiceSpeed: 1.0,
        notificationLevel: 'important',
        autoAnalyze: 'true',
        screenMonitorInterval: 1000,
        expertMode: 'LV5',
        preferredLanguage: 'zh-CN',
        hpBalance: 1000,
        hpMaxBalance: 1000,
        hpTotalConsumed: 0,
        hpTotalRecharged: 0,
        hpLastRechargeAt: null,
      } as unknown) as InsertUserSettings;

      // 合并更新，过滤掉undefined
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      const mergedSettings: InsertUserSettings = { ...defaultInsertSettings, ...filteredUpdates };

      return await userStorage.createUserSettings(mergedSettings);
    }
  }

  /**
   * 检查更新是否包含Coze相关设置
   */
  private hasCozeUpdates(updates: Partial<InsertUserSettings>): boolean {
    const cozeFields = [
      'cozeEnabled', 'cozeApiKey', 'cozeBotId', 'cozeWorkflowId',
      'cozeWorkflowDocFormat', 'cozeWorkflowDocPolish', 'cozeWorkflowDocTranslate',
      'cozeWorkflowDocSummarize', 'cozeWorkflowPpt', 'cozeWorkflowReport', 'cozeWorkflowCodeReview'
    ];
    return Object.keys(updates).some(key => cozeFields.includes(key));
  }

  /**
   * 同步Coze API配置
   */
  async syncCozeFromSettings(): Promise<void> {
    try {
      const settings = await userStorage.getUserSettings('master');
      if (settings) {
        const coze = getCozeAPI() as { updateFromSettings?: (settings: Record<string, string>) => void } | null;
        if (coze?.updateFromSettings) {
          coze.updateFromSettings(settings as unknown as Record<string, string>);
          logger.info('Coze API synced from master settings on startup');
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to sync Coze API from settings');
    }
  }

  /**
   * 获取声纹信息
   */
  async getVoiceprint(userId: string): Promise<Voiceprint | null> {
    const voiceprint = await userStorage.getVoiceprint(userId);
    return voiceprint ?? null;
  }

  /**
   * 获取主声纹
   */
  async getMasterVoiceprint(): Promise<Voiceprint | null> {
    const voiceprint = await userStorage.getMasterVoiceprint();
    return voiceprint ?? null;
  }

  /**
   * 创建声纹
   */
  async createVoiceprint(data: InsertVoiceprint): Promise<Voiceprint> {
    // 检查用户是否存在
    const user = await userStorage.getUser(data.userId);
    if (!user) {
      throw new BusinessError(
        `用户 ${data.userId} 不存在`,
        ErrorCode.NOT_FOUND,
        404
      );
    }

    // 检查是否已存在声纹
    const existing = await userStorage.getVoiceprint(data.userId);
    if (existing) {
      throw new BusinessError(
        `用户 ${data.userId} 已存在声纹`,
        ErrorCode.CONFLICT,
        409
      );
    }

    return await userStorage.createVoiceprint(data);
  }

  /**
   * 获取声纹授权列表
   */
  async getVoiceAuthorizations(): Promise<VoiceAuthorization[]> {
    return await userStorage.getVoiceAuthorizations();
  }

  /**
   * 创建声纹授权
   */
  async createVoiceAuthorization(data: InsertVoiceAuthorization): Promise<VoiceAuthorization> {
    return await userStorage.createVoiceAuthorization(data);
  }

  /**
   * 撤销声纹授权
   */
  async deactivateVoiceAuthorization(id: string): Promise<boolean> {
    return await userStorage.deactivateVoiceAuthorization(id);
  }

  /**
   * 更新声纹信息
   */
  async updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined> {
    return await userStorage.updateVoiceprint(userId, updates);
  }

  /**
   * 验证用户凭证
   */
  async validateCredentials(username: string, secret: string): Promise<boolean> {
    // 这里应该实现实际的凭证验证逻辑
    // 目前只是示例
    logger.debug({ username }, '凭证验证请求');
    return false; // 示例实现
  }

  /**
   * 获取所有用户设置
   */
  async getAllUserSettings(): Promise<UserSettings[]> {
    try {
      return await userStorage.getAllUserSettings();
    } catch (error) {
      logger.error({ err: error }, '获取所有用户设置失败');
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersWithVoiceprint: number;
  }> {
    // 这里应该实现实际的统计逻辑
    // 目前只是示例
    return {
      totalUsers: 0,
      activeUsers: 0,
      usersWithVoiceprint: 0,
    };
  }
}

// 导出全局实例
export const userService = new UserService();
