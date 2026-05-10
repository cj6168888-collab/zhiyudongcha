
import { createServiceLogger } from '../lib/logger'
import { memoryLeakDetector } from '../lib/memory-leak-detector'
import { databaseOptimizer } from '../lib/database-optimizer'
import { cacheManager } from '../lib/cache'
import { getStrictConfig } from '../lib/production-security'

const logger = createServiceLogger('AlertingSystem')

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  threshold: number
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  enabled: boolean
  cooldown: number // 冷却时间（秒）
  lastTriggered?: number
  action?: AlertAction
}

export interface AlertAction {
  type: 'WEBHOOK' | 'EMAIL' | 'LOG' | 'SLACK'
  config: Record<string, unknown>
}

interface WebhookConfig {
  url: string;
  [key: string]: unknown;
}

interface EmailConfig {
  recipient: string;
  [key: string]: unknown;
}

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  [key: string]: unknown;
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: string
  message: string
  metric: string
  currentValue: number
  threshold: number
  timestamp: number
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: number
  resolved: boolean
  resolvedAt?: number
}

export interface MetricData {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  labels?: Record<string, string>
}

/**
 * 监控告警系统
 * 提供全面的监控、告警和通知功能
 */
export class MonitoringAlertSystem {
  private alertRules = new Map<string, AlertRule>()
  private activeAlerts = new Map<string, Alert>()
  private metricsHistory = new Map<string, MetricData[]>()
  private isInitialized = false
  private monitoringInterval?: NodeJS.Timeout
  private alertInterval?: NodeJS.Timeout

  private static readonly DEFAULT_RULES: AlertRule[] = [
    {
      id: 'memory-usage-high',
      name: '内存使用率过高',
      description: '当内存使用率超过80%时触发',
      metric: 'memory_usage_ratio',
      threshold: 0.8,
      comparison: 'gt',
      severity: 'HIGH',
      enabled: true,
      cooldown: 300 // 5分钟
    },
    {
      id: 'memory-usage-critical',
      name: '内存使用率危险',
      description: '当内存使用率超过90%时触发',
      metric: 'memory_usage_ratio',
      threshold: 0.9,
      comparison: 'gt',
      severity: 'CRITICAL',
      enabled: true,
      cooldown: 120 // 2分钟
    },
    {
      id: 'cpu-usage-high',
      name: 'CPU使用率过高',
      description: '当CPU使用率超过80%时触发',
      metric: 'cpu_usage_ratio',
      threshold: 0.8,
      comparison: 'gt',
      severity: 'MEDIUM',
      enabled: true,
      cooldown: 300
    },
    {
      id: 'response-time-high',
      name: '响应时间过长',
      description: '当平均响应时间超过1000ms时触发',
      metric: 'avg_response_time',
      threshold: 1000,
      comparison: 'gt',
      severity: 'MEDIUM',
      enabled: true,
      cooldown: 600 // 10分钟
    },
    {
      id: 'error-rate-high',
      name: '错误率过高',
      description: '当错误率超过5%时触发',
      metric: 'error_rate',
      threshold: 0.05,
      comparison: 'gt',
      severity: 'HIGH',
      enabled: true,
      cooldown: 300
    },
    {
      id: 'database-connections-high',
      name: '数据库连接数过多',
      description: '当数据库连接数超过80%时触发',
      metric: 'db_connection_ratio',
      threshold: 0.8,
      comparison: 'gt',
      severity: 'HIGH',
      enabled: true,
      cooldown: 300
    },
    {
      id: 'cache-hit-rate-low',
      name: '缓存命中率过低',
      description: '当缓存命中率低于50%时触发',
      metric: 'cache_hit_rate',
      threshold: 0.5,
      comparison: 'lt',
      severity: 'MEDIUM',
      enabled: true,
      cooldown: 600
    },
    {
      id: 'disk-usage-high',
      name: '磁盘使用率过高',
      description: '当磁盘使用率超过85%时触发',
      metric: 'disk_usage_ratio',
      threshold: 0.85,
      comparison: 'gt',
      severity: 'HIGH',
      enabled: true,
      cooldown: 600
    }
  ]

  constructor() {
    this.loadDefaultRules()
  }

  /**
   * 初始化告警系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('监控告警系统已初始化')
      return
    }

    try {
      logger.info('正在初始化监控告警系统...')

      // 从缓存加载自定义规则
      await this.loadCustomRules()

      // 启动监控
      this.startMonitoring()
      this.startAlertProcessing()

      this.isInitialized = true
      logger.info('监控告警系统初始化完成')

    } catch (error) {
      logger.error('监控告警系统初始化失败', { error: error.message })
      throw error
    }
  }

  /**
   * 加载默认规则
   */
  private loadDefaultRules(): void {
    for (const rule of MonitoringAlertSystem.DEFAULT_RULES) {
      this.alertRules.set(rule.id, rule)
    }
    logger.info('已加载默认告警规则', { count: this.alertRules.size })
  }

  /**
   * 从缓存加载自定义规则
   */
  private async loadCustomRules(): Promise<void> {
    try {
      const customRules = await cacheManager.get('alert:custom_rules') || []

      for (const rule of customRules) {
        this.alertRules.set(rule.id, rule)
      }

      if (customRules.length > 0) {
        logger.info('已加载自定义告警规则', { count: customRules.length })
      }

    } catch (error) {
      logger.error('加载自定义规则失败', { error: error.message })
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics()
    }, 30000) // 每30秒收集一次指标

    logger.info('监控指标收集已启动')
  }

  /**
   * 启动告警处理
   */
  private startAlertProcessing(): void {
    this.alertInterval = setInterval(async () => {
      await this.processAlerts()
    }, 10000) // 每10秒检查一次告警

    logger.info('告警处理已启动')
  }

  /**
   * 收集系统指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now()
      const metrics = await this.gatherAllMetrics()

      // 存储指标历史
      for (const metric of metrics) {
        const history = this.metricsHistory.get(metric.name) || []
        history.push(metric)

        // 保持最近100个数据点
        if (history.length > 100) {
          this.metricsHistory.set(metric.name, history.slice(-100))
        } else {
          this.metricsHistory.set(metric.name, history)
        }
      }

      // 检查告警
      await this.checkAlerts(metrics)

    } catch (error) {
      logger.error('收集系统指标失败', { error: error.message })
    }
  }

  /**
   * 收集所有指标
   */
  private async gatherAllMetrics(): Promise<MetricData[]> {
    const timestamp = Date.now()
    const metrics: MetricData[] = []

    // 1. 内存指标
    const memoryStats = memoryLeakDetector.getMemoryStats()
    metrics.push({
      name: 'memory_usage_ratio',
      value: memoryStats.current.heapUsed / memoryStats.current.heapTotal,
      timestamp,
      tags: { component: 'memory' }
    })

    metrics.push({
      name: 'memory_heap_used',
      value: memoryStats.current.heapUsed,
      timestamp,
      tags: { component: 'memory', unit: 'bytes' }
    })

    // 2. CPU指标
    const cpuUsage = process.cpuUsage()
    metrics.push({
      name: 'cpu_usage_ratio',
      value: (cpuUsage.user + cpuUsage.system) / 1000000, // 转换为秒
      timestamp,
      tags: { component: 'cpu' }
    })

    // 3. 数据库指标
    const dbStats = await databaseOptimizer.getPerformanceMetrics()
    const connectionUtilization = dbStats.connectionStats.totalCount > 0
      ? dbStats.connectionStats.activeCount / dbStats.connectionStats.totalCount
      : 0

    metrics.push({
      name: 'db_connection_ratio',
      value: connectionUtilization,
      timestamp,
      tags: { component: 'database' }
    })

    metrics.push({
      name: 'avg_response_time',
      value: dbStats.connectionStats.averageUseTime,
      timestamp,
      tags: { component: 'database', unit: 'ms' }
    })

    // 4. 缓存指标
    const cacheMetrics = cacheManager.getMetrics()
    metrics.push({
      name: 'cache_hit_rate',
      value: cacheMetrics.hitRate,
      timestamp,
      tags: { component: 'cache' }
    })

    // 5. 应用指标
    const appMetrics = await this.getApplicationMetrics()
    metrics.push(...appMetrics)

    // 6. 系统指标
    const systemMetrics = await this.getSystemMetrics()
    metrics.push(...systemMetrics)

    return metrics
  }

  /**
   * 获取应用指标
   */
  private async getApplicationMetrics(): Promise<MetricData[]> {
    const timestamp = Date.now()
    const metrics: MetricData[] = []

    try {
      // 错误率（从日志估算）
      const errorRate = await this.calculateErrorRate()
      metrics.push({
        name: 'error_rate',
        value: errorRate,
        timestamp,
        tags: { component: 'application' }
      })

      // 响应时间
      const avgResponseTime = await this.calculateAverageResponseTime()
      metrics.push({
        name: 'avg_response_time',
        value: avgResponseTime,
        timestamp,
        tags: { component: 'application', unit: 'ms' }
      })

      // 活跃用户数
      const activeUsers = await this.getActiveUserCount()
      metrics.push({
        name: 'active_users',
        value: activeUsers,
        timestamp,
        tags: { component: 'application' }
      })

    } catch (error) {
      logger.error('获取应用指标失败', { error: error.message })
    }

    return metrics
  }

  /**
   * 获取系统指标
   */
  private async getSystemMetrics(): Promise<MetricData[]> {
    const timestamp = Date.now()
    const metrics: MetricData[] = []

    try {
      // 磁盘使用率
      const diskUsage = await this.getDiskUsage()
      metrics.push({
        name: 'disk_usage_ratio',
        value: diskUsage,
        timestamp,
        tags: { component: 'system' }
      })

      // 网络延迟（示例）
      const networkLatency = await this.getNetworkLatency()
      metrics.push({
        name: 'network_latency',
        value: networkLatency,
        timestamp,
        tags: { component: 'system', unit: 'ms' }
      })

    } catch (error) {
      logger.error('获取系统指标失败', { error: error.message })
    }

    return metrics
  }

  /**
   * 检查告警
   */
  private async checkAlerts(metrics: MetricData[]): Promise<void> {
    for (const metric of metrics) {
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) {
          continue
        }

        // 检查冷却时间
        if (rule.lastTriggered &&
            Date.now() - rule.lastTriggered < rule.cooldown * 1000) {
          continue
        }

        // 检查阈值
        if (this.shouldTriggerAlert(metric, rule)) {
          await this.triggerAlert(rule, metric)
        }
      }
    }
  }

  /**
   * 检查是否应该触发告警
   */
  private shouldTriggerAlert(metric: MetricData, rule: AlertRule): boolean {
    if (metric.name !== rule.metric) {
      return false
    }

    switch (rule.comparison) {
      case 'gt':
        return metric.value > rule.threshold
      case 'gte':
        return metric.value >= rule.threshold
      case 'lt':
        return metric.value < rule.threshold
      case 'lte':
        return metric.value <= rule.threshold
      case 'eq':
        return metric.value === rule.threshold
      default:
        return false
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, metric: MetricData): Promise<void> {
    const alertId = this.generateAlertId()
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${metric.name} 当前值 ${metric.value} ${this.getComparisonText(rule.comparison)} 阈值 ${rule.threshold}`,
      metric: metric.name,
      currentValue: metric.value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      acknowledged: false
    }

    // 存储告警
    this.activeAlerts.set(alertId, alert)

    // 更新规则的最后触发时间
    rule.lastTriggered = Date.now()

    // 发送通知
    await this.sendNotification(alert, rule)

    logger.warn('告警已触发', {
      alertId,
      ruleName: rule.name,
      severity: rule.severity,
      metric: metric.name,
      currentValue: metric.value,
      threshold: rule.threshold
    })
  }

  /**
   * 发送通知
   */
  private async sendNotification(alert: Alert, rule: AlertRule): Promise<void> {
    try {
      if (!rule.action) {
        return
      }

      switch (rule.action.type) {
        case 'WEBHOOK':
          await this.sendWebhookNotification(alert, rule.action.config)
          break
        case 'EMAIL':
          await this.sendEmailNotification(alert, rule.action.config)
          break
        case 'SLACK':
          await this.sendSlackNotification(alert, rule.action.config)
          break
        case 'LOG':
          logger.error('告警通知', alert)
          break
      }

    } catch (error) {
      logger.error('发送通知失败', {
        alertId: alert.id,
        actionType: rule.action?.type,
        error: error.message
      })
    }
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhookNotification(alert: Alert, config: WebhookConfig): Promise<void> {
    const webhookUrl = config.url

    if (!webhookUrl) {
      logger.warn('Webhook URL未配置')
      return
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      service: 'Navigator-X'
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Assistant-Alerting/1.0'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook请求失败: ${response.status}`)
    }

    logger.debug('Webhook通知发送成功', {
      alertId: alert.id,
      url: webhookUrl
    })
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(alert: Alert, config: EmailConfig): Promise<void> {
    // 这里应该集成邮件服务
    logger.info('邮件通知（待实现）', {
      alertId: alert.id,
      recipient: config.recipient,
      subject: `【${alert.severity}】${alert.ruleName}`,
      message: alert.message
    })
  }

  /**
   * 发送Slack通知
   */
  private async sendSlackNotification(alert: Alert, config: SlackConfig): Promise<void> {
    const webhookUrl = config.webhookUrl

    if (!webhookUrl) {
      logger.warn('Slack Webhook URL未配置')
      return
    }

    const payload = {
      text: `🚨 *${alert.severity}* ${alert.ruleName}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          {
            title: '告警信息',
            value: alert.message,
            short: false
          },
          {
            title: '当前值',
            value: alert.currentValue.toString(),
            short: true
          },
          {
            title: '阈值',
            value: alert.threshold.toString(),
            short: true
          },
          {
            title: '时间',
            value: new Date(alert.timestamp).toLocaleString(),
            short: true
          }
        ]
      }]
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Slack请求失败: ${response.status}`)
    }

    logger.debug('Slack通知发送成功', { alertId: alert.id })
  }

  /**
   * 处理告警
   */
  private async processAlerts(): Promise<void> {
    try {
      // 检查告警恢复
      await this.checkAlertRecovery()

      // 清理过期告警
      await this.cleanupExpiredAlerts()

    } catch (error) {
      logger.error('处理告警失败', { error: error.message })
    }
  }

  /**
   * 检查告警恢复
   */
  private async checkAlertRecovery(): Promise<void> {
    const metrics = await this.gatherAllMetrics()

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.resolved) {
        continue
      }

      const rule = this.alertRules.get(alert.ruleId)
      if (!rule) {
        continue
      }

      // 查找对应的当前指标
      const currentMetric = metrics.find(m => m.name === alert.metric)
      if (!currentMetric) {
        continue
      }

      // 检查是否恢复
      if (this.isAlertRecovered(currentMetric, rule)) {
        alert.resolved = true
        alert.resolvedAt = Date.now()

        logger.info('告警已恢复', {
          alertId,
          ruleName: alert.ruleName,
          metric: alert.metric,
          currentValue: currentMetric.value
        })

        // 发送恢复通知
        await this.sendRecoveryNotification(alert)
      }
    }
  }

  /**
   * 检查告警是否恢复
   */
  private isAlertRecovered(metric: MetricData, rule: AlertRule): boolean {
    switch (rule.comparison) {
      case 'gt':
      case 'gte':
        return metric.value < rule.threshold * 0.9 // 恢复阈值设为告警阈值的90%
      case 'lt':
      case 'lte':
        return metric.value > rule.threshold * 1.1 // 恢复阈值设为告警阈值的110%
      default:
        return false
    }
  }

  /**
   * 清理过期告警
   */
  private async cleanupExpiredAlerts(): Promise<void> {
    const expireTime = Date.now() - 24 * 60 * 60 * 1000 // 24小时

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.timestamp < expireTime) {
        this.activeAlerts.delete(alertId)
        logger.debug('清理过期告警', { alertId })
      }
    }
  }

  /**
   * 发送恢复通知
   */
  private async sendRecoveryNotification(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId)
    if (!rule || !rule.action) {
      return
    }

    const recoveryAlert = {
      ...alert,
      message: `${alert.ruleName}: ${alert.metric} 已恢复正常`,
      resolved: true,
      resolvedAt: Date.now()
    }

    await this.sendNotification(recoveryAlert, rule)
  }

  // 辅助方法
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getComparisonText(comparison: string): string {
    const texts: Record<string, string> = {
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<=',
      'eq': '='
    }
    return texts[comparison] || comparison
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      'LOW': 'good',
      'MEDIUM': 'warning',
      'HIGH': 'danger',
      'CRITICAL': '#ff0000'
    }
    return colors[severity] || 'warning'
  }

  // 模拟方法（需要实际实现）
  private async calculateErrorRate(): Promise<number> {
    // 这里应该从日志系统计算错误率
    return 0.01 // 模拟1%错误率
  }

  private async calculateAverageResponseTime(): Promise<number> {
    // 这里应该从监控系统计算平均响应时间
    return 250 // 模拟250ms
  }

  private async getActiveUserCount(): Promise<number> {
    // 这里应该从会话系统获取活跃用户数
    return 10 // 模拟10个活跃用户
  }

  private async getDiskUsage(): Promise<number> {
    // 这里应该从系统获取磁盘使用率
    return 0.6 // 模拟60%磁盘使用率
  }

  private async getNetworkLatency(): Promise<number> {
    // 这里应该从网络监控获取延迟
    return 50 // 模拟50ms延迟
  }

  /**
   * 获取告警统计
   */
  getAlertStats(): {
    total: number
    active: number
    resolved: number
    bySeverity: Record<string, number>
    recent: Alert[]
  } {
    const alerts = Array.from(this.activeAlerts.values())

    const bySeverity: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    }

    alerts.forEach(alert => {
      if (!alert.resolved) {
        bySeverity[alert.severity]++
      }
    })

    const recent = alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    return {
      total: alerts.length,
      active: alerts.filter(a => !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length,
      bySeverity,
      recent
    }
  }

  /**
   * 添加自定义告警规则
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    logger.info('添加告警规则', { ruleId: rule.id, ruleName: rule.name })
  }

  /**
   * 删除告警规则
   */
  removeAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId)
    if (deleted) {
      logger.info('删除告警规则', { ruleId })
    }
    return deleted
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) {
      return false
    }

    alert.acknowledged = true
    alert.acknowledgedBy = acknowledgedBy
    alert.acknowledgedAt = Date.now()

    logger.info('告警已确认', { alertId, acknowledgedBy })
    return true
  }

  /**
   * 停止监控
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval)
    }

    this.isInitialized = false
    logger.info('监控告警系统已关闭')
  }
}

// 创建并导出监控告警系统单例
export const monitoringAlertSystem = new MonitoringAlertSystem()
