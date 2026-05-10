/**
 * 小智 Mobile Edge AI - 移动端本地AI服务
 * 
 * 功能：
 * 1. 移动设备注册和能力申报
 * 2. 远程调用手机端llama.cpp推理
 * 3. 智能路由（隐私模式/离线模式）
 * 4. 对话缓存和同步队列
 */

import { deviceRegistry, type DeviceInfo, type DeviceCapabilities } from './device-registry';
import type { ChatMessage } from './dashscope';

// ===== 移动设备配置 =====
export interface MobileDeviceConfig {
  deviceId: string;
  deviceName: string;
  osType: 'ANDROID' | 'IOS' | 'HARMONYOS';
  osVersion: string;
  ramGB: number;
  chipId?: string;         // 芯片型号ID (e.g., snapdragon_778g)
  localEndpoint?: string;  // 手机端llama.cpp API地址
  localModel?: string;     // 已下载的本地模型
  tunnelUrl?: string;      // 穿透隧道地址（用于远程调用）
}

// ===== 移动端能力档案 =====
export interface MobileCapabilityProfile {
  maxModelSize: '3B' | '7B' | '13B';
  recommendedModels: string[];
  quantization: 'Q4_K_M' | 'Q5_K_M' | 'Q8_0';
  maxContextLength: number;
  estimatedTPS: number;  // Tokens Per Second
  offlineCapable: boolean;
}

// ===== 芯片性能等级 =====
export type ChipTier = 'FLAGSHIP' | 'HIGH_END' | 'MID_RANGE' | 'ENTRY';

export interface ChipProfile {
  name: string;
  tier: ChipTier;
  tpsMultiplier: number;
}

// 常见芯片性能档案
export const CHIP_PROFILES: Record<string, ChipProfile> = {
  // 旗舰芯片
  'snapdragon_8_gen3': { name: '骁龙8 Gen3', tier: 'FLAGSHIP', tpsMultiplier: 1.3 },
  'snapdragon_8_gen2': { name: '骁龙8 Gen2', tier: 'FLAGSHIP', tpsMultiplier: 1.2 },
  'snapdragon_8_gen1': { name: '骁龙8 Gen1', tier: 'FLAGSHIP', tpsMultiplier: 1.0 },
  'dimensity_9300': { name: '天玑9300', tier: 'FLAGSHIP', tpsMultiplier: 1.25 },
  'dimensity_9200': { name: '天玑9200', tier: 'FLAGSHIP', tpsMultiplier: 1.15 },
  'kirin_9000': { name: '麒麟9000', tier: 'FLAGSHIP', tpsMultiplier: 1.0 },
  'apple_a17': { name: 'Apple A17', tier: 'FLAGSHIP', tpsMultiplier: 1.4 },
  // 高端芯片
  'snapdragon_888': { name: '骁龙888', tier: 'HIGH_END', tpsMultiplier: 0.85 },
  'snapdragon_870': { name: '骁龙870', tier: 'HIGH_END', tpsMultiplier: 0.8 },
  'dimensity_8300': { name: '天玑8300', tier: 'HIGH_END', tpsMultiplier: 0.9 },
  // 中端芯片
  'snapdragon_778g': { name: '骁龙778G', tier: 'MID_RANGE', tpsMultiplier: 0.5 },
  'snapdragon_7_gen1': { name: '骁龙7 Gen1', tier: 'MID_RANGE', tpsMultiplier: 0.55 },
  'dimensity_7200': { name: '天玑7200', tier: 'MID_RANGE', tpsMultiplier: 0.5 },
  'kirin_820': { name: '麒麟820', tier: 'MID_RANGE', tpsMultiplier: 0.45 },
  // 入门芯片
  'snapdragon_695': { name: '骁龙695', tier: 'ENTRY', tpsMultiplier: 0.3 },
  'snapdragon_680': { name: '骁龙680', tier: 'ENTRY', tpsMultiplier: 0.25 },
};

// ===== 推荐模型配置（按内存分级）=====
const MOBILE_MODEL_PROFILES: Record<number, MobileCapabilityProfile> = {
  4: {
    maxModelSize: '3B',
    recommendedModels: ['phi-3.5-mini-Q4_K_M', 'qwen2-1.5b-Q8_0'],
    quantization: 'Q4_K_M',
    maxContextLength: 2048,
    estimatedTPS: 5,
    offlineCapable: true,
  },
  6: {
    maxModelSize: '3B',
    recommendedModels: ['phi-3.5-mini-Q4_K_M', 'qwen2-3b-Q4_K_M'],
    quantization: 'Q4_K_M',
    maxContextLength: 2048,
    estimatedTPS: 8,
    offlineCapable: true,
  },
  8: {
    maxModelSize: '7B',
    recommendedModels: ['qwen2-7b-Q4_K_M', 'llama3-8b-Q4_K_M', 'phi-3.5-mini-Q8_0'],
    quantization: 'Q4_K_M',
    maxContextLength: 4096,
    estimatedTPS: 10,
    offlineCapable: true,
  },
  12: {
    maxModelSize: '7B',
    recommendedModels: ['qwen2-7b-Q5_K_M', 'llama3-8b-Q5_K_M', 'deepseek-7b-Q4_K_M'],
    quantization: 'Q5_K_M',
    maxContextLength: 8192,
    estimatedTPS: 15,
    offlineCapable: true,
  },
  16: {
    maxModelSize: '13B',
    recommendedModels: ['qwen2-7b-Q8_0', 'llama3-8b-Q8_0', 'qwen2-14b-Q4_K_M', 'deepseek-7b-Q8_0'],
    quantization: 'Q8_0',
    maxContextLength: 16384,
    estimatedTPS: 20,
    offlineCapable: true,
  },
};

// ===== 中端芯片专用推荐（如骁龙778G）=====
const MID_RANGE_CHIP_PROFILES: Record<number, MobileCapabilityProfile> = {
  8: {
    maxModelSize: '3B',
    recommendedModels: ['qwen2-3b-Q4_K_M', 'phi-3.5-mini-Q4_K_M'],
    quantization: 'Q4_K_M',
    maxContextLength: 2048,
    estimatedTPS: 3,
    offlineCapable: true,
  },
  12: {
    maxModelSize: '3B',
    recommendedModels: ['qwen2-3b-Q8_0', 'phi-3.5-mini-Q8_0', 'qwen2-7b-Q4_K_M'],
    quantization: 'Q4_K_M',
    maxContextLength: 4096,
    estimatedTPS: 4,
    offlineCapable: true,
  },
  16: {
    maxModelSize: '7B',
    recommendedModels: ['qwen2-3b-Q8_0', 'phi-3.5-mini-Q8_0', 'qwen2-7b-Q4_K_M'],
    quantization: 'Q4_K_M',
    maxContextLength: 4096,
    estimatedTPS: 3,
    offlineCapable: true,
  },
};

// ===== 离线对话缓存 =====
export interface OfflineConversation {
  id: string;
  deviceId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastSyncedAt: number | null;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT';
}

// ===== 移动推理请求 =====
export interface MobileInferenceRequest {
  requestId: string;
  deviceId: string;
  messages: ChatMessage[];
  privacyMode: boolean;  // true = 强制本地
  maxTokens?: number;
  temperature?: number;
}

// ===== 移动推理响应 =====
export interface MobileInferenceResponse {
  requestId: string;
  success: boolean;
  message?: string;
  error?: string;
  provider: 'MOBILE_LOCAL' | 'CLOUD' | 'FALLBACK';
  latencyMs: number;
  tokensGenerated?: number;
  deviceId?: string;
  offlineCached?: boolean;
}

// ===== Mobile Edge AI 服务 =====
export class MobileEdgeAI {
  private mobileDevices: Map<string, MobileDeviceConfig> = new Map();
  private offlineQueue: Map<string, OfflineConversation[]> = new Map();
  private pendingRequests: Map<string, {
    resolve: (response: MobileInferenceResponse) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  constructor() {
    console.log('[MobileEdgeAI] 移动边缘AI服务已启动');
  }
  
  // 根据RAM和芯片等级计算设备能力档案
  getCapabilityProfile(ramGB: number, chipTier?: ChipTier): MobileCapabilityProfile {
    const profiles = (chipTier === 'MID_RANGE' || chipTier === 'ENTRY') 
      ? MID_RANGE_CHIP_PROFILES 
      : MOBILE_MODEL_PROFILES;
    
    if (ramGB >= 16) return profiles[16] || MOBILE_MODEL_PROFILES[16];
    if (ramGB >= 12) return profiles[12] || MOBILE_MODEL_PROFILES[12];
    if (ramGB >= 8) return profiles[8] || MOBILE_MODEL_PROFILES[8];
    if (ramGB >= 6) return MOBILE_MODEL_PROFILES[6];
    return MOBILE_MODEL_PROFILES[4];
  }
  
  // 获取芯片信息
  getChipProfile(chipId: string): ChipProfile | undefined {
    return CHIP_PROFILES[chipId];
  }
  
  // 获取所有可用芯片列表
  getAllChipProfiles(): Record<string, ChipProfile> {
    return CHIP_PROFILES;
  }
  
  // 注册移动设备
  registerMobileDevice(config: MobileDeviceConfig, userId: string): {
    success: boolean;
    device?: DeviceInfo;
    profile?: MobileCapabilityProfile;
    chipInfo?: ChipProfile;
    error?: string;
  } {
    try {
      const chipInfo = config.chipId ? this.getChipProfile(config.chipId) : undefined;
      const chipTier = chipInfo?.tier;
      const profile = this.getCapabilityProfile(config.ramGB, chipTier);
      
      // 构建设备能力
      const capabilities: DeviceCapabilities = {
        canRunLocalModel: config.ramGB >= 4,
        localModelName: config.localModel,
        maxModelSize: profile.maxModelSize,
        gpuAvailable: true,  // 现代手机都有GPU
        gpuMemoryMB: config.ramGB * 512,  // 估算GPU共享内存
        canExecuteScreenActions: false,
        hasAccessibility: false,
        hasOCR: true,
        cpuCores: 8,
        memoryMB: config.ramGB * 1024,
        batteryLevel: 100,
        isPluggedIn: false,
        networkType: 'wifi',
        features: [
          'LOCAL_LLM',
          'OFFLINE_INFERENCE',
          'PRIVACY_MODE',
          `MAX_MODEL_${profile.maxModelSize}`,
          `QUANTIZATION_${profile.quantization}`,
          ...(chipInfo ? [`CHIP_${config.chipId?.toUpperCase()}`, `TIER_${chipInfo.tier}`] : []),
        ],
      };
      
      // 注册到设备中心
      const device = deviceRegistry.registerDevice(
        config.deviceId,
        config.deviceName,
        'MOBILE',
        capabilities,
        userId,
        'MASTER'
      );
      
      // 保存移动设备配置
      this.mobileDevices.set(config.deviceId, config);
      
      console.log(`[MobileEdgeAI] 移动设备已注册: ${config.deviceName}`);
      console.log(`[MobileEdgeAI] RAM: ${config.ramGB}GB, 芯片: ${chipInfo?.name || '未指定'}, 推荐模型: ${profile.recommendedModels.join(', ')}`);
      
      return {
        success: true,
        device,
        profile,
        chipInfo,
      };
    } catch (error) {
      console.error('[MobileEdgeAI] 设备注册失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
  
  // 更新移动设备状态
  updateMobileStatus(deviceId: string, status: {
    batteryLevel?: number;
    isPluggedIn?: boolean;
    networkType?: 'wifi' | 'cellular' | 'offline';
    localModelLoaded?: boolean;
    tunnelActive?: boolean;
  }): boolean {
    const config = this.mobileDevices.get(deviceId);
    const device = deviceRegistry.getDevice(deviceId);
    
    if (!config || !device) return false;
    
    // 更新心跳
    deviceRegistry.updateHeartbeat({
      deviceId,
      timestamp: Date.now(),
      status: status.networkType === 'offline' ? 'OFFLINE' : 'ONLINE',
      batteryLevel: status.batteryLevel,
    });
    
    return true;
  }
  
  // 发起移动端推理请求
  async requestMobileInference(
    request: MobileInferenceRequest
  ): Promise<MobileInferenceResponse> {
    const startTime = Date.now();
    const config = this.mobileDevices.get(request.deviceId);
    const device = deviceRegistry.getDevice(request.deviceId);
    
    // 检查设备是否在线
    if (!device || device.status === 'OFFLINE') {
      // 设备离线，加入离线队列
      if (request.privacyMode) {
        this.addToOfflineQueue(request);
        return {
          requestId: request.requestId,
          success: false,
          error: '设备离线，已加入等待队列',
          provider: 'FALLBACK',
          latencyMs: Date.now() - startTime,
          offlineCached: true,
        };
      }
      
      // 非隐私模式，可以使用云端
      return {
        requestId: request.requestId,
        success: false,
        error: '设备离线，请使用云端',
        provider: 'CLOUD',
        latencyMs: Date.now() - startTime,
      };
    }
    
    // 尝试调用移动设备本地推理
    if (config?.tunnelUrl || config?.localEndpoint) {
      try {
        const endpoint = config.tunnelUrl || config.localEndpoint;
        const response = await this.callMobileLocalModel(
          endpoint!,
          request.messages,
          config.localModel || 'default',
          request.maxTokens,
          request.temperature
        );
        
        return {
          requestId: request.requestId,
          success: true,
          message: response,
          provider: 'MOBILE_LOCAL',
          latencyMs: Date.now() - startTime,
          deviceId: request.deviceId,
        };
      } catch (error) {
        console.error('[MobileEdgeAI] 移动端推理失败:', error);
        
        if (request.privacyMode) {
          this.addToOfflineQueue(request);
          return {
            requestId: request.requestId,
            success: false,
            error: '推理失败，已加入离线队列',
            provider: 'FALLBACK',
            latencyMs: Date.now() - startTime,
            offlineCached: true,
          };
        }
      }
    }
    
    // 没有本地能力或失败，返回需要云端
    return {
      requestId: request.requestId,
      success: false,
      error: '移动设备未配置本地模型',
      provider: 'CLOUD',
      latencyMs: Date.now() - startTime,
    };
  }
  
  // 调用移动端本地模型（兼容llama.cpp server API）
  private async callMobileLocalModel(
    endpoint: string,
    messages: ChatMessage[],
    model: string,
    maxTokens: number = 512,
    temperature: number = 0.7
  ): Promise<string> {
    // llama.cpp server 使用的是 /completion 或 /v1/chat/completions 端点
    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    
    if (!response.ok) {
      throw new Error(`Mobile inference failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  // 添加到离线队列
  private addToOfflineQueue(request: MobileInferenceRequest): void {
    const conversation: OfflineConversation = {
      id: request.requestId,
      deviceId: request.deviceId,
      messages: request.messages,
      createdAt: Date.now(),
      lastSyncedAt: null,
      syncStatus: 'PENDING',
    };
    
    const queue = this.offlineQueue.get(request.deviceId) || [];
    queue.push(conversation);
    this.offlineQueue.set(request.deviceId, queue);
    
    console.log(`[MobileEdgeAI] 请求已加入离线队列: ${request.requestId}`);
  }
  
  // 获取离线队列
  getOfflineQueue(deviceId: string): OfflineConversation[] {
    return this.offlineQueue.get(deviceId) || [];
  }
  
  // 同步离线队列
  async syncOfflineQueue(deviceId: string): Promise<{
    synced: number;
    failed: number;
    remaining: OfflineConversation[];
  }> {
    const queue = this.offlineQueue.get(deviceId) || [];
    let synced = 0;
    let failed = 0;
    const remaining: OfflineConversation[] = [];
    
    for (const conversation of queue) {
      try {
        const response = await this.requestMobileInference({
          requestId: conversation.id,
          deviceId,
          messages: conversation.messages,
          privacyMode: true,
        });
        
        if (response.success) {
          conversation.syncStatus = 'SYNCED';
          conversation.lastSyncedAt = Date.now();
          synced++;
        } else {
          remaining.push(conversation);
          failed++;
        }
      } catch {
        remaining.push(conversation);
        failed++;
      }
    }
    
    this.offlineQueue.set(deviceId, remaining);
    
    return { synced, failed, remaining };
  }
  
  // 获取移动设备列表
  getMobileDevices(): Array<{
    config: MobileDeviceConfig;
    device?: DeviceInfo;
    profile: MobileCapabilityProfile;
  }> {
    const result: Array<{
      config: MobileDeviceConfig;
      device?: DeviceInfo;
      profile: MobileCapabilityProfile;
    }> = [];
    
    this.mobileDevices.forEach((config, deviceId) => {
      result.push({
        config,
        device: deviceRegistry.getDevice(deviceId),
        profile: this.getCapabilityProfile(config.ramGB),
      });
    });
    
    return result;
  }
  
  // 获取16GB设备推荐配置
  get16GBRecommendation(): {
    models: Array<{
      name: string;
      description: string;
      size: string;
      downloadUrl: string;
      quantization: string;
      performance: string;
    }>;
    setupSteps: string[];
    privacyBenefits: string[];
  } {
    return {
      models: [
        {
          name: 'Qwen2-7B-Instruct-Q8_0',
          description: '阿里通义千问2.0，中文能力最强',
          size: '7.7GB',
          downloadUrl: 'https://huggingface.co/Qwen/Qwen2-7B-Instruct-GGUF',
          quantization: 'Q8_0 (最高精度)',
          performance: '约20 tokens/秒',
        },
        {
          name: 'Llama-3-8B-Instruct-Q8_0',
          description: 'Meta最新模型，通用能力强',
          size: '8.5GB',
          downloadUrl: 'https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct-GGUF',
          quantization: 'Q8_0 (最高精度)',
          performance: '约18 tokens/秒',
        },
        {
          name: 'Qwen2-14B-Instruct-Q4_K_M',
          description: '14B大模型，更智能但稍慢',
          size: '8.1GB',
          downloadUrl: 'https://huggingface.co/Qwen/Qwen2-14B-Instruct-GGUF',
          quantization: 'Q4_K_M (平衡)',
          performance: '约12 tokens/秒',
        },
        {
          name: 'DeepSeek-Coder-7B-Q8_0',
          description: '编程专家，代码能力强',
          size: '7.2GB',
          downloadUrl: 'https://huggingface.co/deepseek-ai/deepseek-coder-7b-instruct-GGUF',
          quantization: 'Q8_0 (最高精度)',
          performance: '约20 tokens/秒',
        },
      ],
      setupSteps: [
        '1. 在手机上安装 MLC LLM 或 llama.cpp Android版',
        '2. 下载推荐的GGUF模型文件到手机',
        '3. 在App中加载模型并启动本地服务器',
        '4. 在小智设置中配置手机本地端点',
        '5. 开启隐私模式，享受离线AI体验',
      ],
      privacyBenefits: [
        '🔒 对话内容永不上传云端',
        '⚡ 本地推理延迟<2秒',
        '📴 断网也能正常使用',
        '💰 无需消耗云端额度',
        '🎯 专属个人AI助手',
      ],
    };
  }
  
  // 获取服务状态
  getStatus(): {
    totalMobileDevices: number;
    onlineDevices: number;
    offlineQueueSize: number;
    supportedRAMProfiles: number[];
  } {
    const onlineDevices = Array.from(this.mobileDevices.keys())
      .filter(id => {
        const device = deviceRegistry.getDevice(id);
        return device && device.status !== 'OFFLINE';
      }).length;
    
    let offlineQueueSize = 0;
    this.offlineQueue.forEach(queue => {
      offlineQueueSize += queue.length;
    });
    
    return {
      totalMobileDevices: this.mobileDevices.size,
      onlineDevices,
      offlineQueueSize,
      supportedRAMProfiles: [4, 6, 8, 12, 16],
    };
  }
}

// ===== 全局实例 =====
export const mobileEdgeAI = new MobileEdgeAI();
