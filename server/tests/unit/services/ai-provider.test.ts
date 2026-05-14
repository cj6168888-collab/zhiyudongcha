import { afterEach, describe, expect, it, vi } from 'vitest';

describe('AIProviderChain provider availability', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not include placeholder API keys in the active provider chain', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'sk-dashscope-real');
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-deepseek-real');
    vi.stubEnv('DOUBAO_API_KEY', 'your_doubao_api_key');

    const { AIProviderChain } = await import('../../../lib/ai-provider');
    const chain = new AIProviderChain();

    expect(chain.getAvailableProviders()).toEqual(['dashscope', 'deepseek']);
    expect(chain.getProviderStatus()).toMatchObject({
      dashscope: { configured: true, available: true },
      deepseek: { configured: true, available: true },
      doubao: { configured: false, available: false },
    });
  });
});
