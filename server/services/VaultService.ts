/**
 * 保险库管理服务
 * 封装保险库相关的业务逻辑，包括资源管理、搜索和粉碎操作
 * 使用VaultStorage进行数据访问，处理记忆创建和广播通知
 */

import { createServiceLogger } from '../lib/logger';
import { vaultStorage } from '../storage/domains';
import type { VaultItem, InsertVaultItem } from '@shared/schema';

const logger = createServiceLogger('VaultService');

export class VaultService {
  /**
   * 获取所有保险库项目
   */
  async getAllVaultItems(zone?: string): Promise<VaultItem[]> {
    return await vaultStorage.getAllVaultItems(zone);
  }

  /**
   * 获取指定ID的保险库项目
   */
  async getVaultItem(id: string): Promise<VaultItem | undefined> {
    return await vaultStorage.getVaultItem(id);
  }

  /**
   * 创建新保险库项目
   */
  async createVaultItem(
    itemData: InsertVaultItem,
    options?: {
      broadcastDataChange?: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<VaultItem> {
    const item = await vaultStorage.createVaultItem(itemData);

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('vault', 'CREATE', { id: item.id, fileName: item.fileName });
    }

    logger.info({ vaultItemId: item.id, fileName: item.fileName }, '保险库项目创建成功');
    return item;
  }

  /**
   * 更新保险库项目
   */
  async updateVaultItem(
    id: string,
    updates: Partial<InsertVaultItem>,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE', data: Record<string, unknown>) => void;
    }
  ): Promise<VaultItem | undefined> {
    const item = await vaultStorage.updateVaultItem(id, updates);
    if (!item) {
      return undefined;
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('vault', 'UPDATE', { id: item.id, fileName: item.fileName });
    }

    logger.debug({ vaultItemId: id }, '保险库项目更新成功');
    return item;
  }

  /**
   * 删除保险库项目
   */
  async deleteVaultItem(
    id: string,
    options?: {
      broadcastDataChange?: (entity: string, action: 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<boolean> {
    const success = await vaultStorage.deleteVaultItem(id);
    if (success && options?.broadcastDataChange) {
      options.broadcastDataChange('vault', 'DELETE', { id });
    }
    logger.debug({ vaultItemId: id }, success ? '保险库项目删除成功' : '保险库项目删除失败');
    return success;
  }

  /**
   * 通过语义标签搜索保险库项目
   */
  async searchVaultBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await vaultStorage.searchVaultBySemanticTag(tag);
  }

  /**
   * 通过意图搜索保险库项目
   */
  async searchVaultByIntent(intent: string): Promise<VaultItem[]> {
    return await vaultStorage.searchVaultByIntent(intent);
  }

  /**
   * 永久粉碎目标（人员或保险库项目）
   */
  async permanentShred(
    targetId: string,
    table: 'vault' | 'person',
    options?: {
      auditAction?: (action: string, role: string, entity: string, entityId: string, details: object, result: string, req?: unknown) => Promise<void>;
      userRole?: string;
      request?: unknown;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (table === 'vault') {
        const item = await this.getVaultItem(targetId);
        if (!item) {
          return { success: false, message: 'Target not found in vault' };
        }
        
        logger.info({ fileName: item.fileName }, 'Initiating physical shredding for vault item');
        await this.deleteVaultItem(targetId);
        
        if (options?.auditAction) {
          await options.auditAction(
            'SHRED_COMPLETE',
            options.userRole || 'MASTER',
            'vault',
            targetId,
            { fileName: item.fileName },
            'SUCCESS',
            options.request
          );
        }
        
        return { success: true, message: `[SHRED COMPLETE] ${item.fileName} has been permanently destroyed` };
      } else {
        // Person shredding handled by PersonService
        // This is a placeholder; actual implementation would delegate to PersonService
        return { success: false, message: 'Person shredding must be performed via PersonService' };
      }
    } catch (error) {
      if (options?.auditAction) {
        await options.auditAction(
          'SHRED_FAILED',
          options.userRole || 'MASTER',
          table,
          targetId,
          { error: String(error) },
          'FAILED',
          options.request
        );
      }
      return { success: false, message: `Shredding failed: ${error}` };
    }
  }

  /**
   * 获取保险库统计信息
   */
  async getVaultStats(): Promise<{
    totalDownloads: number;
    activeDownloads: number;
    totalComputeJobs: number;
    activeComputeJobs: number;
    totalDreams: number;
    categories: Record<string, number>;
  }> {
    // 注意：此方法需要整合下载任务、计算任务和梦想日志的统计
    // 暂时返回简化数据
    const items = await this.getAllVaultItems();
    const categories: Record<string, number> = { RESEARCH: 0, SOFTWARE: 0, MEDIA: 0, BOOKS: 0 };
    items.forEach(item => {
      if (item.category && categories[item.category] !== undefined) {
        categories[item.category]++;
      }
    });

    // 实际项目中需要从其他存储中获取数据
    return {
      totalDownloads: 0,
      activeDownloads: 0,
      totalComputeJobs: 0,
      activeComputeJobs: 0,
      totalDreams: 0,
      categories,
    };
  }

  /**
   * 根据类别获取保险库项目
   */
  async getVaultItemsByCategory(category: string): Promise<VaultItem[]> {
    const allItems = await this.getAllVaultItems();
    return allItems.filter(item => item.category === category);
  }
}

// 创建并导出全局实例
export const vaultService = new VaultService();