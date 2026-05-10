/**
 * 小智 Device Registry - 设备注册中心
 * 
 * 功能：
 * 1. 管理连接的设备（手机、笔记本、服务器等）
 * 2. 设备心跳检测和能力上报
 * 3. 智能任务分发（根据设备能力）
 * 4. 设备间消息路由
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DeviceRegistry');

import { EventEmitter } from 'events';
import type WebSocket from 'ws';

// ===== 设备类型 =====
export type DeviceType = 
  | 'MOBILE'      // 手机
  | 'TABLET'      // 平板
  | 'LAPTOP'      // 笔记本
  | 'DESKTOP'     // 台式机
  | 'SERVER'      // 服务器
  | 'EDGE'        // 边缘设备（如树莓派）
  | 'AR_GLASSES'  // AR眼镜
  | 'UNKNOWN';

export type DeviceStatus = 'ONLINE' | 'BUSY' | 'IDLE' | 'OFFLINE' | 'SLEEPING';

// ===== 设备能力 =====
export interface DeviceCapabilities {
  // 推理能力
  canRunLocalModel: boolean;
  localModelName?: string;
  maxModelSize?: string;  // e.g., '7B', '13B'
  gpuAvailable?: boolean;
  gpuMemoryMB?: number;
  
  // 执行能力
  canExecuteScreenActions: boolean;
  hasAccessibility: boolean;
  hasOCR: boolean;
  
  // 资源信息
  cpuCores: number;
  memoryMB: number;
  batteryLevel?: number;
  isPluggedIn?: boolean;
  
  // 网络信息
  networkType?: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  bandwidthMbps?: number;
  
  // 屏幕信息
  screenWidth?: number;
  screenHeight?: number;
  
  // 特殊能力
  features: string[];
}

// ===== 设备信息 =====
export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  
  // 用户信息
  userId: string;
  userRole: 'MASTER' | 'GUEST';
  
  // 连接信息
  connectedAt: number;
  lastHeartbeat: number;
  sessionId: string;
  
  // WebSocket连接
  ws?: WebSocket;
  
  // 统计信息
  jobsCompleted: number;
  jobsFailed: number;
  averageLatencyMs: number;
}

// ===== 心跳数据 =====
export interface HeartbeatData {
  deviceId: string;
  timestamp: number;
  status: DeviceStatus;
  cpuUsage?: number;
  memoryUsage?: number;
  batteryLevel?: number;
  activeJobs?: number;
}

// ===== 设备注册中心类 =====
export class DeviceRegistry extends EventEmitter {
  private devices: Map<string, DeviceInfo> = new Map();
  private heartbeatInterval: number = 30000; // 30秒
  private offlineThreshold: number = 90000;  // 90秒无心跳视为离线
  private checkInterval?: NodeJS.Timeout;
  
  constructor() {
    super();
    this.startHealthCheck();
  }
  
  // 注册设备
  registerDevice(
    deviceId: string,
    name: string,
    type: DeviceType,
    capabilities: DeviceCapabilities,
    userId: string,
    userRole: 'MASTER' | 'GUEST',
    ws?: WebSocket
  ): DeviceInfo {
    const existing = this.devices.get(deviceId);
    
    const device: DeviceInfo = {
      id: deviceId,
      name,
      type,
      status: 'ONLINE',
      capabilities,
      userId,
      userRole,
      connectedAt: existing?.connectedAt || Date.now(),
      lastHeartbeat: Date.now(),
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ws,
      jobsCompleted: existing?.jobsCompleted || 0,
      jobsFailed: existing?.jobsFailed || 0,
      averageLatencyMs: existing?.averageLatencyMs || 0,
    };
    
    this.devices.set(deviceId, device);
    
    logger.info(`[DeviceRegistry] Device registered: ${name} (${deviceId}) - ${type}`);
    logger.info(`[DeviceRegistry] Capabilities: LocalAI=${capabilities.canRunLocalModel}, GPU=${capabilities.gpuAvailable}`);
    
    this.emit('device:registered', device);
    
    return device;
  }
  
  // 注销设备
  unregisterDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    
    device.status = 'OFFLINE';
    device.ws = undefined;
    
    logger.info(`[DeviceRegistry] Device unregistered: ${device.name} (${deviceId})`);
    this.emit('device:unregistered', device);
    
    return true;
  }
  
  // 更新心跳
  updateHeartbeat(data: HeartbeatData): boolean {
    const device = this.devices.get(data.deviceId);
    if (!device) return false;
    
    device.lastHeartbeat = data.timestamp || Date.now();
    device.status = data.status || 'ONLINE';
    
    // 更新动态信息
    if (data.batteryLevel !== undefined) {
      device.capabilities.batteryLevel = data.batteryLevel;
    }
    
    return true;
  }
  
  // 获取设备
  getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId);
  }
  
  // 获取用户的所有设备
  getUserDevices(userId: string): DeviceInfo[] {
    return Array.from(this.devices.values())
      .filter(d => d.userId === userId);
  }
  
  // 获取在线设备
  getOnlineDevices(): DeviceInfo[] {
    return Array.from(this.devices.values())
      .filter(d => d.status === 'ONLINE' || d.status === 'IDLE' || d.status === 'BUSY');
  }
  
  // 获取可执行本地推理的设备
  getLocalInferenceDevices(): DeviceInfo[] {
    return this.getOnlineDevices()
      .filter(d => d.capabilities.canRunLocalModel)
      .sort((a, b) => {
        // 优先选择：GPU可用 > 内存大 > 响应快
        if (a.capabilities.gpuAvailable !== b.capabilities.gpuAvailable) {
          return a.capabilities.gpuAvailable ? -1 : 1;
        }
        if (a.capabilities.memoryMB !== b.capabilities.memoryMB) {
          return (b.capabilities.memoryMB || 0) - (a.capabilities.memoryMB || 0);
        }
        return a.averageLatencyMs - b.averageLatencyMs;
      });
  }
  
  // 选择最佳设备执行任务
  selectBestDevice(requirements: {
    needLocalModel?: boolean;
    needGPU?: boolean;
    needScreenAction?: boolean;
    preferredType?: DeviceType;
    userId?: string;
  } = {}): DeviceInfo | undefined {
    let candidates = this.getOnlineDevices()
      .filter(d => d.status !== 'BUSY');
    
    if (requirements.userId) {
      candidates = candidates.filter(d => d.userId === requirements.userId);
    }
    
    if (requirements.needLocalModel) {
      candidates = candidates.filter(d => d.capabilities.canRunLocalModel);
    }
    
    if (requirements.needGPU) {
      candidates = candidates.filter(d => d.capabilities.gpuAvailable);
    }
    
    if (requirements.needScreenAction) {
      candidates = candidates.filter(d => d.capabilities.canExecuteScreenActions);
    }
    
    if (requirements.preferredType) {
      const preferred = candidates.filter(d => d.type === requirements.preferredType);
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }
    
    // 按综合评分排序
    candidates.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      
      // GPU加分
      if (a.capabilities.gpuAvailable) scoreA += 100;
      if (b.capabilities.gpuAvailable) scoreB += 100;
      
      // 内存加分
      scoreA += (a.capabilities.memoryMB || 0) / 100;
      scoreB += (b.capabilities.memoryMB || 0) / 100;
      
      // 响应速度（越快越好）
      scoreA -= a.averageLatencyMs / 100;
      scoreB -= b.averageLatencyMs / 100;
      
      // 成功率
      const successRateA = a.jobsCompleted / Math.max(1, a.jobsCompleted + a.jobsFailed);
      const successRateB = b.jobsCompleted / Math.max(1, b.jobsCompleted + b.jobsFailed);
      scoreA += successRateA * 50;
      scoreB += successRateB * 50;
      
      return scoreB - scoreA;
    });
    
    return candidates[0];
  }
  
  // 向设备发送消息
  sendToDevice(deviceId: string, message: Record<string, unknown>): boolean {
    const device = this.devices.get(deviceId);
    if (!device?.ws || device.ws.readyState !== 1) {
      return false;
    }
    
    try {
      device.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error({ error, deviceId }, 'Failed to send to device');
      return false;
    }
  }
  
  // 广播消息给用户的所有设备
  broadcastToUser(userId: string, message: Record<string, unknown>): number {
    let sent = 0;
    for (const device of this.getUserDevices(userId)) {
      if (this.sendToDevice(device.id, message)) {
        sent++;
      }
    }
    return sent;
  }
  
  // 获取所有设备（包含离线设备）
  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }
  
  // 获取注册中心状态
  getStatus(): {
    totalDevices: number;
    onlineDevices: number;
    localAIDevices: number;
    devicesByType: Record<string, number>;
  } {
    const devices = Array.from(this.devices.values());
    const online = devices.filter(d => 
      d.status === 'ONLINE' || d.status === 'IDLE' || d.status === 'BUSY'
    );
    
    const byType: Record<string, number> = {};
    for (const d of devices) {
      byType[d.type] = (byType[d.type] || 0) + 1;
    }
    
    return {
      totalDevices: devices.length,
      onlineDevices: online.length,
      localAIDevices: online.filter(d => d.capabilities.canRunLocalModel).length,
      devicesByType: byType,
    };
  }
  
  // 健康检查
  private startHealthCheck(): void {
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      
      const entries = Array.from(this.devices.entries());
      for (const [id, device] of entries) {
        if (device.status !== 'OFFLINE' && now - device.lastHeartbeat > this.offlineThreshold) {
          device.status = 'OFFLINE';
          logger.info(`[DeviceRegistry] Device offline (no heartbeat): ${device.name} (${id})`);
          this.emit('device:offline', device);
        }
      }
    }, 30000);
  }
  
  // 停止健康检查
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// ===== 全局注册中心实例 =====
export const deviceRegistry = new DeviceRegistry();
