import { createServiceLogger } from '../lib/logger';
import { AppError, asyncHandler, BusinessError } from '../middleware/unified-error-handler';
import type { IStorage } from '../storage';

const logger = createServiceLogger('AIConversationService');

// AI对话请求接口
export interface AIConversationRequest {
  conversationId: string;
  userId: string;
  message: string;
  context?: Record<string, any>;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    provider?: string;
  };
}

// AI对话响应接口
export interface AIConversationResponse {
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    model: string;
    provider: string;
    responseTime: number;
  };
}

// AI服务抽象接口
interface AIService {
  name: string;
  chat(request: AIConversationRequest): Promise<AIConversationResponse>;
  isAvailable(): Promise<boolean>;
}

// AI服务提供商实现
class DashScopeService implements AIService {
  name = 'dashscope';
  
  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: { messages: [{ role: 'user', content: '测试' }] },
          parameters: { max_tokens: 10 },
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(request: AIConversationRequest): Promise<AIConversationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.options?.model || 'qwen-turbo',
          input: {
            messages: [
              { role: 'system', content: '你是小智AI助手，一个智能对话助手。' },
              { role: 'user', content: request.message },
            ],
          },
          parameters: {
            temperature: request.options?.temperature || 0.7,
            max_tokens: request.options?.maxTokens || 2000,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`DashScope API错误: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      return {
        response: data.output?.text || '',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        metadata: {
          model: request.options?.model || 'qwen-turbo',
          provider: this.name,
          responseTime,
        },
      };
    } catch (error) {
      logger.error('DashScope服务调用失败', { error: error.message });
      throw new AppError('AI服务调用失败', 'EXTERNAL_SERVICE_ERROR', 502, {
        provider: this.name,
        error: error.message,
      });
    }
  }
}

// AI服务管理器
class AIServiceManager {
  private services: Map<string, AIService> = new Map();

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    const dashScopeKey = process.env.DASHSCOPE_API_KEY;
    if (dashScopeKey) {
      this.services.set('dashscope', new DashScopeService(dashScopeKey));
    }
    
    // 可以在这里添加其他AI服务提供商
    logger.info('AI服务管理器初始化完成', { 
      availableServices: Array.from(this.services.keys()) 
    });
  }

  getService(provider: string): AIService {
    const service = this.services.get(provider);
    if (!service) {
      throw new BusinessError(`不支持的AI服务提供商: ${provider}`, 'OPERATION_NOT_ALLOWED');
    }
    return service;
  }

  async getAvailableService(): Promise<string> {
    for (const [provider, service] of this.services.entries()) {
      if (await service.isAvailable()) {
        return provider;
      }
    }
    
    throw new AppError('所有AI服务都不可用', 'AI_SERVICE_UNAVAILABLE', 503);
  }

  async chat(request: AIConversationRequest): Promise<AIConversationResponse> {
    const provider = request.options?.provider || await this.getAvailableService();
    const service = this.getService(provider);
    
    logger.info('调用AI服务', { provider, messageLength: request.message.length });
    
    const response = await service.chat(request);
    
    // 记录使用统计
    await this.logUsage(provider, response.usage, request.userId);
    
    return response;
  }

  private async logUsage(provider: string, usage: unknown, userId: string): Promise<void> {
    logger.info('AI服务使用统计', {
      provider,
      userId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });
  }
}

// AI对话服务 - 单一职责：处理AI对话逻辑
export class AIConversationService {
  constructor(
    private aiManager: AIServiceManager,
    private conversationManager: ConversationManager
  ) {}

  async processMessage(request: AIConversationRequest): Promise<AIConversationResponse> {
    logger.info('处理AI对话请求', { 
      conversationId: request.conversationId,
      userId: request.userId,
      messageLength: request.message.length 
    });

    try {
      // 检查对话是否存在
      const context = await this.conversationManager.getConversation(request.conversationId);
      if (!context) {
        throw new AppError('对话不存在', 'NOT_FOUND', 404, { conversationId: request.conversationId });
      }

      // 构建对话历史
      const messages = await this.conversationManager.getRecentMessages(request.conversationId, 10);
      const chatMessages = [
        { role: 'system', content: '你是小智AI助手，一个智能对话助手。' },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: request.message },
      ];

      // 调用AI服务
      const aiResponse = await this.aiManager.chat({
        ...request,
        context: { ...request.context, conversationHistory: messages },
      });

      // 保存用户消息
      await this.conversationManager.addMessage(request.conversationId, {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        role: 'user',
        content: request.message,
        timestamp: new Date(),
        metadata: { usage: aiResponse.usage },
      });

      // 保存AI响应
      await this.conversationManager.addMessage(request.conversationId, {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date(),
        metadata: {
          provider: aiResponse.metadata?.provider || 'unknown',
          model: aiResponse.metadata?.model || 'unknown',
          usage: aiResponse.usage,
          responseTime: aiResponse.metadata?.responseTime || 0,
        },
      });

      logger.info('AI对话处理完成', {
        conversationId: request.conversationId,
        provider: aiResponse.metadata?.provider,
        responseTime: aiResponse.metadata?.responseTime,
        totalTokens: aiResponse.usage.totalTokens,
      });

      return aiResponse;

    } catch (error) {
      logger.error('AI对话处理失败', { 
        conversationId: request.conversationId,
        error: error.message,
        stack: error.stack 
      });

      // 如果是业务错误，直接抛出
      if (error instanceof AppError) {
        throw error;
      }

      // 其他错误转换为通用错误
      throw new AppError(
        `AI对话处理失败: ${error.message}`,
        'INTERNAL_SERVER_ERROR',
        500,
        { conversationId: request.conversationId }
      );
    }
  }

  async getConversationHistory(conversationId: string, userId: string): Promise<ConversationMessage[]> {
    // 验证用户权限
    const context = await this.conversationManager.getConversation(conversationId);
    if (!context || context.userId !== userId) {
      throw new AppError('无权访问此对话', 'FORBIDDEN', 403, { conversationId });
    }

    return await this.conversationManager.getRecentMessages(conversationId, 50);
  }

  async getConversationStats(conversationId: string, userId: string): Promise<{
    messageCount: number;
    tokenUsage: number;
    firstMessage: Date;
    lastMessage: Date;
    duration: number;
  }> {
    const context = await this.conversationManager.getConversation(conversationId);
    if (!context || context.userId !== userId) {
      throw new AppError('无权访问此对话', 'FORBIDDEN', 403, { conversationId });
    }

    const messages = await this.conversationManager.getRecentMessages(conversationId, 1000);
    const totalTokens = messages.reduce((sum, msg) => 
      sum + (msg.metadata?.usage?.totalTokens || 0), 0
    );

    return {
      messageCount: messages.length,
      tokenUsage: totalTokens,
      firstMessage: messages[0]?.timestamp || new Date(),
      lastMessage: messages[messages.length - 1]?.timestamp || new Date(),
      duration: context.updatedAt.getTime() - context.createdAt.getTime(),
    };
  }
}

// 导出工厂函数
export function createAIConversationService(storage: IStorage): AIConversationService {
  const aiManager = new AIServiceManager();
  const conversationManager = new ConversationManager(storage);
  
  return new AIConversationService(aiManager, conversationManager);
}