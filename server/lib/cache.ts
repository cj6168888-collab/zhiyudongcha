import Redis from 'ioredis'
import { logger } from './logger'
import { cacheConfig } from './config'

/**
 * Redis缓存管理器
 * 提供统一的缓存接口，支持连接池、重试机制和性能监控
 */
export class CacheManager {
  private redis: Redis
  private subscriber: Redis
  private isHealthy: boolean = true
  private healthCheckInterval?: NodeJS.Timeout
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    latency: [] as number[]
  }

  constructor() {
    this.redis = this.createRedisClient()
    this.subscriber = this.createRedisClient()
    this.initializeHealthChecks()
  }

  private createRedisClient(): Redis {
    const redisConfig = {
      host: cacheConfig.redis.host,
      port: cacheConfig.redis.port,
      password: cacheConfig.redis.password,
      db: cacheConfig.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      commandTimeout: 5000,
      connectTimeout: 10000,
      enableOfflineQueue: false,
      maxLoadingTimeout: 5000
    }

    return new Redis(redisConfig)
      .on('connect', () => {
        logger.info('Redis client connected')
        this.isHealthy = true
      })
      .on('error', (error: Error) => {
        logger.error('Redis connection error:', { error: error.message })
        this.isHealthy = false
        this.metrics.errors++
      })
      .on('close', () => {
        logger.warn('Redis connection closed')
        this.isHealthy = false
      })
  }

  private initializeHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.redis.ping()
        this.isHealthy = result === 'PONG'
      } catch (error: unknown) {
        this.isHealthy = false
        logger.error('Redis health check failed:', error instanceof Error ? error.message : String(error))
      }
    }, 30000)
  }

  /**
   * 设置缓存
   */
  async set(
    key: string,
    value: unknown,
    ttl?: number
  ): Promise<void> {
    if (!this.isHealthy) {
      logger.warn('Redis unhealthy, skipping cache set:', key)
      return
    }

    const startTime = Date.now()
    
    try {
      const serialized = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        version: 1
      })

      if (ttl) {
        await this.redis.setex(key, ttl, serialized)
      } else {
        await this.redis.set(key, serialized)
      }

      this.recordLatency(Date.now() - startTime)
      logger.debug('Cache set successful:', { key, ttl })
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache set error:', { key, error })
      throw error
    }
  }

  /**
   * 获取缓存
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.isHealthy) {
      logger.warn('Redis unhealthy, skipping cache get:', key)
      this.metrics.misses++
      return null
    }

    const startTime = Date.now()

    try {
      const value = await this.redis.get(key)
      
      if (value === null) {
        this.metrics.misses++
        return null
      }

      this.metrics.hits++
      this.recordLatency(Date.now() - startTime)

      const parsed = JSON.parse(value)
      
      // 检查数据完整性
      if (!parsed.data || !parsed.timestamp || !parsed.version) {
        logger.warn('Invalid cache format:', { key, value })
        await this.delete(key)
        return null
      }

      logger.debug('Cache hit:', { key })
      return parsed.data
    } catch (error) {
      this.metrics.errors++
      this.metrics.misses++
      logger.error('Cache get error:', { key, error })
      return null
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    if (!this.isHealthy) {
      return
    }

    try {
      await this.redis.del(key)
      logger.debug('Cache deleted:', { key })
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache delete error:', { key, error })
    }
  }

  /**
   * 批量删除
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isHealthy) {
      return 0
    }

    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length === 0) {
        return 0
      }

      const result = await this.redis.del(...keys)
      logger.debug('Cache pattern deleted:', { pattern, count: result })
      return result
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache pattern delete error:', { pattern, error })
      return 0
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isHealthy) {
      return false
    }

    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache exists check error:', { key, error })
      return false
    }
  }

  /**
   * 设置缓存过期时间
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isHealthy) {
      return false
    }

    try {
      const result = await this.redis.expire(key, ttl)
      return result === 1
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache expire error:', { key, ttl, error })
      return false
    }
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    if (!this.isHealthy) {
      return -1
    }

    try {
      return await this.redis.ttl(key)
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache TTL error:', { key, error })
      return -1
    }
  }

  /**
   * 原子递增
   */
  async incr(key: string): Promise<number> {
    if (!this.isHealthy) {
      throw new Error('Redis unavailable for atomic operations')
    }

    try {
      return await this.redis.incr(key)
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache increment error:', { key, error })
      throw error
    }
  }

  /**
   * 原子递增并设置过期时间
   */
  async incrEx(key: string, ttl: number): Promise<number> {
    if (!this.isHealthy) {
      throw new Error('Redis unavailable for atomic operations')
    }

    try {
      const result = await this.redis.incr(key)
      if (result === 1) {
        await this.redis.expire(key, ttl)
      }
      return result
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache increment with expiry error:', { key, ttl, error })
      throw error
    }
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel)
      this.subscriber.on('message', (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          callback(message)
        }
      })
      logger.debug('Subscribed to channel:', { channel })
    } catch (error) {
      logger.error('Subscribe error:', { channel, error })
      throw error
    }
  }

  /**
   * 发布消息
   */
  async publish(channel: string, message: string): Promise<number> {
    if (!this.isHealthy) {
      return 0
    }

    try {
      const result = await this.redis.publish(channel, message)
      logger.debug('Message published:', { channel, result })
      return result
    } catch (error) {
      this.metrics.errors++
      logger.error('Publish error:', { channel, message, error })
      return 0
    }
  }

  /**
   * 记录延迟
   */
  private recordLatency(latency: number) {
    this.metrics.latency.push(latency)
    if (this.metrics.latency.length > 100) {
      this.metrics.latency.shift()
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0
    const avgLatency = this.metrics.latency.length > 0 
      ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length 
      : 0

    return {
      hitRate,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      errors: this.metrics.errors,
      avgLatency,
      p95Latency: this.calculatePercentile(this.metrics.latency, 95),
      isHealthy: this.isHealthy,
      connected: this.redis.status === 'ready'
    }
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0
    
    const sorted = [...numbers].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * 清理所有缓存
   */
  async clear(): Promise<void> {
    if (!this.isHealthy) {
      throw new Error('Redis unavailable for clear operation')
    }

    try {
      await this.redis.flushdb()
      logger.info('Cache cleared')
    } catch (error: unknown) {
      this.metrics.errors++
      logger.error('Cache clear error:', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * 获取所有匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isHealthy) {
      return []
    }

    try {
      return await this.redis.keys(pattern)
    } catch (error) {
      this.metrics.errors++
      logger.error('Cache keys error:', { pattern, error })
      return []
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now()
      await this.redis.ping()
      const latency = Date.now() - startTime
      
      return {
        healthy: this.isHealthy,
        latency
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 温关闭
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    try {
      await Promise.all([
        this.redis.quit(),
        this.subscriber.quit()
      ])
      logger.info('Redis clients shutdown gracefully')
    } catch (error: unknown) {
      logger.error('Redis shutdown error:', error instanceof Error ? error.message : String(error))
    }
  }
}

// 导出单例实例
export const cacheManager = new CacheManager()

// 导出类型定义
export interface CacheOptions {
  ttl?: number
  tags?: string[]
  version?: number
}

export interface CacheStats {
  hitRate: number
  hits: number
  misses: number
  errors: number
  avgLatency: number
  p95Latency: number
  isHealthy: boolean
  connected: boolean
}

// 缓存装饰器
export function Cacheable(ttl = 3600, keyGenerator?: (...args: unknown[]) => string) {
  return (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      const cacheKey = keyGenerator 
        ? keyGenerator(...args)
        : `${(target as { constructor: { name: string } }).constructor.name}:${propertyName}:${JSON.stringify(args)}`

      // 尝试从缓存获取
      const cached = await cacheManager.get(cacheKey)
      if (cached !== null) {
        return cached
      }

      // 执行原方法
      const result = await (method as (...args: unknown[]) => Promise<unknown>).apply(this, args)
      
      // 存入缓存
      await cacheManager.set(cacheKey, result, ttl)
      
      return result
    }

    return descriptor
  }
}

// 缓存失效装饰器
export function CacheInvalidator(patternOrKey: string | ((...args: unknown[]) => string)) {
  return (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      const result = await (method as (...args: unknown[]) => Promise<unknown>).apply(this, args)

      const pattern = typeof patternOrKey === 'function' 
        ? patternOrKey(...args)
        : patternOrKey

      // 失效相关缓存
      if (pattern.includes('*')) {
        await cacheManager.deletePattern(pattern)
      } else {
        await cacheManager.delete(pattern)
      }

      return result
    }

    return descriptor
  }
}

export default cacheManager
