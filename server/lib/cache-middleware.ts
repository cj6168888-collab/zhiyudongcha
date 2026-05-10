import { Request, Response, NextFunction } from 'express'
import cacheManager, { CacheOptions } from './cache'
import { createServiceLogger } from './logger'

const log = createServiceLogger('Cache');

interface SessionData {
  userId?: string
  expiresAt?: number
  [key: string]: unknown
}

interface CachedResponse {
  data?: unknown
  status?: number
  headers?: Record<string, string>
  timestamp?: number
}

function logCache(level: string, message: string, data?: Record<string, unknown>) {
  if (level === 'error') log.error(data ? { ...data, msg: message } : message);
  else if (level === 'warn') log.warn(data ? { ...data, msg: message } : message);
  else log.info(data ? { ...data, msg: message } : message);
}

/**
 * 缓存中间件
 * 提供请求级缓存支持，支持基于请求内容生成缓存键
 */
export interface CacheMiddlewareOptions {
  /** 缓存时间（秒） */
  ttl?: number
  /** 自定义缓存键生成器 */
  keyGenerator?: (req: Request) => string
  /** 是否只缓存GET请求 */
  getOnly?: boolean
  /** 缓存键前缀 */
  prefix?: string
  /** 条件缓存函数 */
  condition?: (req: Request) => boolean
  /** 排除的headers */
  excludeHeaders?: string[]
}

/**
 * 响应缓存中间件
 */
export function responseCache(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300,
    keyGenerator = defaultKeyGenerator,
    getOnly = true,
    prefix = 'api',
    condition = defaultCondition,
    excludeHeaders = ['authorization', 'cookie']
  } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    // 检查是否应该缓存此请求
    if (getOnly && req.method !== 'GET') {
      return next()
    }

    if (!condition(req)) {
      return next()
    }

    const cacheKey = `${prefix}:${keyGenerator(req)}`

    try {
      // 尝试从缓存获取响应
      const cached = await cacheManager.get(cacheKey) as CachedResponse | null
      if (cached) {
        logCache('debug', 'Cache hit:', { key: cacheKey, url: req.url })

        // 设置缓存相关headers
        res.set('X-Cache', 'HIT')
        res.set('X-Cache-Key', cacheKey)

        // 恢复缓存的headers
        if (cached.headers) {
          Object.entries(cached.headers).forEach(([key, value]) => {
            if (!excludeHeaders.includes(key.toLowerCase())) {
              res.set(key, value as string)
            }
          })
        }

        return res.status(cached.status || 200).json(cached.data)
      }

      // 拦截响应
      const originalJson = res.json
      const originalStatus = res.status
      let responseData: unknown
      let statusCode: number = 200
      const responseHeaders: Record<string, string> = {}

      // 捕获status调用
      res.status = function(code: number) {
        statusCode = code
        return originalStatus.call(this, code)
      }

      // 捕获set调用
      const originalSet = res.set
      res.set = function(this: Response, field: string | Record<string, string>, val?: string): Response {
        if (typeof field === 'string') {
          responseHeaders[field.toLowerCase()] = val || ''
          return originalSet.call(this, field, val)
        } else {
          Object.entries(field).forEach(([key, value]) => {
            responseHeaders[key.toLowerCase()] = value
          })
          return originalSet.call(this, field as unknown as string)
        }
      }

      // 捕获json调用
      res.json = function(this: Response, data: unknown) {
        responseData = data

        // 缓存响应（只缓存成功响应）
        if (statusCode >= 200 && statusCode < 300) {
          const cacheData = {
            data,
            status: statusCode,
            headers: responseHeaders,
            timestamp: Date.now()
          }

          cacheManager.set(cacheKey, cacheData, ttl).catch(error => {
            logCache('error', 'Failed to cache response:', { key: cacheKey, error })
          })
        }

        return originalJson.call(this, data)
      }

      // 设置缓存miss标识
      res.set('X-Cache', 'MISS')

      logCache('debug', 'Cache miss:', { key: cacheKey, url: req.url })

    } catch (error) {
      logCache('error', 'Cache middleware error:', { key: cacheKey, error })
    }

    next()
  }
}

/**
 * 查询结果缓存装饰器
 */
export function QueryCache(ttl: number = 300, keyPrefix: string = 'query') {
  return function <T extends (...args: unknown[]) => unknown>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      // 生成基于查询参数的缓存键
      const cacheKey = `${keyPrefix}:${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`

      try {
        // 尝试从缓存获取
        const cached = await cacheManager.get(cacheKey)
        if (cached !== null) {
          logCache('debug', 'Query cache hit:', { key: cacheKey })
          return cached
        }

        // 执行原查询方法
        const result = await method.apply(this, args)

        // 缓存结果（只缓存有效结果）
        if (result !== null && result !== undefined) {
          await cacheManager.set(cacheKey, result, ttl)
          logCache('debug', 'Query cache set:', { key: cacheKey })
        }

        return result
      } catch (error) {
        logCache('error', 'Query cache error:', { key: cacheKey, error })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 会话缓存服务
 */
export class SessionCacheService {
  private static readonly SESSION_PREFIX = 'session'
  private static readonly USER_PREFIX = 'user_sessions'
  private static readonly CONVERSATION_PREFIX = 'conversation'

  /**
   * 缓存会话数据
   */
  static async setSession(sessionId: string, data: SessionData, ttl: number = 3600): Promise<void> {
    const key = `${this.SESSION_PREFIX}:${sessionId}`
    await cacheManager.set(key, data, ttl)
  }

  /**
   * 获取会话数据
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `${this.SESSION_PREFIX}:${sessionId}`
    return await cacheManager.get(key) as SessionData | null
  }

  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}:${sessionId}`
    await cacheManager.delete(key)
  }

  /**
   * 缓存用户活跃会话列表
   */
  static async setUserActiveSessions(userId: string, sessionIds: string[], ttl: number = 1800): Promise<void> {
    const key = `${this.USER_PREFIX}:${userId}`
    await cacheManager.set(key, sessionIds, ttl)
  }

  /**
   * 获取用户活跃会话
   */
  static async getUserActiveSessions(userId: string): Promise<string[] | null> {
    const key = `${this.USER_PREFIX}:${userId}`
    return await cacheManager.get(key)
  }

  /**
   * 添加会话到用户活跃列表
   */
  static async addSessionToUser(userId: string, sessionId: string): Promise<void> {
    const key = `${this.USER_PREFIX}:${userId}`
    const sessions = await this.getUserActiveSessions(userId) || []

    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId)
      await cacheManager.set(key, sessions, 1800)
    }
  }

  /**
   * 从用户活跃列表移除会话
   */
  static async removeSessionFromUser(userId: string, sessionId: string): Promise<void> {
    const key = `${this.USER_PREFIX}:${userId}`
    const sessions = await this.getUserActiveSessions(userId) || []

    const index = sessions.indexOf(sessionId)
    if (index > -1) {
      sessions.splice(index, 1)
      await cacheManager.set(key, sessions, 1800)
    }
  }

  /**
   * 缓存对话状态
   */
  static async setConversationState(conversationId: string, state: Record<string, unknown>, ttl: number = 7200): Promise<void> {
    const key = `${this.CONVERSATION_PREFIX}:${conversationId}`
    await cacheManager.set(key, state, ttl)
  }

  /**
   * 获取对话状态
   */
  static async getConversationState(conversationId: string): Promise<Record<string, unknown> | null> {
    const key = `${this.CONVERSATION_PREFIX}:${conversationId}`
    return await cacheManager.get(key)
  }

  /**
   * 删除对话状态
   */
  static async deleteConversationState(conversationId: string): Promise<void> {
    const key = `${this.CONVERSATION_PREFIX}:${conversationId}`
    await cacheManager.delete(key)
  }

  /**
   * 清理用户所有相关缓存
   */
  static async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `${this.USER_PREFIX}:${userId}`,
      `${this.SESSION_PREFIX}:*`, // 会话缓存需要单独处理
      `${this.CONVERSATION_PREFIX}:*` // 对话缓存需要单独处理
    ]

    // 删除用户会话列表
    await cacheManager.delete(patterns[0])

    // 获取并删除用户的所有会话
    const sessionKeys = await cacheManager.keys(`${this.SESSION_PREFIX}:*`)
    for (const sessionKey of sessionKeys) {
      const session = await cacheManager.get(sessionKey) as SessionData | null
      if (session?.userId === userId) {
        await cacheManager.delete(sessionKey)
      }
    }
  }

  /**
   * 批量清理过期会话
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const sessionKeys = await cacheManager.keys(`${this.SESSION_PREFIX}:*`)
    let cleanedCount = 0

    for (const sessionKey of sessionKeys) {
      const session = await cacheManager.get(sessionKey) as SessionData | null
      if (session && session.expiresAt && Date.now() > session.expiresAt) {
        await cacheManager.delete(sessionKey)

        // 从用户活跃列表中移除
        if (session.userId) {
          await this.removeSessionFromUser(session.userId, sessionKey.split(':')[1])
        }

        cleanedCount++
      }
    }

    return cleanedCount
  }
}

/**
 * API响应缓存服务
 */
export class ApiCacheService {
  private static readonly API_PREFIX = 'api_response'

  /**
   * 缓存API响应
   */
  static async setApiResponse(
    endpoint: string,
    params: Record<string, unknown>,
    response: unknown,
    ttl: number = 300
  ): Promise<void> {
    const key = this.generateKey(endpoint, params)
    await cacheManager.set(key, response, ttl)
  }

  /**
   * 获取缓存的API响应
   */
  static async getApiResponse(
    endpoint: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const key = this.generateKey(endpoint, params)
    return await cacheManager.get(key)
  }

  /**
   * 失效API缓存
   */
  static async invalidateApiPattern(pattern: string): Promise<number> {
    const keyPattern = `${this.API_PREFIX}:${pattern}*`
    return await cacheManager.deletePattern(keyPattern)
  }

  /**
   * 生成缓存键
   */
  private static generateKey(endpoint: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {} as Record<string, unknown>)

    return `${this.API_PREFIX}:${endpoint}:${Buffer.from(JSON.stringify(sortedParams)).toString('base64')}`
  }

  /**
   * 缓存用户特定API响应
   */
  static async setUserApiResponse(
    userId: string,
    endpoint: string,
    params: Record<string, unknown>,
    response: unknown,
    ttl: number = 300
  ): Promise<void> {
    const key = `user:${userId}:${this.generateKey(endpoint, params)}`
    await cacheManager.set(key, response, ttl)
  }

  /**
   * 获取用户特定API响应
   */
  static async getUserApiResponse(
    userId: string,
    endpoint: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const key = `user:${userId}:${this.generateKey(endpoint, params)}`
    return await cacheManager.get(key)
  }

  /**
   * 清理用户所有API缓存
   */
  static async clearUserApiCache(userId: string): Promise<number> {
    const pattern = `user:${userId}:${this.API_PREFIX}:*`
    return await cacheManager.deletePattern(pattern)
  }
}

/**
 * 默认缓存键生成器
 */
function defaultKeyGenerator(req: Request): string {
  const url = req.url || '/'
  const query = new URLSearchParams(req.query as Record<string, string>).toString()
  const userId = req.user?.id || 'anonymous'

  return `${req.method}:${userId}:${url}${query ? '?' + query : ''}`
}

/**
 * 默认缓存条件
 */
function defaultCondition(req: Request): boolean {
  // 不缓存错误响应、认证请求等
  if (req.headers.authorization || req.headers.cookie) {
    return false
  }

  // 不缓存包含敏感信息的请求
  const sensitivePaths = ['/login', '/register', '/profile', '/settings']
  if (sensitivePaths.some(path => req.url?.includes(path))) {
    return false
  }

  return true
}

/**
 * 缓存清理中间件
 */
export function invalidateCache(patterns: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json

    res.json = function(data: unknown) {
      // 在响应成功后清理相关缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            for (const pattern of patterns) {
              await cacheManager.deletePattern(pattern)
            }
            logCache('debug', 'Cache invalidated:', { patterns })
          } catch (error) {
            logCache('error', 'Cache invalidation error:', { patterns, error })
          }
        })
      }

      return originalJson.call(this, data)
    }

    next()
  }
}

export {
  cacheManager
}

export default {
  responseCache,
  QueryCache,
  SessionCacheService,
  ApiCacheService,
  invalidateCache,
  cacheManager
}
