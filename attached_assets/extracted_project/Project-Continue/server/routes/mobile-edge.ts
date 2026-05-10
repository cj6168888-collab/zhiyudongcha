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
 */

import { Router } from 'express';
import { mobileEdgeAI, type MobileDeviceConfig, type MobileInferenceRequest } from '../services/mobile-edge-ai';

export const mobileEdgeRouter = Router();

// 注册移动设备
mobileEdgeRouter.post('/register', async (req, res) => {
  try {
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
    const result = mobileEdgeAI.registerMobileDevice(config, userId);
    
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
    console.error('[MobileEdge] Register error:', error);
    res.status(500).json({
      success: false,
      error: '设备注册失败',
    });
  }
});

// 设备心跳
mobileEdgeRouter.post('/heartbeat', (req, res) => {
  try {
    const { deviceId, batteryLevel, isPluggedIn, networkType, localModelLoaded, tunnelActive } = req.body;
    
    const success = mobileEdgeAI.updateMobileStatus(deviceId, {
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
    const request: MobileInferenceRequest = {
      requestId: req.body.requestId || `req_${Date.now()}`,
      deviceId: req.body.deviceId,
      messages: req.body.messages || [],
      privacyMode: req.body.privacyMode ?? false,
      maxTokens: req.body.maxTokens,
      temperature: req.body.temperature,
    };
    
    if (!request.deviceId) {
      return res.status(400).json({
        success: false,
        error: '缺少设备ID',
      });
    }
    
    const response = await mobileEdgeAI.requestMobileInference(request);
    
    res.json({
      success: response.success,
      data: response,
      message: response.success 
        ? '本地推理完成！' 
        : (response.offlineCached ? '已加入离线队列' : '请使用云端服务'),
    });
  } catch (error) {
    console.error('[MobileEdge] Inference error:', error);
    res.status(500).json({
      success: false,
      error: '推理请求失败',
    });
  }
});

// 获取设备列表
mobileEdgeRouter.get('/devices', (req, res) => {
  try {
    const devices = mobileEdgeAI.getMobileDevices();
    
    res.json({
      success: true,
      data: devices.map(d => ({
        deviceId: d.config.deviceId,
        deviceName: d.config.deviceName,
        osType: d.config.osType,
        ramGB: d.config.ramGB,
        status: d.device?.status || 'UNKNOWN',
        localModel: d.config.localModel,
        profile: {
          maxModelSize: d.profile.maxModelSize,
          recommendedModels: d.profile.recommendedModels,
          estimatedTPS: d.profile.estimatedTPS,
          offlineCapable: d.profile.offlineCapable,
        },
      })),
      total: devices.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取设备列表失败',
    });
  }
});

// 获取能力档案
mobileEdgeRouter.get('/profile/:ram', (req, res) => {
  try {
    const ramGB = parseInt(req.params.ram, 10);
    
    if (isNaN(ramGB) || ramGB < 2) {
      return res.status(400).json({
        success: false,
        error: '无效的RAM值',
      });
    }
    
    const profile = mobileEdgeAI.getCapabilityProfile(ramGB);
    
    res.json({
      success: true,
      data: {
        ramGB,
        profile,
        message: `${ramGB}GB设备可以运行最大${profile.maxModelSize}的模型，预计速度${profile.estimatedTPS} tokens/秒`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取能力档案失败',
    });
  }
});

// 16GB设备推荐
mobileEdgeRouter.get('/recommendation', (req, res) => {
  try {
    const recommendation = mobileEdgeAI.get16GBRecommendation();
    
    res.json({
      success: true,
      data: recommendation,
      message: '主人的16GB手机可以运行最强的本地AI模型！',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取推荐失败',
    });
  }
});

// 获取离线队列
mobileEdgeRouter.get('/offline-queue/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const queue = mobileEdgeAI.getOfflineQueue(deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId,
        queue,
        count: queue.length,
      },
      message: queue.length > 0 
        ? `有${queue.length}条待处理的离线请求` 
        : '离线队列为空',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取离线队列失败',
    });
  }
});

// 同步离线队列
mobileEdgeRouter.post('/sync/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await mobileEdgeAI.syncOfflineQueue(deviceId);
    
    res.json({
      success: true,
      data: result,
      message: `同步完成：成功${result.synced}条，失败${result.failed}条`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '同步离线队列失败',
    });
  }
});

// 服务状态
mobileEdgeRouter.get('/status', (req, res) => {
  try {
    const status = mobileEdgeAI.getStatus();
    
    res.json({
      success: true,
      data: status,
      message: '移动边缘AI服务运行正常',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取状态失败',
    });
  }
});

console.log('[MobileEdge] Routes registered at /api/mobile/*');
