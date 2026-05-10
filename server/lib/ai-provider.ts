import { createServiceLogger } from './logger';
import { AIServiceError, TimeoutError } from './errors';

const log = createServiceLogger('AIProvider');

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  stream?: boolean;
}

export interface AICompletionResult {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export type AIProviderName = 'dashscope' | 'deepseek' | 'doubao';

interface ProviderConfig {
  name: AIProviderName;
  apiKey: string | undefined;
  baseUrl: string;
  defaultModel: string;
  available: boolean;
}

const PROVIDER_CONFIGS: Record<AIProviderName, Omit<ProviderConfig, 'apiKey' | 'available'>> = {
  dashscope: {
    name: 'dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  deepseek: {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  doubao: {
    name: 'doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'ep-20240101000000-xxxxx',
  },
};

function getProviderConfig(name: AIProviderName): ProviderConfig {
  const base = PROVIDER_CONFIGS[name];
  let apiKey: string | undefined;
  
  switch (name) {
    case 'dashscope':
      apiKey = process.env.DASHSCOPE_API_KEY;
      break;
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY;
      break;
    case 'doubao':
      apiKey = process.env.DOUBAO_API_KEY;
      break;
  }
  
  return {
    ...base,
    apiKey,
    available: !!apiKey,
  };
}

async function callProvider(
  config: ProviderConfig,
  options: AICompletionOptions
): Promise<AICompletionResult> {
  if (!config.apiKey) {
    throw new AIServiceError(
      `${config.name} API密钥未配置`,
      config.name,
      false
    );
  }

  const timeout = options.timeout || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = Date.now();

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new AIServiceError(
        `${config.name} API错误: ${response.status} - ${errorBody}`,
        config.name,
        response.status >= 500 || response.status === 429
      );
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    log.debug({
      provider: config.name,
      model: options.model || config.defaultModel,
      latencyMs,
      tokens: data.usage?.total_tokens,
    }, 'AI调用完成');

    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: config.name,
      model: options.model || config.defaultModel,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      latencyMs,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`${config.name} AI调用`, timeout);
    }

    if (error instanceof AIServiceError) {
      throw error;
    }

    throw new AIServiceError(
      `${config.name} 调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
      config.name,
      true
    );
  }
}

export class AIProviderChain {
  private providers: AIProviderName[];
  private failureCount: Map<AIProviderName, number> = new Map();
  private lastFailure: Map<AIProviderName, number> = new Map();
  private readonly failureThreshold = 3;
  private readonly recoveryTimeMs = 60000;

  constructor(providers: AIProviderName[] = ['dashscope', 'deepseek', 'doubao']) {
    this.providers = providers.filter(p => getProviderConfig(p).available);
    
    if (this.providers.length === 0) {
      log.warn('没有可用的AI提供商，请检查API密钥配置');
    } else {
      log.info({ providers: this.providers }, 'AI提供商链初始化完成');
    }
  }

  private isProviderHealthy(name: AIProviderName): boolean {
    const failures = this.failureCount.get(name) || 0;
    const lastFail = this.lastFailure.get(name) || 0;
    
    if (failures >= this.failureThreshold) {
      if (Date.now() - lastFail > this.recoveryTimeMs) {
        this.failureCount.set(name, 0);
        log.info({ provider: name }, '提供商已恢复健康状态');
        return true;
      }
      return false;
    }
    
    return true;
  }

  private recordFailure(name: AIProviderName): void {
    const current = this.failureCount.get(name) || 0;
    this.failureCount.set(name, current + 1);
    this.lastFailure.set(name, Date.now());
    
    if (current + 1 >= this.failureThreshold) {
      log.warn({ provider: name, failures: current + 1 }, '提供商已标记为不健康');
    }
  }

  private recordSuccess(name: AIProviderName): void {
    this.failureCount.set(name, 0);
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    let healthyProviders = this.providers.filter(p => this.isProviderHealthy(p));
    
    if (healthyProviders.length === 0) {
      const fallback: AIProviderName[] = this.providers.length > 0 ? this.providers : ['dashscope'];
      healthyProviders = fallback;
      log.warn('所有提供商不健康，尝试强制使用');
    }

    const errors: Array<{ provider: string; error: string }> = [];

    for (const providerName of healthyProviders) {
      const config = getProviderConfig(providerName);
      
      if (!config.available) {
        continue;
      }

      try {
        log.debug({ provider: providerName }, '尝试AI调用');
        const result = await callProvider(config, options);
        this.recordSuccess(providerName);
        return result;
      } catch (error) {
        this.recordFailure(providerName);
        
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        errors.push({ provider: providerName, error: errorMsg });
        
        log.warn({ provider: providerName, error: errorMsg }, 'AI调用失败，尝试下一个提供商');
        
        if (error instanceof AIServiceError && !error.retryable) {
          continue;
        }
      }
    }

    log.error({ errors }, '所有AI提供商调用失败');
    throw new AIServiceError(
      '所有AI服务暂时不可用，请稍后重试',
      'all',
      true,
      { errors }
    );
  }

  async chat(
    message: string,
    systemPrompt?: string,
    options?: Partial<AICompletionOptions>
  ): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: message });

    const result = await this.complete({ messages, ...options });
    return result.content;
  }

  getAvailableProviders(): AIProviderName[] {
    return this.providers.filter(p => this.isProviderHealthy(p));
  }

  getProviderStatus(): Record<AIProviderName, { available: boolean; healthy: boolean; failures: number }> {
    const providerNames: AIProviderName[] = ['dashscope', 'deepseek', 'doubao'];
    const status = {} as Record<AIProviderName, { available: boolean; healthy: boolean; failures: number }>;
    
    for (const name of providerNames) {
      const config = getProviderConfig(name);
      status[name] = {
        available: config.available,
        healthy: this.isProviderHealthy(name),
        failures: this.failureCount.get(name) || 0,
      };
    }
    
    return status;
  }
}

export const aiProvider = new AIProviderChain();

export async function chatWithAI(
  message: string,
  systemPrompt?: string,
  options?: Partial<AICompletionOptions>
): Promise<string> {
  return aiProvider.chat(message, systemPrompt, options);
}

export async function completeWithAI(options: AICompletionOptions): Promise<AICompletionResult> {
  return aiProvider.complete(options);
}
