import { createServiceLogger } from '../lib/logger'
import { getStrictConfig, type StrictEnvConfig } from '../lib/production-security'

const logger = createServiceLogger('SecurityConfigValidator')

/**
 * 生产环境安全配置验证器
 */
export class SecurityConfigValidator {
  /**
   * 验证所有关键配置
   */
  static validateProductionSecurity(): {
    isValid: boolean
    errors: string[]
    warnings: string[]
    recommendations: string[]
  } {
    const config = getStrictConfig()
    const errors: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // 1. 数据库连接安全验证
    this.validateDatabaseSecurity(config, errors, warnings)

    // 2. API密钥验证
    this.validateAPIKeys(config, errors, warnings, recommendations)

    // 3. 加密配置验证
    this.validateEncryptionSettings(config, errors, warnings)

    // 4. 会话安全验证
    this.validateSessionSecurity(config, errors, warnings)

    // 5. CORS安全验证
    this.validateCORSSecurity(config, errors, warnings)

    // 6. 依赖包安全验证
    this.validateDependencySecurity(errors, warnings)

    // 7. 环境变量安全验证
    this.validateEnvironmentVariables(config, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    }
  }

  /**
   * 验证数据库连接安全
   */
  private static validateDatabaseSecurity(config: StrictEnvConfig, errors: string[], warnings: string[]): void {
    const dbUrl = config.DATABASE_URL
    
    if (!dbUrl) {
      errors.push('DATABASE_URL is required')
      return
    }

    // 检查SSL使用
    if (config.NODE_ENV === 'production' && !dbUrl.includes('ssl')) {
      errors.push('Database connection must use SSL in production')
    }

    // 检查密码暴露
    if (dbUrl.includes('password:') && dbUrl.includes('@')) {
      errors.push('Database URL should use environment variables for password')
    }

    // 检查主机名
    if (config.NODE_ENV === 'production' && dbUrl.includes('localhost')) {
      errors.push('Database should not use localhost in production')
    }
  }

  /**
   * 验证API密钥
   */
  private static validateAPIKeys(config: StrictEnvConfig, errors: string[], warnings: string[], recommendations: string[]): void {
    const requiredKeys = ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'DOUBAO_API_KEY']
    
    for (const key of requiredKeys) {
      const value = config[key as string]
      
      if (!value || value.length < 20) {
        errors.push(`${key} is required and must be at least 20 characters`)
      }

      if (value && this.isWeakAPIKey(value)) {
        warnings.push(`${key} appears to be weak or test key`)
        recommendations.push(`Generate a strong ${key} and use environment variables`)
      }

      // 检查是否使用了推荐的安全API密钥格式
      if (value && value.startsWith('sk-') && !value.includes('live')) {
        warnings.push(`${key} appears to be a test key`)
        recommendations.push(`Use a production ${key} instead`)
      }
    }

    // 确保至少有一个AI服务可用
    const hasAnyAIKey = requiredKeys.some(key => config[key] && config[key].length > 20)
    if (!hasAnyAIKey) {
      errors.push('At least one AI service API key must be configured')
    }
  }

  /**
   * 验证加密配置
   */
  private static validateEncryptionSettings(config: StrictEnvConfig, errors: string[], warnings: string[]): void {
    const sessionSecret = config.SESSION_SECRET
    
    if (!sessionSecret || sessionSecret.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters')
    }

    if (config.NODE_ENV === 'production' && sessionSecret.length < 64) {
      errors.push('SESSION_SECRET must be at least 64 characters in production')
    }

    if (sessionSecret.includes('dev') || sessionSecret.includes('test')) {
      errors.push('SESSION_SECRET cannot contain "dev" or "test" in production')
    }
  }

  /**
   * 验证会话安全
   */
  private static validateSessionSecurity(config: StrictEnvConfig, errors: string[], warnings: string[]): void {
    const sessionConfig = {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax'
    }

    if (!sessionConfig.secure) {
      warnings.push('Session cookies should be secure in production')
    }

    if (!sessionConfig.httpOnly) {
      errors.push('Session cookies must be HTTP-only')
    }

    if (sessionConfig.maxAge > 24 * 60 * 60 * 1000) {
      warnings.push('Session max age should not exceed 24 hours')
    }
  }

  /**
   * 验证CORS安全
   */
  private static validateCORSSecurity(config: StrictEnvConfig, errors: string[], warnings: string[]): void {
    if (config.CORS_ORIGIN === '*') {
      if (config.NODE_ENV === 'production') {
        errors.push('CORS_ORIGIN should not be "*" in production')
      } else {
        warnings.push('CORS_ORIGIN should be restricted in production')
      }
    }
  }

  /**
   * 验证依赖包安全
   */
  private static validateDependencySecurity(errors: string[], warnings: string[]): void {
    const vulnerablePackages = [
      'lodash',
      'moment',
      'request',
      'node-fetch',
      'axios',
      'uuid'
    ]

    vulnerablePackages.forEach(pkg => {
      warnings.push(`Consider replacing ${pkg} with a more secure alternative`)
    })
  }

  /**
   * 验证环境变量安全
   */
  private static validateEnvironmentVariables(config: StrictEnvConfig, errors: string[], warnings: string[]): void {
    const sensitiveKeys = ['DATABASE_URL', 'SESSION_SECRET', 'MASTER_SECRET']
    
    sensitiveKeys.forEach(key => {
      const value = process.env[key]
      
      if (!value) {
        errors.push(`${key} is required`)
      }

      if (typeof value === 'string' && value.length > 0) {
        // 检查常见的不安全模式
        const insecurePatterns = [
          /password/i,
          /secret/i,
          /key/i,
          /token/i,
          /auth/i,
          /private/i,
          /\b(pass|secret|key|token|auth|private)\b/i
        ]

        for (const pattern of insecurePatterns) {
          if (pattern.test(value)) {
            warnings.push(`${key} contains potentially sensitive information in plain text`)
            recommendations.push(`Use environment variables for ${key}`)
            break
          }
        }
      }
    })

    // 检查默认的生产值
    if (process.env.NODE_ENV === 'production') {
      const defaultValues = [
        { key: 'DATABASE_URL', check: (value: string) => value.includes('localhost') },
        { key: 'MASTER_SECRET', check: (value: string) => value.includes('dev') },
        { key: 'SESSION_SECRET', check: (value: string) => value.length < 64 }
      ]

      defaultValues.forEach(({ key, check }) => {
        const value = process.env[key]
        if (value && check(value)) {
          errors.push(`Default or test value detected for ${key} in production`)
          recommendations.push(`Generate a secure ${key} for production`)
        }
      })
    }
  }

  /**
   * 检查是否为弱API密钥
   */
  private static isWeakAPIKey(key: string): boolean {
    // 检查常见的弱密钥模式
    const weakPatterns = [
      /^(sk|pk)_test_/i, // 测试密钥
      /^(sk|pk)_[a-f0-9]{32}$/i, // 32字符十六进制
      /^([a-z]+[0-9]+){1,}$/i, // 简单模式
      /^.{1,8}$/i, // 短密钥
      /demo|example|sample|test|fake/i, // 示例密钥
      /(aaa|bbb|ccc|ddd|111|222|333|444|555|666|777|888|999|000)/i, // 重复字符
      /^(sk|pk)[a-f0-9]{10}.$/i // 简短密钥
    ]

    return weakPatterns.some(pattern => pattern.test(key))
  }

  /**
   * 生成安全密钥
   */
  static generateSecureKey(length: number = 64): string {
    const crypto = require('crypto')
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 验证当前配置
   */
  static async validateCurrentConfig(): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
    recommendations: string[]
  }> {
    logger.info('开始验证当前配置安全性...')

    const result = this.validateProductionSecurity()
    
    // 记录验证结果
    if (result.errors.length > 0) {
      logger.error('安全配置验证失败:', result.errors)
    }
    
    if (result.warnings.length > 0) {
      logger.warn('安全配置警告:', result.warnings)
    }
    
    if (result.recommendations.length > 0) {
      logger.info('安全配置建议:', result.recommendations)
    }

    return result
  }
}

export default SecurityConfigValidator