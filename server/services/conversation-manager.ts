import { createServiceLogger } from '../lib/logger';
import { AppError, asyncHandler } from '../middleware/unified-error-handler';
import type { IStorage } from '../storage';

import type { ConversationSegment } from '@shared/schema';

import type { InsertConversationSegment } from '@shared/schema';

import type { TalkSession } from '@shared/schema';

const logger = createServiceLogger('ConversationManager');

// 对话上下文接口
export interface ConversationContext {
  id: string;
  userId: string;
  messages: unknown[];
  state: ConversationState;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// 对话状态枚举
export enum ConversationState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned'
}

// 消息接口
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// 对话管理器 - 单一职责：管理对话生命周期
export class ConversationManager {
  constructor(private storage: IStorage) {}

  async createConversation(userId: string): Promise<ConversationContext> {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const context: ConversationContext = {
      id: conversationId,
      userId,
      messages: [],
      state: ConversationState.ACTIVE,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveContext(context);
    logger.info('创建新对话', { conversationId, userId });
    
    return context;
  }

  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    try {
      const stored = await this.storage.getConversation(conversationId);
      if (!stored) return null;

      return {
        id: conversationId,
        userId: stored.userId,
        messages: stored.messages || [],
        state: stored.state || ConversationState.ACTIVE,
        metadata: stored.metadata || {},
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
      };
    } catch (error) {
      logger.error('获取对话失败', { conversationId, error });
      throw new AppError('获取对话失败', 'INTERNAL_SERVER_ERROR', 500, { conversationId });
    }
  }

  async updateContext(conversationId: string, updates: Partial<ConversationContext>): Promise<void> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      throw new AppError('对话不存在', 'NOT_FOUND', 404, { conversationId });
    }

    const updatedContext: ConversationContext = {
      ...context,
      ...updates,
      updatedAt: new Date(),
    };

    await this.saveContext(updatedContext);
    logger.debug('更新对话上下文', { conversationId, updates });
  }

  async addMessage(conversationId: string, message: ConversationMessage): Promise<void> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      throw new AppError('对话不存在', 'NOT_FOUND', 404, { conversationId });
    }

    context.messages.push(message);
    context.updatedAt = new Date();

    await this.saveContext(context);
    logger.debug('添加对话消息', { conversationId, role: message.role, contentLength: message.content.length });
  }

  async getRecentMessages(conversationId: string, limit: number = 10): Promise<ConversationMessage[]> {
    const context = await this.getConversation(conversationId);
    if (!context) return [];

    return context.messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(-limit);
  }

  async getUserConversations(userId: string, limit: number = 50): Promise<ConversationContext[]> {
    // 这里需要从存储中获取用户的所有对话
    // 简化实现，实际应该在存储层实现
    logger.debug('获取用户对话列表', { userId, limit });
    
    // 模拟实现
    return [];
  }

  async closeConversation(conversationId: string): Promise<void> {
    await this.updateContext(conversationId, {
      state: ConversationState.COMPLETED
    });
    
    logger.info('关闭对话', { conversationId });
  }

  async pauseConversation(conversationId: string): Promise<void> {
    await this.updateContext(conversationId, {
      state: ConversationState.PAUSED
    });
    
    logger.info('暂停对话', { conversationId });
  }

  async resumeConversation(conversationId: string): Promise<void> {
    await this.updateContext(conversationId, {
      state: ConversationState.ACTIVE
    });
    
    logger.info('恢复对话', { conversationId });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const context = await this.getConversation(conversationId);
    if (!context) return;

    await this.storage.deleteConversation(conversationId);
    logger.info('删除对话', { conversationId, userId: context.userId });
  }

  async cleanupOldConversations(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAge);
    
    // 清理旧的已完成对话
    logger.info('清理旧对话', { cutoffDate });
    
    // 这里需要在存储层实现清理逻辑
  }

  private async saveContext(context: ConversationContext): Promise<void> {
    await this.storage.saveConversation(context.id, {
      userId: context.userId,
      messages: context.messages,
      state: context.state,
      metadata: context.metadata,
      createdAt: context.createdAt.toISOString(),
      updatedAt: context.updatedAt.toISOString(),
    });
  }
}