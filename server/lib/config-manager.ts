import { createServiceLogger } from './logger'
import { getSecureConfig, getSecureApiKey } from './secure-config'
import { cacheManager } from './cache'
import { z } from 'zod'

const logger = createServiceLogger('ConfigManager')

export type ConfigValueType = string | number | boolean | object | unknown[] | null | undefined | unknown;

export interface ConfigValue {
  key: string
  value: ConfigValueType
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  category: string
  description?: string
  isEncrypted: boolean
  isRequired: boolean
  defaultValue?: ConfigValueType
  validation?: z.ZodSchema
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
  updatedBy?: string
}

export interface ConfigCategory {
  name: string
  description: string
  icon?: string
  order: number
  isSystem: boolean
}

export interface ConfigChangeEvent {
  key: string
  oldValue: ConfigValueType
  newValue: ConfigValueType
  updatedBy: string
  timestamp: number
  category: string
}

export type ConfigListener = (event: ConfigChangeEvent) => void | Promise<void>

/**
 * 配置管理中心
 * 提供统一的配置管理，支持热重载、加密、验证、监听
 */
export class ConfigManager {
  private static readonly CACHE_PREFIX = 'config:'
  private static readonly CACHE_TTL = 3600 // 1小时
  private static readonly CHANGE_HISTORY_PREFIX = 'config_history:'

  private configs = new Map<string, ConfigValue>()
  private categories = new Map<string, ConfigCategory>()
  private listeners = new Set<ConfigListener>()
  private isInitialized = false
  private changeHistory: ConfigChangeEvent[] = []

  constructor() {
    this.initializeDefaultCategories()
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('配置管理器已初始化')
      return
    }

    try {
      logger.info('正在初始化配置管理器...')

      // 加载所有配置
      await this.loadAllConfigs()

      // 启动配置同步
      this.startConfigSync()

      this.isInitialized = true
      logger.info('配置管理器初始化完成')

    } catch (error) {
      logger.error('配置管理器初始化失败', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * 获取配置值
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      // 先从内存缓存获取
      const config = this.configs.get(key)
      if (config) {
        return config.value as T
      }

      // 从Redis缓存获取
      const cacheKey = `${ConfigManager.CACHE_PREFIX}${key}`
      const cached = await cacheManager.get<ConfigValue>(cacheKey)
      if (cached) {
        this.configs.set(key, cached)
        return cached.value as T
      }

      // 从环境变量获取
      const envValue = this.getFromEnvironment(key)
      if (envValue !== undefined) {
        const config: ConfigValue = {
          key,
          value: envValue,
          type: this.getValueType(envValue),
          category: 'environment',
          isEncrypted: false,
          isRequired: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        await this.setConfig(key, config)
        return envValue as T
      }

      // 返回默认值
      return defaultValue

    } catch (error) {
      logger.error('获取配置失败', { key, error: error instanceof Error ? error.message : String(error) })
      return defaultValue
    }
  }

  /**
   * 设置配置值
   */
  async set(key: string, value: unknown, options: {
    category?: string
    description?: string
    isEncrypted?: boolean
    updatedBy?: string
    metadata?: Record<string, unknown>
  } = {}): Promise<boolean> {
    try {
      const oldValue = this.configs.get(key)?.value

      // 验证配置值
      const validationResult = await this.validateConfig(key, value)
      if (!validationResult.valid) {
        logger.error('配置验证失败', { key, error: validationResult.error })
        return false
      }

      // 加密敏感值
      let finalValue = value
      let isEncrypted = options.isEncrypted || false

      if (isEncrypted && typeof value === 'string') {
        finalValue = this.encryptValue(value)
      }

      // 创建配置对象
      const config: ConfigValue = {
        key,
        value: finalValue,
        type: this.getValueType(value),
        category: options.category || 'custom',
        description: options.description,
        isEncrypted,
        isRequired: false,
        createdAt: this.configs.get(key)?.createdAt || Date.now(),
        updatedAt: Date.now(),
        updatedBy: options.updatedBy,
        metadata: options.metadata
      }

      // 更新内存缓存
      this.configs.set(key, config)

      // 更新Redis缓存
      const cacheKey = `${ConfigManager.CACHE_PREFIX}${key}`
      await cacheManager.set(cacheKey, config, ConfigManager.CACHE_TTL)

      // 记录变更历史
      if (oldValue !== undefined && oldValue !== value) {
        await this.recordChange({
          key,
          oldValue,
          newValue: value,
          updatedBy: options.updatedBy || 'system',
          timestamp: Date.now(),
          category: config.category
        })
      }

      // 通知监听器
      await this.notifyListeners({
        key,
        oldValue,
        newValue: value,
        updatedBy: options.updatedBy || 'system',
        timestamp: Date.now(),
        category: config.category
      })

      logger.debug('配置已更新', { key, updatedBy: options.updatedBy })

      return true

    } catch (error) {
      logger.error('设置配置失败', { key, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 删除配置
   */
  async delete(key: string, updatedBy?: string): Promise<boolean> {
    try {
      const config = this.configs.get(key)
      if (!config) {
        return false
      }

      // 从内存删除
      this.configs.delete(key)

      // 从Redis删除
      const cacheKey = `${ConfigManager.CACHE_PREFIX}${key}`
      await cacheManager.delete(cacheKey)

      // 记录删除
      await this.recordChange({
        key,
        oldValue: config.value,
        newValue: undefined,
        updatedBy: updatedBy || 'system',
        timestamp: Date.now(),
        category: config.category
      })

      logger.debug('配置已删除', { key })

      return true

    } catch (error) {
      logger.error('删除配置失败', { key, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 批量获取配置
   */
  async getMultiple(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}

    for (const key of keys) {
      const value = await this.get(key)
      if (value !== undefined) {
        result[key] = value
      }
    }

    return result
  }

  /**
   * 批量设置配置
   */
  async setMultiple(configs: Record<string, any>, options: {
    category?: string
    updatedBy?: string
  } = {}): Promise<{ success: string[]; failed: string[] }> {
    const result = { success: [] as string[], failed: [] as string[] }

    for (const [key, value] of Object.entries(configs)) {
      const success = await this.set(key, value, options)
      if (success) {
        result.success.push(key)
      } else {
        result.failed.push(key)
      }
    }

    return result
  }

  /**
   * 按分类获取配置
   */
  async getByCategory(category: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {}

    for (const [key, config] of this.configs) {
      if (config.category === category) {
        result[key] = config.value
      }
    }

    // 同时从Redis获取该分类的其他配置
    const pattern = `${ConfigManager.CACHE_PREFIX}*`
    const keys = await cacheManager.keys(pattern)

    for (const cacheKey of keys) {
      const config = await cacheManager.get<ConfigValue>(cacheKey)
      if (config && config.category === category && !result[config.key]) {
        result[config.key] = config.value
      }
    }

    return result
  }

  /**
   * 获取所有配置分类
   */
  getCategories(): ConfigCategory[] {
    return Array.from(this.categories.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * 获取配置变更历史
   */
  async getChangeHistory(key?: string, limit: number = 50): Promise<ConfigChangeEvent[]> {
    try {
      let history: ConfigChangeEvent[] = []

      if (key) {
        // 获取特定key的历史
        const cacheKey = `${ConfigManager.CHANGE_HISTORY_PREFIX}${key}`
        const cached = await cacheManager.get<ConfigChangeEvent[]>(cacheKey)
        if (cached) {
          history = cached
        }
      } else {
        // 获取所有历史
        history = this.changeHistory
      }

      return history
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)

    } catch (error) {
      logger.error('获取变更历史失败', { key, error: error instanceof Error ? error.message : String(error) })
      return []
    }
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: ConfigListener): void {
    this.listeners.add(listener)
    logger.debug('添加配置监听器', { listenerCount: this.listeners.size })
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: ConfigListener): void {
    this.listeners.delete(listener)
    logger.debug('移除配置监听器', { listenerCount: this.listeners.size })
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    try {
      logger.info('重新加载配置...')

      // 清空内存缓存
      this.configs.clear()

      // 重新加载所有配置
      await this.loadAllConfigs()

      logger.info('配置重新加载完成')

    } catch (error) {
      logger.error('配置重新加载失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 导出配置
   */
  async export(category?: string): Promise<Record<string, any>> {
    const configs: Record<string, any> = {}

    for (const [key, config] of this.configs) {
      if (!category || config.category === category) {
        // 不导出加密的敏感配置
        if (!config.isEncrypted) {
          configs[key] = config.value
        }
      }
    }

    return configs
  }

  /**
   * 导入配置
   */
  async import(configs: Record<string, any>, options: {
    category?: string
    updatedBy?: string
    overwrite?: boolean
  } = {}): Promise<{ success: string[]; failed: string[]; skipped: string[] }> {
    const result = { success: [] as string[], failed: [] as string[], skipped: [] as string[] }

    for (const [key, value] of Object.entries(configs)) {
      const existing = this.configs.get(key)

      if (existing && !options.overwrite) {
        result.skipped.push(key)
        continue
      }

      const success = await this.set(key, value, {
        category: options.category,
        updatedBy: options.updatedBy
      })

      if (success) {
        result.success.push(key)
      } else {
        result.failed.push(key)
      }
    }

    logger.info('配置导入完成', result)
    return result
  }

  /**
   * 获取配置统计信息
   */
  getStats(): {
    totalConfigs: number
    configsByCategory: Record<string, number>
    encryptedConfigs: number
    recentChanges: number
  } {
    const stats = {
      totalConfigs: this.configs.size,
      configsByCategory: {} as Record<string, number>,
      encryptedConfigs: 0,
      recentChanges: 0
    }

    for (const config of this.configs.values()) {
      // 按分类统计
      stats.configsByCategory[config.category] = (stats.configsByCategory[config.category] || 0) + 1

      // 统计加密配置
      if (config.isEncrypted) {
        stats.encryptedConfigs++
      }
    }

    // 统计最近变更（24小时内）
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    stats.recentChanges = this.changeHistory.filter(change => change.timestamp > oneDayAgo).length

    return stats
  }

  /**
   * 初始化默认分类
   */
  private initializeDefaultCategories(): void {
    const defaultCategories: ConfigCategory[] = [
      { name: 'system', description: '系统配置', order: 1, isSystem: true },
      { name: 'database', description: '数据库配置', order: 2, isSystem: true },
      { name: 'cache', description: '缓存配置', order: 3, isSystem: true },
      { name: 'ai', description: 'AI服务配置', order: 4, isSystem: true },
      { name: 'security', description: '安全配置', order: 5, isSystem: true },
      { name: 'performance', description: '性能配置', order: 6, isSystem: true },
      { name: 'features', description: '功能开关', order: 7, isSystem: false },
      { name: 'ui', description: '界面配置', order: 8, isSystem: false },
      { name: 'notifications', description: '通知配置', order: 9, isSystem: false },
      { name: 'custom', description: '自定义配置', order: 10, isSystem: false }
    ]

    for (const category of defaultCategories) {
      this.categories.set(category.name, category)
    }
  }

  /**
   * 加载所有配置
   */
  private async loadAllConfigs(): Promise<void> {
    try {
      // 加载基础系统配置
      const systemConfigs = {
        'NODE_ENV': getSecureConfig('NODE_ENV'),
        'PORT': getSecureConfig('PORT'),
        'DATABASE_URL': getSecureConfig('DATABASE_URL'),
        'REDIS_HOST': getSecureConfig('REDIS_HOST'),
        'REDIS_PORT': getSecureConfig('REDIS_PORT'),
        'CACHE_DEFAULT_TTL': getSecureConfig('CACHE_DEFAULT_TTL'),
        'RATE_LIMIT_MAX': getSecureConfig('RATE_LIMIT_MAX')
      }

      for (const [key, value] of Object.entries(systemConfigs)) {
        if (value !== undefined) {
          const config: ConfigValue = {
            key,
            value,
            type: this.getValueType(value),
            category: 'system',
            isEncrypted: false,
            isRequired: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          this.configs.set(key, config)
        }
      }

      // 加载AI服务配置（加密存储）
      const aiConfigs = {
        'DASHSCOPE_API_KEY': getSecureApiKey('DASHSCOPE_API_KEY'),
        'DEEPSEEK_API_KEY': getSecureApiKey('DEEPSEEK_API_KEY'),
        'DOUBAO_API_KEY': getSecureApiKey('DOUBAO_API_KEY')
      }

      for (const [key, value] of Object.entries(aiConfigs)) {
        if (value !== undefined) {
          const config: ConfigValue = {
            key,
            value: this.encryptValue(value),
            type: 'string',
            category: 'ai',
            isEncrypted: true,
            isRequired: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          this.configs.set(key, config)
        }
      }

    } catch (error) {
      logger.error('加载配置失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 启动配置同步
   */
  private startConfigSync(): void {
    // 定期同步配置变更
    setInterval(async () => {
      try {
        await this.syncWithCache()
      } catch (error) {
        logger.error('配置同步失败', { error: error instanceof Error ? error.message : String(error) })
      }
    }, 60000) // 每分钟同步一次

    logger.debug('配置同步已启动')
  }

  /**
   * 与缓存同步
   */
  private async syncWithCache(): Promise<void> {
    // 这里可以实现与其他配置源的同步逻辑
    // 例如：配置中心、etcd、consul等
  }

  /**
   * 从环境变量获取配置
   */
  private getFromEnvironment(key: string): string | undefined {
    const envKey = key.toUpperCase()
    return process.env[envKey]
  }

  /**
   * 验证配置值
   */
  private async validateConfig(key: string, value: unknown): Promise<{ valid: boolean; error?: string }> {
    try {
      const config = this.configs.get(key)

      if (config && config.validation) {
        const result = config.validation.safeParse(value)
        if (!result.success) {
          return { valid: false, error: result.error.message }
        }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 加密配置值
   */
  private encryptValue(value: string): string {
    // 使用AES加密
    const crypto = require('crypto')
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(getSecureConfig('SESSION_SECRET'), 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    cipher.setAAD(Buffer.from('config'))

    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }

  /**
   * 解密配置值
   */
  private decryptValue(encryptedValue: string): string {
    const crypto = require('crypto')
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(getSecureConfig('SESSION_SECRET'), 'salt', 32)

    const parts = encryptedValue.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAAD(Buffer.from('config'))
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 获取值的类型
   */
  private getValueType(value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object' && value !== null) return 'object'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    return 'string'
  }

  /**
   * 记录配置变更
   */
  private async recordChange(event: ConfigChangeEvent): Promise<void> {
    try {
      // 添加到内存历史
      this.changeHistory.push(event)

      // 保持最近1000条记录
      if (this.changeHistory.length > 1000) {
        this.changeHistory = this.changeHistory.slice(-1000)
      }

      // 存储到Redis
      const cacheKey = `${ConfigManager.CHANGE_HISTORY_PREFIX}${event.key}`
      let history = await cacheManager.get<ConfigChangeEvent[]>(cacheKey) || []
      history.push(event)

      // 保持每个key最近100条记录
      if (history.length > 100) {
        history = history.slice(-100)
      }

      await cacheManager.set(cacheKey, history, ConfigManager.CACHE_TTL * 24) // 24小时

    } catch (error) {
      logger.error('记录配置变更失败', { event, error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 通知监听器
   */
  private async notifyListeners(event: ConfigChangeEvent): Promise<void> {
    const listeners = Array.from(this.listeners)

    for (const listener of listeners) {
      try {
        await listener(event)
      } catch (error) {
        logger.error('配置监听器执行失败', {
          key: event.key,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  /**
   * 设置配置对象
   */
  private async setConfig(key: string, config: ConfigValue): Promise<void> {
    this.configs.set(key, config)

    const cacheKey = `${ConfigManager.CACHE_PREFIX}${key}`
    await cacheManager.set(cacheKey, config, ConfigManager.CACHE_TTL)
  }
}

// 创建并导出配置管理器单例
export const configManager = new ConfigManager()
