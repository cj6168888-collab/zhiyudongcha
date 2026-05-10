import { Request, Response } from 'express'
import logger from '../lib/logger'
import cacheManager from '../lib/cache'
import { SessionCacheService, ApiCacheService } from '../lib/cache-middleware'
import AIConversationCacheService from '../services/ai-conversation-cache'

/**
 * 缓存管理路由
 */
export async function getCacheStats(req: Request, res: Response) {
  try {
    const cacheMetrics = cacheManager.getMetrics()
    const healthCheck = await cacheManager.healthCheck()

    res.json({
      success: true,
      data: {
        metrics: cacheMetrics,
        health: healthCheck,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Cache stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    })
  }
}

/**
 * 清理缓存
 */
export async function clearCache(req: Request, res: Response) {
  try {
    const { pattern, type } = req.query

    if (pattern) {
      const deletedCount = await cacheManager.deletePattern(pattern as string)
      res.json({
        success: true,
        data: {
          deletedCount,
          pattern,
          message: `Cleared ${deletedCount} keys matching pattern: ${pattern}`
        }
      })
    } else if (type) {
      let deletedCount = 0
      
      switch (type) {
        case 'sessions':
          deletedCount = await cacheManager.deletePattern('session:*')
          deletedCount += await cacheManager.deletePattern('user_sessions:*')
          break
        case 'api':
          deletedCount = await cacheManager.deletePattern('api_response:*')
          deletedCount += await cacheManager.deletePattern('user:*:api_response:*')
          break
        case 'ai':
          deletedCount = await cacheManager.deletePattern('ai_context:*')
          deletedCount += await cacheManager.deletePattern('ai_metrics:*')
          deletedCount += await cacheManager.deletePattern('ai_summary:*')
          deletedCount += await cacheManager.deletePattern('ai_response:*')
          break
        case 'all':
          await cacheManager.clear()
          deletedCount = -1 // 表示全部清理
          break
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid cache type. Supported: sessions, api, ai, all'
          })
      }

      res.json({
        success: true,
        data: {
          deletedCount,
          type,
          message: deletedCount === -1 
            ? 'All cache cleared' 
            : `Cleared ${deletedCount} keys of type: ${type}`
        }
      })
    } else {
      res.status(400).json({
        success: false,
        error: 'Either pattern or type parameter is required'
      })
    }
  } catch (error) {
    logger.error('Clear cache error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    })
  }
}

/**
 * 获取会话缓存信息
 */
export async function getSessionCacheInfo(req: Request, res: Response) {
  try {
    const { sessionId, userId } = req.query

    if (sessionId) {
      const sessionData = await SessionCacheService.getSession(sessionId as string)
      res.json({
        success: true,
        data: {
          sessionId,
          sessionData,
          exists: sessionData !== null
        }
      })
    } else if (userId) {
      const activeSessions = await SessionCacheService.getUserActiveSessions(userId as string)
      res.json({
        success: true,
        data: {
          userId,
          activeSessions,
          count: activeSessions?.length || 0
        }
      })
    } else {
      const allSessionKeys = await cacheManager.keys('session:*')
      const allUserSessionKeys = await cacheManager.keys('user_sessions:*')
      
      res.json({
        success: true,
        data: {
          totalSessions: allSessionKeys.length,
          totalUserSessionLists: allUserSessionKeys.length,
          sessionKeys: allSessionKeys.slice(0, 10), // 只返回前10个
          userSessionKeys: allUserSessionKeys.slice(0, 10)
        }
      })
    }
  } catch (error) {
    logger.error('Session cache info error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get session cache info'
    })
  }
}

/**
 * 清理会话缓存
 */
export async function clearSessionCache(req: Request, res: Response) {
  try {
    const { sessionId, userId } = req.query

    if (sessionId) {
      await SessionCacheService.deleteSession(sessionId as string)
      res.json({
        success: true,
        data: {
          sessionId,
          message: 'Session cache cleared'
        }
      })
    } else if (userId) {
      await SessionCacheService.clearUserCache(userId as string)
      res.json({
        success: true,
        data: {
          userId,
          message: 'All user session cache cleared'
        }
      })
    } else {
      res.status(400).json({
        success: false,
        error: 'Either sessionId or userId parameter is required'
      })
    }
  } catch (error) {
    logger.error('Clear session cache error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear session cache'
    })
  }
}

/**
 * 获取AI对话缓存信息
 */
export async function getAICacheInfo(req: Request, res: Response) {
  try {
    const { conversationId, userId } = req.query

    if (conversationId) {
      const [context, stats] = await Promise.all([
        AIConversationCacheService.getConversationContext(conversationId as string),
        AIConversationCacheService.getConversationStats(conversationId as string)
      ])
      
      res.json({
        success: true,
        data: {
          conversationId,
          context,
          stats,
          exists: context !== null
        }
      })
    } else if (userId) {
      const [metrics, conversationStats] = await Promise.all([
        AIConversationCacheService.getAIMetrics(userId as string),
        AIConversationCacheService.getUserConversationStats(userId as string)
      ])
      
      res.json({
        success: true,
        data: {
          userId,
          metrics,
          conversationStats
        }
      })
    } else {
      const contextKeys = await cacheManager.keys('ai_context:*')
      const metricsKeys = await cacheManager.keys('ai_metrics:*')
      
      res.json({
        success: true,
        data: {
          totalContexts: contextKeys.length,
          totalMetrics: metricsKeys.length,
          contextKeys: contextKeys.slice(0, 10),
          metricsKeys: metricsKeys.slice(0, 10)
        }
      })
    }
  } catch (error) {
    logger.error('AI cache info error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get AI cache info'
    })
  }
}

/**
 * 清理AI对话缓存
 */
export async function clearAICache(req: Request, res: Response) {
  try {
    const { conversationId, userId } = req.query

    if (conversationId) {
      const convId = conversationId as string
      await Promise.all([
        cacheManager.delete(`ai_context:${convId}`),
        cacheManager.delete(`ai_summary:${convId}`),
        cacheManager.deletePattern(`ai_response:${convId}:*`)
      ])
      
      // 从用户列表中移除
      const context = await AIConversationCacheService.getConversationContext(convId)
      if (context?.userId) {
        await AIConversationCacheService.removeConversationFromUserList(context.userId, convId)
      }
      
      res.json({
        success: true,
        data: {
          conversationId: convId,
          message: 'AI conversation cache cleared'
        }
      })
    } else if (userId) {
      await AIConversationCacheService.clearUserAICache(userId as string)
      res.json({
        success: true,
        data: {
          userId,
          message: 'All user AI cache cleared'
        }
      })
    } else {
      res.status(400).json({
        success: false,
        error: 'Either conversationId or userId parameter is required'
      })
    }
  } catch (error) {
    logger.error('Clear AI cache error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear AI cache'
    })
  }
}

/**
 * 缓存预热
 */
export async function warmupCache(req: Request, res: Response) {
  try {
    const { userIds, type } = req.body

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required'
      })
    }

    let warmedUpCount = 0

    switch (type) {
      case 'ai':
        await AIConversationCacheService.warmupCache(userIds)
        warmedUpCount = userIds.length
        break
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Supported: ai'
        })
    }

    res.json({
      success: true,
      data: {
        warmedUpCount,
        type,
        message: `Warmed up cache for ${warmedUpCount} users`
      }
    })
  } catch (error) {
    logger.error('Cache warmup error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to warmup cache'
    })
  }
}

/**
 * 缓存清理维护
 */
export async function maintenanceCache(req: Request, res: Response) {
  try {
    const { type } = req.query

    let results = {}

    switch (type) {
      case 'sessions':
        const cleanedSessions = await SessionCacheService.cleanupExpiredSessions()
        results = { cleanedSessions }
        break
      case 'ai':
        const aiCleanup = await AIConversationCacheService.cleanupExpiredCache()
        results = aiCleanup
        break
      case 'all':
        const [sessionCleanup, aiCleanupAll] = await Promise.all([
          SessionCacheService.cleanupExpiredSessions(),
          AIConversationCacheService.cleanupExpiredCache()
        ])
        results = {
          sessions: sessionCleanup,
          ai: aiCleanupAll
        }
        break
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Supported: sessions, ai, all'
        })
    }

    res.json({
      success: true,
      data: {
        type,
        results,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Cache maintenance error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to perform cache maintenance'
    })
  }
}

/**
 * 获取缓存配置信息
 */
export async function getCacheConfig(req: Request, res: Response) {
  try {
    const config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '0'),
        connected: cacheManager.getMetrics().connected
      },
      defaults: {
        sessionTTL: 3600,
        apiResponseTTL: 300,
        aiContextTTL: 3600,
        aiMetricsTTL: 86400
      },
      features: {
        responseCaching: true,
        sessionCaching: true,
        aiConversationCaching: true,
        queryResultCaching: true
      }
    }

    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    logger.error('Get cache config error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get cache config'
    })
  }
}

/**
 * 缓存性能测试
 */
export async function benchmarkCache(req: Request, res: Response) {
  try {
    const { operations = 1000, keySize = 32, valueSize = 1024 } = req.query
    
    const ops = parseInt(operations as string)
    const testKey = 'benchmark_test_' + 'x'.repeat(parseInt(keySize as string))
    const testValue = 'x'.repeat(parseInt(valueSize as string))

    const results = {
      setOperations: ops,
      getOperations: ops,
      setLatency: [] as number[],
      getLatency: [] as number[],
      errors: 0
    }

    // 测试写入性能
    for (let i = 0; i < ops; i++) {
      const startTime = Date.now()
      try {
        await cacheManager.set(`${testKey}_${i}`, testValue, 300)
        results.setLatency.push(Date.now() - startTime)
      } catch (error) {
        results.errors++
      }
    }

    // 测试读取性能
    for (let i = 0; i < ops; i++) {
      const startTime = Date.now()
      try {
        await cacheManager.get(`${testKey}_${i}`)
        results.getLatency.push(Date.now() - startTime)
      } catch (error) {
        results.errors++
      }
    }

    // 计算统计信息
    const avgSetLatency = results.setLatency.reduce((a, b) => a + b, 0) / results.setLatency.length
    const avgGetLatency = results.getLatency.reduce((a, b) => a + b, 0) / results.getLatency.length
    const p95SetLatency = calculatePercentile(results.setLatency, 95)
    const p95GetLatency = calculatePercentile(results.getLatency, 95)

    // 清理测试数据
    await cacheManager.deletePattern(`${testKey}_*`)

    res.json({
      success: true,
      data: {
        operations: ops,
        errors: results.errors,
        set: {
          avgLatency: Math.round(avgSetLatency * 100) / 100,
          p95Latency: Math.round(p95SetLatency * 100) / 100,
          opsPerSecond: Math.round(1000 / avgSetLatency)
        },
        get: {
          avgLatency: Math.round(avgGetLatency * 100) / 100,
          p95Latency: Math.round(p95GetLatency * 100) / 100,
          opsPerSecond: Math.round(1000 / avgGetLatency)
        }
      }
    })
  } catch (error) {
    logger.error('Cache benchmark error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to benchmark cache'
    })
  }
}

function calculatePercentile(numbers: number[], percentile: number): number {
  if (numbers.length === 0) return 0
  
  const sorted = [...numbers].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}