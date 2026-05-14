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

export function isUsableApiKey(value: string | null | undefined): value is string {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  const placeholderPatterns = [
    /^your[_-]?(api[_-]?)?key$/,
    /^your.*key$/,
    /^replace[_-]?me$/,
    /^changeme$/,
    /^example/,
    /^xxx+$/,
    /xxxxx/,
    /placeholder/,
  ];

  return !placeholderPatterns.some((pattern) => pattern.test(normalized));
}

function envCandidates(provider: ApiKeyProvider): string[] {
  switch (provider) {
    case 'DASHSCOPE':
      return ['DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'TONGYI_API_KEY', 'ALIYUN_DASHSCOPE_API_KEY'];
    case 'DEEPSEEK':
      return ['DEEPSEEK_API_KEY'];
    case 'DOUBAO':
      return ['DOUBAO_API_KEY'];
    case 'CUSTOM':
      return [];
  }
}

export function getEnvApiKey(provider: ApiKeyProvider): string | null {
  for (const envVar of envCandidates(provider)) {
    const envValue = process.env[envVar];
    if (isUsableApiKey(envValue)) {
      return envValue.trim();
    }
  }
  return null;
}

export async function getApiKey(provider: ApiKeyProvider): Promise<string | null> {
  const cached = apiKeyCache.get(provider);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.key;
  }

  try {
    const secretKey = SECRET_KEY_MAPPING[provider];
    const vaultValue = await secretVault.getSecret(secretKey);
    if (isUsableApiKey(vaultValue)) {
      const key = vaultValue.trim();
      apiKeyCache.set(provider, { key, timestamp: Date.now() });
      return key;
    }
  } catch (error) {
    logger.error({ error, provider }, '从 SecretVault 获取失败');
  }

  const envVar = ENV_VAR_MAPPING[provider];
  const envValue = getEnvApiKey(provider);
  if (envValue) {
    logger.warn(`[ApiKeyResolver] ⚠️ ${provider} 使用环境变量${envVar ? ` (${envVar})` : ''}，建议迁移至 SecretVault 加密存储`);
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

  return getEnvApiKey(provider);
}

export type { ApiKeyProvider };
