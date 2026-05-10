import { createServiceLogger } from '../lib/logger'
import { eq, and, lt, desc } from 'drizzle-orm'
import { devices } from '@shared/schema'
import { getDatabase } from '../db'
import { DistributedLockManager } from '../lib/distributed-lock'

const logger = createServiceLogger('DeviceManager')

export interface DeviceInfo {
  id: string
  name: string
  type: 'PC' | 'MOBILE' | 'TABLET' | 'AR_GLASSES' | 'TV' | 'OTHER'
  isActive: boolean
  lastSeen: number
  capabilities: {
    hasCamera: boolean
    hasMicrophone: boolean
    hasSpeaker: boolean
    hasGPS: boolean
    supportsAR: boolean
    supportsVR: boolean
  }
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  metadata: {
    osVersion?: string
    appVersion?: string
    userAgent?: string
    screenSize?: { width: number; height: number }
    networkType?: string
    batteryLevel?: number
  }
  status: 'ONLINE' | 'OFFLINE' | 'SUSPENDED' | 'ERROR'
}

type DeviceType = DeviceInfo['type']
type DeviceStatus = DeviceInfo['status']

interface DeviceUpdateData {
  lastSeen?: Date
  deviceName?: string
  deviceType?: string
  status?: string
  capabilities?: string[]
}

export interface DeviceHeartbeat {
  deviceId: string
  timestamp: number
  status: 'HEALTHY' | 'WARNING' | 'ERROR'
  metrics: {
    cpuUsage?: number
    memoryUsage?: number
    batteryLevel?: number
    networkLatency?: number
    temperature?: number
  }
  events?: Array<{
    type: 'INFO' | 'WARNING' | 'ERROR'
    message: string
    timestamp: number
  }>
}

/**
 * 设备管理器
 * 负责设备注册、状态监控、能力管理
 */
export class DeviceManager {
  private readonly DEVICE_TIMEOUT = 30000 // 30秒超时
  private readonly HEARTBEAT_CLEANUP_INTERVAL = 60000 // 1分钟清理间隔
  private activeHeartbeats = new Map<string, DeviceHeartbeat>()

  constructor() {
    // 启动心跳清理定时器
    setInterval(() => {
      this.cleanupOfflineDevices()
    }, this.HEARTBEAT_CLEANUP_INTERVAL)
  }

  /**
   * 注册设备
   */
  async registerDevice(deviceInfo: Omit<DeviceInfo, 'id' | 'lastSeen' | 'status'>): Promise<{
    success: boolean
    deviceId?: string
    message?: string
  }> {
    const deviceId = this.generateDeviceId()
    const lockKey = `device_register_${deviceId}`

    return await DistributedLockManager.withLock(lockKey, 'DeviceManager', async () => {
      try {
        const now = new Date()
        const db = getDatabase()
        if (!db) {
          throw new Error('数据库未初始化')
        }

        await db.insert(devices).values({
          id: deviceId,
          userId: 'system',
          deviceName: deviceInfo.name,
          deviceType: deviceInfo.type,
          status: 'ONLINE',
          lastSeen: now,
          capabilities: Object.entries(deviceInfo.capabilities)
            .filter(([_, v]) => v)
            .map(([k]) => k.toUpperCase())
        } as any)

        logger.info('设备注册成功', {
          deviceId,
          name: deviceInfo.name,
          type: deviceInfo.type
        })

        return {
          success: true,
          deviceId,
          message: '设备注册成功'
        }

      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error('设备注册失败', { 
          deviceName: deviceInfo.name,
          error: errorMsg 
        })
        
        return {
          success: false,
          message: '设备注册失败: ' + errorMsg
        }
      }
    }, {
      ttl: 10
    })
  }

  /**
   * 更新设备信息
   */
  async updateDevice(deviceId: string, updates: Partial<DeviceInfo>): Promise<{
    success: boolean
    message?: string
  }> {
    const lockKey = `device_update_${deviceId}`

    return await DistributedLockManager.withLock(lockKey, 'DeviceManager', async () => {
      try {
        const updateData: DeviceUpdateData = {}

        if (updates.name) updateData.deviceName = updates.name
        if (updates.type) updateData.deviceType = updates.type
        if (updates.isActive !== undefined) updateData.status = updates.isActive ? 'ONLINE' : 'OFFLINE'
        if (updates.capabilities) updateData.capabilities = Object.entries(updates.capabilities)
          .filter(([_, v]) => v)
          .map(([k]) => k.toUpperCase())
        if (updates.status) updateData.status = updates.status
        updateData.lastSeen = new Date()

        const db = getDatabase()
        if (!db) {
          throw new Error('数据库未初始化')
        }
        const result = await db.update(devices)
          .set(updateData)
          .where(eq(devices.id, deviceId))
          .returning()

        if (result.length === 0) {
          return {
            success: false,
            message: '设备不存在'
          }
        }

        logger.debug('设备信息更新成功', { deviceId, updates })
        
        return {
          success: true,
          message: '设备信息更新成功'
        }

      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error('设备信息更新失败', { deviceId, error: errorMsg })
        
        return {
          success: false,
          message: '设备信息更新失败: ' + errorMsg
        }
      }
    }, {
      ttl: 10
    })
  }

  /**
   * 处理设备心跳
   */
  async handleHeartbeat(heartbeat: DeviceHeartbeat): Promise<{
    success: boolean
    message?: string
    deviceStatus?: string
  }> {
    try {
      const db = getDatabase()
      if (!db) {
        throw new Error('数据库未初始化')
      }

      const device = await db.select()
        .from(devices)
        .where(eq(devices.id, heartbeat.deviceId))
        .limit(1)

      if (device.length === 0) {
        return {
          success: false,
          message: '设备不存在，请先注册'
        }
      }

      this.activeHeartbeats.set(heartbeat.deviceId, heartbeat)

      const now = new Date()
      let newStatus = device[0].status

      if (heartbeat.status === 'ERROR') {
        newStatus = 'ERROR'
      } else if (heartbeat.status === 'WARNING') {
        newStatus = 'SUSPENDED'
      } else if (device[0].status === 'OFFLINE' || device[0].status === 'ERROR') {
        newStatus = 'ONLINE'
      }

      await db.update(devices)
        .set({
          status: newStatus,
          lastSeen: now
        })
        .where(eq(devices.id, heartbeat.deviceId))

      logger.debug('设备心跳处理成功', {
        deviceId: heartbeat.deviceId,
        status: heartbeat.status,
        newStatus
      })

      return {
        success: true,
        message: '心跳处理成功',
        deviceStatus: newStatus
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('设备心跳处理失败', { 
        deviceId: heartbeat.deviceId,
        error: errorMsg 
      })
      
      return {
        success: false,
        message: '心跳处理失败: ' + errorMsg
      }
    }
  }

  /**
   * 获取设备信息
   */
  async getDevice(deviceId: string): Promise<DeviceInfo | null> {
    try {
      const deviceList = await getDatabase().select()
        .from(devices)
        .where(eq(devices.id, deviceId))
        .limit(1)

      if (deviceList.length === 0) {
        return null
      }

      const device = deviceList[0]
      
      // 检查设备是否在线
      const isOnline = this.isDeviceOnline(device.lastSeen)
      
      return {
        id: device.id,
        name: device.deviceName,
        type: device.deviceType as DeviceType,
        isActive: device.status === 'ONLINE',
        lastSeen: device.lastSeen?.getTime() || 0,
        capabilities: this.parseCapabilities(device.capabilities),
        metadata: {},
        status: isOnline ? device.status as DeviceStatus : 'OFFLINE'
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('获取设备信息失败', { deviceId, error: errorMsg })
      return null
    }
  }

  /**
   * 获取所有设备列表
   */
  async getAllDevices(filter?: {
    status?: string
    type?: string
    isActive?: boolean
  }): Promise<DeviceInfo[]> {
    try {
      let query = getDatabase().select().from(devices)

      if (filter) {
        if (filter.status) {
          query = query.where(eq(devices.status, filter.status))
        }
        if (filter.type) {
          query = query.where(eq(devices.deviceType, filter.type))
        }
        if (filter.isActive !== undefined) {
          query = query.where(eq(devices.status, filter.isActive ? 'ONLINE' : 'OFFLINE'))
        }
      }

      const deviceList = await query.orderBy(desc(devices.lastSeen))

      return deviceList.map(device => {
        const isOnline = this.isDeviceOnline(device.lastSeen)
        
        return {
          id: device.id,
          name: device.deviceName,
          type: device.deviceType as DeviceType,
          isActive: device.status === 'ONLINE',
          lastSeen: device.lastSeen?.getTime() || 0,
          capabilities: this.parseCapabilities(device.capabilities),
          metadata: {},
          status: isOnline ? device.status as DeviceStatus : 'OFFLINE'
        }
      })

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('获取设备列表失败', { error: errorMsg })
      return []
    }
  }

  /**
   * 获取在线设备列表
   */
  async getOnlineDevices(): Promise<DeviceInfo[]> {
    return this.getAllDevices({ status: 'ONLINE' })
  }

  /**
   * 注销设备
   */
  async unregisterDevice(deviceId: string): Promise<{
    success: boolean
    message?: string
  }> {
    const lockKey = `device_unregister_${deviceId}`

    return await DistributedLockManager.withLock(lockKey, 'DeviceManager', async () => {
      try {
        // 删除设备记录
        const result = await getDatabase().delete(devices)
          .where(eq(devices.id, deviceId))
          .returning()

        if (result.length === 0) {
          return {
            success: false,
            message: '设备不存在'
          }
        }

        // 清理心跳记录
        this.activeHeartbeats.delete(deviceId)

        logger.info('设备注销成功', { deviceId })

        return {
          success: true,
          message: '设备注销成功'
        }

      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error('设备注销失败', { deviceId, error: errorMsg })
        
        return {
          success: false,
          message: '设备注销失败: ' + errorMsg
        }
      }
    }, {
      ttl: 10
    })
  }

  /**
   * 获取设备统计信息
   */
  async getDeviceStats(): Promise<{
    total: number
    online: number
    offline: number
    suspended: number
    error: number
    byType: Record<string, number>
  }> {
    try {
      const allDevices = await getDatabase().select().from(devices)
      
      const stats = {
        total: allDevices.length,
        online: 0,
        offline: 0,
        suspended: 0,
        error: 0,
        byType: {} as Record<string, number>
      }

      allDevices.forEach(device => {
        const isOnline = this.isDeviceOnline(device.lastSeen)
        const status = isOnline ? device.status : 'OFFLINE'

        switch (status) {
          case 'ONLINE':
            stats.online++
            break
          case 'OFFLINE':
            stats.offline++
            break
          case 'SUSPENDED':
            stats.suspended++
            break
          case 'ERROR':
            stats.error++
            break
        }

        // 按类型统计
        const type = device.deviceType
        stats.byType[type] = (stats.byType[type] || 0) + 1
      })

      return stats

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('获取设备统计失败', { error: errorMsg })
      return {
        total: 0,
        online: 0,
        offline: 0,
        suspended: 0,
        error: 0,
        byType: {}
      }
    }
  }

  /**
   * 获取设备心跳信息
   */
  getDeviceHeartbeat(deviceId: string): DeviceHeartbeat | null {
    return this.activeHeartbeats.get(deviceId) || null
  }

  /**
   * 检查设备是否在线
   */
  private isDeviceOnline(lastSeen?: Date | null): boolean {
    if (!lastSeen) {
      return false
    }
    return Date.now() - lastSeen.getTime() < this.DEVICE_TIMEOUT
  }

  private parseCapabilities(caps?: string[] | null): DeviceInfo['capabilities'] {
    const result: DeviceInfo['capabilities'] = {
      hasCamera: false,
      hasMicrophone: false,
      hasSpeaker: false,
      hasGPS: false,
      supportsAR: false,
      supportsVR: false
    }
    if (!caps) return result
    caps.forEach(cap => {
      const key = cap.toUpperCase()
      if (key === 'HAS_CAMERA') result.hasCamera = true
      if (key === 'HAS_MICROPHONE') result.hasMicrophone = true
      if (key === 'HAS_SPEAKER') result.hasSpeaker = true
      if (key === 'HAS_GPS') result.hasGPS = true
      if (key === 'SUPPORTS_AR') result.supportsAR = true
      if (key === 'SUPPORTS_VR') result.supportsVR = true
    })
    return result
  }

  /**
   * 清理离线设备
   */
  private async cleanupOfflineDevices(): Promise<number> {
    try {
      const offlineThreshold = new Date(Date.now() - this.DEVICE_TIMEOUT)
      
      const offlineDevices = await getDatabase().select()
        .from(devices)
        .where(and(
          lt(devices.lastSeen, offlineThreshold),
          eq(devices.status, 'ONLINE')
        ))

      let cleanedCount = 0

      for (const device of offlineDevices) {
        await getDatabase().update(devices)
          .set({
            status: 'OFFLINE'
          })
          .where(eq(devices.id, device.id))

        // 清理心跳记录
        this.activeHeartbeats.delete(device.id)
        cleanedCount++
      }

      if (cleanedCount > 0) {
        logger.info('清理离线设备', { count: cleanedCount })
      }

      return cleanedCount

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('清理离线设备失败', { error: errorMsg })
      return 0
    }
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `device_${timestamp}_${random}`
  }

  /**
   * 强制更新所有离线设备状态
   */
  async forceUpdateOfflineStatus(): Promise<number> {
    const offlineThreshold = new Date(Date.now() - this.DEVICE_TIMEOUT)
    
    try {
      const result = await getDatabase().update(devices)
        .set({
          status: 'OFFLINE'
        })
        .where(and(
          lt(devices.lastSeen, offlineThreshold),
          eq(devices.status, 'ONLINE')
        ))
        .returning()

      logger.info('强制更新离线设备状态', { count: result.length })
      return result.length

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('强制更新离线设备状态失败', { error: errorMsg })
      return 0
    }
  }
}

// 导出单例实例
export const deviceManager = new DeviceManager()
