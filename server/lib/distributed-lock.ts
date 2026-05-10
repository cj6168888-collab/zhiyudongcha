import { pool } from '../db'
import { logger } from './logger'

export interface DistributedLock {
  key: string
  owner: string
  expiresAt: Date
  createdAt: Date
}

export interface LockOptions {
  ttl?: number
  retryDelay?: number
  maxRetries?: number
}

interface LockRow {
  key: string
  owner: string
  expires_at: Date
  created_at: Date
}

interface CountRow {
  count: string | number
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized')
  }
  return pool
}

/**
 * 分布式锁管理器
 * 用于确保并发操作的原子性
 */
export class DistributedLockManager {
  private static readonly DEFAULT_TTL = 30
  private static readonly DEFAULT_RETRY_DELAY = 100
  private static readonly DEFAULT_MAX_RETRIES = 50

  /**
   * 获取分布式锁
   */
  static async acquireLock(
    key: string,
    owner: string,
    options: LockOptions = {}
  ): Promise<boolean> {
    const {
      ttl = this.DEFAULT_TTL,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      maxRetries = this.DEFAULT_MAX_RETRIES
    } = options

    const expiresAt = new Date(Date.now() + ttl * 1000)

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const insertQuery = `
          INSERT INTO distributed_locks (key, owner, expires_at, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO NOTHING
          RETURNING id
        `

        const result = await getPool().query(insertQuery, [key, owner, expiresAt, new Date()])

        if (result.rows.length > 0) {
          logger.debug(`Lock acquired: ${key} by ${owner}`)
          return true
        }

        // 检查现有锁是否已过期
        const lockInfo = await this.getLockInfo(key)
        if (lockInfo && new Date() > lockInfo.expiresAt) {
          // 锁已过期，尝试释放并重新获取
          await this.releaseLock(key, lockInfo.owner)
          continue
        }

        // 锁被其他进程持有，等待后重试
        if (attempt < maxRetries - 1) {
          await this.sleep(retryDelay)
        }

      } catch (error: unknown) {
        logger.error(`Failed to acquire lock: ${key}`, { error: error instanceof Error ? error.message : String(error) })

        if (attempt === maxRetries - 1) {
          throw error
        }

        await this.sleep(retryDelay)
      }
    }

    logger.warn(`Failed to acquire lock after ${maxRetries} attempts: ${key}`)
    return false
  }

  /**
   * 释放分布式锁
   */
  static async releaseLock(key: string, owner: string): Promise<boolean> {
    try {
      const deleteQuery = `
        DELETE FROM distributed_locks
        WHERE key = $1 AND owner = $2
        RETURNING id
      `

      const result = await getPool().query(deleteQuery, [key, owner])

      if (result.rows.length > 0) {
        logger.debug(`Lock released: ${key} by ${owner}`)
        return true
      }

      logger.warn(`Failed to release lock: ${key} by ${owner} (not found or not owner)`)
      return false

    } catch (error: unknown) {
      logger.error(`Failed to release lock: ${key}`, { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 检查锁是否存在
   */
  static async isLockHeld(key: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM distributed_locks
        WHERE key = $1 AND expires_at > NOW()
        LIMIT 1
      `

      const result = await getPool().query(query, [key])
      return result.rows.length > 0

    } catch (error: unknown) {
      logger.error(`Failed to check lock: ${key}`, { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 获取锁信息
   */
  static async getLockInfo(key: string): Promise<DistributedLock | null> {
    try {
      const query = `
        SELECT key, owner, expires_at, created_at
        FROM distributed_locks
        WHERE key = $1 AND expires_at > NOW()
        LIMIT 1
      `

      const result = await getPool().query(query, [key])

      if (result.rows.length > 0) {
        return {
          key: result.rows[0].key,
          owner: result.rows[0].owner,
          expiresAt: new Date(result.rows[0].expiresAt),
          createdAt: new Date(result.rows[0].createdAt)
        }
      }

      return null

    } catch (error: unknown) {
      logger.error(`Failed to get lock info: ${key}`, { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  /**
   * 延长锁的过期时间
   */
  static async extendLock(
    key: string,
    owner: string,
    additionalTTL: number = this.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      const updateQuery = `
        UPDATE distributed_locks
        SET expires_at = NOW() + INTERVAL '${additionalTTL} seconds'
        WHERE key = $1 AND owner = $2 AND expires_at > NOW()
        RETURNING id
      `

      const result = await getPool().query(updateQuery, [key, owner])

      if (result.rows.length > 0) {
        logger.debug(`Lock extended: ${key} by ${owner}`)
        return true
      }

      logger.warn(`Failed to extend lock: ${key} by ${owner} (not found, not owner, or expired)`)
      return false

    } catch (error: unknown) {
      logger.error(`Failed to extend lock: ${key}`, { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 强制释放锁（管理员功能）
   */
  static async forceReleaseLock(key: string): Promise<boolean> {
    try {
      const deleteQuery = `
        DELETE FROM distributed_locks
        WHERE key = $1
        RETURNING id
      `

      const result = await getPool().query(deleteQuery, [key])

      if (result.rows.length > 0) {
        logger.warn(`Lock force released: ${key}`)
        return true
      }

      return false

    } catch (error: unknown) {
      logger.error(`Failed to force release lock: ${key}`, { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * 清理过期锁
   */
  static async cleanupExpiredLocks(): Promise<number> {
    try {
      const deleteQuery = `
        DELETE FROM distributed_locks
        WHERE expires_at <= NOW()
        RETURNING id
      `

      const result = await getPool().query(deleteQuery)
      const cleanedCount = result.rows.length

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired locks`)
      }

      return cleanedCount

    } catch (error: unknown) {
      logger.error('Failed to cleanup expired locks', { error: error instanceof Error ? error.message : String(error) })
      return 0
    }
  }

  /**
   * 获取所有活跃锁
   */
  static async getActiveLocks(): Promise<DistributedLock[]> {
    try {
      const query = `
        SELECT key, owner, expires_at, created_at
        FROM distributed_locks
        WHERE expires_at > NOW()
        ORDER BY created_at DESC
      `

      const result = await getPool().query(query)

      return result.rows.map((row: Record<string, unknown>) => {
        return {
          key: row.key as string,
          owner: row.owner as string,
          expiresAt: new Date((row.expires_at ?? row.expiresAt) as string),
          createdAt: new Date((row.created_at ?? row.createdAt) as string),
        };
      })

    } catch (error: unknown) {
      logger.error('Failed to get active locks', { error: error instanceof Error ? error.message : String(error) })
      return []
    }
  }

  /**
   * 获取锁统计信息
   */
  static async getLockStatistics(): Promise<{
    total: number
    expired: number
    byOwner: Record<string, number>
  }> {
    try {
      const [totalQuery, expiredQuery, ownerQuery] = await Promise.all([
        getPool().query<CountRow>('SELECT COUNT(*) as count FROM distributed_locks WHERE expires_at > NOW()'),
        getPool().query<CountRow>('SELECT COUNT(*) as count FROM distributed_locks WHERE expires_at <= NOW()'),
        getPool().query<{ owner: string; count: string | number }>(`
          SELECT owner, COUNT(*) as count
          FROM distributed_locks
          WHERE expires_at > NOW()
          GROUP BY owner
        `)
      ])

      const total = parseInt(String(totalQuery.rows[0].count))
      const expired = parseInt(String(expiredQuery.rows[0].count))
      const byOwner: Record<string, number> = {}

      ownerQuery.rows.forEach((row: { owner: string; count: string | number }) => {
        byOwner[row.owner] = parseInt(String(row.count))
      })

      return { total, expired, byOwner }

    } catch (error: unknown) {
      logger.error('Failed to get lock statistics', { error: error instanceof Error ? error.message : String(error) })
      return { total: 0, expired: 0, byOwner: {} }
    }
  }

  /**
   * 执行带锁的操作
   */
  static async withLock<T>(
    key: string,
    owner: string,
    operation: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const lockAcquired = await this.acquireLock(key, owner, options)

    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock: ${key}`)
    }

    try {
      return await operation()
    } finally {
      await this.releaseLock(key, owner)
    }
  }

  /**
   * 延迟函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * HP余额操作的分布式锁工具
 */
export class HPLockManager {
  private static readonly LOCK_PREFIX = 'hp_balance_'

  /**
   * 安全更新HP余额
   */
  static async safeUpdateHPBalance(
    userId: string,
    operation: 'consume' | 'add',
    amount: number,
    description: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const lockKey = `${this.LOCK_PREFIX}${userId}`
    const owner = `hp_operation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return await DistributedLockManager.withLock(lockKey, owner, async () => {
      const client = await getPool().connect()

      try {
        await client.query('BEGIN')

        // 获取当前HP余额
        const currentBalanceResult = await client.query(
          'SELECT hp_balance FROM persons WHERE id = $1 FOR UPDATE',
          [userId]
        )

        if (currentBalanceResult.rows.length === 0) {
          throw new Error('User not found')
        }

        const currentBalance = currentBalanceResult.rows[0].hp_balance

        // 执行操作
        let newBalance: number
        if (operation === 'consume') {
          if (currentBalance < amount) {
            throw new Error('Insufficient HP balance')
          }
          newBalance = currentBalance - amount
        } else {
          newBalance = currentBalance + amount
        }

        // 更新余额
        await client.query(
          'UPDATE persons SET hp_balance = $1 WHERE id = $2',
          [newBalance, userId]
        )

        // 记录交易
        await client.query(
          `INSERT INTO hp_transactions
           (user_id, operation, amount, previous_balance, new_balance, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [userId, operation, amount, currentBalance, newBalance, description]
        )

        await client.query('COMMIT')

        logger.info(`HP balance updated`, {
          userId,
          operation,
          amount,
          previousBalance: currentBalance,
          newBalance,
          description
        })

        return { success: true, newBalance }

      } catch (error) {
        await client.query('ROLLBACK')

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`HP balance update failed`, {
          userId,
          operation,
          amount,
          error: errorMessage
        })

        return { success: false, error: errorMessage }

      } finally {
        client.release()
      }
    }, {
      ttl: 30, // 30秒超时
      retryDelay: 50, // 50毫秒重试间隔
      maxRetries: 100 // 最多重试100次（5秒）
    })
  }

  /**
   * 批量更新多个用户的HP余额
   */
  static async safeBatchUpdateHPBalance(
    updates: Array<{
      userId: string
      operation: 'consume' | 'add'
      amount: number
      description: string
    }>
  ): Promise<Array<{ userId: string; success: boolean; newBalance?: number; error?: string }>> {
    const lockKey = 'hp_batch_operation'
    const owner = `hp_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return await DistributedLockManager.withLock(lockKey, owner, async () => {
      const results = []

      for (const update of updates) {
        const result = await this.safeUpdateHPBalance(
          update.userId,
          update.operation,
          update.amount,
          update.description
        )
        results.push({ userId: update.userId, ...result })
      }

      return results
    }, {
      ttl: 60, // 1分钟超时
      retryDelay: 100,
      maxRetries: 300 // 最多重试300次（30秒）
    })
  }
}

export default DistributedLockManager
