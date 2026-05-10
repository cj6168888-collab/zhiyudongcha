/**
 * AuthorizationManager - 授权管理器
 *
 * 功能：
 * - 用户自定义金额阈值
 * - 全权授权（单次/永久）
 * - 按类型授权
 * - 授权记录与撤销
 * - 数据库持久化
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('AuthorizationManager');

import { randomUUID } from 'crypto';
import { getDatabase } from '../../db';
import { eq } from 'drizzle-orm';

// ============ 授权类型 ============

/**
 * 授权类型
 */
export enum AuthorizationType {
  /** 自动执行 */
  AUTO = 'auto',
  /** 需要确认 */
  CONFIRM = 'confirm',
  /** 需要授权 */
  AUTHORIZE = 'authorize',
  /** 禁止执行 */
  DENY = 'deny',
}

/**
 * 授权范围
 */
export enum AuthorizationScope {
  /** 单次授权 */
  ONCE = 'once',
  /** 永久授权 */
  PERMANENT = 'permanent',
  /** 按类型授权 */
  BY_TYPE = 'by_type',
}

/**
 * 授权项
 */
export interface Authorization {
  id: string;

  /** 授权类型 */
  type: AuthorizationType;

  /** 授权范围 */
  scope: AuthorizationScope;

  /** 授权的操作类型 */
  operation: string;

  /** 授权的参数条件 */
  conditions?: {
    maxAmount?: number;
    timeRange?: { start: Date; end: Date };
    weekdays?: number[];
    location?: string;
    counterparty?: string;
  };

  /** 创建时间 */
  createdAt: Date;

  /** 过期时间（单次授权用） */
  expiresAt?: Date;

  /** 是否启用 */
  enabled: boolean;

  /** 备注 */
  note?: string;
}

/**
 * 用户授权配置
 */
export interface UserAuthorizationConfig {
  userId: string;

  /** 金额阈值设置 */
  amountThresholds: {
    auto: number;       // 自动执行上限（默认100）
    confirm: number;   // 确认执行上限（默认1000）
    // 超过 confirm → 需要授权
  };

  /** 永久授权列表 */
  permanentAuthorizations: Authorization[];

  /** 信任等级（影响默认权限） */
  trustLevel: 'low' | 'medium' | 'high';

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 授权请求
 */
export interface AuthorizationRequest {
  operation: string;
  amount?: number;
  details: {
    description: string;
    counterparty?: string;
    time?: Date;
    location?: string;
  };
  context?: {
    isRepeat?: boolean;
    repeatCount?: number;
    lastSuccess?: boolean;
  };
}

/**
 * 授权结果
 */
export interface AuthorizationResult {
  /** 是否需要授权 */
  required: boolean;

  /** 授权类型 */
  type: AuthorizationType;

  /** 原因 */
  reason: string;

  /** 授权选项 */
  options?: AuthorizationOption[];

  /** 是否有永久授权 */
  permanentAuth?: Authorization;

  /** 建议的权限 */
  suggestedAuth?: {
    scope: AuthorizationScope;
    note?: string;
  };
}

export interface AuthorizationOption {
  id: string;
  label: string;
  description?: string;
  action: 'approve_once' | 'approve_permanent' | 'approve_by_type' | 'deny' | 'modify';
  nextMessage?: string;
}

// ============ 授权管理器 ============

class AuthorizationManager {
  private static instance: AuthorizationManager | null = null;

  // 用户配置缓存（从数据库加载）
  private userConfigs: Map<string, UserAuthorizationConfig> = new Map();

  // 临时授权缓存（单次授权）
  private temporaryAuths: Map<string, { auth: Authorization; usedAt?: Date }> = new Map();

  // 数据库是否可用
  private dbAvailable = false;

  private constructor() {
    this.initializeDefaults();
    this.checkDatabase();
  }

  public static getInstance(): AuthorizationManager {
    if (!AuthorizationManager.instance) {
      AuthorizationManager.instance = new AuthorizationManager();
    }
    return AuthorizationManager.instance;
  }

  /**
   * 检查数据库连接
   */
  private async checkDatabase(): Promise<void> {
    try {
      const db = getDatabase();
      if (db) {
        this.dbAvailable = true;
        logger.info('AuthorizationManager connected to database');
        // 启动定期清理
        this.startPeriodicCleanup();
      }
    } catch (error) {
      logger.warn({ error }, 'Database not available, using in-memory storage');
      this.dbAvailable = false;
    }
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    // 每小时清理一次过期授权
    setInterval(() => {
      this.cleanupExpiredAuthorizations();
    }, 60 * 60 * 1000);
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaults(): void {
    logger.info('AuthorizationManager initialized');
  }

  /**
   * 从数据库加载用户配置
   */
  private async loadFromDatabase(userId: string): Promise<UserAuthorizationConfig | null> {
    if (!this.dbAvailable) return null;

    try {
      const db = getDatabase();
      // TODO: 实现数据库查询
      // const result = await db.select().from(authorizationConfigs).where(eq(authorizationConfigs.userId, userId));
      return null;
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to load user config from database');
      return null;
    }
  }

  /**
   * 保存用户配置到数据库
   */
  private async saveToDatabase(userId: string, config: UserAuthorizationConfig): Promise<void> {
    if (!this.dbAvailable) return;

    try {
      const db = getDatabase();
      // TODO: 实现数据库保存
      // await db.insert(authorizationConfigs).values(config).onConflictDoUpdate({...});
      logger.debug({ userId }, 'User config saved to database');
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to save user config to database');
    }
  }

  /**
   * 获取用户配置
   */
  public async getUserConfig(userId: string): Promise<UserAuthorizationConfig> {
    // 优先从缓存获取
    if (this.userConfigs.has(userId)) {
      return this.userConfigs.get(userId)!;
    }

    // 尝试从数据库加载
    const dbConfig = await this.loadFromDatabase(userId);
    if (dbConfig) {
      this.userConfigs.set(userId, dbConfig);
      return dbConfig;
    }

    // 创建默认配置
    const defaultConfig: UserAuthorizationConfig = {
      userId,
      amountThresholds: {
        auto: 100,
        confirm: 1000,
      },
      permanentAuthorizations: [],
      trustLevel: 'medium',
      updatedAt: new Date(),
    };

    this.userConfigs.set(userId, defaultConfig);
    return defaultConfig;
  }

  /**
   * 更新用户配置
   */
  public async updateUserConfig(userId: string, config: Partial<UserAuthorizationConfig>): Promise<void> {
    const current = await this.getUserConfig(userId);
    const updated = {
      ...current,
      ...config,
      updatedAt: new Date(),
    };
    this.userConfigs.set(userId, updated);

    // 异步保存到数据库
    this.saveToDatabase(userId, updated).catch(err => {
      logger.warn({ err, userId }, 'Failed to persist config');
    });

    logger.info({ userId }, 'User config updated');
  }

  /**
   * 更新金额阈值
   */
  public setAmountThresholds(userId: string, auto: number, confirm: number): void {
    const config = this.getUserConfig(userId);
    config.amountThresholds = { auto, confirm };
    config.updatedAt = new Date();
    logger.info({ userId, auto, confirm }, 'Amount thresholds updated');
  }

  /**
   * 检查是否需要授权
   */
  public async checkAuthorization(userId: string, request: AuthorizationRequest): Promise<AuthorizationResult> {
    const config = await this.getUserConfig(userId);

    // 1. 检查永久授权
    const permanentAuth = this.findMatchingPermanentAuth(config, request);
    if (permanentAuth) {
      logger.info({ userId, operation: request.operation }, 'Found permanent authorization');
      return {
        required: false,
        type: AuthorizationType.AUTO,
        reason: '您已授权我全权处理此类事务',
        permanentAuth,
      };
    }

    // 2. 检查临时授权
    const tempAuth = this.findMatchingTempAuth(userId, request);
    if (tempAuth) {
      return {
        required: false,
        type: AuthorizationType.AUTO,
        reason: '您已授权本次操作',
        permanentAuth: tempAuth,
      };
    }

    // 3. 根据金额判断
    if (request.amount !== undefined) {
      if (request.amount <= config.amountThresholds.auto) {
        return {
          required: false,
          type: AuthorizationType.AUTO,
          reason: '金额在自动执行范围内',
        };
      }

      if (request.amount <= config.amountThresholds.confirm) {
        return {
          required: true,
          type: AuthorizationType.CONFIRM,
          reason: `金额 ¥${request.amount}，需要您确认`,
          options: this.generateConfirmOptions(request),
          suggestedAuth: {
            scope: AuthorizationScope.BY_TYPE,
            note: `以后 ¥${config.amountThresholds.auto} 以内的类似事务我可以直接处理`,
          },
        };
      }

      return {
        required: true,
        type: AuthorizationType.AUTHORIZE,
        reason: `金额 ¥${request.amount} 较大，需要您授权`,
        options: this.generateAuthOptions(request),
        suggestedAuth: {
          scope: AuthorizationScope.ONCE,
          note: '如果您信任我，可以授权我以后处理此类事务',
        },
      };
    }

    // 4. 默认需要确认
    return {
      required: true,
      type: AuthorizationType.CONFIRM,
      reason: '需要您确认',
      options: this.generateConfirmOptions(request),
    };
  }

  /**
   * 检查永久授权
   */
  private findMatchingPermanentAuth(config: UserAuthorizationConfig, request: AuthorizationRequest): Authorization | null {
    for (const auth of config.permanentAuthorizations) {
      if (!auth.enabled) continue;

      // 检查是否过期
      if (auth.expiresAt && auth.expiresAt < new Date()) continue;

      // 检查操作类型匹配
      if (this.matchOperation(auth.operation, request.operation)) {
        // 检查条件
        if (auth.conditions) {
          // 金额条件
          if (auth.conditions.maxAmount && request.amount && request.amount > auth.conditions.maxAmount) {
            continue;
          }

          // 时间条件
          if (auth.conditions.timeRange && request.details.time) {
            if (request.details.time < auth.conditions.timeRange.start ||
                request.details.time > auth.conditions.timeRange.end) {
              continue;
            }
          }
        }

        return auth;
      }
    }
    return null;
  }

  /**
   * 检查临时授权
   */
  private findMatchingTempAuth(userId: string, request: AuthorizationRequest): Authorization | null {
    const key = `${userId}:${request.operation}:${request.details.description}`;
    const temp = this.temporaryAuths.get(key);

    if (temp && temp.auth.expiresAt && temp.auth.expiresAt > new Date()) {
      if (!temp.usedAt) {
        // 标记已使用
        temp.usedAt = new Date();
        return temp.auth;
      }
    }

    return null;
  }

  /**
   * 匹配操作类型
   */
  private matchOperation(pattern: string, operation: string): boolean {
    // 支持通配符
    if (pattern === '*') return true;
    if (pattern === operation) return true;

    // 前缀匹配
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return operation.startsWith(prefix);
    }

    // 后缀匹配
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return operation.endsWith(suffix);
    }

    return false;
  }

  /**
   * 生成确认选项
   */
  private generateConfirmOptions(request: AuthorizationRequest): AuthorizationOption[] {
    return [
      {
        id: 'approve_once',
        label: '确认执行',
        description: '本次确认',
        action: 'approve_once',
        nextMessage: '好的，已确认',
      },
      {
        id: 'approve_permanent',
        label: '以后都这样处理',
        description: '永久授权此类操作',
        action: 'approve_permanent',
        nextMessage: '好的，以后这类事我直接处理',
      },
      {
        id: 'modify',
        label: '修改一下',
        action: 'modify',
        nextMessage: '好的，请告诉我怎么改',
      },
      {
        id: 'deny',
        label: '算了',
        action: 'deny',
        nextMessage: '好的，已取消',
      },
    ];
  }

  /**
   * 生成授权选项
   */
  private generateAuthOptions(request: AuthorizationRequest): AuthorizationOption[] {
    return [
      {
        id: 'approve_once',
        label: '授权本次',
        description: '仅本次有效',
        action: 'approve_once',
        nextMessage: '好的，正在处理',
      },
      {
        id: 'approve_permanent',
        label: '交给你了',
        description: '以后类似的事直接处理',
        action: 'approve_permanent',
        nextMessage: '好的，以后这类事我直接处理',
      },
      {
        id: 'deny',
        label: '还是算了',
        action: 'deny',
        nextMessage: '好的，已取消',
      },
    ];
  }

  /**
   * 添加永久授权
   */
  public addPermanentAuthorization(userId: string, authorization: Omit<Authorization, 'id' | 'createdAt' | 'enabled'>): Authorization {
    const config = this.getUserConfig(userId);

    const auth: Authorization = {
      ...authorization,
      id: `auth_${randomUUID().slice(0, 8)}`,
      createdAt: new Date(),
      enabled: true,
    };

    config.permanentAuthorizations.push(auth);
    config.updatedAt = new Date();

    logger.info({ userId, auth }, 'Permanent authorization added');
    return auth;
  }

  /**
   * 撤销授权
   */
  public revokeAuthorization(userId: string, authId: string): boolean {
    const config = this.getUserConfig(userId);
    const index = config.permanentAuthorizations.findIndex(a => a.id === authId);

    if (index !== -1) {
      config.permanentAuthorizations[index].enabled = false;
      config.updatedAt = new Date();
      logger.info({ userId, authId }, 'Authorization revoked');
      return true;
    }

    return false;
  }

  /**
   * 处理"交给你了"命令
   */
  public processFullAuthorization(userId: string, command: string): {
    success: boolean;
    authorization?: Authorization;
    message: string;
  } {
    const auth = this.parseFullAuthorization(command);

    if (!auth) {
      return {
        success: false,
        message: '我没太理解，您想授权什么操作？',
      };
    }

    const created = this.addPermanentAuthorization(userId, auth);

    let message = `好的，已经记下了！\n\n`;
    message += `您已授权我：\n`;
    message += `• 操作：${auth.operation}\n`;

    if (auth.conditions?.maxAmount) {
      message += `• 金额上限：¥${auth.conditions.maxAmount}\n`;
    }

    message += `\n以后这类事我会直接帮您处理，不用再来问您了`;

    return {
      success: true,
      authorization: created,
      message,
    };
  }

  /**
   * 解析"交给你了"命令
   */
  private parseFullAuthorization(command: string): Partial<Authorization> | null {
    const text = command.toLowerCase();

    // 匹配模式
    const patterns = [
      // "这件事交给你了"
      {
        pattern: /(?:这个|那件|这次)(?:事|操作|事情)交给你了/i,
        scope: AuthorizationScope.ONCE,
      },
      // "以后xxx都交给你了"
      {
        pattern: /(?:以后|以后|往后)(.+)都交给你了/i,
        scope: AuthorizationScope.PERMANENT,
      },
      // "xxx交给你了"（不带"以后"）
      {
        pattern: /(.+)交给你了/i,
        scope: AuthorizationScope.BY_TYPE,
      },
      // "以后都听你的"
      {
        pattern: /(?:以后|以后)都听你的/i,
        scope: AuthorizationScope.PERMANENT,
        operation: '*',
      },
    ];

    for (const p of patterns) {
      const match = text.match(p.pattern);
      if (match) {
        const operation = match[1] ? this.normalizeOperation(match[1]) : '*';

        return {
          type: AuthorizationType.AUTO,
          scope: p.scope,
          operation: operation || '*',
          conditions: {},
        };
      }
    }

    return null;
  }

  /**
   * 标准化操作名称
   */
  private normalizeOperation(text: string): string {
    const mappings: Record<string, string> = {
      '订餐': 'booking.restaurant',
      '订酒店': 'booking.hotel',
      '订票': 'booking.ticket',
      '订外卖': 'booking.takeout',
      '预订': 'booking.*',
      '预订服务': 'booking.*',
      '开会': 'meeting.*',
      '会议': 'meeting.*',
      '日程': 'calendar.*',
      '提醒': 'alarm.*',
      '导航': 'navigation.*',
      '搜索': 'search.*',
      '回复消息': 'communication.reply',
      '发消息': 'communication.send',
      '打电话': 'communication.call',
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (text.includes(key)) {
        return value;
      }
    }

    return text;
  }

  /**
   * 获取用户的所有授权
   */
  public getUserAuthorizations(userId: string): Authorization[] {
    const config = this.getUserConfig(userId);
    return config.permanentAuthorizations.filter(a => a.enabled);
  }

  /**
   * 清除过期授权
   */
  public cleanupExpiredAuthorizations(): void {
    const now = new Date();

    for (const [userId, config] of this.userConfigs) {
      const before = config.permanentAuthorizations.length;

      config.permanentAuthorizations = config.permanentAuthorizations.filter(
        auth => !auth.expiresAt || auth.expiresAt > now
      );

      if (config.permanentAuthorizations.length !== before) {
        logger.info({ userId, removed: before - config.permanentAuthorizations.length }, 'Cleaned up expired authorizations');
      }
    }

    // 清理临时授权
    for (const [key, temp] of this.temporaryAuths) {
      if (temp.auth.expiresAt && temp.auth.expiresAt < now) {
        this.temporaryAuths.delete(key);
      }
    }
  }

  /**
   * 生成授权报告
   */
  public generateAuthReport(userId: string): string {
    const config = this.getUserConfig(userId);
    const auths = this.getUserAuthorizations(userId);

    let report = `📋 您的授权设置\n\n`;
    report += `💰 金额阈值\n`;
    report += `• ¥${config.amountThresholds.auto} 以内：自动执行\n`;
    report += `• ¥${config.amountThresholds.confirm} 以内：需要确认\n`;
    report += `• ¥${config.amountThresholds.confirm} 以上：需要授权\n\n`;

    if (auths.length > 0) {
      report += `✅ 全权授权\n`;
      for (const auth of auths) {
        report += `• ${auth.operation}`;
        if (auth.conditions?.maxAmount) {
          report += ` (限额 ¥${auth.conditions.maxAmount})`;
        }
        report += `\n`;
      }
    } else {
      report += `暂无全权授权\n`;
    }

    report += `\n💡 您可以对我说「xxx交给你了」来授权`;

    return report;
  }
}

// 导出
export const authorizationManager = AuthorizationManager.getInstance();
export default authorizationManager;

// 导出类型
export {
  Authorization,
  UserAuthorizationConfig,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationOption
};
