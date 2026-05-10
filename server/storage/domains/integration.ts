import { integrationProviderRepository, integrationAccountRepository, integrationSyncJobRepository } from '../../repositories';
import type { IntegrationProvider, IntegrationAccount, IntegrationSyncJob, InsertIntegrationProvider, InsertIntegrationAccount, InsertIntegrationSyncJob } from '@shared/schema';

export interface IIntegrationStorage {
  createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider>;
  getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined>;
  getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined>;
  getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]>;
  updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined>;
  
  createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount>;
  getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined>;
  getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined>;
  getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]>;
  updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined>;
  deleteIntegrationAccount(id: string): Promise<boolean>;
  
  createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob>;
  getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined>;
  getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]>;
  updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined>;
}

export class IntegrationStorage implements IIntegrationStorage {
  async createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider> {
    return await integrationProviderRepository.create(provider);
  }

  async getIntegrationProvider(id: string): Promise<IntegrationProvider | undefined> {
    return await integrationProviderRepository.findById(id);
  }

  async getIntegrationProviderByCode(code: string): Promise<IntegrationProvider | undefined> {
    return await integrationProviderRepository.getByCode(code);
  }

  async getAllIntegrationProviders(category?: string): Promise<IntegrationProvider[]> {
    return await integrationProviderRepository.getAll(category);
  }

  async updateIntegrationProvider(id: string, updates: Partial<InsertIntegrationProvider>): Promise<IntegrationProvider | undefined> {
    return await integrationProviderRepository.update(id, updates);
  }
  
  async createIntegrationAccount(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount> {
    return await integrationAccountRepository.createWithCredentials(account, credentials);
  }

  async getIntegrationAccount(id: string): Promise<IntegrationAccount | undefined> {
    return await integrationAccountRepository.findById(id);
  }

  async getIntegrationAccountWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined> {
    return await integrationAccountRepository.getWithCredentials(id);
  }

  async getAllIntegrationAccounts(userId?: string): Promise<IntegrationAccount[]> {
    return await integrationAccountRepository.getAll(userId);
  }

  async updateIntegrationAccount(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined> {
    return await integrationAccountRepository.updateWithCredentials(id, updates, credentials);
  }

  async deleteIntegrationAccount(id: string): Promise<boolean> {
    return await integrationAccountRepository.delete(id);
  }
  
  async createIntegrationSyncJob(job: InsertIntegrationSyncJob): Promise<IntegrationSyncJob> {
    return await integrationSyncJobRepository.create(job);
  }

  async getIntegrationSyncJob(id: string): Promise<IntegrationSyncJob | undefined> {
    return await integrationSyncJobRepository.findById(id);
  }

  async getAccountSyncJobs(accountId: string, limit?: number): Promise<IntegrationSyncJob[]> {
    return await integrationSyncJobRepository.getByAccount(accountId, limit);
  }

  async updateIntegrationSyncJob(id: string, updates: Partial<InsertIntegrationSyncJob>): Promise<IntegrationSyncJob | undefined> {
    return await integrationSyncJobRepository.update(id, updates);
  }
}

export const integrationStorage = new IntegrationStorage();
