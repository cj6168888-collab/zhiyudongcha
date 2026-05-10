/**
 * Z1 协议 - LLM Provider 统一类型定义
 * 支持: DeepSeek / 通义千问 / 豆包 / Ollama
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse | null>;
  chatStream?(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown>;
}

export const LLM_PROVIDER_NAMES = {
  DEEPSEEK: 'DEEPSEEK',
  TONGYI: 'TONGYI',
  DOUBAO: 'DOUBAO',
  LOCAL_OLLAMA: 'LOCAL_OLLAMA',
} as const;

export type LLMProviderName = keyof typeof LLM_PROVIDER_NAMES;
