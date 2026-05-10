import { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger'
import { performanceMetrics, metricsCollector, MetricsCollector } from '../lib/monitoring'
import { cacheManager } from '../lib/cache'

// 添加导出
export { performanceMetrics, metricsCollector } from '../lib/monitoring'

interface MetricsCollectorInterface {
  recordRequest?: (info: Record<string, unknown>) => void;
  recordError?: (info: Record<string, unknown>) => void;
  recordTimer?: (name: string, value: number, labels?: Record<string, string>) => void;
  incrementCounter?: (name: string, value: number, labels?: Record<string, string>) => void;
  recordHistogram?: (name: string, value: number, labels?: Record<string, string>) => void;
  recordGauge?: (name: string, value: number, labels?: Record<string, string>) => void;
  [key: string]: unknown;
}

/**
 * 创建请求性能指标收集中间件
 */
export function createRequestMetricsMiddleware(collector: MetricsCollectorInterface) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestStart = process.hrtime.bigint()

    // 生成请求ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    req.headers['x-request-id'] = requestId

    // 记录请求开始
    const requestInfo = {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    }

    logger.debug('Request started', requestInfo)

    // 监听响应完成
    res.on('finish', () => {
      const endTime = Date.now()
      const requestEnd = process.hrtime.bigint()
      const duration = Number(requestEnd - requestStart) / 1000000 // 转换为毫秒

      const responseInfo = {
        ...requestInfo,
        statusCode: res.statusCode,
        duration: endTime - startTime,
        highResDuration: duration,
        responseSize: res.get('content-length') || 0,
        cacheHit: res.get('X-Cache') === 'HIT'
      }

      // 收集性能指标
      collector.recordRequest(responseInfo)

      // 记录慢请求
      if (duration > 1000) {
        logger.warn('Slow request detected', {
          ...responseInfo,
          threshold: '1000ms'
        })
      }

      logger.debug('Request completed', responseInfo)
    })

    // 监听响应错误
    res.on('error', (error) => {
      const endTime = Date.now()
      const requestEnd = process.hrtime.bigint()
      const duration = Number(requestEnd - requestStart) / 1000000

      const errorInfo = {
        ...requestInfo,
        error: error.message,
        stack: error.stack,
        duration: endTime - startTime,
        highResDuration: duration
      }

      collector.recordError(errorInfo)

      logger.error('Request error', errorInfo)
    })

    next()
  }
}

/**
 * 缓存性能指标中间件
 */
export function cacheMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()

  // 监听响应
  res.on('finish', () => {
    const cacheHit = res.get('X-Cache') === 'HIT'
    const cacheKey = res.get('X-Cache-Key')
    const duration = Date.now() - startTime

    if (cacheKey) {
      metricsCollector.recordCacheOperation({
        operation: cacheHit ? 'hit' : 'miss',
        key: cacheKey,
        duration,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string
      })
    }
  })

  next()
}

/**
 * 数据库性能指标中间件
 */
export function dbMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // 这里可以集成数据库查询监控
  // 例如使用 sequelize 的 hooks 或 pg 的 query 事件

  next()
}

/**
 * 内存使用监控中间件
 */
export function memoryMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const memUsage = process.memoryUsage()

  metricsCollector.recordSystemMetric({
    type: 'memory',
    timestamp: new Date(),
    data: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    },
    requestId: req.headers['x-request-id'] as string
  })

  next()
}

/**
 * CPU使用监控中间件
 */
export function cpuMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const cpuUsage = process.cpuUsage()

  metricsCollector.recordSystemMetric({
    type: 'cpu',
    timestamp: new Date(),
    data: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    requestId: req.headers['x-request-id'] as string
  })

  next()
}

// 综合性能监控中间件
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  // 依次应用各种监控中间件
  memoryMetricsMiddleware(req, res, () => {
    cpuMetricsMiddleware(req, res, () => {
      cacheMetricsMiddleware(req, res, next)
    })
  })
}

/**
 * 实时指标报告API
 */
export async function getRealTimeMetrics(req: Request, res: Response) {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 300 // 默认5分钟
    const metrics = performanceMetrics.getRealTimeMetrics(timeframe)

    res.json({
      success: true,
      data: {
        metrics,
        timestamp: new Date(),
        timeframe
      }
    })
  } catch (error) {
    logger.error('Get real-time metrics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics'
    })
  }
}

/**
 * 历史指标查询API
 */
export async function getHistoricalMetrics(req: Request, res: Response) {
  try {
    const { startTime, endTime, metric, interval = '1m' } = req.query

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      })
    }

    const metrics = performanceMetrics.getHistoricalMetrics(
      new Date(startTime as string),
      new Date(endTime as string),
      metric as string,
      interval as string
    )

    res.json({
      success: true,
      data: {
        metrics,
        startTime,
        endTime,
        interval,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Get historical metrics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get historical metrics'
    })
  }
}

/**
 * 系统健康检查API
 */
export async function getSystemHealth(req: Request, res: Response) {
  try {
    const health = await performanceMetrics.getSystemHealth()

    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Get system health error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    })
  }
}

/**
 * 性能分析报告API
 */
export async function getPerformanceReport(req: Request, res: Response) {
  try {
    const { period = '24h' } = req.query

    const report = await performanceMetrics.generatePerformanceReport(period as string)

    res.json({
      success: true,
      data: {
        report,
        period,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Get performance report error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get performance report'
    })
  }
}

/**
 * 优化建议API
 */
export async function getOptimizationSuggestions(req: Request, res: Response) {
  try {
    const suggestions = await performanceMetrics.getOptimizationSuggestions()

    res.json({
      success: true,
      data: {
        suggestions,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Get optimization suggestions error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization suggestions'
    })
  }
}

export default {
  createRequestMetricsMiddleware,
  cacheMetricsMiddleware,
  dbMetricsMiddleware,
  memoryMetricsMiddleware,
  cpuMetricsMiddleware,
  performanceMiddleware,
  getRealTimeMetrics,
  getHistoricalMetrics,
  getSystemHealth,
  getPerformanceReport,
  getOptimizationSuggestions
}
