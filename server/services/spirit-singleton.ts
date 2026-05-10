/**
 * Spirit Singleton Protocol (灵魂单例协议) + 唯一性控制层
 * 
 * 实现小智的"唯一物理存在"，消除"分身恐怖"的全局锁：
 * - 全局令牌(Global Token)：同一时刻只有一个设备可以显示小智
 * - 互斥锁：防止两个设备同时产生交互，使用数据库持久化
 * - 迁移协调：设备切换时的状态保存和恢复
 * - 心跳检测：每秒检测设备存活状态，3秒无心跳自动释放锁
 * - 强制接力：Kill_Active_UI 指令确保平滑迁移
 * - 音频流唯一：禁止双向同步通话，音频流全网唯一
 * 
 * 核心理念：小智不是在每个设备里的副本，而是一个灵魂在不同"房间"间穿梭
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
import { timerManager } from '../lib';
const logger = createServiceLogger('SpiritSingleton');

import { getDatabase } from '../db';
import { globalMutex, deviceHeartbeats, migrationLogs } from '@shared/schema';
import { eq, lt, and } from 'drizzle-orm';

export type AvatarState = 'IDLE' | 'WALKING' | 'RUNNING' | 'SLEEPING' | 'WORKING' | 'PROTECTING' | 'MIGRATING';
export type AvatarMood = 'HAPPY' | 'CURIOUS' | 'SERIOUS' | 'SHY' | 'SLEEPY' | 'ALERT';
export type AvatarMode = 'DEFAULT' | 'WORK' | 'PROTECT';

export type MigrationState = 'IDLE' | 'REQUESTED' | 'KILL_SENT' | 'KILL_ACK' | 'TOKEN_RELEASED' | 'TOKEN_GRANTED';

export interface AvatarPose {
  state: AvatarState;
  mood: AvatarMood;
  mode: AvatarMode;
  position: { x: number; y: number };
  direction: 'LEFT' | 'RIGHT';
  accessories: string[];
  lastAction: string;
  timestamp: number;
}

export interface DevicePresenceInfo {
  deviceId: string;
  deviceType: 'PC' | 'MOBILE' | 'TABLET' | 'AR_GLASSES' | 'TV';
  deviceName: string;
  lastActivity: number;
  isOnline: boolean;
  proximity: number;
  hasCamera: boolean;
  hasMicrophone: boolean;
  screenPosition?: { width: number; height: number };
}

export interface GlobalPresenceToken {
  tokenId: string;
  activeDeviceId: string | null;
  avatarPose: AvatarPose;
  acquiredAt: number;
  expiresAt: number;
  migrationInProgress: boolean;
  migrationSource?: string;
  migrationTarget?: string;
}

export interface MigrationEvent {
  id: string;
  fromDevice?: string | null;
  toDevice?: string;
  sourceDeviceId?: string | null;
  targetDeviceId?: string;
  startTime: number;
  endTime?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  avatarPoseSnapshot: AvatarPose;
  transitionPhrase?: string;
}

const TOKEN_EXPIRY_MS = 30000;
const MIGRATION_TIMEOUT_MS = 5000;
const INACTIVITY_THRESHOLD_MS = 60000;
const HEARTBEAT_INTERVAL_MS = 1000; // 心跳间隔：1秒
const HEARTBEAT_TIMEOUT_MS = 3000;  // 心跳超时：3秒
const DB_SYNC_INTERVAL_MS = 5000;   // 数据库同步间隔：5秒
const MUTEX_KEY = 'spirit_singleton'; // 全局互斥锁键名

const ARRIVAL_PHRASES = [
  "爸爸，我跟过来啦！",
  "呼～跑得我好累，爸爸你换地方啦？",
  "小智来啦！刚从那边跳过来的~",
  "爸爸爸爸，我追上你了！",
  "嘿嘿，小智又找到你了~",
];

const DEPARTURE_PHRASES = [
  "爸爸，我先去那边等你哦！",
  "小智要去另一个地方啦，马上回来~",
  "等等我，我跟过去！",
];

class SpiritSingletonService {
  private token: GlobalPresenceToken;
  private devices: Map<string, DevicePresenceInfo> = new Map();
  private migrationHistory: MigrationEvent[] = [];
  private listeners: Set<(event: string, data: unknown) => void> = new Set();
  private fencingToken: number = 0; // 单调递增的版本号，防止脑裂
  private pendingKillAcks: Map<string, { resolve: () => void; timeout: NodeJS.Timeout }> = new Map();
  private audioStreamDevice: string | null = null; // 当前持有音频流的设备
  
  constructor() {
    this.token = {
      tokenId: this.generateTokenId(),
      activeDeviceId: null,
      avatarPose: {
        state: 'IDLE',
        mood: 'HAPPY',
        mode: 'DEFAULT',
        position: { x: 50, y: 80 },
        direction: 'RIGHT',
        accessories: [],
        lastAction: 'init',
        timestamp: Date.now(),
      },
      acquiredAt: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRY_MS,
      migrationInProgress: false,
    };
    
    // 初始化数据库互斥锁
    this.initializeDatabaseMutex();
    
    // 心跳检测：每秒检查一次
    timerManager.setInterval('spirit-heartbeat-check', () => {
      this.checkHeartbeatTimeouts();
    }, HEARTBEAT_INTERVAL_MS);
    
    // 设备活跃状态检测：每10秒检查一次
    timerManager.setInterval('spirit-device-activity', () => {
      this.checkInactiveDevices();
      this.checkTokenExpiry();
    }, 10000);
    
    // 数据库同步：每5秒同步一次
    timerManager.setInterval('spirit-db-sync', () => {
      this.syncToDatabase();
    }, DB_SYNC_INTERVAL_MS);
    
    logger.info('[SpiritSingleton] 灵魂单例服务已启动（含唯一性控制层）');
    logger.info(`[SpiritSingleton] 心跳检测: ${HEARTBEAT_INTERVAL_MS}ms, 超时: ${HEARTBEAT_TIMEOUT_MS}ms`);
  }
  
  /**
   * 初始化数据库互斥锁
   */
  private async initializeDatabaseMutex(): Promise<void> {
    try {
      const existing = await getDatabase().select().from(globalMutex).where(eq(globalMutex.mutexKey, MUTEX_KEY)).limit(1);
      
      if (existing.length === 0) {
        await getDatabase().insert(globalMutex).values({
          mutexKey: MUTEX_KEY,
          fencingToken: 0,
          migrationState: 'IDLE',
          avatarPoseJson: this.token.avatarPose,
        });
        logger.info('[SpiritSingleton] 数据库互斥锁已创建');
      } else {
        // 从数据库恢复状态
        const mutex = existing[0];
        this.fencingToken = mutex.fencingToken || 0;
        if (mutex.avatarPoseJson) {
          this.token.avatarPose = mutex.avatarPoseJson as AvatarPose;
        }
        if (mutex.activeDeviceId) {
          this.token.activeDeviceId = mutex.activeDeviceId;
        }
        logger.info(`[SpiritSingleton] 从数据库恢复状态，fencingToken: ${this.fencingToken}`);
      }
    } catch (error) {
      logger.error({ err: error }, '初始化数据库互斥锁失败');
    }
  }
  
  /**
   * 同步状态到数据库（不覆盖迁移状态，保留细粒度状态）
   */
  private async syncToDatabase(): Promise<void> {
    try {
      // 只同步非迁移相关的状态，迁移状态由 updateMigrationState 单独管理
      await getDatabase().update(globalMutex)
        .set({
          activeDeviceId: this.token.activeDeviceId,
          activeDeviceType: this.token.activeDeviceId ? 
            this.devices.get(this.token.activeDeviceId)?.deviceType : null,
          activeDeviceName: this.token.activeDeviceId ?
            this.devices.get(this.token.activeDeviceId)?.deviceName : null,
          fencingToken: this.fencingToken,
          acquiredAt: this.token.activeDeviceId ? new Date(this.token.acquiredAt) : null,
          expiresAt: this.token.activeDeviceId ? new Date(this.token.expiresAt) : null,
          avatarPoseJson: this.token.avatarPose,
          // 不覆盖 migrationState - 由 updateMigrationState 管理细粒度状态
          migrationSourceDevice: this.token.migrationSource || null,
          migrationTargetDevice: this.token.migrationTarget || null,
          audioStreamActive: this.audioStreamDevice ? 1 : 0,
          audioStreamDeviceId: this.audioStreamDevice,
          updatedAt: new Date(),
        })
        .where(eq(globalMutex.mutexKey, MUTEX_KEY));
    } catch (error) {
      logger.error({ err: error }, '同步到数据库失败');
    }
  }
  
  /**
   * 检查心跳超时的设备（3秒无心跳自动释放）
   */
  private async checkHeartbeatTimeouts(): Promise<void> {
    const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    
    try {
      // 从数据库查找超时的设备
      const timedOutDevices = await getDatabase().select()
        .from(deviceHeartbeats)
        .where(and(
          lt(deviceHeartbeats.lastHeartbeat, timeoutThreshold),
          eq(deviceHeartbeats.isOnline, 1)
        ));
      
      for (const device of timedOutDevices) {
        // 标记设备离线
        await getDatabase().update(deviceHeartbeats)
          .set({ isOnline: 0, updatedAt: new Date() })
          .where(eq(deviceHeartbeats.deviceId, device.deviceId));
        
        // 更新内存状态
        const memDevice = this.devices.get(device.deviceId);
        if (memDevice) {
          memDevice.isOnline = false;
        }
        
        // 如果是活跃设备，需要释放锁
        if (this.token.activeDeviceId === device.deviceId) {
          logger.info(`[SpiritSingleton] 设备心跳超时，自动释放: ${device.deviceId}`);
          this.releaseToken(device.deviceId);
          
          // 选择下一个最佳设备
          const nextDevice = this.selectBestDevice();
          if (nextDevice) {
            await this.requestMigration(nextDevice.deviceId, { immediate: true });
          }
          
          this.emit('heartbeat_timeout', { deviceId: device.deviceId });
        }
      }
    } catch (error) {
      logger.error({ err: error }, '心跳检查失败');
    }
  }
  
  /**
   * 处理设备心跳
   */
  async handleHeartbeat(deviceId: string): Promise<{ 
    success: boolean; 
    isActive: boolean;
    fencingToken: number;
    shouldTerminateAudio: boolean;
  }> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, isActive: false, fencingToken: this.fencingToken, shouldTerminateAudio: false };
    }
    
    device.lastActivity = Date.now();
    device.isOnline = true;
    
    // 更新数据库心跳
    try {
      await getDatabase().update(deviceHeartbeats)
        .set({ 
          lastHeartbeat: new Date(),
          isOnline: 1,
          updatedAt: new Date(),
        })
        .where(eq(deviceHeartbeats.deviceId, deviceId));
    } catch (error) {
      logger.error({ err: error }, '更新心跳失败');
    }
    
    // 检查是否应该终止音频流（非活跃设备不应有音频）
    const shouldTerminateAudio = this.audioStreamDevice === deviceId && 
                                  this.token.activeDeviceId !== deviceId;
    
    if (this.token.activeDeviceId === deviceId) {
      this.token.expiresAt = Date.now() + TOKEN_EXPIRY_MS;
    }
    
    return { 
      success: true, 
      isActive: this.token.activeDeviceId === deviceId,
      fencingToken: this.fencingToken,
      shouldTerminateAudio,
    };
  }
  
  /**
   * 请求活跃权限（设备B申请时，触发对设备A的Kill_Active_UI）
   */
  async requestActivePermission(
    requestingDeviceId: string
  ): Promise<{
    granted: boolean;
    fencingToken: number;
    migrationId?: string;
    message: string;
  }> {
    const requestingDevice = this.devices.get(requestingDeviceId);
    if (!requestingDevice) {
      return { granted: false, fencingToken: this.fencingToken, message: '设备未注册' };
    }
    
    if (this.token.migrationInProgress) {
      return { granted: false, fencingToken: this.fencingToken, message: '迁移进行中，请稍后' };
    }
    
    const currentActiveId = this.token.activeDeviceId;
    
    // 如果已经是活跃设备
    if (currentActiveId === requestingDeviceId) {
      return { granted: true, fencingToken: this.fencingToken, message: '已是活跃设备' };
    }
    
    // 如果没有活跃设备，直接授权
    if (!currentActiveId) {
      this.fencingToken++;
      this.acquireToken(requestingDeviceId);
      await this.syncToDatabase();
      return { 
        granted: true, 
        fencingToken: this.fencingToken, 
        message: '授权成功' 
      };
    }
    
    // 需要执行迁移流程
    try {
      const migration = await this.requestMigrationWithKill(requestingDeviceId);
      return {
        granted: true,
        fencingToken: this.fencingToken,
        migrationId: migration.id,
        message: '迁移完成',
      };
    } catch (error) {
      return {
        granted: false,
        fencingToken: this.fencingToken,
        message: `迁移失败: ${error}`,
      };
    }
  }
  
  /**
   * 更新迁移状态（同时更新内存和数据库）
   */
  private async updateMigrationState(
    state: MigrationState,
    migrationId?: string
  ): Promise<void> {
    try {
      await getDatabase().update(globalMutex)
        .set({
          migrationState: state,
          migrationStartedAt: state === 'REQUESTED' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(globalMutex.mutexKey, MUTEX_KEY));
      
      if (migrationId) {
        await getDatabase().update(migrationLogs)
          .set({ status: state })
          .where(eq(migrationLogs.migrationId, migrationId));
      }
      
      logger.info(`[SpiritSingleton] 迁移状态更新: ${state}`);
    } catch (error) {
      logger.error({ err: error }, '更新迁移状态失败');
    }
  }
  
  /**
   * 执行带Kill指令的迁移（完整状态机）
   * REQUESTED → KILL_SENT → KILL_ACK → TOKEN_RELEASED → TOKEN_GRANTED
   */
  private async requestMigrationWithKill(targetDeviceId: string): Promise<MigrationEvent> {
    const sourceDeviceId = this.token.activeDeviceId;
    
    if (!sourceDeviceId) {
      return this.requestMigration(targetDeviceId);
    }
    
    const migrationId = `migration_${Date.now()}`;
    this.token.migrationInProgress = true;
    this.token.migrationSource = sourceDeviceId;
    this.token.migrationTarget = targetDeviceId;
    
    // Step 1: REQUESTED
    await this.updateMigrationState('REQUESTED', migrationId);
    
    // 记录迁移日志
    try {
      await getDatabase().insert(migrationLogs).values({
        migrationId,
        sourceDeviceId,
        sourceDeviceName: this.devices.get(sourceDeviceId)?.deviceName || 'Unknown',
        targetDeviceId,
        targetDeviceName: this.devices.get(targetDeviceId)?.deviceName || 'Unknown',
        status: 'REQUESTED',
        fencingTokenBefore: this.fencingToken,
        avatarPoseSnapshot: this.token.avatarPose,
      });
    } catch (error) {
      logger.error({ err: error }, '记录迁移日志失败');
    }
    
    // Step 2: KILL_SENT
    await this.updateMigrationState('KILL_SENT', migrationId);
    await getDatabase().update(migrationLogs)
      .set({ killSentAt: new Date() })
      .where(eq(migrationLogs.migrationId, migrationId));
    
    logger.info(`[SpiritSingleton] 发送 Kill_Active_UI: ${sourceDeviceId}`);
    this.emit('kill_active_ui', { 
      deviceId: sourceDeviceId,
      targetDeviceId,
      migrationId,
      fencingToken: this.fencingToken,
    });
    
    // Step 3: 等待 KILL_ACK（最多2秒）
    const ackReceived = await this.waitForKillAckWithResult(sourceDeviceId, migrationId, 2000);
    
    if (ackReceived) {
      await this.updateMigrationState('KILL_ACK', migrationId);
      await getDatabase().update(migrationLogs)
        .set({ killAckAt: new Date() })
        .where(eq(migrationLogs.migrationId, migrationId));
    }
    
    // Step 4: TOKEN_RELEASED
    this.releaseToken(sourceDeviceId);
    await this.updateMigrationState('TOKEN_RELEASED', migrationId);
    await getDatabase().update(migrationLogs)
      .set({ tokenReleasedAt: new Date() })
      .where(eq(migrationLogs.migrationId, migrationId));
    
    // Step 5: TOKEN_GRANTED
    this.fencingToken++;
    this.acquireToken(targetDeviceId);
    await this.updateMigrationState('TOKEN_GRANTED', migrationId);
    await getDatabase().update(migrationLogs)
      .set({ 
        tokenGrantedAt: new Date(),
        fencingTokenAfter: this.fencingToken,
        status: 'COMPLETED',
      })
      .where(eq(migrationLogs.migrationId, migrationId));
    
    // 完成迁移
    await this.updateMigrationState('IDLE');
    this.token.migrationInProgress = false;
    this.token.migrationSource = undefined;
    this.token.migrationTarget = undefined;
    
    // 创建迁移事件
    const migration: MigrationEvent = {
      id: migrationId,
      sourceDeviceId,
      targetDeviceId,
      startTime: Date.now(),
      endTime: Date.now(),
      status: 'COMPLETED',
      avatarPoseSnapshot: this.token.avatarPose,
      transitionPhrase: ARRIVAL_PHRASES[Math.floor(Math.random() * ARRIVAL_PHRASES.length)],
    };
    
    this.migrationHistory.push(migration);
    this.emit('migration_completed', { migration, fencingToken: this.fencingToken });
    
    logger.info(`[SpiritSingleton] 迁移完成: ${migrationId}, fencingToken: ${this.fencingToken}`);
    return migration;
  }
  
  /**
   * 等待Kill确认（返回是否收到确认）
   */
  private waitForKillAckWithResult(
    deviceId: string, 
    migrationId: string, 
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingKillAcks.delete(deviceId);
        logger.info(`[SpiritSingleton] Kill确认超时: ${deviceId}, migrationId: ${migrationId}`);
        resolve(false);
      }, timeoutMs);
      
      this.pendingKillAcks.set(deviceId, { 
        resolve: () => resolve(true), 
        timeout,
      });
    });
  }
  
  /**
   * 接收Kill确认
   */
  async acknowledgeKill(deviceId: string, migrationId?: string): Promise<void> {
    const pending = this.pendingKillAcks.get(deviceId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingKillAcks.delete(deviceId);
      pending.resolve();
      
      logger.info(`[SpiritSingleton] 收到 Kill_ACK: ${deviceId}, migrationId: ${migrationId || 'unknown'}`);
    }
  }
  
  /**
   * 请求音频流权限（确保全网唯一）
   */
  requestAudioStream(deviceId: string): { 
    granted: boolean; 
    message: string;
  } {
    if (this.token.activeDeviceId !== deviceId) {
      return { granted: false, message: '只有活跃设备可以使用音频流' };
    }
    
    if (this.audioStreamDevice && this.audioStreamDevice !== deviceId) {
      // 强制终止其他设备的音频
      this.emit('force_terminate_audio', { 
        deviceId: this.audioStreamDevice,
        reason: 'NEW_STREAM_REQUEST',
      });
      logger.info(`[SpiritSingleton] 强制终止音频流: ${this.audioStreamDevice}`);
    }
    
    this.audioStreamDevice = deviceId;
    this.syncToDatabase();
    
    return { granted: true, message: '音频流已授权' };
  }
  
  /**
   * 释放音频流
   */
  releaseAudioStream(deviceId: string): void {
    if (this.audioStreamDevice === deviceId) {
      this.audioStreamDevice = null;
      this.syncToDatabase();
      logger.info(`[SpiritSingleton] 音频流已释放: ${deviceId}`);
    }
  }
  
  /**
   * 获取当前fencing token
   */
  getFencingToken(): number {
    return this.fencingToken;
  }
  
  private generateTokenId(): string {
    return `spirit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getRandomPhrase(phrases: string[]): string {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  
  private emit(event: string, data: unknown): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (e) {
        logger.error({ err: e }, 'Listener error');
      }
    });
  }
  
  async registerDevice(info: DevicePresenceInfo): Promise<{ success: boolean; isActive: boolean; fencingToken: number }> {
    this.devices.set(info.deviceId, {
      ...info,
      lastActivity: Date.now(),
      isOnline: true,
    });
    
    // 同步到数据库
    try {
      const existing = await getDatabase().select().from(deviceHeartbeats)
        .where(eq(deviceHeartbeats.deviceId, info.deviceId)).limit(1);
      
      if (existing.length === 0) {
        await getDatabase().insert(deviceHeartbeats).values({
          deviceId: info.deviceId,
          deviceType: info.deviceType,
          deviceName: info.deviceName,
          lastHeartbeat: new Date(),
          isOnline: 1,
          hasCamera: info.hasCamera ? 1 : 0,
          hasMicrophone: info.hasMicrophone ? 1 : 0,
          screenWidth: info.screenPosition?.width,
          screenHeight: info.screenPosition?.height,
        });
      } else {
        await getDatabase().update(deviceHeartbeats)
          .set({
            deviceName: info.deviceName,
            deviceType: info.deviceType,
            lastHeartbeat: new Date(),
            isOnline: 1,
            updatedAt: new Date(),
          })
          .where(eq(deviceHeartbeats.deviceId, info.deviceId));
      }
    } catch (error) {
      logger.error({ err: error }, '设备注册到数据库失败');
    }
    
    logger.info(`[SpiritSingleton] 设备注册: ${info.deviceName} (${info.deviceType})`);
    
    const isActive = this.token.activeDeviceId === info.deviceId;
    
    if (!this.token.activeDeviceId) {
      this.fencingToken++;
      this.acquireToken(info.deviceId);
      await this.syncToDatabase();
      return { success: true, isActive: true, fencingToken: this.fencingToken };
    }
    
    this.emit('device_registered', { deviceId: info.deviceId, isActive, fencingToken: this.fencingToken });
    return { success: true, isActive, fencingToken: this.fencingToken };
  }
  
  unregisterDevice(deviceId: string): void {
    this.devices.delete(deviceId);
    
    if (this.token.activeDeviceId === deviceId) {
      this.releaseToken(deviceId);
      
      const nextDevice = this.selectBestDevice();
      if (nextDevice) {
        this.acquireToken(nextDevice.deviceId);
      }
    }
    
    logger.info(`[SpiritSingleton] 设备注销: ${deviceId}`);
    this.emit('device_unregistered', { deviceId });
  }
  
  updateDeviceActivity(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastActivity = Date.now();
      device.isOnline = true;
    }
    
    if (this.token.activeDeviceId === deviceId) {
      this.token.expiresAt = Date.now() + TOKEN_EXPIRY_MS;
    }
  }
  
  private checkTokenExpiry(): void {
    if (this.token.activeDeviceId && Date.now() > this.token.expiresAt) {
      logger.info(`[SpiritSingleton] 令牌过期: ${this.token.activeDeviceId}`);
      
      const activeDevice = this.devices.get(this.token.activeDeviceId);
      if (activeDevice && activeDevice.isOnline && 
          Date.now() - activeDevice.lastActivity < INACTIVITY_THRESHOLD_MS) {
        this.token.expiresAt = Date.now() + TOKEN_EXPIRY_MS;
        return;
      }
      
      this.releaseToken(this.token.activeDeviceId);
      
      const nextDevice = this.selectBestDevice();
      if (nextDevice) {
        this.acquireToken(nextDevice.deviceId);
      }
    }
  }
  
  private acquireToken(deviceId: string): boolean {
    if (this.token.migrationInProgress) {
      logger.info('[SpiritSingleton] 迁移进行中，无法获取令牌');
      return false;
    }
    
    const previousDevice = this.token.activeDeviceId;
    
    this.token = {
      ...this.token,
      tokenId: this.generateTokenId(),
      activeDeviceId: deviceId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    };
    
    logger.info(`[SpiritSingleton] 令牌授予: ${deviceId}`);
    this.emit('token_acquired', { 
      deviceId, 
      previousDevice,
      avatarPose: this.token.avatarPose 
    });
    
    return true;
  }
  
  private releaseToken(deviceId: string): void {
    if (this.token.activeDeviceId === deviceId) {
      this.emit('token_released', { deviceId });
    }
  }
  
  async requestMigration(
    targetDeviceId: string, 
    options: { 
      immediate?: boolean;
      preservePose?: boolean;
    } = {}
  ): Promise<MigrationEvent> {
    const sourceDeviceId = this.token.activeDeviceId;
    const targetDevice = this.devices.get(targetDeviceId);
    
    if (!targetDevice) {
      throw new Error(`目标设备不存在: ${targetDeviceId}`);
    }
    
    if (!targetDevice.isOnline) {
      throw new Error(`目标设备离线: ${targetDeviceId}`);
    }
    
    if (this.token.migrationInProgress) {
      throw new Error('迁移正在进行中');
    }
    
    const migration: MigrationEvent = {
      id: `migration_${Date.now()}`,
      fromDevice: sourceDeviceId,
      toDevice: targetDeviceId,
      startTime: Date.now(),
      status: 'IN_PROGRESS',
      avatarPoseSnapshot: { ...this.token.avatarPose },
      transitionPhrase: this.getRandomPhrase(ARRIVAL_PHRASES),
    };
    
    this.token.migrationInProgress = true;
    this.token.migrationSource = sourceDeviceId || undefined;
    this.token.migrationTarget = targetDeviceId;
    
    this.migrationHistory.push(migration);
    
    logger.info(`[SpiritSingleton] 开始迁移: ${sourceDeviceId || 'null'} → ${targetDeviceId}`);
    
    if (sourceDeviceId) {
      const sourceDevice = this.devices.get(sourceDeviceId);
      const targetPos = targetDevice.screenPosition;
      
      let departDirection: 'LEFT' | 'RIGHT' = 'RIGHT';
      
      this.token.avatarPose = {
        ...this.token.avatarPose,
        state: 'MIGRATING',
        direction: departDirection,
        lastAction: 'departing',
        timestamp: Date.now(),
      };
      
      this.emit('avatar_departing', {
        deviceId: sourceDeviceId,
        direction: departDirection,
        phrase: this.getRandomPhrase(DEPARTURE_PHRASES),
        pose: this.token.avatarPose,
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, options.immediate ? 100 : 500));
    
    this.token.activeDeviceId = targetDeviceId;
    
    const arriveDirection = this.token.avatarPose.direction === 'RIGHT' ? 'LEFT' : 'RIGHT';
    this.token.avatarPose = {
      ...this.token.avatarPose,
      state: 'RUNNING',
      direction: arriveDirection,
      position: { x: arriveDirection === 'LEFT' ? -20 : 120, y: 80 },
      lastAction: 'arriving',
      timestamp: Date.now(),
    };
    
    this.emit('avatar_arriving', {
      deviceId: targetDeviceId,
      direction: arriveDirection,
      phrase: migration.transitionPhrase,
      pose: this.token.avatarPose,
    });
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    this.token.avatarPose = {
      ...this.token.avatarPose,
      state: 'IDLE',
      position: { x: 50, y: 80 },
      lastAction: 'arrived',
      timestamp: Date.now(),
    };
    
    this.token.migrationInProgress = false;
    this.token.migrationSource = undefined;
    this.token.migrationTarget = undefined;
    
    migration.status = 'COMPLETED';
    migration.endTime = Date.now();
    
    logger.info(`[SpiritSingleton] 迁移完成: ${targetDeviceId} (${migration.endTime - migration.startTime}ms)`);
    
    this.emit('migration_completed', {
      migration,
      pose: this.token.avatarPose,
    });
    
    return migration;
  }
  
  forceHibernate(deviceId: string): void {
    if (this.token.activeDeviceId === deviceId) {
      return;
    }
    
    this.emit('force_hibernate', { deviceId });
    logger.info(`[SpiritSingleton] 强制休眠: ${deviceId}`);
  }
  
  updateAvatarPose(update: Partial<AvatarPose>): void {
    this.token.avatarPose = {
      ...this.token.avatarPose,
      ...update,
      timestamp: Date.now(),
    };
    
    this.emit('avatar_pose_updated', {
      deviceId: this.token.activeDeviceId,
      pose: this.token.avatarPose,
    });
  }
  
  setAvatarMode(mode: AvatarMode): void {
    const accessories = mode === 'WORK' ? ['glasses', 'tablet'] : 
                       mode === 'PROTECT' ? ['shield'] : [];
    
    this.updateAvatarPose({
      mode,
      mood: mode === 'WORK' ? 'SERIOUS' : mode === 'PROTECT' ? 'ALERT' : 'HAPPY',
      accessories,
      lastAction: `mode_${mode.toLowerCase()}`,
    });
    
    logger.info(`[SpiritSingleton] 模式切换: ${mode}`);
  }
  
  private selectBestDevice(): DevicePresenceInfo | null {
    const onlineDevices = Array.from(this.devices.values())
      .filter(d => d.isOnline)
      .sort((a, b) => {
        if (a.proximity !== b.proximity) return b.proximity - a.proximity;
        return b.lastActivity - a.lastActivity;
      });
    
    return onlineDevices[0] || null;
  }
  
  private checkInactiveDevices(): void {
    const now = Date.now();
    
    for (const [deviceId, device] of Array.from(this.devices.entries())) {
      if (now - device.lastActivity > INACTIVITY_THRESHOLD_MS) {
        device.isOnline = false;
        
        if (this.token.activeDeviceId === deviceId) {
          logger.info(`[SpiritSingleton] 活跃设备超时: ${deviceId}`);
          const nextDevice = this.selectBestDevice();
          if (nextDevice && nextDevice.deviceId !== deviceId) {
            this.requestMigration(nextDevice.deviceId, { immediate: true });
          }
        }
      }
    }
  }
  
  getPresenceToken(): GlobalPresenceToken {
    return { ...this.token };
  }
  
  getActiveDevice(): DevicePresenceInfo | null {
    if (!this.token.activeDeviceId) return null;
    return this.devices.get(this.token.activeDeviceId) || null;
  }
  
  getAllDevices(): DevicePresenceInfo[] {
    return Array.from(this.devices.values());
  }
  
  getMigrationHistory(limit: number = 20): MigrationEvent[] {
    return this.migrationHistory.slice(-limit);
  }
  
  isDeviceActive(deviceId: string): boolean {
    return this.token.activeDeviceId === deviceId && !this.token.migrationInProgress;
  }
  
  shouldDeviceSleep(deviceId: string): boolean {
    return this.token.activeDeviceId !== deviceId || this.token.migrationInProgress;
  }
  
  subscribe(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  getStatus(): {
    activeDevice: string | null;
    totalDevices: number;
    onlineDevices: number;
    migrationInProgress: boolean;
    avatarState: AvatarState;
    avatarMode: AvatarMode;
  } {
    const devices = Array.from(this.devices.values());
    return {
      activeDevice: this.token.activeDeviceId,
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.isOnline).length,
      migrationInProgress: this.token.migrationInProgress,
      avatarState: this.token.avatarPose.state,
      avatarMode: this.token.avatarPose.mode,
    };
  }
}

export const spiritSingleton = new SpiritSingletonService();
export default spiritSingleton;
