import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEnvApiKey, isUsableApiKey } from '../../../services/api-key-resolver';

describe('api-key-resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects empty and placeholder API keys', () => {
    expect(isUsableApiKey(undefined)).toBe(false);
    expect(isUsableApiKey('')).toBe(false);
    expect(isUsableApiKey('your_api_key')).toBe(false);
    expect(isUsableApiKey('your..._key')).toBe(false);
    expect(isUsableApiKey('xxxxx')).toBe(false);
    expect(isUsableApiKey('sk-real-looking-key')).toBe(true);
  });

  it('accepts DashScope aliases for Tongyi/Qwen keys', () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.stubEnv('QWEN_API_KEY', 'sk-qwen-real');

    expect(getEnvApiKey('DASHSCOPE')).toBe('sk-qwen-real');
  });

  it('does not treat placeholder Doubao values as configured', () => {
    vi.stubEnv('DOUBAO_API_KEY', 'your_doubao_api_key');

    expect(getEnvApiKey('DOUBAO')).toBeNull();
  });
});
