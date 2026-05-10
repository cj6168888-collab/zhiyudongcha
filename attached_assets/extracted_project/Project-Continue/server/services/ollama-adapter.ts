/**
 * 小智 Ollama Adapter - 本地AI模型适配器
 * 
 * 功能：
 * 1. 与Ollama API通信
 * 2. 流式响应支持
 * 3. 模型管理（列表、拉取、删除）
 * 4. 健康检查和自动重连
 */

// ===== 配置类型 =====
export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  retries: number;
}

// ===== 消息类型 =====
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ===== 生成选项 =====
export interface GenerateOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  numCtx?: number;
  numPredict?: number;
  stop?: string[];
  stream?: boolean;
}

// ===== 响应类型 =====
export interface OllamaResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
}

// ===== 模型信息 =====
export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

// ===== 默认配置 =====
const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  defaultModel: 'qwen:7b',
  timeout: 60000,
  retries: 2,
};

// ===== Ollama适配器类 =====
export class OllamaAdapter {
  private config: OllamaConfig;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000;
  
  constructor(config?: Partial<OllamaConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // 健康检查
  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    
    // 如果最近检查过，使用缓存结果
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      this.isHealthy = response.ok;
      this.lastHealthCheck = now;
      
      if (this.isHealthy) {
        console.log('[OllamaAdapter] Health check: ONLINE');
      } else {
        console.log('[OllamaAdapter] Health check: UNHEALTHY');
      }
      
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      console.log('[OllamaAdapter] Health check: OFFLINE');
      return false;
    }
  }
  
  // 获取可用模型列表
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('[OllamaAdapter] Failed to list models:', error);
      return [];
    }
  }
  
  // 检查模型是否可用
  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => 
      m.name === modelName || 
      m.name.startsWith(modelName.split(':')[0])
    );
  }
  
  // 拉取模型
  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
      
      // 处理流式进度
      const reader = response.body?.getReader();
      if (!reader) return false;
      
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.total && data.completed && onProgress) {
              onProgress(data.completed / data.total);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      console.log(`[OllamaAdapter] Model pulled: ${modelName}`);
      return true;
    } catch (error) {
      console.error('[OllamaAdapter] Failed to pull model:', error);
      return false;
    }
  }
  
  // 聊天补全（非流式）
  async chat(
    messages: OllamaMessage[],
    options?: GenerateOptions
  ): Promise<OllamaResponse | null> {
    const model = options?.model || this.config.defaultModel;
    
    // 先检查健康状态
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      console.log('[OllamaAdapter] Cannot chat: Ollama is offline');
      return null;
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: {
              temperature: options?.temperature ?? 0.7,
              top_p: options?.topP ?? 0.9,
              top_k: options?.topK ?? 40,
              num_ctx: options?.numCtx ?? 2048,
              num_predict: options?.numPredict ?? 512,
            },
          }),
          signal: AbortSignal.timeout(this.config.timeout),
        });
        
        if (!response.ok) {
          throw new Error(`Chat failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[OllamaAdapter] Chat completed with ${model}`);
        
        return data as OllamaResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.log(`[OllamaAdapter] Chat attempt ${attempt + 1} failed: ${lastError.message}`);
        
        if (attempt < this.config.retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    
    console.error('[OllamaAdapter] Chat failed after retries:', lastError);
    return null;
  }
  
  // 聊天补全（流式）
  async *chatStream(
    messages: OllamaMessage[],
    options?: GenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options?.model || this.config.defaultModel;
    
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      console.log('[OllamaAdapter] Cannot stream chat: Ollama is offline');
      return;
    }
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: options?.topP ?? 0.9,
            num_ctx: options?.numCtx ?? 2048,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
      
      if (!response.ok) {
        throw new Error(`Stream chat failed: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('[OllamaAdapter] Stream chat failed:', error);
    }
  }
  
  // 简单的文本生成
  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    const result = await this.chat([
      { role: 'user', content: prompt },
    ], options);
    
    return result?.message?.content || null;
  }
  
  // 获取推荐的本地模型
  static getRecommendedModels(): Array<{
    name: string;
    description: string;
    size: string;
    minRAM: string;
    useCase: string;
  }> {
    return [
      {
        name: 'phi3:mini',
        description: '微软Phi-3迷你版，快速轻量',
        size: '2.3GB',
        minRAM: '4GB',
        useCase: '简单对话、快速响应',
      },
      {
        name: 'qwen:7b',
        description: '通义千问7B，中文优秀',
        size: '4.1GB',
        minRAM: '8GB',
        useCase: '中文对话、日常助手',
      },
      {
        name: 'qwen2:7b',
        description: '通义千问2.0，更强能力',
        size: '4.4GB',
        minRAM: '8GB',
        useCase: '复杂对话、分析任务',
      },
      {
        name: 'llama3.1:8b',
        description: 'Meta Llama 3.1 8B',
        size: '4.7GB',
        minRAM: '8GB',
        useCase: '通用对话、英文任务',
      },
      {
        name: 'deepseek-coder:6.7b',
        description: 'DeepSeek编程模型',
        size: '3.8GB',
        minRAM: '8GB',
        useCase: '代码生成、技术问答',
      },
    ];
  }
}

// ===== 全局适配器实例 =====
export const ollamaAdapter = new OllamaAdapter();
