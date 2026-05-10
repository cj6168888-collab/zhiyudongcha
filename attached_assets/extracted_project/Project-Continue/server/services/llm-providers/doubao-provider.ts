/**
 * Z1 协议 - 豆包 (Doubao) Provider 适配器
 * 字节跳动火山引擎 - 适合快速响应场景
 * 铁律1: API 密钥仅从 process.env 读取，禁止硬编码/日志输出
 */

import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from './types';

const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export class DoubaoProvider implements LLMProvider {
  name = 'DOUBAO';
  
  private get apiKey(): string | undefined {
    return process.env.DOUBAO_API_KEY;
  }
  
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  
  async chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.log('[Doubao] API key not configured');
      return null;
    }
    
    const model = options?.model || 'doubao-pro-32k';
    
    try {
      const response = await fetch(DOUBAO_API_URL, {
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
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Doubao] API error ${response.status}: ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice?.message?.content) {
        console.error('[Doubao] No content in response');
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
      console.error('[Doubao] Request failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  async *chatStream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.log('[Doubao] API key not configured for streaming');
      return;
    }
    
    const model = options?.model || 'doubao-pro-32k';
    
    try {
      const response = await fetch(DOUBAO_API_URL, {
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
        signal: AbortSignal.timeout(60000),
      });
      
      if (!response.ok || !response.body) {
        console.error(`[Doubao] Stream failed: ${response.status}`);
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
      console.error('[Doubao] Stream error:', error instanceof Error ? error.message : 'Unknown');
    }
  }
}

export const doubaoProvider = new DoubaoProvider();
