import { createServiceLogger } from '../lib/logger'
import { eq, and, lt, desc, sql, isNotNull } from 'drizzle-orm'
import { globalMutex } from '@shared/schema'
import { getDatabase } from '../db'
import { DistributedLockManager } from '../lib/distributed-lock'

const logger = createServiceLogger('TokenManager')

export interface TokenInfo {
  id: string
  activeDeviceId: string | null
  deviceType: string | null
  expiresAt: number
  createdAt: number
  lastHeartbeat: number
  status: 'ACTIVE' | 'EXPIRED' | 'RELEASED'
}

export interface TokenRequest {
  deviceId: string
  deviceType: string
  deviceName: string
  requestedBy: string
  requestTime: number
  priority: number // 1-10, 10为最高优先级
}

/**
 * 令牌管理器
 * 负责全局令牌的分配、管理和监控
 */
export class TokenManager {
  private readonly TOKEN_EXPIRE_TIME = 30000 // 30秒过期
  private readonly HEARTBEAT_INTERVAL = 5000 // 5秒心跳间隔
  private readonly LOCK_TTL = 10 // 锁超时10秒

  /**
   * 请求获取令牌
   */
  async requestToken(request: TokenRequest): Promise<{
    success: boolean
    tokenInfo?: TokenInfo
    message?: string
  }> {
    const lockKey = `token_request_${request.deviceId}`

    return await DistributedLockManager.withLock(lockKey, 'TokenManager', async () => {
      try {
        // 检查当前是否有活跃令牌
        const currentToken = await this.getCurrentToken()
        
        // 如果当前设备已持有令牌，更新过期时间
        if (currentToken && currentToken.activeDeviceId === request.deviceId) {
          const updatedToken = await this.renewToken(currentToken.id)
          return {
            success: true,
            tokenInfo: updatedToken ?? undefined,
            message: '令牌续期成功'
          }
        }

        // 检查当前令牌是否过期
        if (currentToken && Date.now() <= currentToken.expiresAt) {
          // 检查优先级是否可以抢占
          if (request.priority <= 5) { // 低优先级不能抢占
            return {
              success: false,
              message: `令牌已被设备 ${currentToken.activeDeviceId} 持有`
            }
          }
          
          // 高优先级可以抢占，但需要先释放现有令牌
          await this.releaseToken(currentToken.activeDeviceId!, 'HIGH_PRIORITY_PREEMPT')
          logger.info('高优先级令牌抢占', {
            preemptingDevice: request.deviceId,
            preemptedDevice: currentToken.activeDeviceId,
            priority: request.priority
          })
        }

        // 分配新令牌
        const newToken = await this.grantToken(request)
        
        logger.info('令牌分配成功', {
          deviceId: request.deviceId,
          tokenId: newToken.id,
          deviceType: request.deviceType,
          priority: request.priority
        })

        return {
          success: true,
          tokenInfo: newToken,
          message: '令牌获取成功'
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('令牌请求失败', { 
          deviceId: request.deviceId,
          error: errorMessage 
        })
        
        return {
          success: false,
          message: '令牌请求失败: ' + errorMessage
        }
      }
    }, {
      ttl: this.LOCK_TTL,
      maxRetries: 5,
      retryDelay: 100
    })
  }

  /**
   * 释放令牌
   */
  async releaseToken(deviceId: string, reason: string = 'MANUAL_RELEASE'): Promise<boolean> {
    const lockKey = 'token_release_operation'

    return await DistributedLockManager.withLock(lockKey, 'TokenManager', async () => {
      try {
        const currentToken = await this.getCurrentToken()
        
        if (!currentToken || currentToken.activeDeviceId !== deviceId) {
          logger.warn('尝试释放非持有的令牌', { deviceId })
          return false
        }

        // 更新令牌状态
        const db = getDatabase()
        if (!db) {
          throw new Error('数据库未初始化')
        }
        await db.update(globalMutex)
          .set({
            activeDeviceId: null,
            activeDeviceType: null,
            updatedAt: new Date()
          })
          .where(eq(globalMutex.id, currentToken.id))

        logger.info('令牌已释放', {
          deviceId,
          tokenId: currentToken.id,
          reason
        })

        return true

      } catch (error: unknown) {
        logger.error('令牌释放失败', { deviceId, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    }, {
      ttl: this.LOCK_TTL
    })
  }

  /**
   * 续期令牌
   */
  async renewToken(tokenId: string): Promise<TokenInfo | null> {
    try {
      const newExpiresAt = Date.now() + this.TOKEN_EXPIRE_TIME

      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      await db.update(globalMutex)
        .set({
          expiresAt: new Date(newExpiresAt),
          acquiredAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(globalMutex.id, tokenId))

      const renewedToken = await this.getCurrentToken()
      logger.debug('令牌续期成功', { tokenId, newExpiresAt })

      return renewedToken

    } catch (error: unknown) {
      logger.error('令牌续期失败', { tokenId, error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  /**
   * 发送心跳
   */
  async heartbeat(deviceId: string): Promise<{
    success: boolean
    tokenInfo?: TokenInfo
    message?: string
  }> {
    try {
      const currentToken = await this.getCurrentToken()
      
      if (!currentToken || currentToken.activeDeviceId !== deviceId) {
        return {
          success: false,
          message: '设备未持有活跃令牌'
        }
      }

      // 更新心跳时间
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      await db.update(globalMutex)
        .set({
          acquiredAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(globalMutex.id, currentToken.id))

      // 检查是否需要续期
      const timeToExpiry = currentToken.expiresAt - Date.now()
      if (timeToExpiry < this.TOKEN_EXPIRE_TIME * 0.5) {
        const renewedToken = await this.renewToken(currentToken.id)
        return {
          success: true,
          tokenInfo: renewedToken ?? undefined,
          message: '心跳成功并自动续期'
        }
      }

      return {
        success: true,
        tokenInfo: currentToken,
        message: '心跳成功'
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('心跳发送失败', { deviceId, error: errorMsg })
      return {
        success: false,
        message: '心跳失败: ' + errorMsg
      }
    }
  }

  /**
   * 获取当前令牌信息
   */
  async getCurrentToken(): Promise<TokenInfo | null> {
    try {
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      const tokens = await db.select()
        .from(globalMutex)
        .where(isNotNull(globalMutex.activeDeviceId))
        .orderBy(desc(globalMutex.createdAt))
        .limit(1)

      if (tokens.length === 0) {
        return null
      }

      const token = tokens[0]
      
      // 检查令牌是否过期
      if (token.expiresAt && Date.now() > token.expiresAt.getTime()) {
        await this.markTokenExpired(token.id)
        return null
      }

      return {
        id: token.id,
        activeDeviceId: token.activeDeviceId,
        deviceType: token.activeDeviceType,
        expiresAt: token.expiresAt?.getTime() || 0,
        createdAt: token.createdAt?.getTime() || 0,
        lastHeartbeat: token.acquiredAt?.getTime() || 0,
        status: 'ACTIVE'
      }

    } catch (error: unknown) {
      logger.error('获取当前令牌失败', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  /**
   * 获取所有令牌历史
   */
  async getTokenHistory(limit: number = 50): Promise<TokenInfo[]> {
    try {
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      const tokens = await db.select()
        .from(globalMutex)
        .orderBy(desc(globalMutex.createdAt))
        .limit(limit)

      return tokens.map(token => ({
        id: token.id,
        activeDeviceId: token.activeDeviceId,
        deviceType: token.activeDeviceType,
        expiresAt: token.expiresAt?.getTime() || 0,
        createdAt: token.createdAt?.getTime() || 0,
        lastHeartbeat: token.acquiredAt?.getTime() || 0,
        status: 'ACTIVE'
      }))

    } catch (error: unknown) {
      logger.error('获取令牌历史失败', { error: error instanceof Error ? error.message : String(error) })
      return []
    }
  }

  /**
   * 清理过期令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      const expiredTokens = await db.select()
        .from(globalMutex)
        .where(and(
          sql`${globalMutex.activeDeviceId} IS NOT NULL`,
          lt(globalMutex.expiresAt, new Date())
        ))

      let cleanedCount = 0
      
      for (const token of expiredTokens) {
        await this.markTokenExpired(token.id)
        cleanedCount++
      }

      if (cleanedCount > 0) {
        logger.info('清理过期令牌', { count: cleanedCount })
      }

      return cleanedCount

    } catch (error: unknown) {
      logger.error('清理过期令牌失败', { error: error instanceof Error ? error.message : String(error) })
      return 0
    }
  }

  /**
   * 标记令牌过期
   */
  private async markTokenExpired(tokenId: string): Promise<void> {
    const db = getDatabase()
    if (!db) {
      throw new Error('数据库未初始化')
    }
    await db.update(globalMutex)
      .set({
        activeDeviceId: null,
        activeDeviceType: null,
        updatedAt: new Date()
      })
      .where(eq(globalMutex.id, tokenId))
  }

  /**
   * 授予新令牌
   */
  private async grantToken(request: TokenRequest): Promise<TokenInfo> {
    const now = new Date()
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRE_TIME)

    const db = getDatabase()
    if (!db) {
      throw new Error('数据库未初始化')
    }
    const [newToken] = await db.insert(globalMutex)
      .values({
        mutexKey: `token_${request.deviceId}_${Date.now()}`,
        activeDeviceId: request.deviceId,
        activeDeviceType: request.deviceType,
        activeDeviceName: request.deviceName,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
        acquiredAt: now
      })
      .returning()

    return {
      id: newToken.id,
      activeDeviceId: newToken.activeDeviceId,
      deviceType: newToken.activeDeviceType,
      expiresAt: newToken.expiresAt?.getTime() || 0,
      createdAt: newToken.createdAt?.getTime() || 0,
      lastHeartbeat: newToken.acquiredAt?.getTime() || 0,
      status: 'ACTIVE'
    }
  }

  /**
   * 获取令牌统计信息
   */
  async getTokenStats(): Promise<{
    totalTokens: number
    activeTokens: number
    expiredTokens: number
    averageHoldTime: number
    mostActiveDevice: string | null
  }> {
    try {
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }
      const [totalResult, activeResult, expiredResult] = await Promise.all([
        db.select().from(globalMutex),
        db.select().from(globalMutex).where(sql`${globalMutex.activeDeviceId} IS NOT NULL`),
        db.select().from(globalMutex).where(sql`${globalMutex.activeDeviceId} IS NULL`)
      ])

      const totalTokens = totalResult.length
      const activeTokens = activeResult.length
      const expiredTokens = expiredResult.length

      // 计算平均持有时间
      const validTokens = totalResult.filter(token => 
        token.expiresAt && token.createdAt
      )
      
      const averageHoldTime = validTokens.length > 0
        ? validTokens.reduce((sum, token) => 
            sum + (token.expiresAt!.getTime() - token.createdAt!.getTime()), 0
          ) / validTokens.length
        : 0

      // 找出最活跃的设备
      const deviceCounts = new Map<string, number>()
      totalResult.forEach(token => {
        if (token.activeDeviceId) {
          const count = deviceCounts.get(token.activeDeviceId) || 0
          deviceCounts.set(token.activeDeviceId, count + 1)
        }
      })

      let mostActiveDevice: string | null = null
      let maxCount = 0
      
      for (const [deviceId, count] of deviceCounts) {
        if (count > maxCount) {
          maxCount = count
          mostActiveDevice = deviceId
        }
      }

      return {
        totalTokens,
        activeTokens,
        expiredTokens,
        averageHoldTime,
        mostActiveDevice
      }

    } catch (error: unknown) {
      logger.error('获取令牌统计失败', { error: error instanceof Error ? error.message : String(error) })
      return {
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        averageHoldTime: 0,
        mostActiveDevice: null
      }
    }
  }
}

// 导出单例实例
export const tokenManager = new TokenManager()