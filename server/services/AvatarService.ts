import { createServiceLogger } from '../lib/logger';
import { storageAdapter } from '../storage/adapter';
import type { 
  AvatarChatHistory, 
  InsertAvatarChatHistory, 
  AvatarUserPreferences, 
  InsertAvatarUserPreferences,
  InsertExpertDecision
} from '@shared/schema';

export interface AvatarChatHistoryScope {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
}

const logger = createServiceLogger('AvatarService');

export class AvatarService {
  /**
   * 保存用户聊天消息
   */
  async saveUserMessage(content: string, role: 'user' = 'user'): Promise<AvatarChatHistory> {
    try {
      const message: InsertAvatarChatHistory = {
        role,
        content,
        feedback: 0,
        isMemorized: 0,
        memoryWeight: 0,
      };
      return await storageAdapter.createChatMessage(message);
    } catch (error) {
      logger.error({ err: error, content, role }, '保存用户消息失败');
      throw error;
    }
  }

  /**
   * 保存AI回复消息
   */
  async saveAIResponse(content: string, role: 'assistant' = 'assistant'): Promise<AvatarChatHistory> {
    try {
      const message: InsertAvatarChatHistory = {
        role,
        content,
        feedback: 0,
        isMemorized: 0,
        memoryWeight: 0,
      };
      return await storageAdapter.createChatMessage(message);
    } catch (error) {
      logger.error({ err: error, content, role }, '保存AI回复失败');
      throw error;
    }
  }

  /**
   * 创建聊天消息（通用方法）
   */
  async createChatMessage(messageData: InsertAvatarChatHistory): Promise<AvatarChatHistory> {
    try {
      return await storageAdapter.createChatMessage(messageData);
    } catch (error) {
      logger.error({ err: error, messageData }, '创建聊天消息失败');
      throw error;
    }
  }

  /**
   * 获取聊天历史
   */
  async getChatHistory(limit?: number, scope?: AvatarChatHistoryScope): Promise<AvatarChatHistory[]> {
    try {
      return await storageAdapter.getChatHistory(limit, scope);
    } catch (error) {
      logger.error({ err: error, limit, scope }, '获取聊天历史失败');
      throw error;
    }
  }

  /**
   * 获取最近聊天上下文
   */
  async getRecentChatContext(limit?: number, scope?: AvatarChatHistoryScope): Promise<AvatarChatHistory[]> {
    try {
      return await storageAdapter.getRecentChatContext(limit, scope);
    } catch (error) {
      logger.error({ err: error, limit, scope }, '获取最近聊天上下文失败');
      throw error;
    }
  }

  /**
   * 更新聊天反馈
   */
  async updateChatFeedback(id: string, feedback: number, note?: string): Promise<AvatarChatHistory | undefined> {
    try {
      return await storageAdapter.updateChatFeedback(id, feedback, note);
    } catch (error) {
      logger.error({ err: error, id, feedback, note }, '更新聊天反馈失败');
      throw error;
    }
  }

  /**
   * 获取记忆的聊天
   */
  async getMemorizedChats(): Promise<AvatarChatHistory[]> {
    try {
      return await storageAdapter.getMemorizedChats();
    } catch (error) {
      logger.error({ err: error }, '获取记忆聊天失败');
      throw error;
    }
  }

  /**
   * 获取用户偏好设置
   */
  async getUserPreferences(): Promise<AvatarUserPreferences | undefined> {
    try {
      return await storageAdapter.getAvatarUserPreferences();
    } catch (error) {
      logger.error({ err: error }, '获取用户偏好设置失败');
      throw error;
    }
  }

  /**
   * 更新用户偏好设置
   */
  async updateUserPreferences(updates: Partial<InsertAvatarUserPreferences>): Promise<AvatarUserPreferences | undefined> {
    try {
      return await storageAdapter.updateAvatarUserPreferences(updates);
    } catch (error) {
      logger.error({ err: error, updates }, '更新用户偏好设置失败');
      throw error;
    }
  }

  /**
   * 增加聊天统计数据
   */
  async incrementChatStats(feedback?: number): Promise<void> {
    try {
      const prefs = await this.getUserPreferences();
      if (!prefs) {
        // 创建默认偏好设置
        await storageAdapter.updateAvatarUserPreferences({
          totalChats: 1,
          positiveCount: feedback === 1 ? 1 : 0,
          negativeCount: feedback === -1 ? 1 : 0,
        });
        return;
      }

      const updates: Partial<InsertAvatarUserPreferences> = {
        totalChats: (prefs.totalChats || 0) + 1,
      };

      if (feedback === 1) {
        updates.positiveCount = (prefs.positiveCount || 0) + 1;
      } else if (feedback === -1) {
        updates.negativeCount = (prefs.negativeCount || 0) + 1;
      }

      await storageAdapter.updateAvatarUserPreferences(updates);
    } catch (error) {
      logger.error({ err: error, feedback }, '增加聊天统计数据失败');
      throw error;
    }
  }

  /**
   * 获取HP余额
   */
  async getHPBalance(): Promise<{ balance: number; maxBalance: number; totalConsumed: number; totalRecharged: number }> {
    try {
      return await storageAdapter.getHPBalance();
    } catch (error) {
      logger.error({ err: error }, '获取HP余额失败');
      throw error;
    }
  }

  /**
   * 消耗HP
   */
  async consumeHP(amount: number, reason: string): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }> {
    try {
      return await storageAdapter.consumeHP(amount, reason);
    } catch (error) {
      logger.error({ err: error, amount, reason }, '消耗HP失败');
      throw error;
    }
  }

  /**
   * 充值HP
   */
  async rechargeHP(amount: number, expandMax?: boolean): Promise<{ success: boolean; newBalance: number; recharged: number; newMaxBalance?: number }> {
    try {
      return await storageAdapter.rechargeHP(amount, expandMax);
    } catch (error) {
      logger.error({ err: error, amount, expandMax }, '充值HP失败');
      throw error;
    }
  }

  /**
   * 创建专家决策
   */
  async createExpertDecision(decisionData: unknown): Promise<unknown> {
    try {
      return await storageAdapter.createExpertDecision(decisionData as InsertExpertDecision);
    } catch (error) {
      logger.error({ err: error, decisionData }, '创建专家决策失败');
      throw error;
    }
  }
}

export const avatarService = new AvatarService();
