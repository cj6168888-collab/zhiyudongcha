# 小智离线优先架构设计

## 一、核心设计理念

### 1.1 设计目标

```
┌─────────────────────────────────────────────────────────────────────┐
│                         小智离线优先架构                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  单模型模式  │    │  多模型模式  │    │  离线模式   │           │
│  │ (Single)    │    │ (Ensemble)  │    │ (Offline)   │           │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘           │
│         │                   │                   │                   │
│         └───────────────────┴───────────────────┘                   │
│                             │                                       │
│                    ┌────────▼────────┐                            │
│                    │  智能路由层      │                            │
│                    │  (Smart Router)  │                            │
│                    └────────┬────────┘                            │
│                             │                                      │
│         ┌───────────────────┼───────────────────┐                 │
│         │                   │                   │                 │
│    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐            │
│    │ 本地模型 │        │ 边缘服务 │        │  云端   │            │
│    │ (Ollama)│        │ (Edge)   │        │(Cloud)  │            │
│    └─────────┘        └─────────┘        └─────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心原则

1. **本地优先 (Local-First)**：默认使用本地资源，离线可用
2. **渐进式降级**：网络不稳定时自动降级到更快/更可靠的方案
3. **最终一致性**：断网时本地处理，联网后自动同步
4. **隐私保护**：敏感数据默认本地处理

---

## 二、架构分层设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端层 (Client)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      统一对话引擎 (UnifiedChatEngine)                 │    │
│  ├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤    │
│  │  对话管理   │  上下文管理  │  模型选择   │  消息队列   │  同步控制器  │    │
│  │  Manager    │  Context    │  Router     │  Queue      │  SyncCtrl    │    │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      本地模型运行时 (Local Runtime)                    │    │
│  ├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤    │
│  │  Ollama    │  WebLLM     │  ONNX       │  Transformers│  MLKit      │    │
│  │  (Linux)   │  (WebGPU)   │  Runtime    │ .js         │  (Android)  │    │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS / WebSocket / MQTT
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              服务层 (Server)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                       │
│  │    API Gateway        │  │   WebSocket Gateway  │                       │
│  │  (认证/限流/路由)      │  │   (实时消息)         │                       │
│  └──────────┬───────────┘  └──────────┬───────────┘                       │
│             │                         │                                    │
│  ┌──────────▼───────────┐  ┌─────────▼───────────┐                       │
│  │   消息同步服务         │  │   推理服务池          │                       │
│  │   (Sync Service)     │  │   (Inference Pool)  │                       │
│  │  - 冲突解决           │  │  - 请求队列          │                       │
│  │  - 离线消息存储       │  │  - 负载均衡          │                       │
│  │  - 增量同步           │  │  - 模型路由          │                       │
│  └──────────┬───────────┘  └─────────┬───────────┘                       │
│             │                        │                                    │
│  ┌──────────▼───────────┐  ┌─────────▼───────────┐                       │
│  │   持久化存储          │  │   外部AI服务         │                       │
│  │  (PostgreSQL/Redis)  │  │  - DeepSeek         │                       │
│  │  - 用户数据           │  │  - 通义千问          │                       │
│  │  - 消息历史           │  │  - 豆包             │                       │
│  │  - 配置同步           │  │  - Ollama           │                       │
│  └──────────────────────┘  └──────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 消息流设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              消息流程图                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   用户输入                                                                        │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────┐                                                               │
│  │ 消息拦截器    │  ← 敏感词检测 / 隐私过滤                                        │
│  └──────┬──────┘                                                               │
│         │                                                                        │
│         ▼                                                                        │
│  ┌─────────────┐                                                               │
│  │ 网络状态检测  │                                                               │
│  └──────┬──────┘                                                               │
│         │                                                                        │
│    ┌────┴────┐                                                                 │
│    │         │                                                                  │
│  ONLINE   OFFLINE                                                              │
│    │         │                                                                  │
│    ▼         ▼                                                                  │
│  ┌─────────┐ ┌─────────┐                                                       │
│  │智能路由  │ │本地处理  │                                                       │
│  │选择最优  │ │存入队列  │                                                       │
│  │模型     │ │等待同步  │                                                       │
│  └────┬────┘ └────┬────┘                                                       │
│       │          │                                                             │
│       ▼          ▼                                                             │
│  ┌─────────┐ ┌─────────┐                                                       │
│  │推理执行  │ │离线推理  │                                                       │
│  │        │ │本地LLM   │                                                       │
│  └────┬────┘ └────┬────┘                                                       │
│       │          │                                                             │
│       ▼          │                                                             │
│  ┌─────────┐    │                                                             │
│  │ 响应缓存 │    │                                                             │
│  │         │    │                                                             │
│  └────┬────┘    │                                                             │
│       │          │                                                             │
│       ▼          │                                                             │
│  ┌─────────┐    │                                                             │
│  │同步服务  │ ←─┘                                                             │
│  │推送云端  │                                                                  │
│  └─────────┘                                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 统一对话引擎 (UnifiedChatEngine)

```typescript
// client/src/lib/chat/unified-chat-engine.ts

import { EventEmitter } from 'events';
import { localLLMService, type FallbackResult } from '../local-llm';
import { messageQueue } from './message-queue';
import { syncController } from './sync-controller';
import { modelRouter } from './model-router';

export type ModelMode = 'SINGLE' | 'ENSEMBLE' | 'AUTO';
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'UNSTABLE';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  localOnly: boolean;
  modelUsed?: string;
}

export interface ChatConfig {
  mode: ModelMode;
  primaryModel: string;
  fallbackModels: string[];
  preferOffline: boolean;
  privacyMode: boolean;
  maxContextLength: number;
  temperature: number;
}

export interface ChatEngineOptions {
  userId: string;
  sessionId: string;
  config?: Partial<ChatConfig>;
}

export class UnifiedChatEngine extends EventEmitter {
  private config: ChatConfig;
  private messages: ChatMessage[] = [];
  private networkStatus: NetworkStatus = 'ONLINE';
  private isProcessing = false;
  
  constructor(private options: ChatEngineOptions) {
    super();
    this.config = this.buildConfig(options.config);
    this.initNetworkMonitor();
    this.loadMessageHistory();
  }
  
  private buildConfig(userConfig?: Partial<ChatConfig>): ChatConfig {
    return {
      mode: userConfig?.mode || 'AUTO',
      primaryModel: userConfig?.primaryModel || 'cloud',
      fallbackModels: userConfig?.fallbackModels || ['local', 'cache'],
      preferOffline: userConfig?.preferOffline || false,
      privacyMode: userConfig?.privacyMode || false,
      maxContextLength: userConfig?.maxContextLength || 4096,
      temperature: userConfig?.temperature || 0.7,
      ...userConfig,
    };
  }
  
  // ===== 核心对话方法 =====
  
  async chat(userMessage: string): Promise<ChatMessage> {
    const messageId = this.generateMessageId();
    
    const userMsg: ChatMessage = {
      id: messageId,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      syncStatus: this.networkStatus === 'OFFLINE' ? 'PENDING' : 'SYNCING',
      localOnly: false,
    };
    
    this.messages.push(userMsg);
    this.emit('message:user', userMsg);
    
    // 网络可用时立即同步
    if (this.networkStatus !== 'OFFLINE') {
      await syncController.queueForSync(userMsg);
    }
    
    try {
      const assistantMsg = await this.processWithModelSelection(userMessage);
      this.messages.push(assistantMsg);
      
      this.emit('message:assistant', assistantMsg);
      
      // 尝试同步
      await syncController.queueForSync(assistantMsg);
      
      return assistantMsg;
    } catch (error) {
      this.emit('error', { message: userMsg, error });
      throw error;
    }
  }
  
  // ===== 流式对话 =====
  
  async *chatStream(userMessage: string): AsyncGenerator<string> {
    const messageId = this.generateMessageId();
    
    const userMsg: ChatMessage = {
      id: messageId,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      syncStatus: this.networkStatus === 'OFFLINE' ? 'PENDING' : 'SYNCING',
      localOnly: false,
    };
    
    this.messages.push(userMsg);
    
    // 根据网络状态选择执行策略
    if (this.networkStatus === 'OFFLINE') {
      yield* this.streamFromLocal(userMessage);
    } else {
      const selectedModel = await modelRouter.selectModel(
        userMessage,
        this.config,
        this.messages
      );
      
      if (selectedModel.type === 'local') {
        yield* this.streamFromLocal(userMessage);
      } else {
        yield* this.streamFromCloud(userMessage, selectedModel.name);
      }
    }
  }
  
  private async *streamFromLocal(userMessage: string): AsyncGenerator<string> {
    const messages = this.buildMessages(userMessage);
    
    try {
      const result = await localLLMService.chatWithFallback(
        messages,
        async () => { throw new Error('Cloud not available in streaming'); }
      );
      
      if (result.success) {
        yield result.content;
      } else {
        yield `[离线模式] ${result.error || '本地推理失败'}`;
      }
    } catch (error) {
      yield `[错误] ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }
  
  private async *streamFromCloud(
    userMessage: string,
    model: string
  ): AsyncGenerator<string> {
    const messages = this.buildMessages(userMessage);
    
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        yield chunk;
      }
    } catch (error) {
      // 降级到本地
      yield* this.streamFromLocal(userMessage);
    }
  }
  
  // ===== 模型选择逻辑 =====
  
  private async processWithModelSelection(userMessage: string): Promise<ChatMessage> {
    const startTime = Date.now();
    
    // 1. 检查隐私模式
    if (this.config.privacyMode) {
      return this.runLocalInference(userMessage, startTime);
    }
    
    // 2. 检查离线状态
    if (this.networkStatus === 'OFFLINE') {
      return this.runLocalInference(userMessage, startTime);
    }
    
    // 3. 智能选择模型
    const selectedModel = await modelRouter.selectModel(
      userMessage,
      this.config,
      this.messages
    );
    
    switch (selectedModel.type) {
      case 'local':
        return this.runLocalInference(userMessage, startTime);
        
      case 'ensemble':
        return this.runEnsembleInference(userMessage, startTime);
cloud':
        return        
      case ' this.runCloudInference(userMessage, selectedModel.name, startTime);
        
      default:
        return this.runLocalInference(userMessage, startTime);
    }
  }
  
  private async runLocalInference(
    userMessage: string,
    startTime: number
  ): Promise<ChatMessage> {
    const messages = this.buildMessages(userMessage);
    
    const result = await localLLMService.chatWithFallback(
      messages,
      async (msgs) => this.runCloudInferenceDirect(msgs)
    );
    
    return {
      id: this.generateMessageId(),
      role: 'assistant',
      content: result.content || `[本地模式] ${result.error || '推理失败'}`,
      timestamp: Date.now(),
      syncStatus: result.provider === 'LOCAL' ? 'PENDING' : 'SYNCING',
      localOnly: result.provider === 'LOCAL',
      modelUsed: 'local-model',
    };
  }
  
  private async runCloudInference(
    userMessage: string,
    model: string,
    startTime: number
  ): Promise<ChatMessage> {
    const messages = this.buildMessages(userMessage);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        id: this.generateMessageId(),
        role: 'assistant',
        content: data.content,
        timestamp: Date.now(),
        syncStatus: 'SYNCING',
        localOnly: false,
        modelUsed: model,
      };
    } catch (error) {
      // 降级到本地
      console.warn('[ChatEngine] 云端推理失败，降级到本地');
      return this.runLocalInference(userMessage, startTime);
    }
  }
  
  private async runCloudInferenceDirect(messages: any[]): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.content;
  }
  
  private async runEnsembleInference(
    userMessage: string,
    startTime: number
  ): Promise<ChatMessage> {
    // 多模型集成：并行调用多个模型，综合结果
    const models = this.config.fallbackModels.filter(m => m !== this.config.primaryModel);
    const results = await Promise.allSettled(
      models.map(model => this.runCloudInferenceDirect(
        this.buildMessages(userMessage)
      ))
    );
    
    const successfulResponses = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value);
    
    const combinedContent = successfulResponses.join('\n\n---\n\n');
    
    return {
      id: this.generateMessageId(),
      role: 'assistant',
      content: combinedContent || '[集成模式] 所有模型推理失败',
      timestamp: Date.now(),
      syncStatus: 'SYNCING',
      localOnly: false,
      modelUsed: `ensemble:${models.join(',')}`,
    };
  }
  
  // ===== 辅助方法 =====
  
  private buildMessages(userMessage: string): any[] {
    return [
      ...this.messages.slice(-this.config.maxContextLength / 2),
      { role: 'user', content: userMessage },
    ];
  }
  
  private initNetworkMonitor(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange('ONLINE'));
      window.addEventListener('offline', () => this.handleNetworkChange('OFFLINE'));
    }
  }
  
  private handleNetworkChange(status: NetworkStatus): void {
    const previous = this.networkStatus;
    this.networkStatus = status;
    
    this.emit('network:change', { previous, current: status });
    
    // 网络恢复时，同步待处理消息
    if (previous === 'OFFLINE' && status === 'ONLINE') {
      this.syncPendingMessages();
    }
  }
  
  private async syncPendingMessages(): Promise<void> {
    const pending = this.messages.filter(m => m.syncStatus === 'PENDING');
    
    for (const msg of pending) {
      msg.syncStatus = 'SYNCING';
      await syncController.queueForSync(msg);
    }
  }
  
  private async loadMessageHistory(): Promise<void> {
    // 从本地存储加载历史消息
    const stored = localStorage.getItem(`chat_${this.options.sessionId}`);
    if (stored) {
      try {
        this.messages = JSON.parse(stored);
      } catch {
        this.messages = [];
      }
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // ===== 公共API =====
  
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
  
  clearHistory(): void {
    this.messages = [];
    localStorage.removeItem(`chat_${this.options.sessionId}`);
  }
  
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }
  
  setConfig(config: Partial<ChatConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
```

### 3.2 消息队列服务 (MessageQueue)

```typescript
// client/src/lib/chat/message-queue.ts

import { createServiceLogger } from '../logger';
const logger = createServiceLogger('MessageQueue');

export interface QueuedMessage {
  id: string;
  type: 'CHAT' | 'SYNC' | 'CONFIG' | 'FEEDBACK';
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.initPersistence();
    this.startSyncTimer();
  }
  
  // ===== 队列管理 =====
  
  enqueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = this.generateId();
    
    const queued: QueuedMessage = {
      ...message,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    // 按优先级插入
    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
    const insertIndex = this.queue.findIndex(
      m => priorityOrder[m.priority] > priorityOrder[message.priority]
    );
    
    if (insertIndex === -1) {
      this.queue.push(queued);
    } else {
      this.queue.splice(insertIndex, 0, queued);
    }
    
    this.persistQueue();
    this.processQueue();
    
    logger.info(`[MessageQueue] 消息已入队: ${id}, 类型: ${message.type}`);
    return id;
  }
  
  dequeue(): QueuedMessage | null {
    if (this.queue.length === 0) return null;
    return this.queue.shift()!;
  }
  
  peek(): QueuedMessage | null {
    return this.queue[0] || null;
  }
  
  remove(id: string): boolean {
    const index = this.queue.findIndex(m => m.id === id);
    if (index === -1) return false;
    
    this.queue.splice(index, 1);
    this.persistQueue();
    return true;
  }
  
  getSize(): number {
    return this.queue.length;
  }
  
  // ===== 处理逻辑 =====
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const message = this.peek();
      if (!message) break;
      
      try {
        await this.processMessage(message);
        this.dequeue();
        logger.info(`[MessageQueue] 消息处理成功: ${message.id}`);
      } catch (error) {
        await this.handleProcessingError(message, error);
      }
      
      // 避免过快的处理
      await this.delay(100);
    }
    
    this.isProcessing = false;
    this.persistQueue();
  }
  
  private async processMessage(message: QueuedMessage): Promise<void> {
    switch (message.type) {
      case 'CHAT':
        await this.processChatMessage(message.payload);
        break;
      case 'SYNC':
        await this.processSyncMessage(message.payload);
        break;
      case 'CONFIG':
        await this.processConfigMessage(message.payload);
        break;
      case 'FEEDBACK':
        await this.processFeedbackMessage(message.payload);
        break;
      default:
        throw new Error(`未知消息类型: ${message.type}`);
    }
  }
  
  private async processChatMessage(payload: any): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
  
  private async processSyncMessage(payload: any): Promise<void> {
    const response = await fetch('/api/sync/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
  
  private async processConfigMessage(payload: any): Promise<void> {
    const response = await fetch('/api/user/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
  
  private async processFeedbackMessage(payload: any): Promise<void> {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
  
  private async handleProcessingError(
    message: QueuedMessage,
    error: any
  ): Promise<void> {
    message.retryCount++;
    
    if (message.retryCount >= message.maxRetries) {
      logger.error(`[MessageQueue] 消息达到最大重试次数: ${message.id}`, error);
      this.dequeue(); // 移除消息
      
      // 存储到失败的单独队列
      this.storeFailedMessage(message, error);
    } else {
      // 延迟后重新入队
      const delay = Math.min(1000 * Math.pow(2, message.retryCount), 30000);
      await this.delay(delay);
      logger.warn(`[MessageQueue] 消息重试 ${message.retryCount}/${message.maxRetries}: ${message.id}`);
    }
  }
  
  // ===== 同步控制 =====
  
  private startSyncTimer(): void {
    // 每30秒自动同步一次
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, 30000);
  }
  
  async forceSync(): Promise<void> {
    if (navigator.onLine) {
      await this.processQueue();
    }
  }
  
  // ===== 持久化 =====
  
  private initPersistence(): void {
    // 从本地存储恢复队列
    const stored = localStorage.getItem('message_queue');
    if (stored) {
      try {
        this.queue = JSON.parse(stored);
      } catch {
        this.queue = [];
      }
    }
    
    // 监听存储变化
    window.addEventListener('storage', (e) => {
      if (e.key === 'message_queue' && e.newValue) {
        try {
          this.queue = JSON.parse(e.newValue);
        } catch {
          // 忽略解析错误
        }
      }
    });
  }
  
  private persistQueue(): void {
    try {
      localStorage.setItem('message_queue', JSON.stringify(this.queue));
    } catch (error) {
      logger.warn('[MessageQueue] 队列持久化失败:', error);
    }
  }
  
  private storeFailedMessage(message: QueuedMessage, error: any): void {
    const failedKey = 'failed_messages';
    const stored = localStorage.getItem(failedKey);
    const failed = stored ? JSON.parse(stored) : [];
    
    failed.push({
      ...message,
      error: error instanceof Error ? error.message : String(error),
      failedAt: Date.now(),
    });
    
    // 保留最多50条失败消息
    const trimmed = failed.slice(-50);
    localStorage.setItem(failedKey, JSON.stringify(trimmed));
  }
  
  getFailedMessages(): QueuedMessage[] {
    const stored = localStorage.getItem('failed_messages');
    return stored ? JSON.parse(stored) : [];
  }
  
  clearFailedMessages(): void {
    localStorage.removeItem('failed_messages');
  }
  
  // ===== 工具方法 =====
  
  private generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const messageQueue = new MessageQueue();
```

### 3.3 智能模型路由器 (ModelRouter)

```typescript
// client/src/lib/chat/model-router.ts

import type { ChatConfig } from './unified-chat-engine';

export type ModelType = 'local' | 'cloud' | 'ensemble';
export type TaskType = 'CHAT' | 'CODE' | 'ANALYSIS' | 'VISION' | 'CREATIVE';

export interface SelectedModel {
  type: ModelType;
  name: string;
  confidence: number;
  reason: string;
}

export interface RouterConfig {
  preferSpeed: boolean;
  preferQuality: boolean;
  preferPrivacy: boolean;
  costSensitive: boolean;
}

export class ModelRouter {
  private modelCapabilities: Map<string, ModelCapability> = new Map();
  
  constructor() {
    this.initModelCapabilities();
  }
  
  private initModelCapabilities(): void {
    // 本地模型
    this.modelCapabilities.set('local-ollama', {
      type: 'local',
      maxTokens: 4096,
      contextLength: 8192,
      strengths: ['CHAT', 'CODE'],
      weaknesses: ['ANALYSIS', 'CREATIVE'],
      speed: 'fast',
      quality: 'medium',
      offlineCapable: true,
    });
    
    this.modelCapabilities.set('local-webllm', {
      type: 'local',
      maxTokens: 2048,
      contextLength: 4096,
      strengths: ['CHAT'],
      weaknesses: ['CODE', 'ANALYSIS'],
      speed: 'medium',
      quality: 'medium',
      offlineCapable: true,
    });
    
    // 云端模型
    this.modelCapabilities.set('deepseek-chat', {
      type: 'cloud',
      maxTokens: 4096,
      contextLength: 65536,
      strengths: ['CHAT', 'CODE', 'ANALYSIS'],
      weaknesses: [],
      speed: 'medium',
      quality: 'high',
      offlineCapable: false,
    });
    
    this.modelCapabilities.set('qwen-max', {
      type: 'cloud',
      maxTokens: 6144,
      contextLength: 32768,
      strengths: ['CHAT', 'VISION', 'ANALYSIS'],
      weaknesses: [],
      speed: 'fast',
      quality: 'high',
      offlineCapable: false,
    });
    
    this.modelCapabilities.set('doubao-pro', {
      type: 'cloud',
      maxTokens: 8192,
      contextLength: 32768,
      strengths: ['CHAT', 'CREATIVE', 'ANALYSIS'],
      weaknesses: [],
      speed: 'fast',
      quality: 'high',
      offlineCapable: false,
    });
  }
  
  async selectModel(
    userMessage: string,
    config: ChatConfig,
    conversationHistory: any[]
  ): Promise<SelectedModel> {
    // 1. 任务类型识别
    const taskType = this.classifyTask(userMessage);
    
    // 2. 根据配置选择策略
    if (config.mode === 'SINGLE') {
      return this.selectSingleModel(config.primaryModel, taskType);
    }
    
    if (config.mode === 'ENSEMBLE') {
      return this.selectEnsembleModel(config, taskType);
    }
    
    // AUTO 模式：智能选择
    return this.selectOptimalModel(taskType, config);
  }
  
  private classifyTask(message: string): TaskType {
    const lower = message.toLowerCase();
    
    // 代码相关
    if (/\b(function|class|def|import|var|let|const|return|if|else)\b/.test(lower)) {
      return 'CODE';
    }
    
    // 分析相关
    if (/\b(分析|比较|评估|研究|调查|分析)\b/.test(lower) ||
        /\b(analyze|compare|evaluate|research|investigate)\b/.test(lower)) {
      return 'ANALYSIS';
    }
    
    // 视觉相关
    if (/\b(图片|图像|照片|视觉|看图|图片中)\b/.test(lower) ||
        /\b(image|picture|photo|visual|see|look at)\b/.test(lower)) {
      return 'VISION';
    }
    
    // 创意相关
    if (/\b(写诗|创作|写歌|故事|小说|创意)\b/.test(lower) ||
        /\b(write poem|create song|story|novel|creative)\b/.test(lower)) {
      return 'CREATIVE';
    }
    
    return 'CHAT';
  }
  
  private selectSingleModel(modelName: string, taskType: TaskType): SelectedModel {
    const capability = this.modelCapabilities.get(modelName);
    
    if (!capability) {
      return {
        type: 'cloud',
        name: 'qwen-max', // 默认
        confidence: 0.5,
        reason: '指定模型不可用，使用默认云端模型',
      };
    }
    
    return {
      type: capability.type as ModelType,
      name: modelName,
      confidence: 0.9,
      reason: `用户指定模型: ${modelName}`,
    };
  }
  
  private selectEnsembleModel(config: ChatConfig, taskType: TaskType): SelectedModel {
    const models = [config.primaryModel, ...config.fallbackModels];
    
    return {
      type: 'ensemble',
      name: models.join('+'),
      confidence: 0.85,
      reason: `集成模式: ${models.join(', ')}`,
    };
  }
  
  private selectOptimalModel(
    taskType: TaskType,
    config: ChatConfig
  ): SelectedModel {
    // 根据任务类型评估所有可用模型
    const candidates = Array.from(this.modelCapabilities.entries())
      .filter(([_, cap]) => this.isModelAvailable(cap))
      .map(([name, cap]) => this.evaluateModel(name, cap, taskType, config));
    
    // 按评分排序
    candidates.sort((a, b) => b.score - a.score);
    
    const best = candidates[0];
    
    // 如果首选模型不是云端且质量要求高，尝试集成
    if (best.type !== 'cloud' && 
        (taskType === 'ANALYSIS' || taskType === 'CREATIVE')) {
      const cloudCandidate = candidates.find(c => c.type === 'cloud');
      
      if (cloudCandidate) {
        return {
          type: 'ensemble',
          name: `${best.name}+${cloudCandidate.name}`,
          confidence: 0.8,
          reason: `混合模式: ${best.name}快速响应 + ${cloudCandidate.name}高质量`,
        };
      }
    }
    
    return {
      type: best.type,
      name: best.name,
      confidence: best.score,
      reason: best.reason,
    };
  }
  
  private evaluateModel(
    name: string,
    capability: ModelCapability,
    taskType: TaskType,
    config: ChatConfig
  ): { name: string; type: ModelType; score: number; reason: string } {
    let score = 0;
    let reason = '';
    
    // 任务匹配度 (0-40分)
    if (capability.strengths.includes(taskType)) {
      score += 40;
      reason = `模型擅长 ${taskType}`;
    } else if (capability.weaknesses.includes(taskType)) {
      score -= 20;
      reason = `模型不擅长 ${taskType}`;
    } else {
      score += 20;
      reason = `模型支持 ${taskType}`;
    }
    
    // 质量优先 (0-30分)
    if (capability.quality === 'high') {
      score += config.preferQuality ? 30 : 15;
    } else if (capability.quality === 'medium') {
      score += config.preferQuality ? 15 : 25;
    }
    
    // 速度优先 (0-20分)
    if (capability.speed === 'fast') {
      score += config.preferSpeed ? 20 : 10;
    } else if (capability.speed === 'medium') {
      score += config.preferSpeed ? 10 : 15;
    }
    
    // 隐私优先 (0-10分)
    if (config.preferPrivacy && capability.offlineCapable) {
      score += 10;
      reason += ', 保护隐私';
    }
    
    return {
      name,
      type: capability.type as ModelType,
      score,
      reason,
    };
  }
  
  private isModelAvailable(capability: ModelCapability): boolean {
    if (capability.type === 'local') {
      // 检查本地模型是否已加载
      return navigator.onLine || capability.offlineCapable;
    }
    
    // 云端模型需要网络
    return navigator.onLine;
  }
  
  // ===== 公共API =====
  
  getAvailableModels(): { name: string; type: ModelType; offlineCapable: boolean }[] {
    return Array.from(this.modelCapabilities.entries())
      .filter(([_, cap]) => this.isModelAvailable(cap))
      .map(([name, cap]) => ({
        name,
        type: cap.type as ModelType,
        offlineCapable: cap.offlineCapable,
      }));
  }
  
  getModelInfo(modelName: string): ModelCapability | undefined {
    return this.modelCapabilities.get(modelName);
  }
  
  registerModel(name: string, capability: ModelCapability): void {
    this.modelCapabilities.set(name, capability);
  }
}

interface ModelCapability {
  type: 'local' | 'cloud';
  maxTokens: number;
  contextLength: number;
  strengths: TaskType[];
  weaknesses: TaskType[];
  speed: 'slow' | 'medium' | 'fast';
  quality: 'low' | 'medium' | 'high';
  offlineCapable: boolean;
}

export const modelRouter = new ModelRouter();
```

---

## 四、离线同步机制

### 4.1 同步服务设计

```typescript
// client/src/lib/sync/sync-controller.ts

export interface SyncItem {
  id: string;
  type: 'MESSAGE' | 'CONFIG' | 'STATE' | 'ARTIFACT';
  localData: any;
  serverData?: any;
  timestamp: number;
  conflictResolution: 'LOCAL_WINS' | 'SERVER_WINS' | 'MERGE' | 'ASK_USER';
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  retryCount: number;
}

export class SyncController {
  private pendingItems: Map<string, SyncItem> = new Map();
  private conflictedItems: Map<string, SyncItem> = new Map();
  private syncInProgress = false;
  
  // ===== 队列管理 =====
  
  async queueForSync(data: any): Promise<string> {
    const id = this.generateId();
    
    const item: SyncItem = {
      id,
      type: this.detectType(data),
      localData: data,
      timestamp: Date.now(),
      conflictResolution: 'MERGE',
      status: 'PENDING',
      retryCount: 0,
    };
    
    this.pendingItems.set(id, item);
    this.persistPendingItems();
    
    // 尝试同步
    this.processQueue();
    
    return id;
  }
  
  // ===== 同步处理 =====
  
  async processQueue(): Promise<void> {
    if (this.syncInProgress || this.pendingItems.size === 0) return;
    
    if (!navigator.onLine) {
      console.log('[Sync] 离线状态，等待网络恢复');
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      for (const [id, item] of this.pendingItems) {
        if (item.status !== 'PENDING') continue;
        
        try {
          await this.syncItem(item);
          item.status = 'SYNCED';
          this.pendingItems.delete(id);
        } catch (error) {
          await this.handleSyncError(item, error);
        }
        
        // 避免过快请求
        await this.delay(200);
      }
    } finally {
      this.syncInProgress = false;
      this.persistPendingItems();
    }
  }
  
  private async syncItem(item: SyncItem): Promise<void> {
    const endpoint = this.getEndpoint(item.type);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.localData),
    });
    
    if (!response.ok) {
      if (response.status === 409) {
        // 冲突处理
        const serverData = await response.json();
        await this.resolveConflict(item, serverData);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } else {
      item.serverData = await response.json();
    }
  }
  
  private async resolveConflict(item: SyncItem, serverData: any): Promise<void> {
    switch (item.conflictResolution) {
      case 'LOCAL_WINS':
        // 强制覆盖服务器
        await this.forceUpload(item);
        break;
        
      case 'SERVER_WINS':
        // 采用服务器数据
        item.localData = serverData;
        item.status = 'SYNCED';
        break;
        
      case 'MERGE':
        // 合并策略
        item.localData = this.mergeData(item.localData, serverData);
        await this.forceUpload(item);
        break;
        
      case 'ASK_USER':
        // 标记为冲突，等待用户决策
        item.serverData = serverData;
        item.status = 'CONFLICT';
        this.conflictedItems.set(item.id, item);
        this.pendingItems.delete(item.id);
        break;
    }
  }
  
  private async forceUpload(item: SyncItem): Promise<void> {
    const endpoint = `${this.getEndpoint(item.type)}?force=true`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.localData),
    });
    
    if (!response.ok) {
      throw new Error(`Force upload failed: ${response.status}`);
    }
    
    item.status = 'SYNCED';
  }
  
  private mergeData(local: any, server: any): any {
    // 简单合并策略：递归合并对象
    if (typeof local !== typeof server) return local;
    
    if (typeof local === 'object' && local !== null) {
      const result = { ...server };
      
      for (const key of Object.keys(local)) {
        if (key in server) {
          result[key] = this.mergeData(local[key], server[key]);
        } else {
          result[key] = local[key];
        }
      }
      
      return result;
    }
    
    // 标量类型：保留较新的
    return local.timestamp > server.timestamp ? local : server;
  }
  
  // ===== 错误处理 =====
  
  private async handleSyncError(item: SyncItem, error: any): Promise<void> {
    item.retryCount++;
    
    if (item.retryCount >= 3) {
      // 多次失败，标记为待处理
      item.status = 'FAILED';
      console.error(`[Sync] 同步失败: ${item.id}`, error);
      
      // 存储到本地
      this.storeFailedItem(item);
    } else {
      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, item.retryCount), 60000);
      await this.delay(delay);
    }
  }
  
  // ===== 持久化 =====
  
  private persistPendingItems(): void {
    const data = Array.from(this.pendingItems.values());
    localStorage.setItem('sync_pending', JSON.stringify(data));
  }
  
  private loadPendingItems(): void {
    const stored = localStorage.getItem('sync_pending');
    if (stored) {
      try {
        const items = JSON.parse(stored);
        for (const item of items) {
          this.pendingItems.set(item.id, item);
        }
      } catch {
        // 忽略
      }
    }
  }
  
  private storeFailedItem(item: SyncItem): void {
    const key = 'sync_failed';
    const stored = localStorage.getItem(key);
    const failed = stored ? JSON.parse(stored) : [];
    
    failed.push({ ...item, failedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(failed.slice(-100)));
  }
  
  // ===== 工具方法 =====
  
  private detectType(data: any): 'MESSAGE' | 'CONFIG' | 'STATE' | 'ARTIFACT' {
    if (data.role) return 'MESSAGE';
    if (data.config) return 'CONFIG';
    if (data.state) return 'STATE';
    return 'ARTIFACT';
  }
  
  private getEndpoint(type: string): string {
    const endpoints: Record<string, string> = {
      MESSAGE: '/api/sync/messages',
      CONFIG: '/api/sync/config',
      STATE: '/api/sync/state',
      ARTIFACT: '/api/sync/artifacts',
    };
    return endpoints[type] || '/api/sync';
  }
  
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ===== 公共API =====
  
  getPendingCount(): number {
    return this.pendingItems.size;
  }
  
  getConflictedCount(): number {
    return this.conflictedItems.size;
  }
  
  async forceSync(): Promise<void> {
    if (navigator.onLine) {
      await this.processQueue();
    }
  }
}

export const syncController = new SyncController();
```

---

## 五、配置方案

### 5.1 客户端配置

```typescript
// 客户端默认配置
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  mode: 'AUTO',           // AUTO: 智能选择, SINGLE: 单模型, ENSEMBLE: 多模型集成
  primaryModel: 'qwen-max', // 默认云端模型
  fallbackModels: ['local-ollama', 'deepseek-chat'], // 备用模型列表
  preferOffline: false,   // 是否优先使用离线/本地模型
  privacyMode: false,     // 隐私模式：强制本地处理
  maxContextLength: 4096, // 最大上下文长度
  temperature: 0.7,      // 生成温度
};

// 使用示例
const config: ChatConfig = {
  mode: 'SINGLE',
  primaryModel: 'deepseek-chat',
  fallbackModels: [],
  preferOffline: true,
  privacyMode: true, // 强制本地推理
};
```

### 5.2 服务器端路由配置

```typescript
// 服务器端支持的模型配置
export const MODEL_CONFIG = {
  // 云端模型
  DEEPSEEK: {
    endpoint: process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    timeout: 30000,
  },
  TONGYI: {
    endpoint: process.env.TONGYI_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: process.env.TONGYI_API_KEY,
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    timeout: 30000,
  },
  DOUBAO: {
    endpoint: process.env.DOUBAO_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: process.env.DOUBAO_API_KEY,
    models: ['doubao-pro-32k', 'doubao-pro-128k'],
    timeout: 30000,
  },
  
  // 本地模型
  LOCAL_OLLAMA: {
    endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    models: ['qwen:7b', 'llama3', 'mistral'],
    timeout: 120000,
  },
};
```

---

## 六、部署与运维

### 6.1 离线使用场景

| 场景 | 配置 | 说明 |
|------|------|------|
| 纯离线 | `privacyMode: true` | 所有数据本地处理，联网后同步 |
| 弱网 | `preferOffline: true` | 优先本地，失败才用云端 |
| 正常网络 | `mode: 'AUTO'` | 智能选择最优模型 |
| 高质量需求 | `mode: 'ENSEMBLE'` | 多模型集成，取长补短 |

### 6.2 模型选择策略

```
任务类型 → 模型选择

CHAT (日常对话)
├─ 快速响应 → DOUBAO / 本地模型
└─ 深度回复 → Qwen-Max / DeepSeek

CODE (代码生成)
├─ 简单代码 → 本地模型
└─ 复杂项目 → DeepSeek / Qwen-Max

ANALYSIS (分析推理)
├─ 快速分析 → Qwen-Max
└─ 深度分析 → DeepSeek + Qwen-Max 集成

VISION (视觉理解)
└─ 必须使用 → Qwen-VL / 云端模型

CREATIVE (创意写作)
├─ 快速草稿 → 本地模型
└─ 精品创作 → DOUBAO + Qwen-Max 集成
```

---

## 七、总结

### 7.1 核心优势

1. **真正的离线可用**：基于本地模型，无网络也能对话
2. **无缝切换**：网络状态变化自动调整策略
3. **数据安全**：敏感数据默认本地处理
4. **成本优化**：本地优先，降低API调用成本
5. **弹性容错**：多模型备份，单点故障不影响

### 7.2 技术栈

- **客户端**: React + TypeScript + Capacitor
- **本地推理**: Ollama / WebLLM / ONNX Runtime
- **同步协议**: HTTPS + WebSocket
- **消息队列**: IndexedDB + Service Worker

### 7.3 下一步行动

1. 实现 `UnifiedChatEngine` 核心模块
2. 集成 Ollama 本地推理服务
3. 实现离线消息队列
4. 完善冲突解决策略
5. 性能优化和测试
