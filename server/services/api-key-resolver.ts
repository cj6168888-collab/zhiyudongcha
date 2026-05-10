/**
 * Z1 协议 - API Key 统一获取器
 * 
 * 遵循铁律1：算力主权 - 优先从 SecretVault 加密存储获取
 * 降级策略：SecretVault -> 环境变量 -> null
 * 
 * 使用方法：
 * const apiKey = await getApiKey('DASHSCOPE');
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ApiKeyResolver');

import { secretVault, type SecretKeyType } from './secret-vault';

export type ApiKeyProvider = 'DASHSCOPE' | 'DEEPSEEK' | 'DOUBAO' | 'CUSTOM';

const ENV_VAR_MAPPING: Record<ApiKeyProvider, string> = {
  DASHSCOPE: 'DASHSCOPE_API_KEY',
  DEEPSEEK: 'DEEPSEEK_API_KEY',
  DOUBAO: 'DOUBAO_API_KEY',
  CUSTOM: '',
};

const SECRET_KEY_MAPPING: Record<ApiKeyProvider, SecretKeyType> = {
  DASHSCOPE: 'DASHSCOPE_API_KEY',
  DEEPSEEK: 'DEEPSEEK_API_KEY',
  DOUBAO: 'DOUBAO_API_KEY',
  CUSTOM: 'CUSTOM',
};

const apiKeyCache: Map<ApiKeyProvider, { key: string; timestamp: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getApiKey(provider: ApiKeyProvider): Promise<string | null> {
  const cached = apiKeyCache.get(provider);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.key;
  }

  try {
    const secretKey = SECRET_KEY_MAPPING[provider];
    const vaultValue = await secretVault.getSecret(secretKey);
    if (vaultValue) {
      apiKeyCache.set(provider, { key: vaultValue, timestamp: Date.now() });
      return vaultValue;
    }
  } catch (error) {
    logger.error({ error, provider }, '从 SecretVault 获取失败');
  }

  const envVar = ENV_VAR_MAPPING[provider];
  const envValue = envVar ? process.env[envVar] : null;
  if (envValue) {
    logger.warn(`[ApiKeyResolver] ⚠️ ${provider} 使用环境变量，建议迁移至 SecretVault 加密存储`);
    apiKeyCache.set(provider, { key: envValue, timestamp: Date.now() });
    return envValue;
  }

  return null;
}

export async function hasApiKey(provider: ApiKeyProvider): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}

export async function getAvailableProviders(): Promise<ApiKeyProvider[]> {
  const providers: ApiKeyProvider[] = ['DASHSCOPE', 'DEEPSEEK', 'DOUBAO'];
  const available: ApiKeyProvider[] = [];
  
  for (const provider of providers) {
    if (await hasApiKey(provider)) {
      available.push(provider);
    }
  }
  
  return available;
}

export function clearApiKeyCache(): void {
  apiKeyCache.clear();
  logger.info('[ApiKeyResolver] 缓存已清除');
}

export function getSyncApiKey(provider: ApiKeyProvider): string | null {
  const cached = apiKeyCache.get(provider);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.key;
  }

  const envVar = ENV_VAR_MAPPING[provider];
  return envVar ? process.env[envVar] || null : null;
}

export type { ApiKeyProvider };
