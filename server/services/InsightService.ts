import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';
import type { InsightsProcessing, InsertInsightsProcessing } from '@shared/schema';

const logger = createServiceLogger('InsightService');

export class InsightService {
  /**
   * 获取活跃的洞察处理记录
   */
  async getActiveInsightsProcessing(): Promise<InsightsProcessing[]> {
    return await storage.getActiveInsightsProcessing();
  }

  /**
   * 获取洞察处理记录
   */
  async getInsightsProcessing(id: string): Promise<InsightsProcessing | undefined> {
    return await storage.getInsightsProcessing(id);
  }

  /**
   * 获取会话的洞察处理记录
   */
  async getInsightsProcessingBySession(sessionId: string): Promise<InsightsProcessing | undefined> {
    return await storage.getInsightsProcessingBySession(sessionId);
  }

  /**
   * 创建洞察处理记录
   */
  async createInsightsProcessing(data: InsertInsightsProcessing): Promise<InsightsProcessing> {
    const record = await storage.createInsightsProcessing(data);
    logger.info({ id: record.id, sessionId: record.sessionId }, '洞察处理记录创建成功');
    return record;
  }

  /**
   * 更新洞察处理记录
   */
  async updateInsightsProcessing(id: string, updates: Partial<InsertInsightsProcessing>): Promise<InsightsProcessing | undefined> {
    const record = await storage.updateInsightsProcessing(id, updates);
    if (record) {
      logger.debug({ id }, '洞察处理记录更新成功');
    }
    return record;
  }

  /**
   * 启动洞察处理模拟（保持现有模拟逻辑）
   */
  simulateInsightsProcessing(id: string, sessionId: string): void {
    const stages = [
      { stage: 'transcribing', progress: 20 },
      { stage: 'analyzing', progress: 50 },
      { stage: 'summarizing', progress: 80 },
      { stage: 'completed', progress: 100 }
    ];
    
    let index = 0;
    const interval = setInterval(async () => {
      if (index >= stages.length) {
        clearInterval(interval);
        return;
      }
      
      try {
        await storage.updateInsightsProcessing(id, stages[index]);
      } catch (error) {
        logger.error({ err: error }, '[InsightsProcessing] Update error');
        clearInterval(interval);
      }
      index++;
    }, 3000);
  }
}

export const insightService = new InsightService();