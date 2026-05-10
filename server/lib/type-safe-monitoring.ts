import { createServiceLogger } from './logger'
import { getStrictConfig } from './production-security'
import { cacheManager } from './cache'

const logger = createServiceLogger('TypeSafeMonitoring')

export interface TraceContext {
  traceId: string
  parentId?: string
  spanId?: string
  startTime: number
  tags?: Record<string, string>
  metadata?: Record<string, unknown>
  spans?: Map<string, Span>
}

interface SerializedTraceContext {
  traceId: string;
  startTime: number;
  metadata?: Record<string, unknown>;
  parentId?: string;
  spanId?: string;
  tags?: Record<string, string>;
  spans?: Array<[string, Span]>;
}

export interface Span {
  spanId: string
  parentId?: string
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'ok' | 'error'
  tags?: Record<string, string>
  logs?: Array<{
    timestamp: number
    level: string
    message: string
  }>
}

export interface MetricData {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
}

/**
 * 类型安全的监控服务
 * 修复TypeScript严格模式违规，添加类型安全保障
 */
export class TypeSafeMonitoringService {
  private activeTraces = new Map<string, TraceContext>()
  private metrics = new Map<string, MetricData[]>()
  private isInitialized = false

  constructor() {
    this.initializeSafeDefaults()
  }

  /**
   * 初始化类型安全的默认值
   */
  private initializeSafeDefaults(): void {
    // 确保所有Map都有默认值
    if (this.activeTraces.size === 0) {
      this.activeTraces.clear()
    }
    
    if (this.metrics.size === 0) {
      this.metrics.clear()
    }
  }

  /**
   * 初始化监控服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('TypeSafeMonitoringService 已初始化')
      return
    }

    try {
      logger.info('正在初始化类型安全监控服务...')

      // 从缓存加载现有数据
      await this.loadFromCache()

      this.isInitialized = true
      logger.info('类型安全监控服务初始化完成')

    } catch (error) {
      logger.error('类型安全监控服务初始化失败', { error: error.message })
      throw error
    }
  }

  /**
   * 创建追踪上下文（类型安全）
   */
  createTraceContext(traceId?: string, metadata?: Record<string, unknown>): TraceContext {
    const traceContext: TraceContext = {
      traceId: traceId || this.generateTraceId(),
      startTime: Date.now(),
      metadata: metadata || {}
    }

    // 类型安全的Map操作
    this.activeTraces.set(traceContext.traceId, traceContext)
    
    logger.debug('创建追踪上下文', { traceId: traceContext.traceId })
    return traceContext
  }

  /**
   * 添加Span到追踪上下文（类型安全）
   */
  addSpanToTrace(traceId: string, span: Span): boolean {
    const traceContext = this.activeTraces.get(traceId)
    if (!traceContext) {
      logger.warn('追踪上下文不存在', { traceId })
      return false
    }

    // 创建span的Map（如果不存在）
    if (!traceContext.spans) {
      traceContext.spans = new Map<string, Span>()
    }

    // 类型安全的Map操作
    traceContext.spans.set(span.spanId, span)
    
    logger.debug('添加Span到追踪', { 
      traceId, 
      spanId: span.spanId,
      operationName: span.operationName 
    })
    
    return true
  }

  /**
   * 结束Span（类型安全）
   */
  finishSpan(traceId: string, spanId: string, status: 'ok' | 'error' = 'ok'): boolean {
    const traceContext = this.activeTraces.get(traceId)
    if (!traceContext || !traceContext.spans) {
      logger.warn('追踪上下文或Span不存在', { traceId, spanId })
      return false
    }

    const span = traceContext.spans.get(spanId)
    if (!span) {
      logger.warn('Span不存在', { traceId, spanId })
      return false
    }

    // 更新Span状态
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = status

    logger.debug('Span已完成', { 
      traceId, 
      spanId, 
      duration: span.duration,
      status 
    })
    
    return true
  }

  /**
   * 移除Span（类型安全）
   */
  removeSpan(traceId: string, spanId: string): boolean {
    const traceContext = this.activeTraces.get(traceId)
    if (!traceContext || !traceContext.spans) {
      return false
    }

    const removed = traceContext.spans.delete(spanId)
    if (removed) {
      logger.debug('Span已移除', { traceId, spanId })
    }
    
    return removed
  }

  /**
   * 记录指标（类型安全）
   */
  recordMetric(metric: MetricData): void {
    // 验证指标数据
    if (!this.validateMetricData(metric)) {
      logger.error('指标数据验证失败', { metric })
      return
    }

    // 获取或创建指标数组
    let metricArray = this.metrics.get(metric.name)
    if (!metricArray) {
      metricArray = []
      this.metrics.set(metric.name, metricArray)
    }

    // 添加指标（保持最近1000条记录）
    metricArray.push(metric)
    if (metricArray.length > 1000) {
      this.metrics.set(metric.name, metricArray.slice(-1000))
    }

    logger.debug('指标已记录', { 
      name: metric.name,
      value: metric.value,
      type: metric.type
    })
  }

  /**
   * 验证指标数据（类型安全）
   */
  private validateMetricData(metric: MetricData): boolean {
    // 检查必需字段
    if (!metric.name || typeof metric.name !== 'string') {
      return false
    }

    if (typeof metric.value !== 'number') {
      return false
    }

    if (!metric.timestamp || typeof metric.timestamp !== 'number') {
      return false
    }

    if (!metric.type || !['counter', 'gauge', 'histogram', 'timer'].includes(metric.type)) {
      return false
    }

    // 检查可选字段类型
    if (metric.tags && typeof metric.tags !== 'object') {
      return false
    }

    return true
  }

  /**
   * 获取追踪上下文（类型安全）
   */
  getTraceContext(traceId: string): TraceContext | undefined {
    return this.activeTraces.get(traceId)
  }

  /**
   * 获取所有活跃追踪
   */
  getActiveTraces(): Map<string, TraceContext> {
    return new Map(this.activeTraces)
  }

  /**
   * 获取指标数据（类型安全）
   */
  getMetrics(metricName?: string): Map<string, MetricData[]> {
    if (metricName) {
      const metricData = this.metrics.get(metricName)
      return metricData ? new Map([[metricName, metricData]]) : new Map()
    }
    return new Map(this.metrics)
  }

  /**
   * 清理过期数据（类型安全）
   */
  cleanup(): number {
    let cleanedCount = 0
    const now = Date.now()
    const cleanupThreshold = 60 * 60 * 1000 // 1小时

    // 清理过期的追踪
    for (const [traceId, traceContext] of this.activeTraces) {
      if (now - traceContext.startTime > cleanupThreshold) {
        this.activeTraces.delete(traceId)
        cleanedCount++
      }
    }

    // 清理过期的指标
    for (const [metricName, metricArray] of this.metrics) {
      const validMetrics = metricArray.filter(metric => 
        now - metric.timestamp <= cleanupThreshold
      )
      
      if (validMetrics.length < metricArray.length) {
        this.metrics.set(metricName, validMetrics)
        cleanedCount += metricArray.length - validMetrics.length
      }
    }

    if (cleanedCount > 0) {
      logger.info('清理过期监控数据', { count: cleanedCount })
    }

    return cleanedCount
  }

  /**
   * 保存到缓存（类型安全）
   */
  async saveToCache(): Promise<void> {
    try {
      // 准备要保存的数据
      const dataToSave = {
        traces: Array.from(this.activeTraces.entries()).map(([traceId, context]) => ({
          traceId,
          context: this.serializeTraceContext(context)
        })),
        metrics: Array.from(this.metrics.entries()).map(([name, data]) => ({
          name,
          data
        })),
        timestamp: Date.now()
      }

      // 保存到Redis
      await cacheManager.set('monitoring:data', dataToSave, 3600) // 1小时过期
      
      logger.debug('监控数据已保存到缓存', {
        tracesCount: dataToSave.traces.length,
        metricsCount: dataToSave.metrics.length
      })

    } catch (error) {
      logger.error('保存监控数据到缓存失败', { error: error.message })
    }
  }

  /**
   * 从缓存加载（类型安全）
   */
  private async loadFromCache(): Promise<void> {
    try {
      const cachedData = await cacheManager.get<{
        traces: Array<{ traceId: string; context: unknown }>
        metrics: Array<{ name: string; data: MetricData[] }>
        timestamp: number
      }>('monitoring:data')

      if (cachedData) {
        // 恢复追踪数据
        for (const { traceId, context } of cachedData.traces) {
          const traceContext = this.deserializeTraceContext(context)
          if (traceContext) {
            this.activeTraces.set(traceId, traceContext)
          }
        }

        // 恢复指标数据
        for (const { name, data } of cachedData.metrics) {
          this.metrics.set(name, data)
        }

        logger.debug('监控数据已从缓存加载', {
          tracesCount: cachedData.traces.length,
          metricsCount: cachedData.metrics.length
        })
      }

    } catch (error) {
      logger.error('从缓存加载监控数据失败', { error: error.message })
    }
  }

  /**
   * 序列化追踪上下文（类型安全）
   */
  private serializeTraceContext(context: TraceContext): SerializedTraceContext {
    const serialized: SerializedTraceContext = {
      traceId: context.traceId,
      startTime: context.startTime,
      metadata: context.metadata
    }

    if (context.parentId) {
      serialized.parentId = context.parentId
    }

    if (context.spanId) {
      serialized.spanId = context.spanId
    }

    if (context.tags) {
      serialized.tags = context.tags
    }

    // 序列化spans Map
    if (context.spans) {
      serialized.spans = Array.from(context.spans.entries())
    }

    return serialized
  }

  /**
   * 反序列化追踪上下文（类型安全）
   */
  private deserializeTraceContext(data: unknown): TraceContext | null {
    try {
      // 验证必需字段
      if (!data || typeof data !== 'object') {
        return null
      }
      
      const obj = data as Record<string, unknown>
      
      if (!obj.traceId || typeof obj.startTime !== 'number') {
        return null
      }

      const traceContext: TraceContext = {
        traceId: obj.traceId as string,
        startTime: obj.startTime as number,
        metadata: (obj.metadata as Record<string, unknown>) || {}
      }

      // 恢复可选字段
      if (obj.parentId) {
        traceContext.parentId = obj.parentId as string
      }

      if (obj.spanId) {
        traceContext.spanId = obj.spanId as string
      }

      if (obj.tags) {
        traceContext.tags = obj.tags as Record<string, string>
      }

      // 恢复spans Map
      if (obj.spans && Array.isArray(obj.spans)) {
        traceContext.spans = new Map(obj.spans as Array<[string, Span]>)
      }

      return traceContext

    } catch (error) {
      logger.error('反序列化追踪上下文失败', { error: error.message })
      return null
    }
  }

  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `trace_${timestamp}_${random}`
  }

  /**
   * 获取监控统计信息（类型安全）
   */
  getStats(): {
    activeTraces: number
    totalMetrics: number
    metricsByType: Record<string, number>
  } {
    let totalMetrics = 0
    const metricsByType: Record<string, number> = {}

    for (const metricArray of this.metrics.values()) {
      totalMetrics += metricArray.length
      
      for (const metric of metricArray) {
        metricsByType[metric.type] = (metricsByType[metric.type] || 0) + 1
      }
    }

    return {
      activeTraces: this.activeTraces.size,
      totalMetrics,
      metricsByType
    }
  }

  /**
   * 停止监控服务
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    try {
      logger.info('正在关闭类型安全监控服务...')

      // 保存当前数据到缓存
      await this.saveToCache()

      // 清理内存
      this.activeTraces.clear()
      this.metrics.clear()

      this.isInitialized = false
      logger.info('类型安全监控服务已关闭')

    } catch (error) {
      logger.error('关闭类型安全监控服务失败', { error: error.message })
    }
  }
}

// 创建并导出类型安全的监控服务单例
export const typeSafeMonitoringService = new TypeSafeMonitoringService()

// 定期清理任务
setInterval(async () => {
  try {
    await typeSafeMonitoringService.cleanup()
    await typeSafeMonitoringService.saveToCache()
  } catch (error) {
    logger.error('定期监控维护失败', { error: error.message })
  }
}, 10 * 60 * 1000) // 每10分钟执行一次