import { createServiceLogger } from './logger'
import { monitoringAlertSystem } from './monitoring-alert-system'
import { memoryLeakDetector } from './memory-leak-detector'
import { cacheManager } from './cache'

const logger = createServiceLogger('LogAggregator')

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  service?: string
  traceId?: string
  userId?: string
  requestId?: string
  ip?: string
  userAgent?: string
  duration?: number
  error?: {
    name: string
    message: string
    stack: string
    code?: string
  }
  metadata?: Record<string, any>
  tags?: string[]
}

export interface LogAggregationRule {
  pattern: string | RegExp
  action: 'AGGREGATE' | 'ALERT' | 'FILTER'
  window: number // 聚合窗口（秒）
  threshold?: number // 阈值
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN'
}

export interface AggregatedLog {
  pattern: string
  count: number
  firstSeen: number
  lastSeen: number
  levels: Record<string, number>
  samples: LogEntry[]
  alertTriggered?: boolean
}

/**
 * 日志聚合系统
 * 提供日志收集、聚合、分析和存储功能
 */
export class LogAggregator {
  private logBuffer: LogEntry[] = []
  private aggregatedLogs = new Map<string, AggregatedLog>()
  private aggregationRules = new Map<string, LogAggregationRule>()
  private bufferSize = 10000
  private flushInterval = 30000 // 30秒
  private maxRetainedLogs = 100000 // 保留最多10万条日志
  private aggregationInterval?: NodeJS.Timeout
  private flushTimeout?: NodeJS.Timeout

  constructor() {
    this.setupDefaultAggregationRules()
    this.startLogProcessing()
  }

  /**
   * 设置默认聚合规则
   */
  private setupDefaultAggregationRules(): void {
    const defaultRules: LogAggregationRule[] = [
      // 错误聚合
      {
        pattern: 'error',
        action: 'AGGREGATE',
        window: 300, // 5分钟
        aggregation: 'COUNT',
        threshold: 5
      },
      // 数据库错误
      {
        pattern: /database.*error/i,
        action: 'ALERT',
        window: 60, // 1分钟
        aggregation: 'COUNT',
        threshold: 1
      },
      // 认证失败
      {
        pattern: /authentication.*failed|login.*failed/i,
        action: 'AGGREGATE',
        window: 300, // 5分钟
        aggregation: 'COUNT',
        threshold: 3
      },
      // API限流
      {
        pattern: /rate.*limit.*exceeded/i,
        action: 'AGGREGATE',
        window: 60, // 1分钟
        aggregation: 'COUNT',
        threshold: 10
      },
      // 内存警告
      {
        pattern: /memory.*warning|out of memory/i,
        action: 'ALERT',
        window: 60, // 1分钟
        aggregation: 'COUNT',
        threshold: 1
      },
      // 慢查询
      {
        pattern: /slow.*query|query.*timeout/i,
        action: 'AGGREGATE',
        window: 300, // 5分钟
        aggregation: 'COUNT',
        threshold: 3
      },
      // 连接失败
      {
        pattern: /connection.*failed|timeout.*error/i,
        action: 'AGGREGATE',
        window: 180, // 3分钟
        aggregation: 'COUNT',
        threshold: 5
      }
    ]

    for (let i = 0; i < defaultRules.length; i++) {
      const ruleId = `rule_${i}`
      this.aggregationRules.set(ruleId, defaultRules[i])
    }

    logger.info('已设置默认日志聚合规则', { count: defaultRules.length })
  }

  /**
   * 启动日志处理
   */
  private startLogProcessing(): void {
    // 定期聚合日志
    this.aggregationInterval = setInterval(() => {
      this.aggregateLogs()
    }, this.flushInterval)

    // 定期刷新到存储
    this.scheduleFlush()

    logger.info('日志聚合处理已启动')
  }

  /**
   * 添加日志条目
   */
  addLog(logEntry: LogEntry): void {
    // 确保时间戳
    if (!logEntry.timestamp) {
      logEntry.timestamp = Date.now()
    }

    // 添加到缓冲区
    this.logBuffer.push(logEntry)

    // 检查是否需要立即刷新
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushToStorage()
    }

    // 检查紧急日志
    if (logEntry.level === 'fatal' || logEntry.level === 'error') {
      this.processUrgentLog(logEntry)
    }
  }

  /**
   * 批量添加日志
   */
  addLogs(logEntries: LogEntry[]): void {
    for (const entry of logEntries) {
      this.addLog(entry)
    }
  }

  /**
   * 聚合日志
   */
  private aggregateLogs(): void {
    try {
      const now = Date.now()
      const windowSize = this.flushInterval / 1000

      // 获取当前时间窗口内的日志
      const recentLogs = this.logBuffer.filter(log => 
        now - log.timestamp <= windowSize * 1000
      )

      // 对每个规则进行聚合
      for (const [ruleId, rule] of this.aggregationRules) {
        const matchingLogs = recentLogs.filter(log => 
          this.matchesPattern(log.message, rule.pattern)
        )

        if (matchingLogs.length === 0) {
          continue
        }

        const aggregated = this.performAggregation(ruleId, rule, matchingLogs)
        this.aggregatedLogs.set(`${ruleId}:${rule.pattern}`, aggregated)

        // 检查是否需要触发告警
        if (rule.action === 'ALERT' || 
            (rule.action === 'AGGREGATE' && rule.threshold && aggregated.count >= rule.threshold)) {
          this.triggerLogAlert(rule, aggregated)
        }
      }

      // 清理过期的聚合日志
      this.cleanupExpiredAggregatedLogs(now)

    } catch (error: unknown) {
      logger.error('日志聚合失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 检查模式匹配
   */
  private matchesPattern(message: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return message.toLowerCase().includes(pattern.toLowerCase())
    } else if (pattern instanceof RegExp) {
      return pattern.test(message)
    }
    return false
  }

  /**
   * 执行聚合
   */
  private performAggregation(
    ruleId: string, 
    rule: LogAggregationRule, 
    logs: LogEntry[]
  ): AggregatedLog {
    const firstSeen = Math.min(...logs.map(l => l.timestamp))
    const lastSeen = Math.max(...logs.map(l => l.timestamp))
    
    // 按级别统计
    const levels: Record<string, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0
    }

    for (const log of logs) {
      levels[log.level]++
    }

    // 保存样本（最多10条）
    const samples = logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    // 计算聚合值
    let value = 0
    switch (rule.aggregation) {
      case 'COUNT':
        value = logs.length
        break
      case 'SUM':
        value = logs.reduce((sum, log) => sum + (log.duration || 0), 0)
        break
      case 'AVG':
        value = logs.reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length
        break
      case 'MAX':
        value = Math.max(...logs.map(log => log.duration || 0))
        break
      case 'MIN':
        value = Math.min(...logs.map(log => log.duration || 0))
        break
    }

    return {
      pattern: rule.pattern.toString(),
      count: logs.length,
      firstSeen,
      lastSeen,
      levels,
      samples,
      alertTriggered: false
    }
  }

  /**
   * 触发日志告警
   */
  private triggerLogAlert(rule: LogAggregationRule, aggregated: AggregatedLog): void {
    const alertMessage = `日志聚合告警: ${rule.pattern} 在 ${rule.window}秒内出现 ${aggregated.count} 次`
    
    logger.error('日志聚合告警', {
      pattern: rule.pattern,
      count: aggregated.count,
      window: rule.window,
      threshold: rule.threshold,
      samples: aggregated.samples.slice(0, 3)
    })

    // 这里可以集成告警系统
    // monitoringAlertSystem.triggerCustomAlert({
    //   name: '日志聚合告警',
    //   message: alertMessage,
    //   severity: 'HIGH'
    // })
  }

  /**
   * 处理紧急日志
   */
  private processUrgentLog(logEntry: LogEntry): void {
    // 立即刷新到存储
    this.flushToStorage()

    // 发送实时通知
    logger.error('紧急日志', {
      level: logEntry.level,
      message: logEntry.message,
      service: logEntry.service,
      traceId: logEntry.traceId
    })

    // 可以集成其他通知渠道
    // this.sendUrgentNotification(logEntry)
  }

  /**
   * 清理过期的聚合日志
   */
  private cleanupExpiredAggregatedLogs(now: number): void {
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    for (const [key, aggregated] of this.aggregatedLogs) {
      if (now - aggregated.lastSeen > maxAge) {
        this.aggregatedLogs.delete(key)
      }
    }
  }

  /**
   * 刷新到存储
   */
  private flushToStorage(): void {
    if (this.logBuffer.length === 0) {
      return
    }

    try {
      // 异步刷新到存储（数据库、文件系统等）
      this.persistLogs([...this.logBuffer])
        .catch(error => {
          logger.error('日志持久化失败', { error: error.message })
        })

      // 清空缓冲区
      this.logBuffer = []

      logger.debug('日志已刷新到存储', { count: this.logBuffer.length })

    } catch (error: unknown) {
      logger.error('日志刷新失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 持久化日志
   */
  private async persistLogs(logs: LogEntry[]): Promise<void> {
    // 存储到缓存
    await cacheManager.set('logs:batch', {
      logs,
      timestamp: Date.now()
    }, 3600) // 1小时过期

    // 这里可以添加其他存储方式：
    // 1. 写入文件
    // 2. 发送到日志服务（如ELK）
    // 3. 写入数据库
    // 4. 发送到外部日志聚合服务

    // 示例：写入文件（仅用于开发环境）
    if (process.env.NODE_ENV === 'development') {
      await this.writeLogsToFile(logs)
    }
  }

  /**
   * 写入日志到文件
   */
  private async writeLogsToFile(logs: LogEntry[]): Promise<void> {
    try {
      const fs = require('fs').promises
      const path = require('path')
      
      const logDir = path.join(process.cwd(), 'logs')
      const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`)
      
      // 确保日志目录存在
      await fs.mkdir(logDir, { recursive: true })
      
      // 格式化日志条目
      const logLines = logs.map(log => 
        JSON.stringify({
          timestamp: new Date(log.timestamp).toISOString(),
          level: log.level,
          service: log.service,
          message: log.message,
          traceId: log.traceId,
          userId: log.userId,
          ip: log.ip,
          duration: log.duration,
          error: log.error
        })
      )

      // 写入文件
      await fs.appendFile(logFile, logLines.join('\n') + '\n')

    } catch (error: unknown) {
      logger.error('写入日志文件失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 安排刷新
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
    }

    this.flushTimeout = setTimeout(() => {
      this.flushToStorage()
      this.scheduleFlush() // 递归安排下次刷新
    }, this.flushInterval)
  }

  /**
   * 获取日志统计
   */
  getLogStats(): {
    bufferSize: number
    aggregatedCount: number
    recentErrors: LogEntry[]
    topErrors: Array<{ pattern: string; count: number }>
  } {
    const now = Date.now()
    const recentTime = now - 60 * 60 * 1000 // 最近1小时

    // 最近的错误日志
    const recentErrors = this.logBuffer
      .filter(log => log.level === 'error' && log.timestamp > recentTime)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    // 错误统计
    const errorStats = new Map<string, number>()
    for (const log of this.logBuffer) {
      if (log.level === 'error') {
        for (const [ruleId, rule] of this.aggregationRules) {
          if (this.matchesPattern(log.message, rule.pattern)) {
            const key = rule.pattern.toString()
            errorStats.set(key, (errorStats.get(key) || 0) + 1)
            break
          }
        }
      }
    }

    const topErrors = Array.from(errorStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }))

    return {
      bufferSize: this.logBuffer.length,
      aggregatedCount: this.aggregatedLogs.size,
      recentErrors,
      topErrors
    }
  }

  /**
   * 获取聚合日志
   */
  getAggregatedLogs(pattern?: string): AggregatedLog[] {
    if (pattern) {
      return Array.from(this.aggregatedLogs.values())
        .filter(log => log.pattern.includes(pattern))
    }

    return Array.from(this.aggregatedLogs.values())
  }

  /**
   * 搜索日志
   */
  searchLogs(query: {
    level?: string
    service?: string
    startTime?: number
    endTime?: number
    text?: string
    limit?: number
  }): LogEntry[] {
    let results = [...this.logBuffer]

    // 按级别过滤
    if (query.level) {
      results = results.filter(log => log.level === query.level)
    }

    // 按服务过滤
    if (query.service) {
      results = results.filter(log => log.service === query.service)
    }

    // 按时间范围过滤
    if (query.startTime) {
      const startTime = query.startTime
      results = results.filter(log => log.timestamp >= startTime)
    }
    if (query.endTime) {
      const endTime = query.endTime
      results = results.filter(log => log.timestamp <= endTime)
    }

    // 按文本搜索
    if (query.text) {
      const searchText = query.text.toLowerCase()
      results = results.filter(log => 
        log.message.toLowerCase().includes(searchText) ||
        (log.error?.message && log.error.message.toLowerCase().includes(searchText))
      )
    }

    // 排序和限制
    results = results.sort((a, b) => b.timestamp - a.timestamp)
    
    if (query.limit) {
      results = results.slice(0, query.limit)
    }

    return results
  }

  /**
   * 添加聚合规则
   */
  addAggregationRule(ruleId: string, rule: LogAggregationRule): void {
    this.aggregationRules.set(ruleId, rule)
    logger.info('添加聚合规则', { ruleId, pattern: rule.pattern })
  }

  /**
   * 移除聚合规则
   */
  removeAggregationRule(ruleId: string): boolean {
    const removed = this.aggregationRules.delete(ruleId)
    if (removed) {
      logger.info('移除聚合规则', { ruleId })
    }
    return removed
  }

  /**
   * 设置缓冲区大小
   */
  setBufferSize(size: number): void {
    this.bufferSize = Math.max(1000, Math.min(100000, size))
    logger.info('日志缓冲区大小已设置', { size: this.bufferSize })
  }

  /**
   * 设置刷新间隔
   */
  setFlushInterval(interval: number): void {
    this.flushInterval = Math.max(5000, Math.min(300000, interval))
    logger.info('日志刷新间隔已设置', { interval: this.flushInterval })
  }

  /**
   * 停止日志聚合
   */
  shutdown(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval)
      this.aggregationInterval = undefined
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = undefined
    }

    // 最后一次刷新
    this.flushToStorage()

    // 清理资源
    this.logBuffer = []
    this.aggregatedLogs.clear()
    this.aggregationRules.clear()

    logger.info('日志聚合系统已关闭')
  }
}

// 创建并导出日志聚合系统单例
export const logAggregator = new LogAggregator()

// 导出日志记录函数
export const log = {
  debug: (message: string, metadata?: Record<string, unknown>) => {
    logAggregator.addLog({
      timestamp: Date.now(),
      level: 'debug',
      message,
      metadata
    })
  },
  
  info: (message: string, metadata?: Record<string, unknown>) => {
    logAggregator.addLog({
      timestamp: Date.now(),
      level: 'info',
      message,
      metadata
    })
  },
  
  warn: (message: string, metadata?: Record<string, unknown>) => {
    logAggregator.addLog({
      timestamp: Date.now(),
      level: 'warn',
      message,
      metadata
    })
  },
  
  error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    logAggregator.addLog({
      timestamp: Date.now(),
      level: 'error',
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      } : undefined,
      metadata
    })
  },
  
  fatal: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    logAggregator.addLog({
      timestamp: Date.now(),
      level: 'fatal',
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      } : undefined,
      metadata
    })
  }
}

export default LogAggregator
