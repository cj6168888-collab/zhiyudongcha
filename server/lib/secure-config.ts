import { z } from 'zod'
import crypto from 'crypto'
import { logger } from './logger'

/**
 * 环境变量配置验证和安全检查
 */

// 定义环境变量配置schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 数据库配置
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // 会话安全
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Redis配置
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),

  // AI服务API密钥
  DASHSCOPE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DOUBAO_API_KEY: z.string().optional(),

  // 本地AI配置
  LOCAL_MODEL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  LOCAL_MODEL_ENDPOINT: z.string().url().optional(),
  LOCAL_MODEL_NAME: z.string().optional(),

  // 缓存配置
  CACHE_DEFAULT_TTL: z.string().transform(Number).default('300'),
  CACHE_SESSION_TTL: z.string().transform(Number).default('3600'),
  CACHE_AI_CONTEXT_TTL: z.string().transform(Number).default('3600'),

  // 其他配置
  PORT: z.string().transform(Number).default('5000'),

  // 安全配置
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
})

// 配置验证类型
export type ValidatedConfig = z.infer<typeof envSchema>

// 加密敏感配置的工具类
export class SecureConfigManager {
  private static readonly ENCRYPTION_KEY = crypto.scryptSync(process.env.CONFIG_ENCRYPTION_KEY || 'default-key', 'salt', 32)
  private static readonly ALGORITHM = 'aes-256-gcm'

  /**
   * 加密敏感配置值
   */
  static encrypt(value: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv)
    cipher.setAAD(Buffer.from('config'))

    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }

  /**
   * 解密敏感配置值
   */
  static decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv)
    decipher.setAAD(Buffer.from('config'))
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  /**
   * 安全获取API密钥
   */
  static getSecureApiKey(keyName: string): string | undefined {
    const encrypted = process.env[`ENCRYPTED_${keyName}`]
    if (encrypted) {
      return this.decrypt(encrypted)
    }
    return process.env[keyName]
  }
}

/**
 * 依赖关系检测器
 * 用于检测循环依赖和架构问题
 */
export class DependencyGraph {
  private dependencies: Map<string, Set<string>> = new Map()
  private nodes: Set<string> = new Set()

  /**
   * 添加依赖关系
   */
  addDependency(from: string, to: string): void {
    if (from === to) {
      throw new Error(`Self-dependency detected: ${from}`)
    }

    this.nodes.add(from)
    this.nodes.add(to)

    if (!this.dependencies.has(from)) {
      this.dependencies.set(from, new Set())
    }
    this.dependencies.get(from)!.add(to)
  }

  /**
   * 检测循环依赖
   */
  detectCycles(): string[][] {
    const cycles: string[][] = []
    const visited: Set<string> = new Set()
    const recursionStack: Set<string> = new Set()
    const path: string[] = []

    for (const node of this.nodes) {
      if (!visited.has(node)) {
        this.dfs(node, visited, recursionStack, path, cycles)
      }
    }

    return cycles
  }

  private dfs(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const dependencies = this.dependencies.get(node)
    if (dependencies) {
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          this.dfs(dep, visited, recursionStack, path, cycles)
        } else if (recursionStack.has(dep)) {
          // 找到循环
          const cycleStart = path.indexOf(dep)
          const cycle = path.slice(cycleStart).concat([dep])
          cycles.push(cycle)
        }
      }
    }

    recursionStack.delete(node)
    path.pop()
  }

  /**
   * 获取拓扑排序
   */
  getTopologicalOrder(): string[] {
    const inDegree: Map<string, number> = new Map()

    // 初始化入度
    for (const node of this.nodes) {
      inDegree.set(node, 0)
    }

    // 计算入度
    for (const [from, deps] of this.dependencies) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
      }
    }

    // 拓扑排序
    const queue: string[] = []
    const result: string[] = []

    // 找到所有入度为0的节点
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      // 更新邻接节点的入度
      const deps = this.dependencies.get(current)
      if (deps) {
        for (const dep of deps) {
          const newDegree = (inDegree.get(dep) || 0) - 1
          inDegree.set(dep, newDegree)
          if (newDegree === 0) {
            queue.push(dep)
          }
        }
      }
    }

    // 如果结果不包含所有节点，说明有循环依赖
    if (result.length !== this.nodes.size) {
      throw new Error('Circular dependency detected, topological sort failed')
    }

    return result
  }

  /**
   * 生成依赖图报告
   */
  generateReport(): string {
    const cycles = this.detectCycles()
    let report = '=== 依赖关系分析报告 ===\n\n'

    report += `总节点数: ${this.nodes.size}\n`
    report += `总依赖关系数: ${Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0)}\n\n`

    if (cycles.length > 0) {
      report += '❌ 检测到循环依赖:\n'
      cycles.forEach((cycle, index) => {
        report += `  ${index + 1}. ${cycle.join(' → ')}\n`
      })
    } else {
      report += '✅ 未检测到循环依赖\n'
    }

    try {
      const order = this.getTopologicalOrder()
      report += '\n📋 推荐加载顺序:\n'
      order.forEach((node, index) => {
        report += `  ${index + 1}. ${node}\n`
      })
    } catch (error) {
      report += '\n❌ 无法生成拓扑排序（存在循环依赖）\n'
    }

    return report
  }
}

// 全局依赖图实例
export const globalDependencyGraph = new DependencyGraph()

/**
 * 类型安全的配置管理器
 */
export class TypeSafeConfigManager {
  private static config: ValidatedConfig | null = null
  private static isInitialized = false

  /**
   * 验证并初始化配置
   */
  static validateAndInitialize(): ValidatedConfig {
    if (this.isInitialized) {
      return this.config!
    }

    try {
      // 运行时验证
      const validatedConfig = envSchema.parse(process.env)

      // 安全检查
      this.performSecurityChecks(validatedConfig)

      this.config = validatedConfig
      this.isInitialized = true

      return validatedConfig
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ 环境变量验证失败:')
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`)
        })
      } else {
        console.error('❌ 配置初始化失败:', error)
      }
      process.exit(1)
    }
  }

  /**
   * 执行安全检查
   */
  private static performSecurityChecks(config: ValidatedConfig): void {
    const warnings: string[] = []

    // 生产环境安全检查
    if (config.NODE_ENV === 'production') {
      if (config.SESSION_SECRET.length < 64) {
        warnings.push('SESSION_SECRET应在生产环境中使用64位以上的随机字符串')
      }

      if (config.CORS_ORIGIN === '*') {
        warnings.push('CORS_ORIGIN不应在生产环境中使用通配符"*"')
      }

      if (config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1')) {
        warnings.push('DATABASE_URL不应在生产环境中使用localhost')
      }
    }

    // API密钥检查
    const availableProviders = []
    if (SecureConfigManager.getSecureApiKey('DASHSCOPE_API_KEY')) {
      availableProviders.push('DashScope')
    }
    if (SecureConfigManager.getSecureApiKey('DEEPSEEK_API_KEY')) {
      availableProviders.push('DeepSeek')
    }
    if (SecureConfigManager.getSecureApiKey('DOUBAO_API_KEY')) {
      availableProviders.push('豆包')
    }

    if (availableProviders.length === 0 && !config.LOCAL_MODEL_ENABLED) {
      warnings.push('未配置任何AI服务提供商，部分功能可能不可用')
    }

    // 显示检查结果
    if (warnings.length > 0) {
      console.warn('⚠️ 安全警告:')
      warnings.forEach(warning => console.warn(`  - ${warning}`))
    }

    logger.info(`可用AI服务: ${availableProviders.join(', ') || '无'}`)
    logger.info(`本地AI模型: ${config.LOCAL_MODEL_ENABLED ? '启用' : '禁用'}`)
    logger.info(`Redis连接: ${config.REDIS_HOST}:${config.REDIS_PORT}`)
  }

  /**
   * 获取类型安全的配置
   */
  static get<K extends keyof ValidatedConfig>(key: K): ValidatedConfig[K] {
    if (!this.isInitialized) {
      this.validateAndInitialize()
    }
    return this.config![key]
  }

  /**
   * 获取所有配置
   */
  static getAll(): ValidatedConfig {
    if (!this.isInitialized) {
      this.validateAndInitialize()
    }
    return this.config!
  }

  /**
   * 获取安全API密钥
   */
  static getSecureApiKey(keyName: string): string | undefined {
    return SecureConfigManager.getSecureApiKey(keyName)
  }
}

// 导出便捷函数
export const getConfig = () => TypeSafeConfigManager.validateAndInitialize()
export const getSecureConfig = (key: keyof ValidatedConfig) => TypeSafeConfigManager.get(key)
export const getSecureApiKey = (keyName: string) => TypeSafeConfigManager.getSecureApiKey(keyName)

// 导出配置类型
export type { ValidatedConfig as Config }
