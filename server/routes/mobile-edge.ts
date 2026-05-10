/**
 * 小智 Mobile Edge AI Routes - 移动边缘AI API
 * 
 * 端点：
 * - POST /api/mobile/register - 注册移动设备
 * - POST /api/mobile/heartbeat - 设备心跳
 * - POST /api/mobile/inference - 移动端推理请求
 * - GET /api/mobile/devices - 获取设备列表
 * - GET /api/mobile/profile/:ram - 获取能力档案
 * - GET /api/mobile/recommendation - 16GB设备推荐
 * - GET /api/mobile/offline-queue/:deviceId - 获取离线队列
 * - POST /api/mobile/sync/:deviceId - 同步离线队列
 * - GET /api/mobile/status - 服务状态
 * 
 * @version 3.0.0
 * @author 架构组
 * @date 2026-03-03
 * 
 * 企业级特性：
 * - 单例模式路由
 * - 幂等注册
 * - 完善错误处理
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('MobileEdge');

import { Router } from 'express';
import { getMobileEdgeAI, type MobileDeviceConfig, type MobileInferenceRequest } from '../services/mobile-edge-ai';

// 确保只获取一次单例
let mobileEdgeAIService: ReturnType<typeof getMobileEdgeAI> | null = null;
let routesRegistered = false;

function getMobileEdgeAIService() {
  if (!mobileEdgeAIService) {
    mobileEdgeAIService = getMobileEdgeAI();
    logger.info('[MobileEdge] Service instance acquired');
  }
  return mobileEdgeAIService;
}

export const mobileEdgeRouter = Router();

// 注册移动设备
mobileEdgeRouter.post('/register', async (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    
    const config: MobileDeviceConfig = {
      deviceId: req.body.deviceId || `mobile_${Date.now()}`,
      deviceName: req.body.deviceName || '我的手机',
      osType: req.body.osType || 'ANDROID',
      osVersion: req.body.osVersion || 'Unknown',
      ramGB: req.body.ramGB || 8,
      localEndpoint: req.body.localEndpoint,
      localModel: req.body.localModel,
      tunnelUrl: req.body.tunnelUrl,
    };
    
    const userId = req.body.userId || 'master';
    const result = service.registerMobileDevice(config, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          device: result.device,
          profile: result.profile,
          recommendation: result.profile ? {
            maxModelSize: result.profile.maxModelSize,
            recommendedModels: result.profile.recommendedModels,
            estimatedTPS: result.profile.estimatedTPS,
          } : null,
        },
        message: '设备注册成功！小智已准备好在你的手机上运行~',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Register error');
    res.status(500).json({
      success: false,
      error: '设备注册失败',
    });
  }
});

// 设备心跳
mobileEdgeRouter.post('/heartbeat', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const { deviceId, batteryLevel, isPluggedIn, networkType, localModelLoaded, tunnelActive } = req.body;
    
    const success = service.updateMobileStatus(deviceId, {
      batteryLevel,
      isPluggedIn,
      networkType,
      localModelLoaded,
      tunnelActive,
    });
    
    res.json({
      success,
      timestamp: Date.now(),
      message: success ? '心跳更新成功' : '设备未找到',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '心跳更新失败',
    });
  }
});

// 移动端推理请求
mobileEdgeRouter.post('/inference', async (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    
    const request: MobileInferenceRequest = {
      requestId: req.body.requestId || `req_${Date.now()}`,
      deviceId: req.body.deviceId,
      messages: req.body.messages || [],
      privacyMode: req.body.privacyMode || false,
      maxTokens: req.body.maxTokens || 512,
      temperature: req.body.temperature || 0.7,
    };
    
    const response = await service.requestMobileInference(request);
    
    if (response.success) {
      res.json({
        success: true,
        data: response,
      });
    } else {
      res.json({
        success: false,
        error: response.error,
        data: response,
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Inference error');
    res.status(500).json({
      success: false,
      error: '推理请求失败',
    });
  }
});

// 获取设备列表
mobileEdgeRouter.get('/devices', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const devices = service.getMobileDevices();
    
    res.json({
      success: true,
      data: devices,
      total: devices.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get devices error');
    res.status(500).json({
      success: false,
      error: '获取设备列表失败',
    });
  }
});

// 获取能力档案
mobileEdgeRouter.get('/profile/:ram', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const ram = parseInt(req.params.ram);
    
    if (isNaN(ram)) {
      return res.status(400).json({
        success: false,
        error: 'RAM参数必须是数字',
      });
    }
    
    const profile = service.getCapabilityProfile(ram);
    
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get profile error');
    res.status(500).json({
      success: false,
      error: '获取能力档案失败',
    });
  }
});

// 获取16GB设备推荐
mobileEdgeRouter.get('/recommendation', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const recommendation = service.get16GBRecommendation();
    
    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get recommendation error');
    res.status(500).json({
      success: false,
      error: '获取推荐失败',
    });
  }
});

// 获取离线队列
mobileEdgeRouter.get('/offline-queue/:deviceId', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const { deviceId } = req.params;
    
    const queue = service.getOfflineQueue(deviceId);
    
    res.json({
      success: true,
      data: queue,
      total: queue.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get offline queue error');
    res.status(500).json({
      success: false,
      error: '获取离线队列失败',
    });
  }
});

// 同步离线队列
mobileEdgeRouter.post('/sync/:deviceId', async (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const { deviceId } = req.params;
    
    const result = await service.syncOfflineQueue(deviceId);
    
    res.json({
      success: true,
      data: result,
      message: `同步完成: ${result.synced}成功, ${result.failed}失败`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Sync offline queue error');
    res.status(500).json({
      success: false,
      error: '同步离线队列失败',
    });
  }
});

// 服务状态
mobileEdgeRouter.get('/status', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const status = service.getStatus();
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get status error');
    res.status(500).json({
      success: false,
      error: '获取状态失败',
    });
  }
});

// 芯片档案列表
mobileEdgeRouter.get('/chips', (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const chips = service.getAllChipProfiles();
    
    res.json({
      success: true,
      data: chips,
      total: Object.keys(chips).length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get chips error');
    res.status(500).json({
      success: false,
      error: '获取芯片档案失败',
    });
  }
});

// 健康检查
mobileEdgeRouter.get('/health', async (req, res) => {
  try {
    const service = getMobileEdgeAIService();
    const health = await service.healthCheck();
    
    res.json(health);
  } catch (error) {
    logger.error({ err: error }, 'Health check error');
    res.status(500).json({
      status: 'error',
      details: { error: 'Health check failed' }
    });
  }
});

// 路由注册日志 - 确保只记录一次
if (!routesRegistered) {
  logger.info('[MobileEdge] Routes registered at /api/mobile/*');
  routesRegistered = true;
}

export default mobileEdgeRouter;
