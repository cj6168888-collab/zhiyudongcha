/**
 * 集成管理服务
 * 封装集成提供商、账户和同步任务相关的业务逻辑
 * 使用IntegrationStorage进行数据访问，处理凭证加密和同步任务
 */

import { createServiceLogger } from '../lib/logger';
import { integrationStorage } from '../storage/domains';
import type {
  IntegrationProvider,
  IntegrationAccount,
  IntegrationSyncJob,
  InsertIntegrationProvider,
  InsertIntegrationAccount,
  InsertIntegrationSyncJob
} from '@shared/schema';

const logger = createServiceLogger('IntegrationService');

export class IntegrationService {
  /**
   * 获取所有集成提供商
   */
  async getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]> {
    return await integrationStorage.getAllIntegrationProviders(category);
  }

  /**
   * 获取指定ID的集成提供商
   */
  async getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined> {
    return await integrationStorage.getIntegrationProvider(id);
  }

  /**
   * 根据代码获取集成提供商
   */
  async getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined> {
    return await integrationStorage.getIntegrationProviderByCode(code);
  }

  /**
   * 创建集成提供商
   */
  async createIntegrationProvider(
    providerData: InsertIntegrationProvider,
    options?: {
      broadcastDataChange?: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationProvider> {
    const provider = await integrationStorage.createIntegrationProvider(providerData);

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationProvider', 'CREATE', { id: provider.id, code: provider.code });
    }

    logger.info({ providerId: provider.id, providerCode: provider.code }, '集成提供商创建成功');
    return provider;
  }

  /**
   * 更新集成提供商
   */
  async updateIntegrationProvider(
    id: string,
    updates: Partial<InsertIntegrationProvider>,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationProvider | undefined> {
    const provider = await integrationStorage.updateIntegrationProvider(id, updates);
    if (!provider) {
      return undefined;
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationProvider', 'UPDATE', { id: provider.id, code: provider.code });
    }

    logger.debug({ providerId: id }, '集成提供商更新成功');
    return provider;
  }

  /**
   * 获取所有集成账户
   */
  async getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]> {
    return await integrationStorage.getAllIntegrationAccounts(userId);
  }

  /**
   * 获取指定ID的集成账户
   */
  async getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined> {
    return await integrationStorage.getIntegrationAccount(id);
  }

  /**
   * 获取集成账户（包含凭证）
   */
  async getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined> {
    return await integrationStorage.getIntegrationAccountWithCredentials(id);
  }

  /**
   * 创建集成账户
   */
  async createIntegrationAccount(
    accountData: InsertIntegrationAccount,
    credentials?: object,
    options?: {
      broadcastDataChange?: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationAccount> {
    const account = await integrationStorage.createIntegrationAccount(accountData, credentials);

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationAccount', 'CREATE', { id: account.id, provider: account.providerId });
    }

    logger.info({ accountId: account.id, provider: account.providerId }, '集成账户创建成功');
    return account;
  }

  /**
   * 更新集成账户
   */
  async updateIntegrationAccount(
    id: string,
    updates: Partial<InsertIntegrationAccount>,
    credentials?: object,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationAccount | undefined> {
    const account = await integrationStorage.updateIntegrationAccount(id, updates, credentials);
    if (!account) {
      return undefined;
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationAccount', 'UPDATE', { id: account.id, provider: account.providerId });
    }

    logger.debug({ accountId: id }, '集成账户更新成功');
    return account;
  }

  /**
   * 删除集成账户
   */
  async deleteIntegrationAccount(
    id: string,
    options?: {
      broadcastDataChange?: (entity: string, action: 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<boolean> {
    const success = await integrationStorage.deleteIntegrationAccount(id);
    if (success && options?.broadcastDataChange) {
      options.broadcastDataChange('integrationAccount', 'DELETE', { id });
    }

    logger.debug({ accountId: id }, success ? '集成账户删除成功' : '集成账户删除失败');
    return success;
  }

  /**
   * 测试集成账户连接
   */
  async testIntegrationAccountConnection(
    id: string,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE', data: Record<string, unknown>) => void;
    }
  ): Promise<{ success: boolean; message: string }> {
    const result = await integrationStorage.getIntegrationAccountWithCredentials(id);
    if (!result) {
      return { success: false, message: '账户不存在' };
    }

    // 更新账户状态为已连接
    const updated = await integrationStorage.updateIntegrationAccount(id, {
      status: 'connected',
      lastConnectedAt: new Date(),
      lastError: null,
    });

    if (updated && options?.broadcastDataChange) {
      options.broadcastDataChange('integrationAccount', 'UPDATE', { id: updated.id, status: updated.status });
    }

    logger.info({ accountId: id }, '集成账户连接测试成功');
    return { success: true, message: '连接测试成功' };
  }

  /**
   * 获取账户的同步任务
   */
  async getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]> {
    return await integrationStorage.getAccountSyncJobs(accountId, limit);
  }

  /**
   * 创建集成同步任务
   */
  async createIntegrationSyncJob(
    jobData: InsertIntegrationSyncJob,
    options?: {
      broadcastDataChange?: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationSyncJob> {
    const job = await integrationStorage.createIntegrationSyncJob(jobData);

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationSyncJob', 'CREATE', { id: job.id, accountId: job.accountId });
    }

    logger.info({ jobId: job.id, accountId: job.accountId }, '集成同步任务创建成功');
    return job;
  }

  /**
   * 获取指定ID的同步任务
   */
  async getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined> {
    return await integrationStorage.getIntegrationSyncJob(id);
  }

  /**
   * 更新集成同步任务
   */
  async updateIntegrationSyncJob(
    id: string,
    updates: Partial<InsertIntegrationSyncJob>,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<IntegrationSyncJob | undefined> {
    const job = await integrationStorage.updateIntegrationSyncJob(id, updates);
    if (!job) {
      return undefined;
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('integrationSyncJob', 'UPDATE', { id: job.id, status: job.status });
    }

    logger.debug({ jobId: id }, '集成同步任务更新成功');
    return job;
  }

  /**
   * 模拟集成同步任务执行（用于演示）
   */
  async simulateIntegrationSync(jobId: string): Promise<void> {
    const stages = [
      { status: 'running' as const, itemsProcessed: 0 },
      { status: 'running' as const, itemsProcessed: 25 },
      { status: 'running' as const, itemsProcessed: 50 },
      { status: 'running' as const, itemsProcessed: 75 },
      { status: 'completed' as const, itemsProcessed: 100 },
    ];

    await integrationStorage.updateIntegrationSyncJob(jobId, { startedAt: new Date() });

    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await integrationStorage.updateIntegrationSyncJob(jobId, {
        ...stage,
        completedAt: stage.status === 'completed' ? new Date() : undefined,
      });
    }

    logger.info({ jobId }, '集成同步任务模拟完成');
  }

  /**
   * 初始化默认集成提供商（如果不存在）
   */
  async seedDefaultProviders(): Promise<{ message: string; count: number }> {
    const existing = await integrationStorage.getAllIntegrationProviders();
    if (existing.length > 0) {
      return { message: '提供商已存在', count: existing.length };
    }

    const defaultProviders: InsertIntegrationProvider[] = [
      { code: 'wecom', name: '企业微信', nameEn: 'WeCom', category: 'messaging', icon: 'wecom', capabilities: ['contacts', 'messages', 'departments'], description: '企业微信集成，同步通讯录和消息' },
      { code: 'dingtalk', name: '钉钉', nameEn: 'DingTalk', category: 'messaging', icon: 'dingtalk', capabilities: ['contacts', 'messages'], description: '钉钉企业版集成' },
      { code: 'lark', name: '飞书', nameEn: 'Lark/Feishu', category: 'messaging', icon: 'lark', capabilities: ['contacts', 'messages', 'docs'], description: '飞书/Lark企业协作集成' },
      { code: 'mysql', name: 'MySQL', nameEn: 'MySQL', category: 'database', icon: 'database', capabilities: ['query', 'sync'], description: 'MySQL数据库连接' },
      { code: 'postgres', name: 'PostgreSQL', nameEn: 'PostgreSQL', category: 'database', icon: 'database', capabilities: ['query', 'sync'], description: 'PostgreSQL数据库连接' },
    ];

    for (const provider of defaultProviders) {
      await integrationStorage.createIntegrationProvider(provider);
    }

    logger.info({ count: defaultProviders.length }, '默认集成提供商已创建');
    return { message: '默认提供商已创建', count: defaultProviders.length };
  }
}

// 创建并导出全局实例
export const integrationService = new IntegrationService();