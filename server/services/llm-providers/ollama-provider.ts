/**
 * Z1 协议 - Ollama Provider 适配器 (本地离线)
 * 铁律4: 离线兼容，支持本地 GPU 服务器部署
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('OllamaProvider');

import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from './types';

export class OllamaProvider implements LLMProvider {
  name = 'LOCAL_OLLAMA';
  
  private baseUrl: string;
  private defaultModel: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  
  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = defaultModel || process.env.OLLAMA_MODEL || 'qwen:7b';
  }
  
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < 30000) {
      return this.isHealthy;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      this.isHealthy = response.ok;
      this.lastHealthCheck = now;
      return this.isHealthy;
    } catch {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }
  
  async chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null> {
    const available = await this.isAvailable();
    if (!available) {
      logger.info('[Ollama] Service not available');
      return null;
    }
    
    const model = options?.model || this.defaultModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: options?.topP ?? 0.9,
            num_predict: options?.maxTokens ?? 2048,
          },
        }),
        signal: AbortSignal.timeout(60000),
      });
      
      if (!response.ok) {
        logger.error(`[Ollama] API error: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data.message?.content) {
        logger.error('[Ollama] No content in response');
        return null;
      }
      
      return {
        content: data.message.content,
        model: data.model || model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      logger.error({ err: error }, '[Ollama] Request failed');
      return null;
    }
  }
  
  async *chatStream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    const available = await this.isAvailable();
    if (!available) {
      logger.info('[Ollama] Service not available for streaming');
      return;
    }
    
    const model = options?.model || this.defaultModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: options?.topP ?? 0.9,
          },
        }),
        signal: AbortSignal.timeout(120000),
      });
      
      if (!response.ok || !response.body) {
        logger.error(`[Ollama] Stream failed: ${response.status}`);
        return;
      }
      
      const reader = response.body.getReader();
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
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, '[Ollama] Stream error');
    }
  }
  
  setConfig(baseUrl: string, model: string): void {
    this.baseUrl = baseUrl;
    this.defaultModel = model;
    this.isHealthy = false;
    this.lastHealthCheck = 0;
  }
}

export const ollamaProvider = new OllamaProvider();
