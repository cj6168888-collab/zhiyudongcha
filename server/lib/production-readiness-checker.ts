import { createServiceLogger } from '../lib/logger'
import { getStrictConfig } from '../lib/production-security'
import { monitoringAlertSystem } from '../lib/monitoring-alert-system'
import { databaseOptimizer } from '../lib/database-optimizer'
import { memoryLeakDetector } from '../lib/memory-leak-detector'

const logger = createServiceLogger('ProductionReadinessChecker')

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  timestamp: number
  checks: HealthCheck[]
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
  score: number // 0-100
}

export interface HealthCheck {
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  message: string
  duration: number
  details?: Record<string, any>
}

export interface DeploymentReadiness {
  overallStatus: 'READY' | 'NOT_READY' | 'BLOCKING_ISSUES'
  score: number // 0-100
  checks: HealthCheckResult
  recommendations: string[]
  blockingIssues: string[]
  nextSteps: string[]
}

/**
 * 生产部署就绪性检查器
 */
export class ProductionReadinessChecker {
  private static readonly CHECK_WEIGHTS = {
    CRITICAL: 30,
    HIGH: 20,
    MEDIUM: 10,
    LOW: 5
  }

  constructor() {
    this.initialize()
  }

  /**
   * 初始化检查器
   */
  private initialize(): void {
    // 设置定时健康检查
    setInterval(() => {
      this.performHealthCheck()
    }, 60000) // 每10分钟
  }

  /**
   * 执行完整的健康检查
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      logger.info('开始生产就绪性健康检查...')

      const checks = await Promise.all([
        this.checkSystemRequirements(),
        this.checkDatabaseHealth(),
        this.checkSecurityConfiguration(),
        this.checkPerformanceBaselines(),
        this.checkMonitoringSystems(),
        this.checkDeploymentReadiness(),
        this.checkScalabilityReadiness()
      ])

      const result = this.calculateHealthScore(checks)

      logger.info('健康检查完成', {
        status: result.summary.status,
        score: result.score,
        duration: Date.now() - startTime,
        checks: result.summary.total,
        passed: result.summary.passed,
        failed: result.summary.failed
      })

      return result

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('健康检查失败', { error: errorMessage })

      return {
        status: 'UNHEALTHY',
        timestamp: Date.now(),
        checks: [],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          warnings: 0
        },
        score: 0
      }
    }
  }

  /**
   * 检查系统需求
   */
  private async checkSystemRequirements(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const nodeVersion = process.version
      const memoryUsage = process.memoryUsage()
      const config = getStrictConfig()

      // 检查Node.js版本
      const majorVersion = parseInt(nodeVersion.split('.')[0])
      const isValidVersion = majorVersion >= 18

      // 检查内存使用
      const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
      const isMemoryHealthy = memoryUsageRatio < 0.9

      // 检查必要环境变量
      const requiredVars = ['DATABASE_URL', 'SESSION_SECRET']
      const missingVars = requiredVars.filter(v => !process.env[v])

      const issues: string[] = []

      if (!isValidVersion) {
        issues.push(`Node.js版本过低 (${nodeVersion}), 需要 >= 18`)
      }

      if (!isMemoryHealthy) {
        issues.push(`内存使用率过高: ${(memoryUsageRatio * 100).toFixed(1)}%`)
      }

      if (missingVars.length > 0) {
        issues.push(`缺少必需的环境变量: ${missingVars.join(', ')}`)
      }

      const status = issues.length === 0 ? 'HEALTHY' : 'DEGRADED'
      const message = issues.join('; ') || '系统要求检查通过'

      return {
        name: 'system-requirements',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          nodeVersion,
          memoryUsage: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            ratio: memoryUsageRatio
          },
          missingEnvVars: missingVars
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: 'system-requirements',
        status: 'UNHEALTHY',
        message: `检查失败: ${errorMessage}`,
        duration: Date.now() - startTime,
        details: { error: errorMessage }
      }
    }
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const dbHealth = await databaseOptimizer.healthCheck()

      const status = dbHealth.healthy ? 'HEALTHY' : 'UNHEALTHY'
      const message = dbHealth.healthy
        ? '数据库连接正常'
        : `数据库检查失败: ${dbHealth.error || '未知错误'}`

      return {
        name: 'database-health',
        status,
        message,
        duration: Date.now() - startTime,
        details: dbHealth
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: 'database-health',
        status: 'UNHEALTHY',
        message: `数据库检查失败: ${errorMessage}`,
        duration: Date.now() - startTime,
        details: { error: errorMessage }
      }
    }
  }

  /**
   * 检查安全配置
   */
  private async checkSecurityConfiguration(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const { SecurityConfigValidator } = await import('../lib/production-security')
      const securityResult = SecurityConfigValidator.validateAndGetConfig()

      const issues = []

      // 检查密钥复杂度
      if (securityResult.SESSION_SECRET.length < 64) {
        issues.push('SESSION_SECRET长度不足64字符')
      }

      // 检查API密钥配置
      const hasValidAPIKey = !!(securityResult.DASHSCOPE_API_KEY || securityResult.DEEPSEEK_API_KEY || securityResult.DOUBAO_API_KEY)
      if (!hasValidAPIKey) {
        issues.push('缺少有效的AI服务API密钥')
      }

      // 检查CORS配置
      if (securityResult.CORS_ORIGIN === '*') {
        issues.push('CORS源配置过于宽松')
      }

      const status = issues.length === 0 ? 'HEALTHY' : issues.some(issue => issue.includes('长度不足') || issue.includes('必需')) ? 'CRITICAL' : 'WARNING'
      const message = issues.length === 0 ? '安全配置检查通过' : `安全问题: ${issues.join(', ')}`

      return {
        name: 'security-configuration',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          issues
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: 'security-configuration',
        status: 'UNHEALTHY',
        message: `安全配置检查失败: ${errorMessage}`,
        duration: Date.now() - startTime,
        details: { error: errorMessage }
      }
    }
  }

  /**
   * 检查性能基线
   */
  private async checkPerformanceBaselines(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const memoryStats = memoryLeakDetector.getMemoryStats()
      const dbStats = await databaseOptimizer.getPerformanceMetrics()

      // 检查内存使用
      const memoryUsageRatio = memoryStats.current.heapUsed / memoryStats.current.heapTotal
      const isMemoryHealthy = memoryUsageRatio < 0.8

      // 检查数据库性能
      const avgResponseTime = dbStats.connectionStats.averageUseTime
      const isPerformanceHealthy = avgResponseTime < 500 && memoryUsageRatio < 0.9

      const issues: string[] = []

      if (!isMemoryHealthy) {
        issues.push(`内存使用率过高: ${(memoryUsageRatio * 100).toFixed(1)}%`)
      }

      if (avgResponseTime > 500) {
        issues.push(`平均响应时间过长: ${avgResponseTime}ms`)
      }

      const status = issues.length === 0 ? 'HEALTHY' : (issues.some(issue => issue.includes('过高') || issue.includes('过长')) ? 'DEGRADED' : 'WARNING')
      const message = issues.length === 0 ? '性能基线检查通过' : `性能问题: ${issues.join(', ')}`

      return {
        name: 'performance-baselines',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          memoryStats,
          dbStats,
          issues
        }
      }

    } catch (error) {
      return {
        name: 'performance-baselines',
        status: 'UNHEALTHY',
        message: `性能基线检查失败: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  /**
   * 检查监控系统
   */
  private async checkMonitoringSystems(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      // 检查内存泄漏检测器
      const memoryDetector = memoryLeakDetector.getMemoryStats()
      const hasLeaks = memoryDetector.detectedLeaks.filter(leak => leak.severity === 'HIGH' || leak.severity === 'CRITICAL').length > 0

      // 检查数据库优化器
      const dbStats = databaseOptimizer.getStats()

      // 检查告警系统
      const alertStats = monitoringAlertSystem.getAlertStats()

      const issues: string[] = []

      if (hasLeaks) {
        issues.push(`检测到 ${memoryDetector.detectedLeaks.length} 个内存泄漏`)
      }

      if (dbStats.totalConnections > dbStats.maxUsedCount * 0.8) {
        issues.push(`数据库连接池使用率过高: ${((dbStats.totalConnections / dbStats.maxUsedCount) * 100).toFixed(1)}%`)
      }

      if (alertStats.active > 10) {
        issues.push(`活跃告警数量过多: ${alertStats.active}`)
      }

      const status = issues.length === 0 ? 'HEALTHY' : 'WARNING'
      const message = issues.length === 0 ? '监控系统检查通过' : `监控问题: ${issues.join(', ')}`

      return {
        name: 'monitoring-systems',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          memoryLeakCount: memoryDetector.detectedLeaks.length,
          dbStats,
          alertStats,
          issues
        }
      }

    } catch (error) {
      return {
        name: 'monitoring-systems',
        status: 'UNHEALTHY',
        message: `监控系统检查失败: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  /**
   * 检查部署就绪性
   */
  private async checkDeploymentReadiness(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const config = getStrictConfig()
      const issues: string[] = []

      // 检查必要的部署脚本
      const requiredDeploymentFiles = [
        'package.json',
        'tsconfig.json',
        'server/tsconfig.json',
        'docker-compose.yml',
        '.env.example'
      ]

      // 检查环境配置
      if (config.NODE_ENV === 'production') {
        if (!config.REDIS_HOST) {
          issues.push('生产环境缺少Redis配置')
        }

        if (!config.REDIS_PASSWORD) {
          issues.push('生产环境Redis缺少密码配置')
        }

        if (!config.DATABASE_POOL_MAX || parseInt(config.DATABASE_POOL_MAX) < 10) {
          issues.push('生产环境数据库连接池大小过小')
        }
      }

      // 检查日志配置
      if (!config.LOG_LEVEL || config.LOG_LEVEL === 'debug') {
        issues.push('生产环境不应使用debug日志级别')
      }

      const status = issues.length === 0 ? 'HEALTHY' : 'DEGRADED'
      const message = issues.length === 0 ? '部署就绪性检查通过' : `部署问题: ${issues.join(', ')}`

      return {
        name: 'deployment-readiness',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          requiredDeploymentFiles,
          configIssues: issues
        }
      }

    } catch (error) {
      return {
        name: 'deployment-readiness',
        status: 'UNHEALTHY',
        message: `部署就绪性检查失败: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  /**
   * 检查扩展性就绪性
   */
  private async checkScalabilityReadiness(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const config = getStrictConfig()
      const issues: string[] = []

      // 检查负载均衡支持
      if (config.NODE_ENV === 'production') {
        // 这里应该检查是否有负载均衡配置
        if (!process.env.LOAD_BALANCER_URL) {
          issues.push('生产环境缺少负载均衡器配置')
        }
      }

      // 检查缓存策略
      if (!config.REDIS_HOST) {
        issues.push(' 缺少Redis缓存，影响可扩展性')
      }

      // 检查数据库连接池配置
      const maxConnections = parseInt(config.DATABASE_POOL_MAX) || 20
      if (maxConnections < 50) {
        issues.push(`最大连接数设置过小 (${maxConnections})，可能影响高并发`)
      }

      const status = issues.length === 0 ? 'HEALTHY' : 'WARNING'
      const message = issues.length === 0 ? '扩展性检查通过' : `扩展性问题: ${issues.join(', ')}`

      return {
        name: 'scalability-readiness',
        status,
        message,
        duration: Date.now() - startTime,
        details: {
          scalabilityIssues: issues
        }
      }

    } catch (error) {
      return {
        name: 'scalability-readiness',
        status: 'UNHEALHYY',
        message: `扩展性检查失败: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(checks: HealthCheck[]): HealthCheckResult {
    let totalWeight = 0
    let passedWeight = 0

    const summary = {
      total: checks.length,
      passed: 0,
      failed: 0,
      warnings: 0
    }

    for (const check of checks) {
      totalWeight += this.getCheckWeight(check.status)

      if (check.status === 'HEALTHY') {
        summary.passed++
        passedWeight += this.getCheckWeight(check.status)
      } else if (check.status === 'DEGRADED') {
        summary.failed++
      } else if (check.status === 'WARNING') {
        summary.warnings++
      }
    }

    // 计算最终分数 (0-100)
    const score = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0

    return {
      status: score >= 80 ? 'HEALTHY' : score >= 60 ? 'DEGRADED' : 'UNHEALTY',
      timestamp: Date.now(),
      checks,
      summary,
      score
    }
  }

  /**
   * 获取检查权重
   */
  private getCheckWeight(status: string): number {
    switch (status) {
      case 'HEALTHY':
        return 100
      case 'DEGRADED':
        return ProductionReadinessChecker.CHECK_WEIGHTS.HIGH
      case 'WARNING':
        return ProductionReadinessChecker.CHECK_WEIGHTS.MEDIUM
      case 'UNHEALTHY':
        return 0
      default:
        return ProductionReadinessChecker.CHECK_WEIGHTS.LOW
    }
  }

  /**
   * 获取完整的部署就绪性评估
   */
  async getDeploymentReadiness(): Promise<DeploymentReadiness> {
    const healthCheck = await this.performHealthCheck()

    // 分析关键指标
    const criticalIssues = healthCheck.checks.filter(check =>
      check.status === 'UNHEALTY'
    ).length

    const highIssues = healthCheck.checks.filter(check =>
      check.status === 'DEGRADED'
    ).length

    const lowIssues = healthCheck.checks.filter(check =>
      check.status === 'WARNING'
    ).length

    // 生成建议
    const recommendations: string[] = []
    const blockingIssues: string[] = []

    // 阻塞问题
    if (criticalIssues > 0) {
      blockingIssues.push(...criticalIssues.map(check => `${check.name}: ${check.message}`))
      recommendations.push('立即解决所有关键问题才能部署')
    }

    // 高优先级问题
    if (highIssues > 0) {
      recommendations.push('优先解决高优先级问题')
    }

    // 中优先级问题
    if (lowIssues > 0) {
      recommendations.push('计划解决中优先级问题')
    }

    // 通用建议
    if (healthCheck.score < 80) {
      recommendations.push('继续优化以达到生产标准')
    }

    // 下一步行动
    if (healthCheck.score < 60) {
      blockingIssues.push('当前状态不适合生产部署')
    } else if (healthCheck.score < 80 && criticalIssues.length === 0) {
      recommendations.push('考虑解决警告级别问题后部署')
    } else {
      recommendations.push('系统基本就绪，可以进行生产部署')
    }

    const overallStatus = healthCheck.score >= 80 ? 'READY' :
                        healthCheck.score >= 60 ? 'NOT_READY' : 'BLOCKING_ISSUES'

    return {
      overallStatus,
      score: healthCheck.score,
      checks: healthCheck,
      recommendations,
      blockingIssues,
      nextSteps: [
        '1. 解决所有关键问题',
        '2. 进行完整的集成测试',
        '3. 配置生产监控',
        '4. 准备部署文档',
        '5. 进行负载测试'
      ]
    }
  }

  /**
   * 生成部署检查报告
   */
  generateDeploymentReport(): string {
    return `
## 🚀 领航者 (Navigator-X) 生产部署就绪性报告

### 📊 检查时间
${new Date().toISOString()}

### 🎯 总体状态
- **综合评分**: ${healthCheck.score}/100
- **部署状态**: ${healthCheck.status}
- **健康检查**: ${healthCheck.summary.passed}/${healthCheck.summary.total} 通过

### 📋 检查详情
${healthCheck.checks.map(check =>
  `**${check.status.toUpperCase()}**: ${check.name}\n   ${check.message}\n   耗时: ${check.duration}ms`
  ).join('\n')}

### 🚨 关键问题
${blockingIssues.length > 0 ? blockingIssues.join('\n') : '无关键问题'}

### 📋 优先级修复
${recommendations.join('\n')}

---
*报告生成工具: ProductionReadinessChecker*
*下次检查: 建议在修复问题后重新评估
    `
  }
  /**
   * 定期检查方法
   */
  async scheduleRegularChecks(): Promise<void> {
    const readiness = await this.getDeploymentReadiness()

    logger.info('定期就绪性检查完成', {
      score: readiness.score,
      status: readiness.overallStatus,
      blockingIssues: readiness.blockingIssues.length
    })
  }
}

export const productionReadinessChecker = new ProductionReadinessChecker()
