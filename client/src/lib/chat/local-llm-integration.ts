import { Capacitor } from '@capacitor/core';
import type { FallbackConfig, FallbackResult, LocalModelInfo } from './types';

const OFFLINE_CACHE_KEY = 'xiaozhi_offline_cache';
const CONFIG_STORAGE_KEY = 'xiaozhi_local_llm_config';

const DEFAULT_CONFIG: FallbackConfig = {
  preferLocal: false,
  privacyMode: false,
  cloudTimeout: 30000,
  localRetries: 2,
  cacheOfflineResponses: true,
  maxCacheSize: 50,
};

interface CachedResponse {
  query: string;
  response: string;
  timestamp: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LocalLLMIntegration {
  private isNative: boolean;
  private modelLoaded = false;
  private currentModel: string | null = null;
  private networkStatus: 'ONLINE' | 'OFFLINE' | 'UNSTABLE' = 'ONLINE';
  private config: FallbackConfig = { ...DEFAULT_CONFIG };
  private networkCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.loadConfig();
    this.initNetworkMonitor();
  }

  private loadConfig(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch {
      console.warn('[LocalLLM] 无法加载配置');
    }
  }

  private saveConfig(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      console.warn('[LocalLLM] 无法保存配置');
    }
  }

  private initNetworkMonitor(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.updateNetworkStatus('ONLINE'));
    window.addEventListener('offline', () => this.updateNetworkStatus('OFFLINE'));

    this.networkCheckTimer = setInterval(() => this.checkNetworkQuality(), 30000);
  }

  private updateNetworkStatus(
    status: 'ONLINE' | 'OFFLINE' | 'UNSTABLE'
  ): void {
    const previous = this.networkStatus;
    this.networkStatus = status;

    if (previous !== status) {

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('network-status-change', {
            detail: { status, previous },
          })
        );
      }
    }
  }

  private async checkNetworkQuality(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
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
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - start;

      this.updateNetworkStatus(latency > 3000 ? 'UNSTABLE' : 'ONLINE');
    } catch {
      this.updateNetworkStatus(
        navigator.onLine ? 'UNSTABLE' : 'OFFLINE'
      );
    }
  }

  setConfig(config: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  getNetworkStatus(): 'ONLINE' | 'OFFLINE' | 'UNSTABLE' {
    return this.networkStatus;
  }

  isAvailable(): boolean {
    return this.isNative;
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  async checkModelExists(modelName: string): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      const result = await (window as { LocalLLM?: { checkModel: (name: string) => Promise<{ exists: boolean }> } }).LocalLLM?.checkModel?.(modelName);
      return result?.exists ?? false;
    } catch {
      return false;
    }
  }

  async downloadModel(
    model: LocalModelInfo,
    onProgress: (progress: number) => void
  ): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      return await (window as { LocalLLM?: { downloadModel: (params: { url: string; name: string; onProgress: (p: number) => void }) => Promise<boolean> } }).LocalLLM?.downloadModel?.({
        url: model.downloadUrl,
        name: model.name,
        onProgress,
      }) ?? false;
    } catch (error) {
      console.error('[LocalLLM] 下载失败:', error);
      return false;
    }
  }

  async loadModel(modelName: string): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      const result = await (window as { LocalLLM?: { loadModel: (params: { name: string; contextLength: number; gpuLayers: number }) => Promise<{ success: boolean }> } }).LocalLLM?.loadModel?.({
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
      console.error('[LocalLLM] 加载失败:', error);
      return false;
    }
  }

  async unloadModel(): Promise<void> {
    if (!this.isNative || !this.modelLoaded) return;

    try {
      await (window as { LocalLLM?: { unloadModel: () => Promise<void> } }).LocalLLM?.unloadModel?.();
      this.modelLoaded = false;
      this.currentModel = null;
    } catch (error) {
      console.error('[LocalLLM] 卸载失败:', error);
    }
  }

  async chat(
    msgs: ChatMessage[],
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.isNative || !this.modelLoaded) {
      throw new Error('模型未加载');
    }

    try {
      const result = await (window as { LocalLLM?: { chat: (params: { messages: ChatMessage[]; temperature: number; topP: number; maxTokens: number; onToken?: (t: string) => void }) => Promise<{ content: string }> } }).LocalLLM?.chat?.({
        messages: msgs,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        onToken,
      });

      return result?.content ?? '';
    } catch (error) {
      console.error('[LocalLLM] 对话失败:', error);
      throw error;
    }
  }

  async chatWithFallback(
    msgs: ChatMessage[],
    cloudChatFn: (msgs: ChatMessage[]) => Promise<string>
  ): Promise<FallbackResult> {
    const startTime = Date.now();

    if (this.config.privacyMode) {
      return this.runLocalOnly(msgs, startTime);
    }

    if (this.networkStatus === 'OFFLINE') {
      return this.runLocalWithCache(msgs, startTime);
    }

    if (this.config.preferLocal && this.modelLoaded) {
      const localResult = await this.runLocal(msgs, startTime);
      if (localResult.success) return localResult;

      return this.runCloud(msgs, cloudChatFn, startTime);
    }

    if (this.networkStatus === 'ONLINE') {
      const cloudResult = await this.runCloud(msgs, cloudChatFn, startTime);
      if (cloudResult.success) return cloudResult;

      if (this.modelLoaded) {
        const localResult = await this.runLocal(msgs, startTime);
        if (localResult.success) return localResult;
      }
      return this.runCache(msgs, startTime);
    }

    return this.runCloudWithQuickFallback(msgs, cloudChatFn, startTime);
  }

  private async runLocalOnly(
    msgs: ChatMessage[],
    startTime: number
  ): Promise<FallbackResult> {
    if (!this.modelLoaded) {
      return {
        success: false,
        content: '',
        provider: 'LOCAL',
        latencyMs: Date.now() - startTime,
        error: '本地模型未加载，隐私模式下无法使用云端',
      };
    }
    return this.runLocal(msgs, startTime);
  }

  private async runLocalWithCache(
    msgs: ChatMessage[],
    startTime: number
  ): Promise<FallbackResult> {
    if (this.modelLoaded) {
      const result = await this.runLocal(msgs, startTime);
      if (result.success) return result;
    }
    return this.runCache(msgs, startTime);
  }

  private async runLocal(
    msgs: ChatMessage[],
    startTime: number
  ): Promise<FallbackResult> {
    let retries = 0;

    while (retries < this.config.localRetries) {
      try {
        const content = await this.chat(msgs);

        if (this.config.cacheOfflineResponses && msgs.length > 0) {
          this.cacheResponse(msgs[msgs.length - 1].content, content);
        }

        return {
          success: true,
          content,
          provider: 'LOCAL',
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        retries++;
        console.warn(`[LocalLLM] 本地推理失败 (${retries}/${this.config.localRetries})`);
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

  private async runCloud(
    msgs: ChatMessage[],
    cloudChatFn: (msgs: ChatMessage[]) => Promise<string>,
    startTime: number
  ): Promise<FallbackResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.cloudTimeout);

      const content = await cloudChatFn(msgs);
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
        error: error instanceof Error ? error.message : '云端不可用',
      };
    }
  }

  private async runCloudWithQuickFallback(
    msgs: ChatMessage[],
    cloudChatFn: (msgs: ChatMessage[]) => Promise<string>,
    startTime: number
  ): Promise<FallbackResult> {
    const quickTimeout = 10000;

    try {
      const cloudPromise = cloudChatFn(msgs);
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

      if (this.modelLoaded) {
        return this.runLocal(msgs, startTime);
      }
      return this.runCache(msgs, startTime);
    }
  }

  private runCache(
    msgs: ChatMessage[],
    startTime: number
  ): FallbackResult {
    const query = msgs.length > 0 ? msgs[msgs.length - 1].content : '';
    const cached = this.getCachedResponse(query);

    if (cached) {
      return {
        success: true,
        content: `${cached}\n\n[离线缓存]`,
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

  private cacheResponse(query: string, response: string): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const cacheStr = localStorage.getItem(OFFLINE_CACHE_KEY) || '[]';
      const cache: CachedResponse[] = JSON.parse(cacheStr);

      const filtered = cache.filter(c => c.query !== query);
      filtered.unshift({ query, response, timestamp: Date.now() });

      const trimmed = filtered.slice(0, this.config.maxCacheSize);
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.warn('[LocalLLM] 缓存失败:', error);
    }
  }

  private getCachedResponse(query: string): string | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const cacheStr = localStorage.getItem(OFFLINE_CACHE_KEY) || '[]';
      const cache: CachedResponse[] = JSON.parse(cacheStr);

      const queryLower = query.toLowerCase();
      const match = cache.find(
        c =>
          c.query.toLowerCase().includes(queryLower) ||
          queryLower.includes(c.query.toLowerCase())
      );

      return match?.response ?? null;
    } catch {
      return null;
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

  clearCache(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OFFLINE_CACHE_KEY);
    }
  }

  getStatus(): {
    loaded: boolean;
    model: string | null;
    network: 'ONLINE' | 'OFFLINE' | 'UNSTABLE';
  } {
    return {
      loaded: this.modelLoaded,
      model: this.currentModel,
      network: this.networkStatus,
    };
  }

  destroy(): void {
    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
    }
  }
}

export const localLLM = new LocalLLMIntegration();
