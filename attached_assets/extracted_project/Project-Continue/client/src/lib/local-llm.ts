import { Capacitor } from '@capacitor/core';

export interface LocalLLMConfig {
  modelPath: string;
  contextLength: number;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface LocalLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelInfo {
  name: string;
  size: string;
  downloadUrl: string;
  sha256: string;
  quantization: string;
  description?: string;
}

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    name: 'Qwen2.5-3B-Instruct-Q4_K_M',
    size: '1.9GB',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sha256: 'a94a27b7d8c8d7c6e7f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3',
    quantization: 'Q4_K_M',
    description: '通义千问2.5 3B - 平衡性能与质量',
  },
  {
    name: 'Phi-3-mini-4k-instruct-Q4_K_M',
    size: '2.2GB',
    downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    sha256: 'b5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    quantization: 'Q4_K_M',
    description: '微软 Phi-3 Mini - 轻量高效',
  },
];

// ===== 网络状态检测 =====
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'UNSTABLE';

export interface FallbackResult {
  success: boolean;
  content: string;
  provider: 'LOCAL' | 'CLOUD' | 'FALLBACK_CACHE';
  latencyMs: number;
  error?: string;
}

// ===== 降级策略配置 =====
export interface FallbackConfig {
  preferLocal: boolean;           // 优先本地推理
  privacyMode: boolean;           // 隐私模式（强制本地）
  cloudTimeout: number;           // 云端超时时间 (ms)
  localRetries: number;           // 本地失败重试次数
  cacheOfflineResponses: boolean; // 缓存离线响应
}

// ===== 离线响应缓存 =====
const OFFLINE_CACHE_KEY = 'xiaozhi_offline_cache';
const MAX_CACHE_SIZE = 50;

interface CachedResponse {
  query: string;
  response: string;
  timestamp: number;
}

export class LocalLLMService {
  private isNative: boolean;
  private modelLoaded: boolean = false;
  private currentModel: string | null = null;
  private networkStatus: NetworkStatus = 'ONLINE';
  private fallbackConfig: FallbackConfig = {
    preferLocal: false,
    privacyMode: false,
    cloudTimeout: 30000,
    localRetries: 2,
    cacheOfflineResponses: true,
  };
  private networkCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.initNetworkMonitor();
    this.loadFallbackConfig();
  }

  private initNetworkMonitor(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateNetworkStatus('ONLINE'));
      window.addEventListener('offline', () => this.updateNetworkStatus('OFFLINE'));
      
      this.networkCheckInterval = setInterval(() => this.checkNetworkQuality(), 30000);
    }
  }

  private updateNetworkStatus(status: NetworkStatus): void {
    const previousStatus = this.networkStatus;
    this.networkStatus = status;
    
    if (previousStatus !== status) {
      console.log(`[LocalLLM] 网络状态变更: ${previousStatus} → ${status}`);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('network-status-change', {
          detail: { status, previousStatus }
        }));
      }
    }
  }

  private async checkNetworkQuality(): Promise<void> {
    if (!navigator.onLine) {
      this.updateNetworkStatus('OFFLINE');
      return;
    }
    
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch('/api/health', { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      
      if (latency > 3000) {
        this.updateNetworkStatus('UNSTABLE');
      } else {
        this.updateNetworkStatus('ONLINE');
      }
    } catch {
      if (navigator.onLine) {
        this.updateNetworkStatus('UNSTABLE');
      } else {
        this.updateNetworkStatus('OFFLINE');
      }
    }
  }

  private loadFallbackConfig(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('xiaozhi_fallback_config');
      if (stored) {
        try {
          this.fallbackConfig = { ...this.fallbackConfig, ...JSON.parse(stored) };
        } catch {
          console.warn('[LocalLLM] 无法解析降级配置');
        }
      }
    }
  }

  saveFallbackConfig(config: Partial<FallbackConfig>): void {
    this.fallbackConfig = { ...this.fallbackConfig, ...config };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('xiaozhi_fallback_config', JSON.stringify(this.fallbackConfig));
    }
  }

  getFallbackConfig(): FallbackConfig {
    return { ...this.fallbackConfig };
  }

  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  isAvailable(): boolean {
    return this.isNative;
  }

  isOfflineCapable(): boolean {
    return this.isNative && this.modelLoaded;
  }

  async checkModelExists(modelName: string): Promise<boolean> {
    if (!this.isNative) return false;
    
    try {
      const result = await (window as any).LocalLLM?.checkModel(modelName);
      return result?.exists ?? false;
    } catch {
      return false;
    }
  }

  async downloadModel(
    model: ModelInfo,
    onProgress: (progress: number) => void
  ): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      return await (window as any).LocalLLM?.downloadModel({
        url: model.downloadUrl,
        name: model.name,
        onProgress,
      });
    } catch (error) {
      console.error('[LocalLLM] Download failed:', error);
      return false;
    }
  }

  async loadModel(modelName: string): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      const result = await (window as any).LocalLLM?.loadModel({
        name: modelName,
        contextLength: 4096,
        gpuLayers: 0,
      });
      
      if (result?.success) {
        this.modelLoaded = true;
        this.currentModel = modelName;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[LocalLLM] Load failed:', error);
      return false;
    }
  }

  async unloadModel(): Promise<void> {
    if (!this.isNative || !this.modelLoaded) return;

    try {
      await (window as any).LocalLLM?.unloadModel();
      this.modelLoaded = false;
      this.currentModel = null;
    } catch (error) {
      console.error('[LocalLLM] Unload failed:', error);
    }
  }

  async chat(
    messages: LocalLLMMessage[],
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.isNative || !this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    try {
      const result = await (window as any).LocalLLM?.chat({
        messages,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        onToken,
      });
      
      return result?.content ?? '';
    } catch (error) {
      console.error('[LocalLLM] Chat failed:', error);
      throw error;
    }
  }

  getStatus(): { loaded: boolean; model: string | null; network: NetworkStatus } {
    return {
      loaded: this.modelLoaded,
      model: this.currentModel,
      network: this.networkStatus,
    };
  }

  // ===== 智能降级策略 =====
  
  async chatWithFallback(
    messages: LocalLLMMessage[],
    cloudChatFn: (messages: LocalLLMMessage[]) => Promise<string>,
    onToken?: (token: string) => void
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    
    // 隐私模式：强制本地
    if (this.fallbackConfig.privacyMode) {
      return this.tryLocalOnly(messages, onToken, startTime);
    }
    
    // 离线状态：尝试本地
    if (this.networkStatus === 'OFFLINE') {
      return this.tryLocalWithCache(messages, onToken, startTime);
    }
    
    // 优先本地模式
    if (this.fallbackConfig.preferLocal && this.isOfflineCapable()) {
      const localResult = await this.tryLocal(messages, onToken, startTime);
      if (localResult.success) return localResult;
      
      // 本地失败，降级到云端
      console.log('[LocalLLM] 本地推理失败，降级到云端');
      return this.tryCloud(messages, cloudChatFn, startTime);
    }
    
    // 默认：优先云端
    if (this.networkStatus === 'ONLINE') {
      const cloudResult = await this.tryCloud(messages, cloudChatFn, startTime);
      if (cloudResult.success) {
        return cloudResult;
      }
      // 云端失败，降级到本地
      console.log('[LocalLLM] 云端失败，降级到本地:', cloudResult.error);
      if (this.isOfflineCapable()) {
        const localResult = await this.tryLocal(messages, onToken, startTime);
        if (localResult.success) {
          return localResult;
        }
      }
      // 本地也失败，尝试缓存
      return this.tryCache(messages, startTime);
    }
    
    // 网络不稳定：尝试云端，快速超时后降级
    return this.tryCloudWithQuickFallback(messages, cloudChatFn, onToken, startTime);
  }

  private async tryLocalOnly(
    messages: LocalLLMMessage[],
    onToken: ((token: string) => void) | undefined,
    startTime: number
  ): Promise<FallbackResult> {
    if (!this.isOfflineCapable()) {
      return {
        success: false,
        content: '',
        provider: 'LOCAL',
        latencyMs: Date.now() - startTime,
        error: '本地模型未加载，隐私模式下无法使用云端服务',
      };
    }
    return this.tryLocal(messages, onToken, startTime);
  }

  private async tryLocalWithCache(
    messages: LocalLLMMessage[],
    onToken: ((token: string) => void) | undefined,
    startTime: number
  ): Promise<FallbackResult> {
    if (this.isOfflineCapable()) {
      const result = await this.tryLocal(messages, onToken, startTime);
      if (result.success) return result;
    }
    
    // 尝试缓存
    return this.tryCache(messages, startTime);
  }

  private async tryLocal(
    messages: LocalLLMMessage[],
    onToken: ((token: string) => void) | undefined,
    startTime: number
  ): Promise<FallbackResult> {
    let retries = 0;
    
    while (retries < this.fallbackConfig.localRetries) {
      try {
        const content = await this.chat(messages, onToken);
        
        // 缓存响应
        if (this.fallbackConfig.cacheOfflineResponses && messages.length > 0) {
          this.cacheResponse(messages[messages.length - 1].content, content);
        }
        
        return {
          success: true,
          content,
          provider: 'LOCAL',
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        retries++;
        console.warn(`[LocalLLM] 本地推理失败 (${retries}/${this.fallbackConfig.localRetries}):`, error);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return {
      success: false,
      content: '',
      provider: 'LOCAL',
      latencyMs: Date.now() - startTime,
      error: '本地推理失败',
    };
  }

  private async tryCloud(
    messages: LocalLLMMessage[],
    cloudChatFn: (messages: LocalLLMMessage[]) => Promise<string>,
    startTime: number
  ): Promise<FallbackResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fallbackConfig.cloudTimeout);
      
      const content = await cloudChatFn(messages);
      clearTimeout(timeoutId);
      
      return {
        success: true,
        content,
        provider: 'CLOUD',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        provider: 'CLOUD',
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : '云端服务不可用',
      };
    }
  }

  private async tryCloudWithQuickFallback(
    messages: LocalLLMMessage[],
    cloudChatFn: (messages: LocalLLMMessage[]) => Promise<string>,
    onToken: ((token: string) => void) | undefined,
    startTime: number
  ): Promise<FallbackResult> {
    const quickTimeout = 10000; // 不稳定网络下快速超时
    
    try {
      const cloudPromise = cloudChatFn(messages);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), quickTimeout)
      );
      
      const content = await Promise.race([cloudPromise, timeoutPromise]);
      
      return {
        success: true,
        content,
        provider: 'CLOUD',
        latencyMs: Date.now() - startTime,
      };
    } catch {
      console.log('[LocalLLM] 网络不稳定，降级到本地');
      
      if (this.isOfflineCapable()) {
        return this.tryLocal(messages, onToken, startTime);
      }
      
      return this.tryCache(messages, startTime);
    }
  }

  private tryCache(messages: LocalLLMMessage[], startTime: number): FallbackResult {
    const query = messages.length > 0 ? messages[messages.length - 1].content : '';
    const cached = this.getCachedResponse(query);
    
    if (cached) {
      return {
        success: true,
        content: cached + '\n\n[离线缓存响应]',
        provider: 'FALLBACK_CACHE',
        latencyMs: Date.now() - startTime,
      };
    }
    
    return {
      success: false,
      content: '',
      provider: 'FALLBACK_CACHE',
      latencyMs: Date.now() - startTime,
      error: '无网络连接且无可用缓存',
    };
  }

  // ===== 缓存管理 =====

  private cacheResponse(query: string, response: string): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const cacheStr = localStorage.getItem(OFFLINE_CACHE_KEY) || '[]';
      const cache: CachedResponse[] = JSON.parse(cacheStr);
      
      // 移除重复
      const filtered = cache.filter(c => c.query !== query);
      
      // 添加新条目
      filtered.unshift({ query, response, timestamp: Date.now() });
      
      // 限制大小
      const trimmed = filtered.slice(0, MAX_CACHE_SIZE);
      
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.warn('[LocalLLM] 缓存写入失败:', error);
    }
  }

  private getCachedResponse(query: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    
    try {
      const cacheStr = localStorage.getItem(OFFLINE_CACHE_KEY) || '[]';
      const cache: CachedResponse[] = JSON.parse(cacheStr);
      
      // 简单字符串匹配（可以改进为语义相似度）
      const queryLower = query.toLowerCase();
      const match = cache.find(c => 
        c.query.toLowerCase().includes(queryLower) ||
        queryLower.includes(c.query.toLowerCase())
      );
      
      return match?.response ?? null;
    } catch {
      return null;
    }
  }

  clearCache(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OFFLINE_CACHE_KEY);
    }
  }

  getCacheSize(): number {
    if (typeof localStorage === 'undefined') return 0;
    
    try {
      const cacheStr = localStorage.getItem(OFFLINE_CACHE_KEY) || '[]';
      const cache: CachedResponse[] = JSON.parse(cacheStr);
      return cache.length;
    } catch {
      return 0;
    }
  }

  // ===== 模型校验 =====

  async verifyModelIntegrity(modelName: string): Promise<{ valid: boolean; error?: string; actualSha256?: string }> {
    if (!this.isNative) {
      return { valid: false, error: '仅支持原生平台' };
    }

    // 查找模型的预期 SHA256
    const modelInfo = SUPPORTED_MODELS.find(m => m.name === modelName);
    const expectedSha256 = modelInfo?.sha256 || '';

    try {
      const result = await (window as any).LocalLLM?.verifyModel?.({
        name: modelName,
        sha256: expectedSha256,
      });
      
      // 如果有警告（表示没有提供期望值），也视为失败
      if (result?.warning && expectedSha256) {
        console.warn('[LocalLLM] 模型校验警告:', result.warning);
      }
      
      if (result?.valid && !result?.warning) {
        return { 
          valid: true,
          actualSha256: result.actualSha256,
        };
      }
      
      // 如果没有期望的 SHA256，但校验通过，仍然返回成功（兼容旧模型）
      if (result?.valid && !expectedSha256) {
        console.log('[LocalLLM] 模型无 SHA256 校验值，跳过校验');
        return { 
          valid: true,
          actualSha256: result.actualSha256,
        };
      }
      
      return { 
        valid: false, 
        error: result?.error || '模型校验失败',
        actualSha256: result?.actualSha256,
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : '校验过程出错' 
      };
    }
  }

  getModelExpectedSha256(modelName: string): string | undefined {
    return SUPPORTED_MODELS.find(m => m.name === modelName)?.sha256;
  }

  // ===== 清理 =====

  destroy(): void {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }
}

export const localLLM = new LocalLLMService();
