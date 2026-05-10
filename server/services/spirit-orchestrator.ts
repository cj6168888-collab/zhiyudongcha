import { createServiceLogger } from '../lib/logger'
import { tokenManager, TokenInfo } from './token-manager'
import { deviceManager, DeviceInfo, DeviceHeartbeat } from './device-manager'
import { migrationCoordinator, MigrationRequest } from './migration-coordinator'
import { heartbeatManager, HeartbeatConfig } from './heartbeat-manager'

type TokenStats = Awaited<ReturnType<typeof tokenManager.getTokenStats>>
type HealthStats = Awaited<ReturnType<typeof heartbeatManager.getHealthStats>>
type MigrationRecord = {
  id?: string;
  sourceDevice?: string;
  targetDevice?: string;
  status?: string;
  startedAt?: Date;
  endedAt?: Date;
  [key: string]: unknown;
} // typed instead of any

const logger = createServiceLogger('SpiritOrchestrator')

interface DeviceMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  batteryLevel?: number;
  networkLatency?: number;
  temperature?: number;
  [key: string]: unknown;
}

/**
 * 灵魂协调器
 * 负责协调令牌管理、设备管理、迁移协调和心跳管理
 * 替代原有的SpiritSingleton，实现单一职责原则
 */
export class SpiritOrchestrator {
  private isInitialized = false
  private startTime: number = Date.now();

  /**
   * 初始化灵魂协调器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('灵魂协调器已初始化')
      return
    }

    try {
      logger.info('正在初始化灵魂协调器...')

      // 启动心跳管理器
      heartbeatManager.start()

      // 清理过期的令牌
      await tokenManager.cleanupExpiredTokens()

      // 强制更新离线设备状态
      await deviceManager.forceUpdateOfflineStatus()

      // 清理过期的迁移记录
      await migrationCoordinator.cleanupExpiredMigrations()

      this.isInitialized = true

      logger.info('灵魂协调器初始化完成')

    } catch (error) {
      logger.error({ error: (error as Error).message }, '灵魂协调器初始化失败')
      throw error
    }
  }

  /**
   * 停止灵魂协调器
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    try {
      logger.info('正在关闭灵魂协调器...')

      // 停止心跳管理器
      heartbeatManager.stop()

      // 释放当前令牌
      const currentToken = await tokenManager.getCurrentToken()
      if (currentToken && currentToken.activeDeviceId) {
        await tokenManager.releaseToken(currentToken.activeDeviceId, 'SYSTEM_SHUTDOWN')
        logger.info({ deviceId: currentToken.activeDeviceId }, '系统关闭时释放令牌')
      }

      this.isInitialized = false

      logger.info('灵魂协调器已关闭')

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, '灵魂协调器关闭失败')
    }
  }

  /**
   * 注册设备
   */
  async registerDevice(deviceInfo: Omit<DeviceInfo, 'id' | 'lastSeen' | 'status'>): Promise<{
    success: boolean
    deviceId?: string
    message?: string
  }> {
    try {
      const result = await deviceManager.registerDevice(deviceInfo)
      
      if (result.success && result.deviceId) {
        // 注册设备心跳
        heartbeatManager.registerDeviceHeartbeat(result.deviceId)
        logger.info({ deviceId: result.deviceId }, '设备注册成功并启动心跳')
      }

      return result

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, '设备注册失败')
      return {
        success: false,
        message: '设备注册失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 注销设备
   */
  async unregisterDevice(deviceId: string): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      // 注销设备心跳
      heartbeatManager.unregisterDeviceHeartbeat(deviceId)

      // 如果设备持有令牌，先释放
      const currentToken = await tokenManager.getCurrentToken()
      if (currentToken && currentToken.activeDeviceId === deviceId) {
        await tokenManager.releaseToken(deviceId, 'DEVICE_UNREGISTER')
      }

      // 注销设备
      const result = await deviceManager.unregisterDevice(deviceId)

      if (result.success) {
        logger.info({ deviceId }, '设备注销成功')
      }

      return result

    } catch (error) {
      logger.error({ deviceId, error: error instanceof Error ? error.message : String(error) }, '设备注销失败')
      return {
        success: false,
        message: '设备注销失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 请求令牌
   */
  async requestSpiritToken(deviceId: string, priority: number = 5, reason: string = 'USER_REQUEST'): Promise<{
    success: boolean
    tokenInfo?: TokenInfo
    message?: string
  }> {
    try {
      const device = await deviceManager.getDevice(deviceId)
      if (!device) {
        return {
          success: false,
          message: '设备不存在'
        }
      }

      const request = {
        deviceId,
        deviceType: device.type,
        deviceName: device.name,
        requestedBy: 'SpiritOrchestrator',
        requestTime: Date.now(),
        priority
      }

      const result = await tokenManager.requestToken(request)

      if (result.success && result.tokenInfo) {
        logger.info({
          deviceId,
          tokenId: result.tokenInfo.id,
          priority,
          reason
        }, '灵魂令牌获取成功')
      }

      return result

    } catch (error) {
      logger.error({ deviceId, error: error instanceof Error ? error.message : String(error) }, '灵魂令牌请求失败')
      return {
        success: false,
        message: '灵魂令牌请求失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 释放令牌
   */
  async releaseSpiritToken(deviceId: string, reason: string = 'MANUAL_RELEASE'): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      const result = await tokenManager.releaseToken(deviceId, reason)

      if (result) {
        logger.info({ deviceId, reason }, '灵魂令牌释放成功')
      }

      return {
        success: result,
        message: result ? '令牌释放成功' : '令牌释放失败'
      }

    } catch (error) {
      logger.error({ deviceId, error: error instanceof Error ? error.message : String(error) }, '灵魂令牌释放失败')
      return {
        success: false,
        message: '灵魂令牌释放失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 发送设备心跳
   */
  async sendHeartbeat(deviceId: string, metrics?: DeviceMetrics): Promise<{
    success: boolean
    tokenInfo?: TokenInfo
    message?: string
  }> {
    try {
      // 构建心跳数据
      const heartbeat = {
        deviceId,
        timestamp: Date.now(),
        status: 'HEALTHY' as const,
        metrics: metrics || {},
        events: []
      }

      // 处理设备心跳
      const deviceResult = await deviceManager.handleHeartbeat(heartbeat)
      if (!deviceResult.success) {
        return deviceResult
      }

      // 发送令牌心跳
      const tokenResult = await tokenManager.heartbeat(deviceId)

      if (tokenResult.success) {
        logger.debug({ deviceId }, '设备心跳成功')
      }

      return tokenResult

    } catch (error) {
      logger.error({ deviceId, error: error instanceof Error ? error.message : String(error) }, '设备心跳失败')
      return {
        success: false,
        message: '设备心跳失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 请求设备迁移
   */
  async requestMigration(
    fromDeviceId: string,
    toDeviceId: string,
    reason: 'USER_INITIATED' | 'HIGH_PRIORITY' | 'DEVICE_FAILURE' | 'SYSTEM_MAINTENANCE' = 'USER_INITIATED',
    priority: number = 5
  ): Promise<{
    success: boolean
    migrationId?: string
    message?: string
  }> {
    try {
      const migrationId = this.generateMigrationId()

      const request: MigrationRequest = {
        id: migrationId,
        fromDeviceId,
        toDeviceId,
        reason,
        priority,
        requestedAt: Date.now(),
        requestedBy: 'SpiritOrchestrator',
        metadata: {
          preserveState: true,
          transferData: ['session', 'preferences', 'context'],
          timeout: 60000,
          rollbackOnFailure: true
        }
      }

      const result = await migrationCoordinator.requestMigration(request)

      if (result.success) {
        logger.info({
          migrationId,
          fromDeviceId,
          toDeviceId,
          reason,
          priority
        }, '设备迁移请求成功')
      }

      return result

    } catch (error) {
      logger.error({ fromDeviceId, toDeviceId, error: error instanceof Error ? error.message : String(error) }, '设备迁移请求失败')
      return {
        success: false,
        message: '设备迁移请求失败: ' + (error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    orchestrator: {
      isInitialized: boolean
    }
    token: {
      currentToken: TokenInfo | null
      stats: TokenStats
    }
    devices: {
      total: number
      online: number
      offline: number
      byType: Record<string, number>
    }
    heartbeat: {
      healthStats: HealthStats
      config: HeartbeatConfig
    }
    migrations: {
      active: number
      recent: MigrationRecord[]
    }
  }> {
    try {
      const [currentToken, tokenStats, deviceStats, heartbeatStats, activeMigrations, migrationHistory] = await Promise.all([
        tokenManager.getCurrentToken(),
        tokenManager.getTokenStats(),
        deviceManager.getDeviceStats(),
        heartbeatManager.getHealthStats(),
        Array.from(migrationCoordinator.getActiveMigrations()),
        migrationCoordinator.getMigrationHistory(10)
      ])

      return {
        orchestrator: {
          isInitialized: this.isInitialized
        },
        token: {
          currentToken,
          stats: tokenStats
        },
        devices: {
          total: deviceStats.total,
          online: deviceStats.online,
          offline: deviceStats.offline,
          byType: deviceStats.byType
        },
        heartbeat: {
          healthStats: heartbeatStats,
          config: heartbeatManager.getConfig()
        },
        migrations: {
          active: activeMigrations.length,
          recent: migrationHistory
        }
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, '获取系统状态失败')
      throw error
    }
  }

  /**
   * 获取迁移进度
   */
  getMigrationProgress(migrationId: string) {
    return migrationCoordinator.getMigrationProgress(migrationId)
  }

  /**
   * 取消迁移
   */
  async cancelMigration(migrationId: string, reason: string = 'USER_CANCELLED'): Promise<{
    success: boolean
    message?: string
  }> {
    return await migrationCoordinator.cancelMigration(migrationId, reason)
  }

  /**
   * 强制系统同步
   */
  async forceSystemSync(): Promise<{
    success: boolean
    results: {
      tokenCleanup: number
      deviceStatusUpdate: number
      heartbeatSync: number
      migrationCleanup: number
    }
  }> {
    try {
      logger.info('开始强制系统同步...')

      const [tokenCleanup, deviceStatusUpdate, heartbeatSync, migrationCleanup] = await Promise.all([
        tokenManager.cleanupExpiredTokens(),
        deviceManager.forceUpdateOfflineStatus(),
        heartbeatManager.forceSyncDeviceStatus(),
        migrationCoordinator.cleanupExpiredMigrations()
      ])

      const results = {
        tokenCleanup,
        deviceStatusUpdate,
        heartbeatSync,
        migrationCleanup
      }

       logger.info(results, '强制系统同步完成')

      return {
        success: true,
        results
      }

    } catch (error) {
       logger.error({ error: error instanceof Error ? error.message : String(error) }, '强制系统同步失败')
      return {
        success: false,
        results: {
          tokenCleanup: 0,
          deviceStatusUpdate: 0,
          heartbeatSync: {},
          migrationCleanup: 0
        }
      }
    }
  }

  /**
   * 生成迁移ID
   */
  private generateMigrationId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `migration_${timestamp}_${random}`
  }

  /**
   * 获取协调器统计信息
   */
  getOrchestratorStats(): {
    isInitialized: boolean
    uptime: number
    componentStatus: {
      tokenManager: string
      deviceManager: string
      heartbeatManager: string
      migrationCoordinator: string
    }
  } {
    return {
      isInitialized: this.isInitialized,
      uptime: Date.now() - this.startTime,
      componentStatus: {
        tokenManager: 'ACTIVE',
        deviceManager: 'ACTIVE',
        heartbeatManager: heartbeatManager.getManagerStatus().isRunning ? 'ACTIVE' : 'INACTIVE',
        migrationCoordinator: 'ACTIVE'
      }
    }
  }
}

// 创建并导出灵魂协调器单例
export const spiritOrchestrator = new SpiritOrchestrator()

// 记录启动时间
// Use internal startTime instead of external assignment
