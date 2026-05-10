/**
 * 影子内存管理服务
 * 封装影子内存相关的业务逻辑，用于学习和经验积累
 */

import { createServiceLogger } from '../lib/logger';
import { shadowMemoryRepository } from '../repositories/memory.repository';
import type { ShadowMemory, InsertShadowMemory } from '@shared/schema';

const logger = createServiceLogger('MemoryService');

export class MemoryService {
  /**
   * 获取所有影子内存
   */
  async getAllMemories(): Promise<ShadowMemory[]> {
    return await shadowMemoryRepository.findAll();
  }

  /**
   * 创建新影子内存
   */
  async createMemory(memory: InsertShadowMemory): Promise<ShadowMemory> {
    return await shadowMemoryRepository.create(memory);
  }

  /**
   * 根据字段获取影子内存
   */
  async getMemoriesByField(field: string): Promise<ShadowMemory[]> {
    return await shadowMemoryRepository.getByField(field);
  }

  /**
   * 获取最近的影子内存
   */
  async getRecentMemories(limit: number = 50): Promise<ShadowMemory[]> {
    return await shadowMemoryRepository.getRecentMemories(limit);
  }

  /**
   * 获取高模仿权重的影子内存
   */
  async getMemoriesByMimicryWeight(minWeight: number): Promise<ShadowMemory[]> {
    return await shadowMemoryRepository.getByMimicryWeight(minWeight);
  }

  /**
   * 获取内存统计信息
   */
  async getMemoryStats(): Promise<{
    totalMemories: number;
    byField: Record<string, number>;
    totalExpPoints: number;
  }> {
    const memories = await this.getAllMemories();
    const byField: Record<string, number> = {};
    let totalExpPoints = 0;

    memories.forEach(memory => {
      const field = memory.field || 'unknown';
      byField[field] = (byField[field] || 0) + 1;
      totalExpPoints += memory.expPoints || 0;
    });

    return {
      totalMemories: memories.length,
      byField,
      totalExpPoints,
    };
  }
}

// 创建并导出全局实例
export const memoryService = new MemoryService();