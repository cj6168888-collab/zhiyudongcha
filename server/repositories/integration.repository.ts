import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  integrationProviders, integrationAccounts, integrationSyncJobs,
  type IntegrationProvider, type InsertIntegrationProvider,
  type IntegrationAccount, type InsertIntegrationAccount,
  type IntegrationSyncJob, type InsertIntegrationSyncJob
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { encryptCredentials, decryptCredentials } from "../utils/crypto";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('IntegrationRepository');

export class IntegrationProviderRepository extends BaseRepository<IntegrationProvider, InsertIntegrationProvider> {
  constructor() {
    super('IntegrationProvider');
  }

  protected getTable() {
    return integrationProviders;
  }

  protected getIdColumn() {
    return integrationProviders.id;
  }

  async getByCode(code: string): Promise<IntegrationProvider | undefined> {
    try {
      const [provider] = await this.db.select().from(integrationProviders).where(eq(integrationProviders.code, code));
      return provider;
    } catch (error) {
      logger.error({ err: error, code }, 'getByCode failed');
      throw error;
    }
  }

  async getAll(category?: string): Promise<IntegrationProvider[]> {
    try {
      if (category) {
        return await this.db.select().from(integrationProviders).where(eq(integrationProviders.category, category));
      }
      return await this.db.select().from(integrationProviders);
    } catch (error) {
      logger.error({ err: error, category }, 'getAll failed');
      throw error;
    }
  }
}

export class IntegrationAccountRepository extends BaseRepository<IntegrationAccount, InsertIntegrationAccount> {
  constructor() {
    super('IntegrationAccount');
  }

  protected getTable() {
    return integrationAccounts;
  }

  protected getIdColumn() {
    return integrationAccounts.id;
  }

  async createWithCredentials(account: InsertIntegrationAccount, credentials?: object): Promise<IntegrationAccount> {
    try {
      let accountData = { ...account };
      if (credentials) {
        const { encrypted, iv } = encryptCredentials(credentials);
        accountData.encryptedCredentials = encrypted;
        accountData.credentialsIv = iv;
      }
      const [newAccount] = await this.db.insert(integrationAccounts).values(accountData).returning();
      return newAccount;
    } catch (error) {
      logger.error({ err: error }, 'createWithCredentials failed');
      throw error;
    }
  }

  async getWithCredentials(id: string): Promise<{ account: IntegrationAccount; credentials: object | null } | undefined> {
    try {
      const [account] = await this.db.select().from(integrationAccounts).where(eq(integrationAccounts.id, id));
      if (!account) return undefined;
      
      let credentials: object | null = null;
      if (account.encryptedCredentials && account.credentialsIv) {
        try {
          credentials = decryptCredentials(account.encryptedCredentials, account.credentialsIv);
        } catch (e) {
          logger.error({ err: e }, 'Failed to decrypt credentials');
        }
      }
      return { account, credentials };
    } catch (error) {
      logger.error({ err: error, id }, 'getWithCredentials failed');
      throw error;
    }
  }

  async getAll(userId?: string): Promise<IntegrationAccount[]> {
    try {
      if (userId) {
        return await this.db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, userId));
      }
      return await this.db.select().from(integrationAccounts);
    } catch (error) {
      logger.error({ err: error, userId }, 'getAll failed');
      throw error;
    }
  }

  async updateWithCredentials(id: string, updates: Partial<InsertIntegrationAccount>, credentials?: object): Promise<IntegrationAccount | undefined> {
    try {
      let updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
      if (credentials) {
        const { encrypted, iv } = encryptCredentials(credentials);
        updateData.encryptedCredentials = encrypted;
        updateData.credentialsIv = iv;
      }
      const [updated] = await this.db.update(integrationAccounts)
        .set(updateData)
        .where(eq(integrationAccounts.id, id))
        .returning();
      return updated;
    } catch (error) {
      logger.error({ err: error, id }, 'updateWithCredentials failed');
      throw error;
    }
  }
}

export class IntegrationSyncJobRepository extends BaseRepository<IntegrationSyncJob, InsertIntegrationSyncJob> {
  constructor() {
    super('IntegrationSyncJob');
  }

  protected getTable() {
    return integrationSyncJobs;
  }

  protected getIdColumn() {
    return integrationSyncJobs.id;
  }

  async getByAccount(accountId: string, limit?: number): Promise<IntegrationSyncJob[]> {
    try {
      let query = this.db.select().from(integrationSyncJobs)
        .where(eq(integrationSyncJobs.accountId, accountId))
        .orderBy(sql`created_at DESC`);
      if (limit) {
        return await query.limit(limit);
      }
      return await query;
    } catch (error) {
      logger.error({ err: error, accountId, limit }, 'getByAccount failed');
      throw error;
    }
  }
}

export const integrationProviderRepository = new IntegrationProviderRepository();
export const integrationAccountRepository = new IntegrationAccountRepository();
export const integrationSyncJobRepository = new IntegrationSyncJobRepository();
