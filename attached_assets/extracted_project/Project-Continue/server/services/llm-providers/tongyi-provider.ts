/**
 * Z1 协议 - 通义千问 Provider 适配器 (DashScope)
 * 铁律1: API 密钥仅从 process.env 读取，禁止硬编码/日志输出
 */

import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from './types';

const TONGYI_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export class TongyiProvider implements LLMProvider {
  name = 'TONGYI';
  
  private get apiKey(): string | undefined {
    return process.env.DASHSCOPE_API_KEY;
  }
  
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  
  async chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.log('[Tongyi] API key not configured');
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
        console.error(`[Tongyi] API error ${response.status}: ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.code) {
        console.error(`[Tongyi] API error: ${data.code} - ${data.message}`);
        return null;
      }
      
      const content = data.output?.choices?.[0]?.message?.content || data.output?.text;
      
      if (!content) {
        console.error('[Tongyi] No content in response');
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
      console.error('[Tongyi] Request failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  async *chatStream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.log('[Tongyi] API key not configured for streaming');
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
        console.error(`[Tongyi] Stream failed: ${response.status}`);
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
      console.error('[Tongyi] Stream error:', error instanceof Error ? error.message : 'Unknown');
    }
  }
}

export const tongyiProvider = new TongyiProvider();
