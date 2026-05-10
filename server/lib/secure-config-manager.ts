import { createServiceLogger } from '../lib/logger';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { z } from 'zod';

const logger = createServiceLogger('SecureConfigManager');

/**
 * 配置值接口
 */
export interface ConfigValue {
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  category: string;
  description: string;
  isEncrypted: boolean;
  isRequired: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue?: string;
  newValue: string;
  changedBy: string;
  timestamp: number;
  category: string;
  isEncrypted: boolean;
}

/**
 * 安全配置管理器
 * 提供统一的配置管理、加密存储和访问控制
 */
export class SecureConfigManager {
  private static instance: SecureConfigManager;
  private config: Map<string, ConfigValue> = new Map();
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';
  private listeners: Array<(event: ConfigChangeEvent) => void> = [];
  private initialized = false;

  private constructor() {
    this.encryptionKey = this.deriveEncryptionKey();
    this.loadConfiguration();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  /**
   * 派生加密密钥
   */
  private deriveEncryptionKey(): Buffer {
    const masterSecret = process.env.MASTER_SECRET;
    if (!masterSecret) {
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        console.warn('MASTER_SECRET not set, using development fallback key');
        return createHash('sha256').update('dev-master-key-for-testing-only').digest();
      }
      throw new Error('MASTER_SECRET environment variable is required for secure configuration');
    }
    
    return createHash('sha256').update(masterSecret).digest();
  }

  /**
   * 加密敏感值
   */
  private encryptValue(value: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * 解密敏感值
   */
  private decryptValue(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      this.algorithm, 
      this.encryptionKey, 
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * 判断配置是否需要加密
   */
  private shouldEncrypt(key: string): boolean {
    const sensitiveKeys = [
      'MASTER_SECRET',
      'DATABASE_URL',
      'REDIS_PASSWORD',
      'JWT_SECRET',
      'SESSION_SECRET',
      'DASHSCOPE_API_KEY',
      'DEEPSEEK_API_KEY',
      'DOUBAO_API_KEY',
      'OPENAI_API_KEY'
    ];
    
    return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()));
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): void {
    try {
      // 加载环境变量
      this.loadEnvironmentVariables();
      
      // 加载配置文件
      this.loadConfigFiles();
      
      this.initialized = true;
      logger.info('安全配置管理器初始化完成', {
        totalConfigs: this.config.size,
        encryptedCount: Array.from(this.config.values()).filter(c => c.isEncrypted).length
      });
      
    } catch (error) {
      logger.error('安全配置管理器初始化失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 加载环境变量
   */
  private loadEnvironmentVariables(): void {
    const envConfigs = [
      {
        key: 'DATABASE_URL',
        type: 'string' as const,
        category: 'database',
        description: '数据库连接字符串',
        isRequired: true
      },
      {
        key: 'REDIS_HOST',
        type: 'string' as const,
        category: 'cache',
        description: 'Redis服务器地址',
        isRequired: true
      },
      {
        key: 'REDIS_PORT',
        type: 'number' as const,
        category: 'cache',
        description: 'Redis服务器端口',
        isRequired: false
      },
      {
        key: 'REDIS_PASSWORD',
        type: 'string' as const,
        category: 'cache',
        description: 'Redis服务器密码',
        isRequired: false
      },
      {
        key: 'CACHE_DEFAULT_TTL',
        type: 'number' as const,
        category: 'cache',
        description: '默认缓存过期时间(秒)',
        isRequired: false
      },
      {
        key: 'SESSION_SECRET',
        type: 'string' as const,
        category: 'security',
        description: '会话加密密钥',
        isRequired: true
      },
      {
        key: 'NODE_ENV',
        type: 'string' as const,
        category: 'system',
        description: '运行环境',
        isRequired: true
      },
      {
        key: 'DASHSCOPE_API_KEY',
        type: 'string' as const,
        category: 'ai',
        description: 'DashScope API密钥',
        isRequired: false
      },
      {
        key: 'DEEPSEEK_API_KEY',
        type: 'string' as const,
        category: 'ai',
        description: 'DeepSeek API密钥',
        isRequired: false
      },
      {
        key: 'DOUBAO_API_KEY',
        type: 'string' as const,
        category: 'ai',
        description: '豆包API密钥',
        isRequired: false
      }
    ];

    for (const config of envConfigs) {
      const envValue = process.env[config.key];
      if (envValue !== undefined) {
        this.setConfig(config.key, envValue, {
          type: config.type,
          category: config.category,
          description: config.description,
          isRequired: config.isRequired,
          isEncrypted: this.shouldEncrypt(config.key),
          updatedBy: 'system'
        });
      } else if (config.isRequired) {
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
          console.warn(`Required environment variable ${config.key} missing, using dev fallback`);
        } else {
          throw new Error(`Required environment variable ${config.key} is missing`);
        }
      }
    }
  }

  /**
   * 加载配置文件
   */
  private loadConfigFiles(): void {
    // 这里可以扩展支持从配置文件加载
    // 暂时只支持环境变量
  }

  /**
   * 获取配置值
   */
  public getConfig<T = string>(key: string): T | null {
    if (!this.initialized) {
      throw new Error('Configuration manager not initialized');
    }

    const config = this.config.get(key);
    if (!config) {
      return null;
    }

    let value = config.value;
    
    // 如果加密则解密
    if (config.isEncrypted) {
      try {
        const encryptedData = JSON.parse(value);
        value = this.decryptValue(
          encryptedData.encrypted,
          encryptedData.iv,
          encryptedData.tag
        );
      } catch (error) {
        logger.error('配置解密失败', { key, error: (error as Error).message });
        return null;
      }
    }

    // 类型转换
    return this.convertValue<T>(value, config.type);
  }

  /**
   * 设置配置值
   */
  public setConfig(
    key: string, 
    value: unknown,
    options: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      category: string;
      description: string;
      isRequired: boolean;
      isEncrypted?: boolean;
      updatedBy?: string;
    }
  ): void {
    const oldValue = this.config.get(key)?.value;
    const isEncrypted = options.isEncrypted ?? this.shouldEncrypt(key);
    
    let processedValue: string;
    if (isEncrypted) {
      const encryptedData = this.encryptValue(String(value));
      processedValue = JSON.stringify(encryptedData);
    } else {
      processedValue = String(value);
    }

    const configValue: ConfigValue = {
      value: processedValue,
      type: options.type,
      category: options.category,
      description: options.description,
      isEncrypted,
      isRequired: options.isRequired,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: options.updatedBy || 'system'
    };

    this.config.set(key, configValue);

    // 记录变更事件
    const event: ConfigChangeEvent = {
      key,
      oldValue,
      newValue: String(value),
      changedBy: options.updatedBy || 'system',
      timestamp: Date.now(),
      category: options.category,
      isEncrypted
    };

    this.notifyListeners(event);
    
    logger.info('配置已更新', {
      key,
      category: options.category,
      isEncrypted,
      changedBy: options.updatedBy || 'system'
    });
  }

  /**
   * 类型转换
   */
  private convertValue<T>(value: string, type: string): T {
    switch (type) {
      case 'number':
        return Number(value) as unknown as T;
      case 'boolean':
        return (value.toLowerCase() === 'true') as unknown as T;
      case 'object':
      case 'array':
        try {
          return JSON.parse(value) as unknown as T;
        } catch {
          return value as unknown as T;
        }
      default:
        return value as unknown as T;
    }
  }

  /**
   * 添加配置变更监听器
   */
  public addChangeListener(listener: (event: ConfigChangeEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  public removeChangeListener(listener: (event: ConfigChangeEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(event: ConfigChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('配置变更监听器执行失败', { 
          key: event.key, 
          error: (error as Error).message 
        });
      }
    });
  }

  /**
   * 获取所有配置（解密后）
   */
  public getAllConfigs(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, config] of this.config.entries()) {
      let value = config.value;
      
      if (config.isEncrypted) {
        try {
          const encryptedData = JSON.parse(value);
          value = this.decryptValue(
            encryptedData.encrypted,
            encryptedData.iv,
            encryptedData.tag
          );
        } catch (error) {
          logger.error('配置解密失败', { key, error: (error as Error).message });
          continue;
        }
      }

      result[key] = this.convertValue(value, config.type);
    }
    
    return result;
  }

  /**
   * 获取按分类的配置
   */
  public getConfigsByCategory(category: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, config] of this.config.entries()) {
      if (config.category === category) {
        result[key] = this.getConfig(key);
      }
    }
    
    return result;
  }

  /**
   * 验证必需配置
   */
  public validateRequiredConfigs(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const [key, config] of this.config.entries()) {
      if (config.isRequired && !config.value) {
        missing.push(key);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * 获取安全配置摘要
   */
  public getSecuritySummary(): {
    totalConfigs: number;
    encryptedConfigs: number;
    requiredConfigs: number;
    categories: string[];
  } {
    const configs = Array.from(this.config.values());
    
    return {
      totalConfigs: configs.length,
      encryptedConfigs: configs.filter(c => c.isEncrypted).length,
      requiredConfigs: configs.filter(c => c.isRequired).length,
      categories: [...new Set(configs.map(c => c.category))]
    };
  }

  /**
   * 清理过期的配置缓存
   */
  public cleanup(): void {
    // 如果有过期的临时配置，可以在这里清理
    logger.debug('配置清理完成');
  }
}

// 导出单例实例
export const secureConfigManager = SecureConfigManager.getInstance();