/**
 * Z1 协议 - LLM Provider 统一导出
 * 支持四种国产/本地算力: DeepSeek / 通义千问 / 豆包 / Ollama
 */

export * from './types';
export { deepseekProvider, DeepSeekProvider } from './deepseek-provider';
export { tongyiProvider, TongyiProvider } from './tongyi-provider';
export { doubaoProvider, DoubaoProvider } from './doubao-provider';
export { ollamaProvider, OllamaProvider } from './ollama-provider';

import { deepseekProvider } from './deepseek-provider';
import { tongyiProvider } from './tongyi-provider';
import { doubaoProvider } from './doubao-provider';
import { ollamaProvider } from './ollama-provider';
import type { LLMProvider, LLMProviderName } from './types';

export const providerRegistry: Record<LLMProviderName, LLMProvider> = {
  DEEPSEEK: deepseekProvider,
  TONGYI: tongyiProvider,
  DOUBAO: doubaoProvider,
  LOCAL_OLLAMA: ollamaProvider,
};

export function getProvider(name: LLMProviderName): LLMProvider {
  return providerRegistry[name];
}

export async function getAvailableProviders(): Promise<LLMProviderName[]> {
  const available: LLMProviderName[] = [];
  
  for (const [name, provider] of Object.entries(providerRegistry)) {
    if (await provider.isAvailable()) {
      available.push(name as LLMProviderName);
    }
  }
  
  return available;
}
