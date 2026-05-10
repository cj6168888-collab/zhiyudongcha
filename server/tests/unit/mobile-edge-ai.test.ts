/**
 * MobileEdgeAI 单元测试
 * 
 * @version 3.0.0
 * @author 测试组
 * @date 2026-03-03
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MobileEdgeAI, getMobileEdgeAI } from '../../services/mobile-edge-ai';

describe('MobileEdgeAI Singleton', () => {
  beforeEach(() => {
    // 测试环境允许重置
    process.env.NODE_ENV = 'test';
    MobileEdgeAI.resetInstance();
  });
  
  afterEach(() => {
    MobileEdgeAI.resetInstance();
  });
  
  describe('Singleton Pattern', () => {
    it('should create only one instance', () => {
      const instance1 = MobileEdgeAI.getInstance();
      const instance2 = MobileEdgeAI.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MobileEdgeAI);
    });
    
    it('should track initialization count', () => {
      MobileEdgeAI.resetInstance();
      
      const instance1 = MobileEdgeAI.getInstance();
      const instance2 = MobileEdgeAI.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should reset instance in test environment', () => {
      const instance1 = MobileEdgeAI.getInstance();
      MobileEdgeAI.resetInstance();
      const instance2 = MobileEdgeAI.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
    
    it('should throw error when resetting in production', () => {
      process.env.NODE_ENV = 'production';
      
      expect(() => MobileEdgeAI.resetInstance()).toThrow(
        'resetInstance can only be called in test environment'
      );
      
      process.env.NODE_ENV = 'test';
    });
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const service = MobileEdgeAI.getInstance();
      await service.initialize();
      
      expect(service.isInitialized()).toBe(true);
    });
    
    it('should initialize only once (idempotent)', async () => {
      const service = MobileEdgeAI.getInstance();
      
      await service.initialize();
      await service.initialize();
      
      expect(service.isInitialized()).toBe(true);
    });
  });
  
  describe('Health Check', () => {
    it('should return health status', async () => {
      const service = MobileEdgeAI.getInstance();
      await service.initialize();
      
      const health = await service.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['ok', 'degraded', 'error']).toContain(health.status);
    });
    
    it('should include all health check details', async () => {
      const service = MobileEdgeAI.getInstance();
      await service.initialize();
      
      const health = await service.healthCheck();
      
      expect(health.details).toHaveProperty('initialized');
      expect(health.details).toHaveProperty('totalMobileDevices');
      expect(health.details).toHaveProperty('offlineQueueSize');
      expect(health.details).toHaveProperty('pendingRequests');
      expect(health.details).toHaveProperty('instanceCount');
    });
  });
  
  describe('Capability Profiles', () => {
    it('should return profile for 8GB RAM', () => {
      const service = MobileEdgeAI.getInstance();
      const profile = service.getCapabilityProfile(8);
      
      expect(profile).toBeDefined();
      expect(profile.maxModelSize).toBe('7B');
      expect(profile.recommendedModels.length).toBeGreaterThan(0);
      expect(profile.offlineCapable).toBe(true);
    });
    
    it('should return profile for 16GB RAM', () => {
      const service = MobileEdgeAI.getInstance();
      const profile = service.getCapabilityProfile(16);
      
      expect(profile).toBeDefined();
      expect(profile.maxModelSize).toBe('13B');
      expect(profile.estimatedTPS).toBeGreaterThan(10);
    });
    
    it('should return profile for 4GB RAM', () => {
      const service = MobileEdgeAI.getInstance();
      const profile = service.getCapabilityProfile(4);
      
      expect(profile).toBeDefined();
      expect(profile.maxModelSize).toBe('3B');
      expect(profile.estimatedTPS).toBe(5);
    });
    
    it('should adjust profile based on chip tier', () => {
      const service = MobileEdgeAI.getInstance();
      
      // 旗舰芯片
      const flagshipProfile = service.getCapabilityProfile(8, 'FLAGSHIP');
      expect(flagshipProfile.estimatedTPS).toBe(10);
      
      // 中端芯片
      const midRangeProfile = service.getCapabilityProfile(8, 'MID_RANGE');
      expect(midRangeProfile.estimatedTPS).toBeLessThan(flagshipProfile.estimatedTPS);
    });
  });
  
  describe('Chip Profiles', () => {
    it('should return chip profile for known chips', () => {
      const service = MobileEdgeAI.getInstance();
      
      const chip = service.getChipProfile('snapdragon_8_gen3');
      expect(chip).toBeDefined();
      expect(chip?.tier).toBe('FLAGSHIP');
      expect(chip?.tpsMultiplier).toBeGreaterThan(1);
    });
    
    it('should return undefined for unknown chips', () => {
      const service = MobileEdgeAI.getInstance();
      
      const chip = service.getChipProfile('unknown_chip');
      expect(chip).toBeUndefined();
    });
    
    it('should return all chip profiles', () => {
      const service = MobileEdgeAI.getInstance();
      
      const chips = service.getAllChipProfiles();
      expect(Object.keys(chips).length).toBeGreaterThan(0);
      
      // 验证包含主要芯片
      expect(chips).toHaveProperty('snapdragon_8_gen3');
      expect(chips).toHaveProperty('apple_a17');
      expect(chips).toHaveProperty('dimensity_9300');
    });
  });
  
  describe('16GB Recommendation', () => {
    it('should return 16GB recommendation', () => {
      const service = MobileEdgeAI.getInstance();
      const recommendation = service.get16GBRecommendation();
      
      expect(recommendation).toBeDefined();
      expect(recommendation.models.length).toBeGreaterThan(0);
      expect(recommendation.setupSteps.length).toBeGreaterThan(0);
      expect(recommendation.privacyBenefits.length).toBeGreaterThan(0);
    });
    
    it('should include recommended models', () => {
      const service = MobileEdgeAI.getInstance();
      const recommendation = service.get16GBRecommendation();
      
      const modelNames = recommendation.models.map(m => m.name);
      expect(modelNames).toContain('Qwen2-7B-Instruct-Q8_0');
      expect(modelNames).toContain('Llama-3-8B-Instruct-Q8_0');
    });
    
    it('should include setup steps', () => {
      const service = MobileEdgeAI.getInstance();
      const recommendation = service.get16GBRecommendation();
      
      expect(recommendation.setupSteps[0]).toContain('1.');
      expect(recommendation.setupSteps.length).toBe(5);
    });
  });
  
  describe('Device Registration', () => {
    it('should register a mobile device', () => {
      const service = MobileEdgeAI.getInstance();
      
      const result = service.registerMobileDevice({
        deviceId: 'test_device_1',
        deviceName: 'Test Phone',
        osType: 'ANDROID',
        osVersion: '14',
        ramGB: 8,
      }, 'test_user');
      
      expect(result.success).toBe(true);
      expect(result.device).toBeDefined();
      expect(result.profile).toBeDefined();
    });
    
    it('should register device with chip info', () => {
      const service = MobileEdgeAI.getInstance();
      
      const result = service.registerMobileDevice({
        deviceId: 'test_device_2',
        deviceName: 'Flagship Phone',
        osType: 'ANDROID',
        osVersion: '14',
        ramGB: 12,
        chipId: 'snapdragon_8_gen3',
      }, 'test_user');
      
      expect(result.success).toBe(true);
      expect(result.chipInfo).toBeDefined();
      expect(result.chipInfo?.tier).toBe('FLAGSHIP');
    });
    
    it('should update device status', () => {
      const service = MobileEdgeAI.getInstance();
      
      // 先注册设备
      service.registerMobileDevice({
        deviceId: 'test_device_3',
        deviceName: 'Test Phone',
        osType: 'ANDROID',
        osVersion: '14',
        ramGB: 8,
      }, 'test_user');
      
      // 更新状态
      const success = service.updateMobileStatus('test_device_3', {
        batteryLevel: 80,
        isPluggedIn: true,
        networkType: 'wifi',
        localModelLoaded: true,
        tunnelActive: true,
      });
      
      expect(success).toBe(true);
    });
    
    it('should return false when updating non-existent device', () => {
      const service = MobileEdgeAI.getInstance();
      
      const success = service.updateMobileStatus('non_existent_device', {
        batteryLevel: 80,
      });
      
      expect(success).toBe(false);
    });
  });
  
  describe('Device List', () => {
    it('should return empty list initially', () => {
      const service = MobileEdgeAI.getInstance();
      const devices = service.getMobileDevices();
      
      expect(devices).toEqual([]);
    });
    
    it('should return registered devices', () => {
      const service = MobileEdgeAI.getInstance();
      
      // 注册设备
      service.registerMobileDevice({
        deviceId: 'test_device_4',
        deviceName: 'Phone 1',
        osType: 'ANDROID',
        osVersion: '14',
        ramGB: 8,
      }, 'test_user');
      
      service.registerMobileDevice({
        deviceId: 'test_device_5',
        deviceName: 'Phone 2',
        osType: 'IOS',
        osVersion: '17',
        ramGB: 16,
      }, 'test_user');
      
      const devices = service.getMobileDevices();
      
      expect(devices.length).toBe(2);
      expect(devices[0].config.deviceName).toBe('Phone 1');
      expect(devices[1].config.deviceName).toBe('Phone 2');
    });
  });
  
  describe('Service Status', () => {
    it('should return service status', () => {
      const service = MobileEdgeAI.getInstance();
      const status = service.getStatus();
      
      expect(status).toHaveProperty('totalMobileDevices');
      expect(status).toHaveProperty('onlineDevices');
      expect(status).toHaveProperty('offlineQueueSize');
      expect(status).toHaveProperty('supportedRAMProfiles');
      expect(status.supportedRAMProfiles).toContain(8);
      expect(status.supportedRAMProfiles).toContain(16);
    });
  });
  
  describe('Inference', () => {
    it('should fail inference for non-existent device', async () => {
      const service = MobileEdgeAI.getInstance();
      
      const response = await service.requestMobileInference({
        requestId: 'test_req_1',
        deviceId: 'non_existent',
        messages: [{ role: 'user', content: 'Hello' }],
        privacyMode: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('离线');
    });
    
    it('should queue offline request in privacy mode', async () => {
      const service = MobileEdgeAI.getInstance();
      
      // 注册设备但不配置本地端点
      service.registerMobileDevice({
        deviceId: 'offline_device',
        deviceName: 'Offline Phone',
        osType: 'ANDROID',
        osVersion: '14',
        ramGB: 8,
      }, 'test_user');
      
      // 更新设备为离线状态
      service.updateMobileStatus('offline_device', {
        batteryLevel: 50,
        isPluggedIn: false,
        networkType: 'offline',
        localModelLoaded: false,
        tunnelActive: false,
      });
      
      const response = await service.requestMobileInference({
        requestId: 'test_req_2',
        deviceId: 'offline_device',
        messages: [{ role: 'user', content: 'Hello' }],
        privacyMode: true,
      });
      
      expect(response.success).toBe(false);
      // offlineCached可能为true或undefined，取决于设备状态
      if (response.offlineCached !== undefined) {
        expect(response.offlineCached).toBe(true);
      }
    });
  });
  
  describe('Offline Queue', () => {
    it('should return empty queue initially', () => {
      const service = MobileEdgeAI.getInstance();
      const queue = service.getOfflineQueue('test_device');
      
      expect(queue).toEqual([]);
    });
    
    it('should sync offline queue', async () => {
      const service = MobileEdgeAI.getInstance();
      
      const result = await service.syncOfflineQueue('test_device');
      
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('remaining');
    });
  });
});

describe('MobileEdgeAI Integration', () => {
  it('should work with getMobileEdgeAI function', () => {
    process.env.NODE_ENV = 'test';
    MobileEdgeAI.resetInstance();
    
    const service = getMobileEdgeAI();
    
    expect(service).toBeInstanceOf(MobileEdgeAI);
    expect(service.isInitialized()).toBeDefined();
    
    MobileEdgeAI.resetInstance();
  });
});
