/**
 * 小智 Laptop Device Routes - 笔记本设备管理API
 * 
 * 端点：
 * - POST /api/laptop/register - 注册笔记本设备
 * - GET /api/laptop/devices - 获取设备列表
 * - DELETE /api/laptop/devices - 移除设备
 * - POST /api/laptop/heartbeat - 设备心跳
 * - GET /api/laptop/status - 服务状态
 */

import { Router } from 'express';
import { deviceRegistry } from '../services/device-registry';

export const laptopDevicesRouter = Router();

// 内存存储笔记本设备（简化版，后续可迁移到数据库）
interface LaptopConfig {
  deviceId: string;
  deviceName: string;
  osType: 'WINDOWS' | 'MACOS' | 'LINUX';
  ramGB: number;
  cpuCores: number;
  gpuName?: string;
  gpuMemoryMB?: number;
  storageGB?: number;
  localModel?: string;
  localEndpoint?: string;
  purpose: string[];
  registeredAt: number;
  lastSeen: number;
  status: 'ONLINE' | 'OFFLINE' | 'SLEEPING';
}

const laptopDevices: Map<string, LaptopConfig> = new Map();

// 注册笔记本设备
laptopDevicesRouter.post('/register', async (req, res) => {
  try {
    const {
      deviceId,
      deviceName,
      osType,
      ramGB,
      cpuCores,
      gpuName,
      gpuMemoryMB,
      storageGB,
      localModel,
      localEndpoint,
      purpose,
    } = req.body;

    const config: LaptopConfig = {
      deviceId: deviceId || `laptop_${Date.now()}`,
      deviceName: deviceName || '小智的笔记本',
      osType: osType || 'WINDOWS',
      ramGB: ramGB || 16,
      cpuCores: cpuCores || 8,
      gpuName,
      gpuMemoryMB,
      storageGB: storageGB || 512,
      localModel,
      localEndpoint,
      purpose: purpose || ['work', 'play'],
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      status: 'ONLINE',
    };

    laptopDevices.set(config.deviceId, config);

    // 同时注册到设备注册中心
    deviceRegistry.registerDevice(
      config.deviceId,
      config.deviceName,
      'LAPTOP',
      {
        canRunLocalModel: !!localModel,
        localModelName: localModel,
        gpuAvailable: !!gpuName,
        gpuMemoryMB: gpuMemoryMB,
        canExecuteScreenActions: true,
        hasAccessibility: true,
        hasOCR: true,
        cpuCores: config.cpuCores,
        memoryMB: config.ramGB * 1024,
        networkType: 'wifi',
        features: config.purpose,
      },
      'master',
      'MASTER'
    );

    console.log(`[LaptopDevices] Registered: ${config.deviceName} (${config.deviceId})`);

    res.json({
      success: true,
      data: config,
      message: `小智的笔记本"${config.deviceName}"已注册成功！现在可以工作和玩耍了~`,
    });
  } catch (error) {
    console.error('[LaptopDevices] Register error:', error);
    res.status(500).json({
      success: false,
      error: '笔记本注册失败',
    });
  }
});

// 获取设备列表
laptopDevicesRouter.get('/devices', (req, res) => {
  try {
    const devices = Array.from(laptopDevices.values());
    
    // 更新状态（如果超过2分钟没有心跳则离线）
    const now = Date.now();
    devices.forEach(d => {
      if (now - d.lastSeen > 120000 && d.status === 'ONLINE') {
        d.status = 'OFFLINE';
      }
    });

    res.json({
      success: true,
      data: devices,
      total: devices.length,
      online: devices.filter(d => d.status === 'ONLINE').length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取设备列表失败',
    });
  }
});

// 移除设备
laptopDevicesRouter.delete('/devices', (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: '缺少设备ID',
      });
    }

    const device = laptopDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: '设备不存在',
      });
    }

    laptopDevices.delete(deviceId);
    deviceRegistry.unregisterDevice(deviceId);

    console.log(`[LaptopDevices] Removed: ${device.deviceName} (${deviceId})`);

    res.json({
      success: true,
      message: `设备"${device.deviceName}"已移除`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '移除设备失败',
    });
  }
});

// 设备心跳
laptopDevicesRouter.post('/heartbeat', (req, res) => {
  try {
    const { deviceId, status } = req.body;

    const device = laptopDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: '设备未注册',
      });
    }

    device.lastSeen = Date.now();
    device.status = status || 'ONLINE';

    // 更新设备注册中心
    deviceRegistry.updateHeartbeat({
      deviceId,
      timestamp: Date.now(),
      status: device.status as any,
    });

    res.json({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '心跳更新失败',
    });
  }
});

// 服务状态
laptopDevicesRouter.get('/status', (req, res) => {
  try {
    const devices = Array.from(laptopDevices.values());
    const online = devices.filter(d => d.status === 'ONLINE');
    const withAI = devices.filter(d => !!d.localModel);

    res.json({
      success: true,
      data: {
        totalDevices: devices.length,
        onlineDevices: online.length,
        aiCapableDevices: withAI.length,
        purposes: {
          work: devices.filter(d => d.purpose.includes('work')).length,
          play: devices.filter(d => d.purpose.includes('play')).length,
          ai: devices.filter(d => d.purpose.includes('ai')).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取状态失败',
    });
  }
});

console.log('[LaptopDevices] Router initialized');
