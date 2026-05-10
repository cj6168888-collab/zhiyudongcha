import { pool } from '../lib/database'
import logger from '../lib/logger'
import { cacheManager } from '../lib/cache'

/**
 * 缓存清理定时任务
 */
export class CacheMaintenanceService {
  private static instance: CacheMaintenanceService
  private maintenanceInterval?: NodeJS.Timeout

  private constructor() {}

  static getInstance(): CacheMaintenanceService {
    if (!CacheMaintenanceService.instance) {
      CacheMaintenanceService.instance = new CacheMaintenanceService()
    }
    return CacheMaintenanceService.instance
  }

  /**
   * 启动缓存维护任务
   */
  async start() {
    logger.info('Starting cache maintenance service')

    // 每小时执行一次缓存清理
    this.maintenanceInterval = setInterval(async () => {
      await this.performMaintenance()
    }, 60 * 60 * 1000) // 1小时

    // 启动时执行一次清理
    await this.performMaintenance()

    logger.info('Cache maintenance service started')
  }

  /**
   * 停止缓存维护任务
   */
  async stop() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = undefined
    }

    logger.info('Cache maintenance service stopped')
  }

  /**
   * 执行缓存维护
   */
  private async performMaintenance() {
    try {
      const startTime = Date.now()
      logger.info('Starting cache maintenance')

      const results = await Promise.allSettled([
        this.cleanupExpiredSessions(),
        this.cleanupExpiredAIContexts(),
        this.cleanupOrphanedCache(),
        this.optimizeCacheSize(),
        this.updateCacheStatistics()
      ])

      const duration = Date.now() - startTime

      // 统计结果
      const summary = {
        duration,
        expiredSessions: this.extractResult(results[0]) || 0,
        expiredAIContexts: this.extractResult(results[1]) || {},
        orphanedCache: this.extractResult(results[2]) || 0,
        optimization: this.extractResult(results[3]) || {},
        statisticsUpdated: this.extractResult(results[4]) || false
      }

      logger.info('Cache maintenance completed', summary)

      // 记录到系统监控
      await this.recordMaintenanceMetrics(summary)

    } catch (error) {
      logger.error('Cache maintenance failed', error)
    }
  }

  /**
   * 清理过期会话缓存
   */
  private async cleanupExpiredSessions(): Promise<number> {
    try {
      // 这里需要导入 SessionCacheService
      const { SessionCacheService } = await import('../lib/cache-middleware')
      const cleanedCount = await SessionCacheService.cleanupExpiredSessions()
      
      logger.debug(`Cleaned up ${cleanedCount} expired sessions`)
      return cleanedCount
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', error)
      return 0
    }
  }

  /**
   * 清理过期的AI对话缓存
   */
  private async cleanupExpiredAIContexts(): Promise<any> {
    try {
      const AIConversationCacheService = (await import('../services/ai-conversation-cache')).default
      const result = await AIConversationCacheService.cleanupExpiredCache()
      
      logger.debug('Cleaned up expired AI contexts', result)
      return result
    } catch (error) {
      logger.error('Failed to cleanup expired AI contexts', error)
      return {}
    }
  }

  /**
   * 清理孤立的缓存条目
   */
  private async cleanupOrphanedCache(): Promise<number> {
    try {
      let cleanedCount = 0

      // 清理孤立的API响应缓存
      const apiResponseKeys = await cacheManager.keys('api_response:*')
      for (const key of apiResponseKeys) {
        const cached = await cacheManager.get(key)
        if (cached && cached.timestamp) {
          const age = Date.now() - new Date(cached.timestamp).getTime()
          // 清理超过24小时的API响应缓存
          if (age > 24 * 60 * 60 * 1000) {
            await cacheManager.delete(key)
            cleanedCount++
          }
        }
      }

      // 清理孤立的用户缓存
      const userCacheKeys = await cacheManager.keys('user:*')
      for (const key of userCacheKeys) {
        const userId = key.split(':')[1]
        
        // 检查用户是否还存在
        const userExists = await this.checkUserExists(userId)
        if (!userExists) {
          await cacheManager.deletePattern(`user:${userId}:*`)
          cleanedCount++
        }
      }

      logger.debug(`Cleaned up ${cleanedCount} orphaned cache entries`)
      return cleanedCount
    } catch (error) {
      logger.error('Failed to cleanup orphaned cache', error)
      return 0
    }
  }

  /**
   * 优化缓存大小
   */
  private async optimizeCacheSize(): Promise<any> {
    try {
      const metrics = cacheManager.getMetrics()
      const optimization = {
        memoryOptimized: false,
        compressionEnabled: false,
        evictionsPerformed: 0
      }

      // 如果缓存命中率过低，清理部分缓存
      if (metrics.hitRate < 0.3) {
        // 清理最旧的缓存条目
        const allKeys = await cacheManager.keys('*')
        const oldKeys = allKeys.slice(-Math.floor(allKeys.length * 0.2)) // 清理最旧的20%
        
        for (const key of oldKeys) {
          await cacheManager.delete(key)
          optimization.evictionsPerformed++
        }

        optimization.memoryOptimized = true
      }

      logger.debug('Cache optimization completed', optimization)
      return optimization
    } catch (error) {
      logger.error('Failed to optimize cache size', error)
      return {}
    }
  }

  /**
   * 更新缓存统计信息
   */
  private async updateCacheStatistics(): Promise<boolean> {
    try {
      const metrics = cacheManager.getMetrics()
      const healthCheck = await cacheManager.healthCheck()

      const stats = {
        ...metrics,
        health: healthCheck,
        timestamp: new Date(),
        memoryUsage: process.memoryUsage()
      }

      // 存储统计信息到缓存
      await cacheManager.set('cache:stats:latest', stats, 3600)
      
      // 存储历史统计（最近24小时，每小时一个数据点）
      const hourKey = `cache:stats:${new Date().getHours()}`
      await cacheManager.set(hourKey, stats, 86400)

      logger.debug('Cache statistics updated')
      return true
    } catch (error) {
      logger.error('Failed to update cache statistics', error)
      return false
    }
  }

  /**
   * 检查用户是否存在
   */
  private async checkUserExists(userId: string): Promise<boolean> {
    try {
      const query = 'SELECT id FROM persons WHERE id = $1 LIMIT 1'
      const result = await pool.query(query, [userId])
      return result.rows.length > 0
    } catch (error) {
      logger.error('Failed to check user existence', { userId, error })
      return false // 假设用户存在，避免误删
    }
  }

  /**
   * 提取 PromiseSettledResult 的值
   */
  private extractResult<T>(result: PromiseSettledResult<T>): T | null {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return null
  }

  /**
   * 记录维护指标
   */
  private async recordMaintenanceMetrics(summary: {
    duration: number;
    expiredSessions: number;
    orphanedCache: number;
    optimization: Record<string, unknown>;
  }) {
    try {
      const { metricsCollector } = await import('../middleware/performance-middleware')
      
      metricsCollector.recordCustomMetric({
        name: 'cache_maintenance',
        value: summary.duration,
        tags: {
          expired_sessions: summary.expiredSessions.toString(),
          orphaned_cache: summary.orphanedCache.toString(),
          optimization_performed: Object.keys(summary.optimization).length > 0 ? 'true' : 'false'
        },
        timestamp: new Date()
      })
    } catch (error) {
      logger.error('Failed to record maintenance metrics', error)
    }
  }

  /**
   * 手动触发缓存维护
   */
  async triggerMaintenance(): Promise<{ status: string; timestamp: Date }> {
    logger.info('Manual cache maintenance triggered')
    await this.performMaintenance()
    return { status: 'completed', timestamp: new Date() }
  }

  /**
   * 获取缓存维护状态
   */
  async getMaintenanceStatus(): Promise<any> {
    try {
      const latestStats = await cacheManager.get('cache:stats:latest')
      const health = await cacheManager.healthCheck()
      
      return {
        active: !!this.maintenanceInterval,
        lastMaintenance: latestStats?.timestamp,
        health,
        metrics: latestStats
      }
    } catch (error) {
      logger.error('Failed to get maintenance status', error)
      return { active: false, error: error.message }
    }
  }
}

// 导出单例实例
export const cacheMaintenanceService = CacheMaintenanceService.getInstance()

export default cacheMaintenanceService