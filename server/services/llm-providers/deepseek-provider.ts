/**
 * Z1 协议 - DeepSeek Provider 适配器
 * 铁律1: API 密钥优先从 SecretVault 获取，fallback 到 process.env
 * 禁止硬编码/日志输出
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('DeepseekProvider');

import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from './types';
import { getSyncApiKey, getApiKey } from '../api-key-resolver';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export class DeepSeekProvider implements LLMProvider {
  name = 'DEEPSEEK';
  
  private get apiKey(): string | undefined {
    return getSyncApiKey('DEEPSEEK') || undefined;
  }
  
  async getApiKeyAsync(): Promise<string | null> {
    return getApiKey('DEEPSEEK');
  }
  
  async isAvailable(): Promise<boolean> {
    const key = await this.getApiKeyAsync();
    return !!key;
  }
  
  async chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      logger.info('[DeepSeek] API key not configured');
      return null;
    }
    
    const model = options?.model || 'deepseek-chat';
    
    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          top_p: options?.topP ?? 0.9,
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[DeepSeek] API error ${response.status}: ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice?.message?.content) {
        logger.error('[DeepSeek] No content in response');
        return null;
      }
      
      return {
        content: choice.message.content,
        model: data.model || model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      logger.error({ err: error }, '[DeepSeek] Request failed');
      return null;
    }
  }
  
  async *chatStream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      logger.info('[DeepSeek] API key not configured for streaming');
      return;
    }
    
    const model = options?.model || 'deepseek-chat';
    
    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: true,
        }),
        signal: AbortSignal.timeout(120000),
      });
      
      if (!response.ok || !response.body) {
        logger.error(`[DeepSeek] Stream failed: ${response.status}`);
        return;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        
        for (const line of lines) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, '[DeepSeek] Stream error');
    }
  }
}

export const deepseekProvider = new DeepSeekProvider();
