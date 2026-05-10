import { pool } from '../lib/database'
import logger from '../lib/logger'
import cacheManager from '../lib/cache'

export interface AIInteractionMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  totalTokens: number
  averageLatency: number
  lastRequestTime: Date
}

export interface AIConversationContext {
  conversationId: string
  userId: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    tokens?: number
  }>
  context: Record<string, any>
  summary?: string
  lastInteraction: Date
}

export class AIConversationCacheService {
  private static readonly CONTEXT_PREFIX = 'ai_context'
  private static readonly METRICS_PREFIX = 'ai_metrics'
  private static readonly SUMMARY_PREFIX = 'ai_summary'
  private static readonly RESPONSE_PREFIX = 'ai_response'

  /**
   * 缓存对话上下文
   */
  static async cacheConversationContext(context: AIConversationContext, ttl: number = 3600): Promise<void> {
    const key = `${this.CONTEXT_PREFIX}:${context.conversationId}`
    await cacheManager.set(key, context, ttl)

    // 同时缓存用户最近对话列表
    await this.addConversationToUserList(context.userId, context.conversationId)
  }

  /**
   * 获取对话上下文
   */
  static async getConversationContext(conversationId: string): Promise<AIConversationContext | null> {
    const key = `${this.CONTEXT_PREFIX}:${conversationId}`
    return await cacheManager.get(key)
  }

  /**
   * 更新对话上下文（添加新消息）
   */
  static async updateConversationContext(
    conversationId: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string; tokens?: number }
  ): Promise<void> {
    const context = await this.getConversationContext(conversationId)
    if (context) {
      context.messages.push({
        ...message,
        timestamp: new Date()
      })
      context.lastInteraction = new Date()

      // 保持最近100条消息
      if (context.messages.length > 100) {
        context.messages = context.messages.slice(-100)
      }

      await this.cacheConversationContext(context)
    }
  }

  /**
   * 生成并缓存对话摘要
   */
  static async generateAndCacheSummary(conversationId: string): Promise<string | null> {
    const context = await this.getConversationContext(conversationId)
    if (!context || context.messages.length < 3) {
      return null
    }

    // 简单的摘要生成（实际应用中可以调用AI服务）
    const recentMessages = context.messages.slice(-10)
    const summary = recentMessages
      .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}...`)
      .join('\n')

    const summaryKey = `${this.SUMMARY_PREFIX}:${conversationId}`
    await cacheManager.set(summaryKey, {
      summary,
      messageCount: context.messages.length,
      generatedAt: new Date()
    }, 7200)

    // 更新上下文中的摘要
    context.summary = summary
    await this.cacheConversationContext(context)

    return summary
  }

  /**
   * 缓存AI响应以避免重复计算
   */
  static async cacheAIResponse(
    conversationId: string,
    userInputHash: string,
    response: unknown,
    ttl: number = 1800
  ): Promise<void> {
    const key = `${this.RESPONSE_PREFIX}:${conversationId}:${userInputHash}`
    await cacheManager.set(key, {
      response,
      cachedAt: new Date()
    }, ttl)
  }

  /**
   * 获取缓存的AI响应
   */
  static async getCachedAIResponse(conversationId: string, userInputHash: string): Promise<any | null> {
    const key = `${this.RESPONSE_PREFIX}:${conversationId}:${userInputHash}`
    const cached = await cacheManager.get(key)

    if (cached) {
      // 更新最后使用时间
      await cacheManager.set(key, {
        ...cached,
        lastUsed: new Date()
      }, 1800)
      return cached.response
    }

    return null
  }

  /**
   * 缓存AI交互指标
   */
  static async cacheAIMetrics(
    userId: string,
    metrics: Partial<AIInteractionMetrics>,
    ttl: number = 86400
  ): Promise<void> {
    const key = `${this.METRICS_PREFIX}:${userId}`
    const existingMetrics = await cacheManager.get<AIInteractionMetrics>(key) || {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalTokens: 0,
      averageLatency: 0,
      lastRequestTime: new Date()
    }

    // 合并指标
    const updatedMetrics: AIInteractionMetrics = {
      ...existingMetrics,
      ...metrics,
      lastRequestTime: new Date()
    }

    // 重新计算平均延迟
    if (metrics.averageLatency !== undefined) {
      const totalRequests = updatedMetrics.requestCount
      updatedMetrics.averageLatency = (
        (existingMetrics.averageLatency * (totalRequests - 1) + metrics.averageLatency) /
        totalRequests
      )
    }

    await cacheManager.set(key, updatedMetrics, ttl)
  }

  /**
   * 获取AI交互指标
   */
  static async getAIMetrics(userId: string): Promise<AIInteractionMetrics | null> {
    const key = `${this.METRICS_PREFIX}:${userId}`
    return await cacheManager.get(key)
  }

  /**
   * 增加请求计数
   */
  static async incrementRequestCount(userId: string, success: boolean = true, tokens: number = 0): Promise<void> {
    const key = `${this.METRICS_PREFIX}:${userId}`

    // 使用原子操作增加计数
    const requestKey = `${key}:requests`
    const successKey = `${key}:successes`
    const errorKey = `${key}:errors`
    const tokensKey = `${key}:tokens`

    await Promise.all([
      cacheManager.incr(requestKey),
      success ? cacheManager.incr(successKey) : cacheManager.incr(errorKey),
      tokens > 0 ? cacheManager.incrEx(tokensKey, 86400) : Promise.resolve()
    ])

    // 设置过期时间
    await Promise.all([
      cacheManager.expire(requestKey, 86400),
      cacheManager.expire(successKey, 86400),
      cacheManager.expire(errorKey, 86400)
    ])
  }

  /**
   * 获取用户的活跃对话列表
   */
  static async getUserActiveConversations(userId: string): Promise<string[]> {
    const key = `user_conversations:${userId}`
    return await cacheManager.get(key) || []
  }

  /**
   * 添加对话到用户活跃列表
   */
  private static async addConversationToUserList(userId: string, conversationId: string): Promise<void> {
    const key = `user_conversations:${userId}`
    const conversations = await this.getUserActiveConversations(userId)

    if (!conversations.includes(conversationId)) {
      conversations.unshift(conversationId)

      // 保持最近50个对话
      if (conversations.length > 50) {
        conversations.splice(50)
      }

      await cacheManager.set(key, conversations, 7200)
    }
  }

  /**
   * 从用户活跃列表移除对话
   */
  static async removeConversationFromUserList(userId: string, conversationId: string): Promise<void> {
    const key = `user_conversations:${userId}`
    const conversations = await this.getUserActiveConversations(userId)

    const index = conversations.indexOf(conversationId)
    if (index > -1) {
      conversations.splice(index, 1)
      await cacheManager.set(key, conversations, 7200)
    }
  }

  /**
   * 清理用户所有AI缓存
   */
  static async clearUserAICache(userId: string): Promise<void> {
    const patterns = [
      `${this.METRICS_PREFIX}:${userId}`,
      `user_conversations:${userId}`,
      `${this.CONTEXT_PREFIX}:*`,
      `${this.SUMMARY_PREFIX}:*`,
      `${this.RESPONSE_PREFIX}:*`
    ]

    // 删除用户指标
    await cacheManager.delete(patterns[0])
    await cacheManager.delete(patterns[1])

    // 获取并删除用户的所有对话上下文
    const conversationKeys = await cacheManager.keys(`${this.CONTEXT_PREFIX}:*`)
    for (const convKey of conversationKeys) {
      const context = await cacheManager.get(convKey)
      if (context?.userId === userId) {
        const conversationId = convKey.split(':')[1]

        // 删除相关的所有缓存
        await Promise.all([
          cacheManager.delete(convKey),
          cacheManager.delete(`${this.SUMMARY_PREFIX}:${conversationId}`),
          cacheManager.deletePattern(`${this.RESPONSE_PREFIX}:${conversationId}:*`)
        ])
      }
    }
  }

  /**
   * 获取对话统计信息
   */
  static async getConversationStats(conversationId: string): Promise<{
    messageCount: number
    userMessageCount: number
    assistantMessageCount: number
    totalTokens: number
    duration: number
    lastActivity: Date
  } | null> {
    const context = await this.getConversationContext(conversationId)
    if (!context) {
      return null
    }

    const userMessages = context.messages.filter(msg => msg.role === 'user')
    const assistantMessages = context.messages.filter(msg => msg.role === 'assistant')
    const totalTokens = context.messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0)

    const firstMessage = context.messages[0]
    const duration = firstMessage
      ? context.lastInteraction.getTime() - firstMessage.timestamp.getTime()
      : 0

    return {
      messageCount: context.messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      totalTokens,
      duration,
      lastActivity: context.lastInteraction
    }
  }

  /**
   * 批量获取用户对话统计
   */
  static async getUserConversationStats(userId: string): Promise<{
    totalConversations: number
    totalMessages: number
    totalTokens: number
    averageMessagesPerConversation: number
    activeConversations: number
  }> {
    const conversationIds = await this.getUserActiveConversations(userId)
    const stats = await Promise.all(
      conversationIds.map(id => this.getConversationStats(id))
    )

    const validStats = stats.filter(stat => stat !== null) as unknown[]

    return {
      totalConversations: conversationIds.length,
      totalMessages: validStats.reduce((sum, stat) => sum + stat.messageCount, 0),
      totalTokens: validStats.reduce((sum, stat) => sum + stat.totalTokens, 0),
      averageMessagesPerConversation: conversationIds.length > 0
        ? validStats.reduce((sum, stat) => sum + stat.messageCount, 0) / conversationIds.length
        : 0,
      activeConversations: validStats.filter(stat => {
        const oneHourAgo = Date.now() - 3600000
        return stat.lastActivity.getTime() > oneHourAgo
      }).length
    }
  }

  /**
   * 清理过期缓存
   */
  static async cleanupExpiredCache(): Promise<{
    cleanedContexts: number
    cleanedSummaries: number
    cleanedResponses: number
  }> {
    const now = Date.now()
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

    let cleanedContexts = 0
    let cleanedSummaries = 0
    let cleanedResponses = 0

    // 清理过期的对话上下文
    const contextKeys = await cacheManager.keys(`${this.CONTEXT_PREFIX}:*`)
    for (const key of contextKeys) {
      const context = await cacheManager.get(key)
      if (context && context.lastInteraction.getTime() < oneWeekAgo) {
        const conversationId = key.split(':')[1]

        await Promise.all([
          cacheManager.delete(key),
          cacheManager.delete(`${this.SUMMARY_PREFIX}:${conversationId}`),
          cacheManager.deletePattern(`${this.RESPONSE_PREFIX}:${conversationId}:*`)
        ])

        cleanedContexts++
      }
    }

    // 清理孤立的摘要
    const summaryKeys = await cacheManager.keys(`${this.SUMMARY_PREFIX}:*`)
    for (const key of summaryKeys) {
      const conversationId = key.split(':')[1]
      const contextKey = `${this.CONTEXT_PREFIX}:${conversationId}`

      if (!(await cacheManager.exists(contextKey))) {
        await cacheManager.delete(key)
        cleanedSummaries++
      }
    }

    // 清理孤立的响应缓存
    const responseKeys = await cacheManager.keys(`${this.RESPONSE_PREFIX}:*`)
    for (const key of responseKeys) {
      const parts = key.split(':')
      const conversationId = parts[2]
      const contextKey = `${this.CONTEXT_PREFIX}:${conversationId}`

      if (!(await cacheManager.exists(contextKey))) {
        await cacheManager.delete(key)
        cleanedResponses++
      }
    }

    return {
      cleanedContexts,
      cleanedSummaries,
      cleanedResponses
    }
  }

  /**
   * 预热缓存 - 为活跃用户预加载常用数据
   */
  static async warmupCache(userIds: string[]): Promise<void> {
    logger.info(`Warming up cache for ${userIds.length} users`)

    for (const userId of userIds) {
      try {
        // 预加载用户指标
        await this.getAIMetrics(userId)

        // 预加载用户活跃对话
        const conversations = await this.getUserActiveConversations(userId)

        // 预加载最近5个对话的上下文
        for (const conversationId of conversations.slice(0, 5)) {
          await this.getConversationContext(conversationId)
          await this.getConversationStats(conversationId)
        }
      } catch (error) {
        logger.error('Cache warmup error:', { userId, error })
      }
    }
  }
}

export default AIConversationCacheService
