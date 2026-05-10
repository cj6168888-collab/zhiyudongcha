import { createServiceLogger } from './logger'
import { timerManager } from './timer-manager'

const logger = createServiceLogger('MemoryLeakDetector')

export interface MemoryLeakInfo {
  component: string
  leakType: 'MAP_GROWTH' | 'TIMER_LEAK' | 'EVENT_LISTENER' | 'CACHE_OVERFLOW' | 'CONNECTION_LEAK'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  recommendation: string
  detectedAt: number
}

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
  timestamp: number
}

/**
 * 内存泄漏检测器
 * 监控和修复内存泄漏问题
 */
export class MemoryLeakDetector {
  private static readonly MEMORY_CHECK_INTERVAL = 30000 // 30秒
  private static readonly MEMORY_WARNING_THRESHOLD = 0.8 // 80%
  private static readonly MEMORY_CRITICAL_THRESHOLD = 0.9 // 90%
  
  private memorySnapshots: MemoryStats[] = []
  private componentTrackers = new Map<string, any>()
  private detectedLeaks: MemoryLeakInfo[] = []
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout

  /**
   * 启动内存泄漏检测
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('内存泄漏检测已在运行')
      return
    }

    this.isMonitoring = true
    
    // 立即执行一次检查
    this.checkMemoryLeaks()
    
    // 定期检查
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryLeaks()
    }, MemoryLeakDetector.MEMORY_CHECK_INTERVAL)

    logger.info('内存泄漏检测已启动')
  }

  /**
   * 停止内存泄漏检测
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    
    this.isMonitoring = false
    logger.info('内存泄漏检测已停止')
  }

  /**
   * 检查内存泄漏
   */
  private checkMemoryLeaks(): void {
    try {
      // 获取当前内存统计
      const currentMemory = this.getCurrentMemoryStats()
      
      // 添加到快照列表
      this.memorySnapshots.push(currentMemory)
      
      // 保持最近100个快照
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots = this.memorySnapshots.slice(-100)
      }
      
      // 分析内存趋势
      this.analyzeMemoryTrends(currentMemory)
      
      // 检查组件泄漏
      this.checkComponentLeaks()
      
      // 清理检测到的泄漏
      this.cleanupDetectedLeaks()
      
    } catch (error: unknown) {
      logger.error('内存泄漏检查失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 获取当前内存统计
   */
  private getCurrentMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage()
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now()
    }
  }

  /**
   * 分析内存趋势
   */
  private analyzeMemoryTrends(currentMemory: MemoryStats): void {
    if (this.memorySnapshots.length < 10) {
      return // 需要至少10个数据点
    }
    
    const recentSnapshots = this.memorySnapshots.slice(-10)
    
    // 计算内存增长率
    const growthRates = []
    for (let i = 1; i < recentSnapshots.length; i++) {
      const prev = recentSnapshots[i - 1]
      const curr = recentSnapshots[i]
      const growthRate = (curr.heapUsed - prev.heapUsed) / prev.heapUsed
      growthRates.push(growthRate)
    }
    
    const averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
    
    // 检查内存使用率
    const heapUsageRatio = currentMemory.heapUsed / currentMemory.heapTotal
    const rssUsageRatio = currentMemory.rss / (1024 * 1024 * 1024) // 假设1GB为基准
    
    // 检测内存泄漏
    if (averageGrowthRate > 0.01) { // 平均增长率超过1%
      this.reportMemoryLeak({
        component: 'HEAP_MEMORY',
        leakType: 'MAP_GROWTH',
        severity: this.calculateSeverity(heapUsageRatio),
        description: `堆内存持续增长，平均增长率: ${(averageGrowthRate * 100).toFixed(2)}%`,
        recommendation: '检查未清理的对象引用，特别是Map、Set等集合',
        detectedAt: Date.now()
      })
    }
    
    // 检查内存使用率
    if (heapUsageRatio > MemoryLeakDetector.MEMORY_WARNING_THRESHOLD) {
      this.reportMemoryLeak({
        component: 'HEAP_USAGE',
        leakType: 'CACHE_OVERFLOW',
        severity: heapUsageRatio > MemoryLeakDetector.MEMORY_CRITICAL_THRESHOLD ? 'CRITICAL' : 'HIGH',
        description: `堆内存使用率过高: ${(heapUsageRatio * 100).toFixed(1)}%`,
        recommendation: '优化缓存策略，清理不必要的对象引用',
        detectedAt: Date.now()
      })
    }
  }

  /**
   * 检查组件泄漏
   */
  private checkComponentLeaks(): void {
    // 检查全局对象
    this.checkGlobalObjects()
    
    // 检查定时器泄漏
    this.checkTimerLeaks()
    
    // 检查事件监听器泄漏
    this.checkEventListenerLeaks()
    
    // 检查连接泄漏
    this.checkConnectionLeaks()
  }

  /**
   * 检查全局对象泄漏
   */
  private checkGlobalObjects(): void {
    // 检查global对象的异常增长
    const globalKeys = Object.keys(global)
    
    // 统计不同类型的全局对象
    const objectTypes = new Map<string, number>()
    
    for (const key of globalKeys) {
      const value = (global as Record<string, unknown>)[key]
      const type = typeof value
      objectTypes.set(type, (objectTypes.get(type) || 0) + 1)
    }
    
    // 检查异常的对象数量
    for (const [type, count] of objectTypes) {
      if (type === 'object' && count > 1000) {
        this.reportMemoryLeak({
          component: 'GLOBAL_OBJECTS',
          leakType: 'MAP_GROWTH',
          severity: 'MEDIUM',
          description: `全局对象过多: ${count}`,
          recommendation: '检查全局对象的清理逻辑',
          detectedAt: Date.now()
        })
      }
    }
  }

  /**
   * 检查定时器泄漏
   */
  private checkTimerLeaks(): void {
    try {
      // 获取所有活跃的定时器
      const activeTimers = timerManager.getActiveTimers()
      
      // 检查定时器数量
      if (activeTimers.length > 100) {
        this.reportMemoryLeak({
          component: 'TIMERS',
          leakType: 'TIMER_LEAK',
          severity: 'HIGH',
          description: `活跃定时器过多: ${activeTimers.length}`,
          recommendation: '检查定时器清理逻辑，避免重复创建',
          detectedAt: Date.now()
        })
      }
      
      // 检查长时间运行的定时器
      const now = Date.now()
      for (const timer of activeTimers) {
        const createdTime = timer.createdAt instanceof Date ? timer.createdAt.getTime() : timer.createdAt
        if (now - createdTime > 60 * 60 * 1000) { // 超过1小时
          this.reportMemoryLeak({
            component: 'LONG_RUNNING_TIMER',
            leakType: 'TIMER_LEAK',
            severity: 'MEDIUM',
            description: `长时间运行的定时器: ${timer.name}`,
            recommendation: '检查定时器是否应该停止或重启',
            detectedAt: Date.now()
          })
        }
      }
      
    } catch (error: unknown) {
      logger.error('检查定时器泄漏失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 检查事件监听器泄漏
   */
  private checkEventListenerLeaks(): void {
    // 检查事件发射器的监听器数量
    const eventEmitters = this.getEventEmitters()
    
    for (const emitter of eventEmitters) {
      const em = emitter as { listenerCount?: () => number }
      const listenerCount = em.listenerCount ? em.listenerCount() : 0
      
      if (listenerCount > 50) {
        this.reportMemoryLeak({
          component: 'EVENT_LISTENERS',
          leakType: 'EVENT_LISTENER',
          severity: 'MEDIUM',
          description: `事件监听器过多: ${listenerCount}`,
          recommendation: '检查事件监听器的移除逻辑',
          detectedAt: Date.now()
        })
      }
    }
  }

  /**
   * 检查连接泄漏
   */
  private checkConnectionLeaks(): void {
    // 检查数据库连接
    this.checkDatabaseConnections()
    
    // 检查Redis连接
    this.checkRedisConnections()
    
    // 检查WebSocket连接
    this.checkWebSocketConnections()
  }

  /**
   * 检查数据库连接
   */
  private checkDatabaseConnections(): void {
    try {
      // 这里需要实际的数据库连接池实例
      // 暂时使用模拟检查
      const connectionCount = this.estimateDatabaseConnections()
      
      if (connectionCount > 50) {
        this.reportMemoryLeak({
          component: 'DATABASE_CONNECTIONS',
          leakType: 'CONNECTION_LEAK',
          severity: 'HIGH',
          description: `数据库连接过多: ${connectionCount}`,
          recommendation: '检查数据库连接的释放逻辑',
          detectedAt: Date.now()
        })
      }
      
    } catch (error: unknown) {
      logger.error('检查数据库连接泄漏失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 检查Redis连接
   */
  private checkRedisConnections(): void {
    try {
      // 检查Redis连接池状态
      const redisConnections = this.estimateRedisConnections()
      
      if (redisConnections > 20) {
        this.reportMemoryLeak({
          component: 'REDIS_CONNECTIONS',
          leakType: 'CONNECTION_LEAK',
          severity: 'MEDIUM',
          description: `Redis连接过多: ${redisConnections}`,
          recommendation: '检查Redis连接池配置和释放逻辑',
          detectedAt: Date.now()
        })
      }
      
    } catch (error: unknown) {
      logger.error('检查Redis连接泄漏失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 检查WebSocket连接
   */
  private checkWebSocketConnections(): void {
    try {
      const wsConnections = this.estimateWebSocketConnections()
      
      if (wsConnections > 1000) {
        this.reportMemoryLeak({
          component: 'WEBSOCKET_CONNECTIONS',
          leakType: 'CONNECTION_LEAK',
          severity: 'HIGH',
          description: `WebSocket连接过多: ${wsConnections}`,
          recommendation: '检查WebSocket连接的清理逻辑',
          detectedAt: Date.now()
        })
      }
      
    } catch (error: unknown) {
      logger.error('检查WebSocket连接泄漏失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 清理检测到的泄漏
   */
  private cleanupDetectedLeaks(): void {
    // 清理过期的泄漏记录
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.detectedLeaks = this.detectedLeaks.filter(leak => leak.detectedAt > oneHourAgo)
    
    // 执行自动清理
    this.performAutoCleanup()
  }

  /**
   * 执行自动清理
   */
  private performAutoCleanup(): void {
    try {
      // 强制垃圾回收（仅在必要时）
      const memoryUsage = process.memoryUsage()
      const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
      
      if (heapUsageRatio > MemoryLeakDetector.MEMORY_CRITICAL_THRESHOLD) {
        logger.warn('内存使用率过高，执行垃圾回收')
        
        if (global.gc) {
          global.gc()
        }
      }
      
      // 清理过期数据
      this.cleanupExpiredData()
      
    } catch (error: unknown) {
      logger.error('检查缓存泄漏失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 清理过期数据
   */
  private cleanupExpiredData(): void {
    // 清理内存快照
    if (this.memorySnapshots.length > 50) {
      this.memorySnapshots = this.memorySnapshots.slice(-50)
    }
    
    // 清理组件跟踪器
    for (const [key, tracker] of this.componentTrackers) {
      if (tracker.cleanup && typeof tracker.cleanup === 'function') {
        try {
          tracker.cleanup()
        } catch (error: unknown) {
          logger.error('组件跟踪器检查失败', { name, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  }

  /**
   * 报告内存泄漏
   */
  private reportMemoryLeak(leak: MemoryLeakInfo): void {
    // 检查是否已经报告过相同类型的泄漏
    const recentLeaks = this.detectedLeaks.filter(l => 
      l.component === leak.component && 
      l.detectedAt > Date.now() - 5 * 60 * 1000 // 最近5分钟
    )
    
    if (recentLeaks.length > 2) {
      return // 避免重复报告
    }
    
    this.detectedLeaks.push(leak)
    
    logger.warn('检测到内存泄漏', { ...leak })
    
    // 根据严重程度采取行动
    if (leak.severity === 'CRITICAL') {
      logger.error('严重内存泄漏，建议立即处理', { ...leak })
    }
  }

  /**
   * 计算严重程度
   */
  private calculateSeverity(usageRatio: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (usageRatio > MemoryLeakDetector.MEMORY_CRITICAL_THRESHOLD) {
      return 'CRITICAL'
    } else if (usageRatio > 0.85) {
      return 'HIGH'
    } else if (usageRatio > 0.7) {
      return 'MEDIUM'
    } else {
      return 'LOW'
    }
  }

  // 估算方法（需要根据实际实现调整）
  private estimateDatabaseConnections(): number {
    // 这里应该从实际的数据库连接池获取
    return 10
  }
  
  private estimateRedisConnections(): number {
    // 这里应该从实际的Redis客户端获取
    return 5
  }
  
  private estimateWebSocketConnections(): number {
    // 这里应该从实际的WebSocket管理器获取
    return 50
  }
  
  private getEventEmitters(): unknown[] {
    // 这里应该收集所有的事件发射器实例
    return []
  }

  /**
   * 注册组件跟踪器
   */
  registerComponentTracker(name: string, tracker: unknown): void {
    this.componentTrackers.set(name, tracker)
    logger.debug('注册组件跟踪器', { name })
  }

  /**
   * 注销组件跟踪器
   */
  unregisterComponentTracker(name: string): void {
    this.componentTrackers.delete(name)
    logger.debug('注销组件跟踪器', { name })
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): {
    current: MemoryStats
    trend: {
      growthRate: number
      averageHeapUsed: number
      peakMemory: number
    }
    leaks: MemoryLeakInfo[]
  } {
    const current = this.getCurrentMemoryStats()
    
    // 计算趋势
    let growthRate = 0
    let averageHeapUsed = current.heapUsed
    let peakMemory = current.heapUsed
    
    if (this.memorySnapshots.length > 1) {
      const recent = this.memorySnapshots.slice(-10)
      const sum = recent.reduce((sum, snap) => sum + snap.heapUsed, 0)
      averageHeapUsed = sum / recent.length
      
      peakMemory = Math.max(...recent.map(snap => snap.heapUsed))
      
      if (recent.length > 1) {
        const first = recent[0]
        const last = recent[recent.length - 1]
        growthRate = (last.heapUsed - first.heapUsed) / first.heapUsed
      }
    }
    
    return {
      current,
      trend: {
        growthRate,
        averageHeapUsed,
        peakMemory
      },
      leaks: [...this.detectedLeaks]
    }
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): boolean {
    try {
      if (global.gc) {
        global.gc()
        logger.info('手动垃圾回收执行完成')
        return true
      } else {
        logger.warn('垃圾回收不可用，需要使用 --expose-gc 标志启动')
        return false
      }
    } catch (error: unknown) {
      logger.error('强制垃圾回收失败', { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 获取检测到的泄漏
   */
  getDetectedLeaks(): MemoryLeakInfo[] {
    return [...this.detectedLeaks]
  }

  /**
   * 清除泄漏记录
   */
  clearLeakHistory(): void {
    this.detectedLeaks = []
    logger.info('泄漏历史已清除')
  }

  /**
   * 停止检测并清理
   */
  shutdown(): void {
    this.stopMonitoring()
    this.memorySnapshots = []
    this.componentTrackers.clear()
    this.detectedLeaks = []
    logger.info('内存泄漏检测器已关闭')
  }
}

// 创建并导出内存泄漏检测器单例
export const memoryLeakDetector = new MemoryLeakDetector()

// 自动启动检测
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    memoryLeakDetector.startMonitoring()
  }, 10000) // 10秒后启动检测
}
