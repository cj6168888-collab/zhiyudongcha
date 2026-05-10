/**
 * 小智 Resource Manager - 资源管理器
 * 
 * 功能：
 * 1. 设备能力感知
 * 2. 智能任务分配
 * 3. 负载均衡优化
 * 4. 资源使用监控
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ResourceManager');

export interface DeviceCapability {
  deviceId: string;
  deviceName: string;
  deviceType: 'server' | 'desktop' | 'mobile' | 'edge';
  
  cpu: {
    cores: number;
    speed: number;
    usage: number;
  };
  
  memory: {
    total: number;
    available: number;
    usage: number;
  };
  
  gpu?: {
    name: string;
    memory: number;
    compute: number;
  };
  
  network: {
    bandwidth: number;
    latency: number;
    type: 'wired' | 'wifi' | 'cellular';
  };
  
  features: {
    hasGpu: boolean;
    hasNpu: boolean;
    hasLocalAI: boolean;
    maxModelSize: number;
  };
  
  lastHeartbeat: Date;
  isOnline: boolean;
}

export interface TaskRequirement {
  taskId: string;
  taskType: 'inference' | 'stt' | 'tts' | 'vision' | 'compute' | 'storage';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  requirements: {
    minMemory?: number;
    minCores?: number;
    requireGpu?: boolean;
    requireLocalAI?: boolean;
    maxLatency?: number;
    modelSize?: number;
  };
  
  preferences: {
    preferLocal?: boolean;
    preferCloud?: boolean;
    preferDevice?: string;
  };
  
  deadline?: Date;
  estimatedDuration?: number;
}

export interface TaskAssignment {
  taskId: string;
  assignedDevice: string;
  assignmentReason: string;
  estimatedCompletion: Date;
  fallbackDevice?: string;
}

export interface ResourceStats {
  totalDevices: number;
  onlineDevices: number;
  totalCapacity: {
    cpu: number;
    memory: number;
    gpu: number;
  };
  currentUsage: {
    cpu: number;
    memory: number;
    gpu: number;
  };
  taskQueue: number;
  completedTasks24h: number;
}

class ResourceManagerService {
  private devices: Map<string, DeviceCapability> = new Map();
  private taskQueue: TaskRequirement[] = [];
  private assignments: Map<string, TaskAssignment> = new Map();
  private taskHistory: { taskId: string; device: string; success: boolean; duration: number; completedAt: number }[] = [];
  
  registerDevice(device: DeviceCapability): void {
    device.lastHeartbeat = new Date();
    device.isOnline = true;
    this.devices.set(device.deviceId, device);
    logger.info(`[ResourceManager] Device registered: ${device.deviceName} (${device.deviceType})`);
  }
  
  updateDeviceStatus(deviceId: string, updates: Partial<DeviceCapability>): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    
    Object.assign(device, updates);
    device.lastHeartbeat = new Date();
    device.isOnline = true;
    
    return true;
  }
  
  heartbeat(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    
    device.lastHeartbeat = new Date();
    device.isOnline = true;
    return true;
  }
  
  private calculateDeviceScore(device: DeviceCapability, task: TaskRequirement): number {
    let score = 0;
    const req = task.requirements;
    const pref = task.preferences;
    
    if (!device.isOnline) return -1;
    
    if (req.minMemory && device.memory.available < req.minMemory) return -1;
    if (req.minCores && device.cpu.cores < req.minCores) return -1;
    if (req.requireGpu && !device.features.hasGpu) return -1;
    if (req.requireLocalAI && !device.features.hasLocalAI) return -1;
    if (req.modelSize && device.features.maxModelSize < req.modelSize) return -1;
    
    const cpuAvailable = 100 - device.cpu.usage;
    const memAvailable = (device.memory.available / device.memory.total) * 100;
    score += cpuAvailable * 0.3;
    score += memAvailable * 0.3;
    
    if (device.features.hasGpu && (task.taskType === 'inference' || task.taskType === 'vision')) {
      score += 30;
    }
    
    if (device.features.hasLocalAI && pref.preferLocal) {
      score += 25;
    }
    
    if (device.network.type === 'wired') score += 10;
    else if (device.network.type === 'wifi') score += 5;
    
    if (req.maxLatency && device.network.latency <= req.maxLatency) {
      score += 15;
    }
    
    if (pref.preferDevice === device.deviceId) {
      score += 50;
    }
    
    switch (device.deviceType) {
      case 'server': score += 20; break;
      case 'desktop': score += 15; break;
      case 'edge': score += 10; break;
      case 'mobile': score += 5; break;
    }
    
    const deviceHistory = this.taskHistory.filter(h => 
      h.device === device.deviceId && h.success
    );
    if (deviceHistory.length > 5) {
      const avgDuration = deviceHistory.reduce((sum, h) => sum + h.duration, 0) / deviceHistory.length;
      if (avgDuration < 1000) score += 10;
    }
    
    return score;
  }
  
  assignTask(task: TaskRequirement): TaskAssignment | null {
    const candidates: { device: DeviceCapability; score: number }[] = [];
    
    for (const device of Array.from(this.devices.values())) {
      const score = this.calculateDeviceScore(device, task);
      if (score > 0) {
        candidates.push({ device, score });
      }
    }
    
    if (candidates.length === 0) {
      logger.info(`[ResourceManager] No suitable device for task ${task.taskId}`);
      return null;
    }
    
    candidates.sort((a, b) => b.score - a.score);
    
    const best = candidates[0];
    const fallback = candidates.length > 1 ? candidates[1].device.deviceId : undefined;
    
    const estimatedDuration = task.estimatedDuration || 5000;
    const assignment: TaskAssignment = {
      taskId: task.taskId,
      assignedDevice: best.device.deviceId,
      assignmentReason: this.getAssignmentReason(best.device, task),
      estimatedCompletion: new Date(Date.now() + estimatedDuration),
      fallbackDevice: fallback,
    };
    
    this.assignments.set(task.taskId, assignment);
    logger.info(`[ResourceManager] Task ${task.taskId} assigned to ${best.device.deviceName}`);
    
    return assignment;
  }
  
  private getAssignmentReason(device: DeviceCapability, task: TaskRequirement): string {
    const reasons: string[] = [];
    
    if (device.features.hasGpu && task.taskType === 'inference') {
      reasons.push('GPU加速可用');
    }
    if (device.features.hasLocalAI && task.preferences.preferLocal) {
      reasons.push('本地AI模型');
    }
    if (device.cpu.usage < 30) {
      reasons.push('CPU负载低');
    }
    if (device.memory.available > device.memory.total * 0.7) {
      reasons.push('内存充足');
    }
    if (device.network.type === 'wired') {
      reasons.push('有线网络');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '综合评分最高';
  }
  
  completeTask(taskId: string, success: boolean, duration: number): void {
    const assignment = this.assignments.get(taskId);
    if (assignment) {
      this.taskHistory.push({
        taskId,
        device: assignment.assignedDevice,
        success,
        duration,
        completedAt: Date.now(),
      });
      
      if (this.taskHistory.length > 1000) {
        this.taskHistory = this.taskHistory.slice(-500);
      }
      
      this.assignments.delete(taskId);
    }
  }
  
  queueTask(task: TaskRequirement): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  processQueue(): TaskAssignment[] {
    const results: TaskAssignment[] = [];
    const processed: string[] = [];
    
    for (const task of this.taskQueue) {
      const assignment = this.assignTask(task);
      if (assignment) {
        results.push(assignment);
        processed.push(task.taskId);
      }
    }
    
    this.taskQueue = this.taskQueue.filter(t => !processed.includes(t.taskId));
    
    return results;
  }
  
  getStats(): ResourceStats {
    let totalCpu = 0, totalMem = 0, totalGpu = 0;
    let usedCpu = 0, usedMem = 0, usedGpu = 0;
    let onlineCount = 0;
    
    for (const device of Array.from(this.devices.values())) {
      totalCpu += device.cpu.cores;
      totalMem += device.memory.total;
      if (device.gpu) totalGpu += device.gpu.memory;
      
      if (device.isOnline) {
        onlineCount++;
        usedCpu += device.cpu.cores * (device.cpu.usage / 100);
        usedMem += device.memory.total - device.memory.available;
        if (device.gpu) usedGpu += device.gpu.memory * 0.5;
      }
    }
    
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const completedTasks24h = this.taskHistory.filter(h => 
      h.completedAt > yesterday
    ).length;
    
    return {
      totalDevices: this.devices.size,
      onlineDevices: onlineCount,
      totalCapacity: { cpu: totalCpu, memory: totalMem, gpu: totalGpu },
      currentUsage: { cpu: usedCpu, memory: usedMem, gpu: usedGpu },
      taskQueue: this.taskQueue.length,
      completedTasks24h,
    };
  }
  
  getDevices(): DeviceCapability[] {
    return Array.from(this.devices.values());
  }
  
  getDevice(deviceId: string): DeviceCapability | undefined {
    return this.devices.get(deviceId);
  }
  
  getAssignment(taskId: string): TaskAssignment | undefined {
    return this.assignments.get(taskId);
  }
  
  checkDeviceHealth(): void {
    const timeout = 60000;
    const now = Date.now();
    
    for (const device of Array.from(this.devices.values())) {
      if (now - device.lastHeartbeat.getTime() > timeout) {
        device.isOnline = false;
        logger.info(`[ResourceManager] Device offline: ${device.deviceName}`);
      }
    }
  }
  
  getBestDeviceFor(taskType: TaskRequirement['taskType']): DeviceCapability | null {
    const mockTask: TaskRequirement = {
      taskId: 'probe',
      taskType,
      priority: 'medium',
      requirements: {},
      preferences: {},
    };
    
    let bestDevice: DeviceCapability | null = null;
    let bestScore = -1;
    
    for (const device of Array.from(this.devices.values())) {
      const score = this.calculateDeviceScore(device, mockTask);
      if (score > bestScore) {
        bestScore = score;
        bestDevice = device;
      }
    }
    
    return bestDevice;
  }
  
  getRecommendation(taskType: TaskRequirement['taskType']): {
    recommendation: 'local' | 'cloud' | 'hybrid';
    reason: string;
    device?: string;
  } {
    const best = this.getBestDeviceFor(taskType);
    
    if (!best) {
      return {
        recommendation: 'cloud',
        reason: '无可用本地设备，使用云端服务',
      };
    }
    
    if (best.features.hasLocalAI && best.features.maxModelSize >= 7) {
      return {
        recommendation: 'local',
        reason: `${best.deviceName} 支持本地AI推理`,
        device: best.deviceId,
      };
    }
    
    if (best.features.hasGpu) {
      return {
        recommendation: 'hybrid',
        reason: `${best.deviceName} 有GPU但模型容量有限，建议混合模式`,
        device: best.deviceId,
      };
    }
    
    return {
      recommendation: 'cloud',
      reason: '本地设备能力不足，建议使用云端服务',
    };
  }
}

export const resourceManager = new ResourceManagerService();

export { ResourceManagerService };
