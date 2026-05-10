import { z } from 'zod'
import crypto from 'crypto'

/**
 * 生产环境安全配置验证
 * 确保所有关键配置在生产环境中都正确设置
 */

// 严格的环境变量验证schema
const strictEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 必需的生产环境配置
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(64, 'SESSION_SECRET must be at least 64 characters'),

  // Redis配置
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),

  // AI服务配置（至少需要一个）
  DASHSCOPE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DOUBAO_API_KEY: z.string().optional(),

  // 缓存配置
  CACHE_DEFAULT_TTL: z.string().transform(Number).default('300'),
  CACHE_SESSION_TTL: z.string().transform(Number).default('3600'),

  // 安全配置
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),

  // 性能配置
  DATABASE_POOL_MIN: z.string().transform(Number).default('5'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('20'),
  DATABASE_CONNECTION_TIMEOUT: z.string().transform(Number).default('30000'),

  // 日志配置
  LOG_LEVEL: z.string().default('info'),
  LOG_FORMAT: z.string().default('json'),
}).refine((data) => {
  // 至少需要一个AI服务配置
  const hasAnyAIKey = !!(data.DASHSCOPE_API_KEY || data.DEEPSEEK_API_KEY || data.DOUBAO_API_KEY)
  return hasAnyAIKey
}, {
  message: 'At least one AI service API key must be configured'
})

export type StrictEnvConfig = z.infer<typeof strictEnvSchema>

/**
 * 生产环境安全检查器
 */
export class ProductionSecurityChecker {
  private static readonly SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  }

  /**
   * 执行生产环境安全检查
   */
  static performSecurityCheck(config: StrictEnvConfig): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // 生产环境特殊检查
    if (config.NODE_ENV === 'production') {
      // 1. SESSION_SECRET 强制检查
      if (config.SESSION_SECRET.length < 64) {
        errors.push('SESSION_SECRET must be at least 64 characters in production')
      }

      // 2. 检查是否使用默认值或弱密钥
      if (this.isWeakSecret(config.SESSION_SECRET)) {
        errors.push('SESSION_SECRET appears to be weak or default value')
      }

      // 3. CORS 检查
      if (config.CORS_ORIGIN === '*') {
        warnings.push('CORS_ORIGIN should not be "*" in production')
      }

      // 4. 数据库安全检查
      if (!config.DATABASE_URL.includes('ssl') && !config.DATABASE_URL.includes('localhost')) {
        warnings.push('DATABASE_URL should use SSL in production')
      }

      // 5. 环境变量加密检查
      const encryptedKeys = ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'DOUBAO_API_KEY']
      for (const key of encryptedKeys) {
        if (process.env[key] && !this.isEncrypted(process.env[key])) {
          warnings.push(`${key} should be encrypted in production`)
        }
      }

      // 6. 连接池安全检查
      if (parseInt(config.DATABASE_POOL_MAX) > 50) {
        warnings.push('DATABASE_POOL_MAX should not exceed 50 in production')
      }

      // 7. 日志级别检查
      if (config.LOG_LEVEL === 'debug') {
        warnings.push('LOG_LEVEL should not be "debug" in production')
      }
    }

    // 通用安全检查
    // 1. 数据库URL安全检查
    if (config.DATABASE_URL.includes('password=')) {
      const warnings_msg = 'DATABASE_URL contains password in plain text'
      if (config.NODE_ENV === 'production') {
        errors.push(warnings_msg)
      } else {
        warnings.push(warnings_msg)
      }
    }

    // 2. AI服务密钥格式检查
    const aiKeys = [config.DASHSCOPE_API_KEY, config.DEEPSEEK_API_KEY, config.DOUBAO_API_KEY].filter(Boolean)
    for (const key of aiKeys) {
      if (key && this.isWeakAPIKey(key)) {
        warnings.push('AI API key appears to be weak or test key')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 生成安全的响应头
   */
  static getSecurityHeaders(): Record<string, string> {
    return { ...this.SECURITY_HEADERS }
  }

  /**
   * 获取安全的会话配置
   */
  static getSessionConfig(config: StrictEnvConfig): {
    secret: string
    resave: boolean
    saveUninitialized: boolean
    cookie: {
      secure: boolean
      httpOnly: boolean
      maxAge: number
      sameSite: 'strict' | 'lax' | 'none'
    }
  } {
    return {
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax'
      }
    }
  }

  /**
   * 检查密钥强度
   */
  private static isWeakSecret(secret: string): boolean {
    // 检查常见的弱密钥模式
    const weakPatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /test/i,
      /dev/i,
      /default/i,
      /123456/,
      /admin/i,
      /^(.)\1+$/, // 重复字符
      /^[a-zA-Z]+$/, // 纯字母
      /^[0-9]+$/, // 纯数字
      /^.{1,8}$/ // 太短
    ]

    return weakPatterns.some(pattern => pattern.test(secret))
  }

  /**
   * 检查API密钥格式
   */
  private static isWeakAPIKey(key: string): boolean {
    // 检查常见的测试或弱API密钥
    const weakPatterns = [
      /test/i,
      /demo/i,
      /sample/i,
      /example/i,
      /fake/i,
      /^sk-test/, // Stripe测试密钥模式
      /^pk_test/, // Stripe测试公钥模式
      /^[a-f0-9]{32}$/i, // MD5-like
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i // UUID-like
    ]

    return weakPatterns.some(pattern => pattern.test(key))
  }

  /**
   * 检查是否已加密
   */
  private static isEncrypted(value: string): boolean {
    try {
      // 尝试解密，如果成功则说明是加密的
      this.decryptValue(value)
      return true
    } catch {
      // 解密失败，说明不是加密格式
      return false
    }
  }

  /**
   * 加密环境变量值
   */
  static encryptValue(value: string): string {
    const algorithm = 'aes-256-gcm'
    const encryptionKey = this.getEncryptionKey()
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv)

    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }

  /**
   * 解密环境变量值
   */
  static decryptValue(encryptedValue: string): string {
    const algorithm = 'aes-256-gcm'
    const encryptionKey = this.getEncryptionKey()

    const parts = encryptedValue.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 获取加密密钥
   */
  private static getEncryptionKey(): Buffer {
    const baseKey = process.env.CONFIG_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'fallback-key-change-in-production'
    return crypto.scryptSync(baseKey, 'salt', 32)
  }

  /**
   * 验证数据库连接字符串安全性
   */
  static validateDatabaseSecurity(dbUrl: string): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // 检查是否使用SSL
    if (process.env.NODE_ENV === 'production' && !dbUrl.includes('ssl')) {
      issues.push('Database connection should use SSL in production')
    }

    // 检查连接字符串中的明文密码
    if (dbUrl.includes('password=')) {
      issues.push('Database URL contains plain text password')
    }

    // 检查是否使用localhost
    if (process.env.NODE_ENV === 'production' && dbUrl.includes('localhost')) {
      issues.push('Database should not use localhost in production')
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * 生成随机安全密钥
   */
  static generateSecureSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 检查依赖安全漏洞
   */
  static checkDependencyVulnerabilities(): {
    vulnerabilities: Array<{
      package: string
      version: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      description: string
    }>
  } {
    // 这里应该集成实际的漏洞扫描工具，如 npm audit
    // 现在返回模拟结果
    return {
      vulnerabilities: [
        // 实际实现时应该调用 npm audit 或类似工具
      ]
    }
  }
}

/**
 * 安全配置验证器
 */
export class SecureConfigValidator {
  /**
   * 验证并获取严格配置
   */
  static validateAndGetConfig(): StrictEnvConfig {
    const result = strictEnvSchema.safeParse(process.env)

    if (!result.success) {
      console.error('❌ 严格环境变量验证失败:')
      result.error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      process.exit(1)
    }

    const config = result.data

    // 执行安全检查
    const securityCheck = ProductionSecurityChecker.performSecurityCheck(config)

    if (!securityCheck.isValid) {
      console.error('❌ 生产环境安全检查失败:')
      securityCheck.errors.forEach(error => {
        console.error(`  - ${error}`)
      })
      process.exit(1)
    }

    // 显示警告
    if (securityCheck.warnings.length > 0) {
      console.warn('⚠️ 安全警告:')
      securityCheck.warnings.forEach(warning => {
        console.warn(`  - ${warning}`)
      })
    }

    // 验证数据库安全
    const dbSecurity = ProductionSecurityChecker.validateDatabaseSecurity(config.DATABASE_URL)
    if (!dbSecurity.isValid) {
      console.warn('⚠️ 数据库安全问题:')
      dbSecurity.issues.forEach(issue => {
        console.warn(`  - ${issue}`)
      })
    }

    return config
  }

  /**
   * 检查必需的AI服务配置
   */
  static validateAIServices(): {
    hasDashScope: boolean
    hasDeepSeek: boolean
    hasDoubao: boolean
    totalServices: number
    recommendations: string[]
  } {
    const config = strictEnvSchema.parse(process.env)

    const hasDashScope = !!config.DASHSCOPE_API_KEY
    const hasDeepSeek = !!config.DEEPSEEK_API_KEY
    const hasDoubao = !!config.DOUBAO_API_KEY
    const totalServices = [hasDashScope, hasDeepSeek, hasDoubao].filter(Boolean).length

    const recommendations: string[] = []

    if (totalServices === 0) {
      recommendations.push('至少配置一个AI服务以启用核心功能')
    } else if (totalServices === 1) {
      recommendations.push('建议配置多个AI服务以提高可用性')
    } else if (totalServices >= 2) {
      recommendations.push('多服务配置良好，建议配置负载均衡')
    }

    return {
      hasDashScope,
      hasDeepSeek,
      hasDoubao,
      totalServices,
      recommendations
    }
  }
}

// 导出便捷函数
export const getStrictConfig = () => SecureConfigValidator.validateAndGetConfig()
export const getSecurityHeaders = () => ProductionSecurityChecker.getSecurityHeaders()
export const getSessionConfig = () => ProductionSecurityChecker.getSessionConfig(getStrictConfig())
export const validateAIServices = () => SecureConfigValidator.validateAIServices()

// 开发环境安全检查
if (process.env.NODE_ENV === 'development') {
  const securityCheck = ProductionSecurityChecker.performSecurityCheck(getStrictConfig())
  if (securityCheck.errors.length > 0) {
    console.warn('🔧 开发环境安全检查建议:')
    securityCheck.errors.forEach(error => {
      console.warn(`  - ${error}`)
    })
  }
}
