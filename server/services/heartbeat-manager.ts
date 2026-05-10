import { createServiceLogger } from '../lib/logger'
import { timerManager } from '../lib/timer-manager'
import { tokenManager } from './token-manager'
import { deviceManager } from './device-manager'
import { migrationCoordinator } from './migration-coordinator'

const logger = createServiceLogger('HeartbeatManager')

export interface HeartbeatConfig {
  interval: number // 心跳间隔（毫秒）
  timeout: number // 心跳超时（毫秒）
  maxMissedBeats: number // 最大允许 missed beats
  retryInterval: number // 重试间隔（毫秒）
}

export interface HeartbeatStatus {
  deviceId: string
  isAlive: boolean
  lastBeat: number
  missedBeats: number
  nextBeatTime: number
  latency: number
  status: 'HEALTHY' | 'WARNING' | 'ERROR' | 'TIMEOUT'
}

/**
 * 心跳管理器
 * 负责管理所有设备的心跳检测和状态监控
 */
export class HeartbeatManager {
  private heartbeatTimers = new Map<string, NodeJS.Timeout>()
  private heartbeatStatus = new Map<string, HeartbeatStatus>()
  private config: HeartbeatConfig
  private isRunning = false

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = {
      interval: 5000, // 5秒间隔
      timeout: 15000, // 15秒超时
      maxMissedBeats: 3, // 最多miss 3次心跳
      retryInterval: 10000, // 10秒重试间隔
      ...config
    }
  }

  /**
   * 启动心跳管理器
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('心跳管理器已在运行')
      return
    }

    this.isRunning = true
    logger.info('心跳管理器已启动', this.config)

    // 启动全局心跳监控
    this.startGlobalMonitoring()
  }

  /**
   * 停止心跳管理器
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // 清理所有设备的心跳定时器
    for (const [deviceId, timer] of this.heartbeatTimers) {
      clearInterval(timer)
      logger.debug('清理设备心跳定时器', { deviceId })
    }

    this.heartbeatTimers.clear()
    this.heartbeatStatus.clear()

    logger.info('心跳管理器已停止')
  }

  /**
   * 注册设备心跳
   */
  registerDeviceHeartbeat(deviceId: string): void {
    if (!this.isRunning) {
      logger.warn('心跳管理器未运行，无法注册设备心跳')
      return
    }

    // 如果设备已注册，先清理
    if (this.heartbeatTimers.has(deviceId)) {
      this.unregisterDeviceHeartbeat(deviceId)
    }

    // 创建心跳状态
    const status: HeartbeatStatus = {
      deviceId,
      isAlive: true,
      lastBeat: Date.now(),
      missedBeats: 0,
      nextBeatTime: Date.now() + this.config.interval,
      latency: 0,
      status: 'HEALTHY'
    }

    this.heartbeatStatus.set(deviceId, status)

    // 设置心跳定时器
    const timer = setInterval(() => {
      this.processDeviceHeartbeat(deviceId)
    }, this.config.interval)

    this.heartbeatTimers.set(deviceId, timer)

    logger.info('设备心跳已注册', { 
      deviceId, 
      interval: this.config.interval 
    })

    // 立即执行一次心跳
    this.processDeviceHeartbeat(deviceId)
  }

  /**
   * 注销设备心跳
   */
  unregisterDeviceHeartbeat(deviceId: string): void {
    const timer = this.heartbeatTimers.get(deviceId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(deviceId)
      logger.debug('设备心跳定时器已清理', { deviceId })
    }

    this.heartbeatStatus.delete(deviceId)
    logger.info('设备心跳已注销', { deviceId })
  }

  /**
   * 手动触发心跳
   */
  async triggerHeartbeat(deviceId: string): Promise<{
    success: boolean
    latency?: number
    status?: string
  }> {
    const startTime = Date.now()
    
    try {
      // 发送心跳到令牌管理器
      const result = await tokenManager.heartbeat(deviceId)
      const latency = Date.now() - startTime

      if (result.success) {
        this.updateHeartbeatStatus(deviceId, {
          isAlive: true,
          lastBeat: Date.now(),
          missedBeats: 0,
          latency,
          status: 'HEALTHY'
        })

        logger.debug('心跳成功', { deviceId, latency })
        
        return {
          success: true,
          latency,
          status: result.tokenInfo?.status
        }
      } else {
        this.updateHeartbeatStatus(deviceId, {
          isAlive: false,
          missedBeats: (this.heartbeatStatus.get(deviceId)?.missedBeats || 0) + 1,
          status: 'ERROR'
        })

        logger.warn('心跳失败', { deviceId, error: result.message })
        
        return {
          success: false,
          status: 'ERROR'
        }
      }

    } catch (error) {
      this.updateHeartbeatStatus(deviceId, {
        isAlive: false,
        missedBeats: (this.heartbeatStatus.get(deviceId)?.missedBeats || 0) + 1,
        status: 'ERROR'
      })

      logger.error('心跳异常', { deviceId, error: error.message })
      
      return {
        success: false,
        status: 'ERROR'
      }
    }
  }

  /**
   * 获取配置
   */
  getConfig(): HeartbeatConfig {
    return { ...this.config }
  }

  /**
   * 获取设备心跳状态
   */
  getHeartbeatStatus(deviceId: string): HeartbeatStatus | null {
    return this.heartbeatStatus.get(deviceId) || null
  }

  /**
   * 获取所有设备心跳状态
   */
  getAllHeartbeatStatus(): Map<string, HeartbeatStatus> {
    return new Map(this.heartbeatStatus)
  }

  /**
   * 获取在线设备列表
   */
  getOnlineDevices(): string[] {
    const onlineDevices: string[] = []
    
    for (const [deviceId, status] of this.heartbeatStatus) {
      if (status.isAlive && status.status !== 'TIMEOUT') {
        onlineDevices.push(deviceId)
      }
    }
    
    return onlineDevices
  }

  /**
   * 获取设备健康统计
   */
  getHealthStats(): {
    total: number
    healthy: number
    warning: number
    error: number
    timeout: number
    averageLatency: number
  } {
    const stats = {
      total: this.heartbeatStatus.size,
      healthy: 0,
      warning: 0,
      error: 0,
      timeout: 0,
      averageLatency: 0
    }

    let totalLatency = 0
    let latencyCount = 0

    for (const status of this.heartbeatStatus.values()) {
      switch (status.status) {
        case 'HEALTHY':
          stats.healthy++
          break
        case 'WARNING':
          stats.warning++
          break
        case 'ERROR':
          stats.error++
          break
        case 'TIMEOUT':
          stats.timeout++
          break
      }

      if (status.latency > 0) {
        totalLatency += status.latency
        latencyCount++
      }
    }

    stats.averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0

    return stats
  }

  /**
   * 更新心跳配置
   */
  updateConfig(newConfig: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('心跳配置已更新', this.config)
  }

  /**
   * 处理设备心跳
   */
  private async processDeviceHeartbeat(deviceId: string): Promise<void> {
    const status = this.heartbeatStatus.get(deviceId)
    if (!status) {
      return
    }

    // 检查是否超时
    const timeSinceLastBeat = Date.now() - status.lastBeat
    if (timeSinceLastBeat > this.config.timeout) {
      this.updateHeartbeatStatus(deviceId, {
        isAlive: false,
        status: 'TIMEOUT'
      })

      logger.warn('设备心跳超时', { 
        deviceId, 
        timeSinceLastBeat,
        timeout: this.config.timeout 
      })

      // 触发超时处理
      this.handleHeartbeatTimeout(deviceId)
      return
    }

    // 检查连续失败次数
    if (status.missedBeats >= this.config.maxMissedBeats) {
      this.updateHeartbeatStatus(deviceId, {
        isAlive: false,
        status: 'ERROR'
      })

      logger.warn('设备心跳连续失败', { 
        deviceId, 
        missedBeats: status.missedBeats,
        maxMissedBeats: this.config.maxMissedBeats
      })

      // 触发失败处理
      this.handleHeartbeatFailure(deviceId)
      return
    }

    // 发送心跳
    await this.triggerHeartbeat(deviceId)
  }

  /**
   * 更新心跳状态
   */
  private updateHeartbeatStatus(deviceId: string, updates: Partial<HeartbeatStatus>): void {
    const currentStatus = this.heartbeatStatus.get(deviceId)
    if (!currentStatus) {
      return
    }

    const updatedStatus = { ...currentStatus, ...updates }
    
    // 更新下次心跳时间
    if (updates.isAlive !== false) {
      updatedStatus.nextBeatTime = Date.now() + this.config.interval
    }

    this.heartbeatStatus.set(deviceId, updatedStatus)
  }

  /**
   * 处理心跳超时
   */
  private async handleHeartbeatTimeout(deviceId: string): Promise<void> {
    try {
      logger.info('处理心跳超时', { deviceId })

      // 释放设备的令牌（如果持有）
      const currentToken = await tokenManager.getCurrentToken()
      if (currentToken && currentToken.activeDeviceId === deviceId) {
        await tokenManager.releaseToken(deviceId, 'HEARTBEAT_TIMEOUT')
        logger.info('因心跳超时释放令牌', { deviceId })
      }

      // 更新设备状态为离线
      await deviceManager.updateDevice(deviceId, { status: 'OFFLINE' })

    } catch (error) {
      logger.error('处理心跳超时失败', { deviceId, error: error.message })
    }
  }

  /**
   * 处理心跳失败
   */
  private async handleHeartbeatFailure(deviceId: string): Promise<void> {
    try {
      logger.info('处理心跳失败', { deviceId })

      // 可以在这里添加失败处理逻辑，如：
      // - 尝试重新连接
      // - 通知管理员
      // - 记录故障事件

    } catch (error) {
      logger.error('处理心跳失败失败', { deviceId, error: error.message })
    }
  }

  /**
   * 启动全局监控
   */
  private startGlobalMonitoring(): void {
    // 定期检查心跳状态并清理
    timerManager.setInterval('heartbeat-global-monitor', async () => {
      try {
        await this.performGlobalHealthCheck()
        await this.cleanupStaleHeartbeats()
      } catch (error) {
        logger.error('全局心跳监控失败', { error: error.message })
      }
    }, 30000) // 30秒执行一次

    logger.debug('全局心跳监控已启动')
  }

  /**
   * 执行全局健康检查
   */
  private async performGlobalHealthCheck(): Promise<void> {
    const healthStats = this.getHealthStats()
    
    logger.debug('全局心跳健康检查', healthStats)

    // 如果错误率过高，发出警告
    const totalDevices = healthStats.total
    const unhealthyDevices = healthStats.error + healthStats.timeout + healthStats.warning
    
    if (totalDevices > 0 && unhealthyDevices / totalDevices > 0.3) {
      logger.warn('设备健康状态异常', {
        total: totalDevices,
        unhealthy: unhealthyDevices,
        ratio: (unhealthyDevices / totalDevices * 100).toFixed(1) + '%'
      })
    }

    // 更新设备管理器中的设备状态
    for (const [deviceId, status] of this.heartbeatStatus) {
      if (!status.isAlive) {
        await deviceManager.updateDevice(deviceId, { 
          status: status.status === 'TIMEOUT' ? 'OFFLINE' : 'SUSPENDED' 
        })
      }
    }
  }

  /**
   * 清理过期心跳
   */
  private async cleanupStaleHeartbeats(): Promise<void> {
    const staleThreshold = Date.now() - this.config.timeout * 2
    let cleanedCount = 0

    for (const [deviceId, status] of this.heartbeatStatus) {
      if (status.lastBeat < staleThreshold) {
        this.unregisterDeviceHeartbeat(deviceId)
        cleanedCount++
        logger.debug('清理过期心跳', { deviceId })
      }
    }

    if (cleanedCount > 0) {
      logger.info('清理过期心跳完成', { count: cleanedCount })
    }
  }

  /**
   * 强制同步所有设备状态
   */
  async forceSyncDeviceStatus(): Promise<{
    synced: number
    failed: number
    errors: string[]
  }> {
    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const [deviceId, status] of this.heartbeatStatus) {
      try {
        await this.triggerHeartbeat(deviceId)
        results.synced++
      } catch (error) {
        results.failed++
        results.errors.push(`${deviceId}: ${error.message}`)
      }
    }

    logger.info('强制同步设备状态完成', results)
    return results
  }

  /**
   * 获取心跳管理器状态
   */
  getManagerStatus(): {
    isRunning: boolean
    config: HeartbeatConfig
    registeredDevices: number
    healthStats: unknown
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      registeredDevices: this.heartbeatTimers.size,
      healthStats: this.getHealthStats()
    }
  }
}

// 创建并导出心跳管理器单例
export const heartbeatManager = new HeartbeatManager({
  interval: 5000, // 5秒
  timeout: 15000, // 15秒
  maxMissedBeats: 3
})