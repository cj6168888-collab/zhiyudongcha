/**
 * Z1 协议 - 通义千问 Provider 适配器 (DashScope)
 * 铁律1: API 密钥优先从 SecretVault 获取，fallback 到 process.env
 * 禁止硬编码/日志输出
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('TongyiProvider');

import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from './types';
import { getSyncApiKey, getApiKey } from '../api-key-resolver';

const TONGYI_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export class TongyiProvider implements LLMProvider {
  name = 'TONGYI';
  
  private get apiKey(): string | undefined {
    return getSyncApiKey('DASHSCOPE') || process.env.DASHSCOPE_API_KEY;
  }
  
  async getApiKeyAsync(): Promise<string | null> {
    return getApiKey('DASHSCOPE');
  }
  
  async isAvailable(): Promise<boolean> {
    const key = await this.getApiKeyAsync();
    return !!key;
  }
  
  async chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      logger.info('[Tongyi] API key not configured');
      return null;
    }
    
    const model = options?.model || 'qwen-max';
    
    try {
      const response = await fetch(TONGYI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: { messages },
          parameters: {
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            top_p: options?.topP ?? 0.9,
            result_format: 'message',
          },
        }),
        signal: AbortSignal.timeout(60000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Tongyi] API error ${response.status}: ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.code) {
        logger.error(`[Tongyi] API error: ${data.code} - ${data.message}`);
        return null;
      }
      
      const content = data.output?.choices?.[0]?.message?.content || data.output?.text;
      
      if (!content) {
        logger.error('[Tongyi] No content in response');
        return null;
      }
      
      return {
        content,
        model: model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
        finishReason: data.output?.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      logger.error({ err: error }, '[Tongyi] Request failed');
      return null;
    }
  }
  
  async *chatStream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      logger.info('[Tongyi] API key not configured for streaming');
      return;
    }
    
    const model = options?.model || 'qwen-max';
    
    try {
      const response = await fetch(TONGYI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          model,
          input: { messages },
          parameters: {
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            result_format: 'message',
            incremental_output: true,
          },
        }),
        signal: AbortSignal.timeout(120000),
      });
      
      if (!response.ok || !response.body) {
        logger.error(`[Tongyi] Stream failed: ${response.status}`);
        return;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data:'));
        
        for (const line of lines) {
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.output?.choices?.[0]?.message?.content || data.output?.text;
            if (content) yield content;
          } catch {
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, '[Tongyi] Stream error');
    }
  }
}

export const tongyiProvider = new TongyiProvider();
