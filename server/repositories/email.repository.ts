import { eq, sql, type SQL } from "drizzle-orm";
import { getDatabase } from "../db";
import { 
  emailAccounts, emails, emailAttachments,
  type EmailAccount, type InsertEmailAccount,
  type Email, type InsertEmail,
  type EmailAttachment, type InsertEmailAttachment
} from "@shared/schema";
import { BaseRepository } from "./base.repository";
import { encryptCredentials, decryptCredentials } from "../utils/crypto";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('EmailRepository');

export class EmailAccountRepository extends BaseRepository<EmailAccount, InsertEmailAccount> {
  constructor() {
    super('EmailAccount');
  }

  protected getTable() {
    return emailAccounts;
  }

  protected getIdColumn() {
    return emailAccounts.id;
  }

  async createWithPassword(account: InsertEmailAccount, password?: string): Promise<EmailAccount> {
    try {
      let accountData = { ...account };
      if (password) {
        const { encrypted, iv } = encryptCredentials({ password });
        accountData.encryptedPassword = encrypted;
        accountData.passwordIv = iv;
      }
      const [newAccount] = await this.db.insert(emailAccounts).values(accountData).returning();
      return newAccount;
    } catch (error) {
      logger.error({ err: error }, 'createWithPassword failed');
      throw error;
    }
  }

  async getWithPassword(id: string): Promise<{ account: EmailAccount; password: string | null } | undefined> {
    try {
      const [account] = await this.db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
      if (!account) return undefined;
      
      let password: string | null = null;
      if (account.encryptedPassword && account.passwordIv) {
        try {
          const decrypted = decryptCredentials(account.encryptedPassword, account.passwordIv) as { password: string };
          password = decrypted.password;
        } catch (e) {
          logger.error({ err: e }, 'Failed to decrypt email password');
        }
      }
      return { account, password };
    } catch (error) {
      logger.error({ err: error, id }, 'getWithPassword failed');
      throw error;
    }
  }

  async getAll(userId?: string): Promise<EmailAccount[]> {
    try {
      if (userId) {
        return await this.db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
      }
      return await this.db.select().from(emailAccounts);
    } catch (error) {
      logger.error({ err: error, userId }, 'getAll failed');
      throw error;
    }
  }

  async updateWithPassword(id: string, updates: Partial<InsertEmailAccount>, password?: string): Promise<EmailAccount | undefined> {
    try {
      let updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
      if (password) {
        const { encrypted, iv } = encryptCredentials({ password });
        updateData.encryptedPassword = encrypted;
        updateData.passwordIv = iv;
      }
      const [updated] = await this.db.update(emailAccounts)
        .set(updateData)
        .where(eq(emailAccounts.id, id))
        .returning();
      return updated;
    } catch (error) {
      logger.error({ err: error, id }, 'updateWithPassword failed');
      throw error;
    }
  }

  async deleteWithEmails(id: string): Promise<boolean> {
    try {
      await this.db.delete(emails).where(eq(emails.accountId, id));
      const result = await this.db.delete(emailAccounts).where(eq(emailAccounts.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error({ err: error, id }, 'deleteWithEmails failed');
      throw error;
    }
  }
}

export class EmailRepository extends BaseRepository<Email, InsertEmail> {
  constructor() {
    super('Email');
  }

  protected getTable() {
    return emails;
  }

  protected getIdColumn() {
    return emails.id;
  }

  async getByMessageId(accountId: string, messageId: string): Promise<Email | undefined> {
    try {
      const results = await this.db.select().from(emails)
        .where(sql`${emails.accountId} = ${accountId} AND ${emails.messageId} = ${messageId}`);
      return results[0];
    } catch (error) {
      logger.error({ err: error, accountId, messageId }, 'getByMessageId failed');
      throw error;
    }
  }

  async getByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]> {
    try {
      let query = this.db.select().from(emails)
        .where(folder 
          ? sql`${emails.accountId} = ${accountId} AND ${emails.folder} = ${folder}`
          : eq(emails.accountId, accountId)
        )
        .orderBy(sql`received_at DESC`);
      if (limit) {
        return await query.limit(limit);
      }
      return await query;
    } catch (error) {
      logger.error({ err: error, accountId, folder, limit }, 'getByAccount failed');
      throw error;
    }
  }

  async getByCategory(accountId: string, category: string): Promise<Email[]> {
    try {
      return await this.db.select().from(emails)
        .where(sql`${emails.accountId} = ${accountId} AND ${emails.category} = ${category}`)
        .orderBy(sql`received_at DESC`);
    } catch (error) {
      logger.error({ err: error, accountId, category }, 'getByCategory failed');
      throw error;
    }
  }

  async getAllWithFilters(options?: { 
    category?: string; 
    importance?: string; 
    isRead?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Email[]> {
    try {
      const conditions: SQL[] = [];
      
      if (options?.category) {
        conditions.push(sql`${emails.category} = ${options.category}`);
      }
      if (options?.importance) {
        conditions.push(sql`${emails.importance} = ${options.importance}`);
      }
      if (options?.isRead !== undefined) {
        conditions.push(sql`${emails.isRead} = ${options.isRead}`);
      }
      
      let query = this.db.select().from(emails);
      
      if (conditions.length > 0) {
        const combinedCondition = conditions.reduce((acc, cond, idx) => 
          idx === 0 ? cond : sql`${acc} AND ${cond}`
        );
        query = query.where(combinedCondition) as typeof query;
      }
      
      query = query.orderBy(sql`received_at DESC`) as typeof query;
      
      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as typeof query;
      }
      
      return await query;
    } catch (error) {
      logger.error({ err: error, options }, 'getAllWithFilters failed');
      throw error;
    }
  }

  async deleteWithAttachments(id: string): Promise<boolean> {
    try {
      await this.db.delete(emailAttachments).where(eq(emailAttachments.emailId, id));
      const result = await this.db.delete(emails).where(eq(emails.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error({ err: error, id }, 'deleteWithAttachments failed');
      throw error;
    }
  }

  async getStats(): Promise<{ unreadCount: number; invoiceCount: number; totalEmails: number }> {
    try {
      const allEmails = await this.db.select().from(emails);
      const unreadCount = allEmails.filter(e => !e.isRead).length;
      const invoiceCount = allEmails.filter(e => e.category === 'invoice').length;
      return { unreadCount, invoiceCount, totalEmails: allEmails.length };
    } catch (error) {
      logger.error({ err: error }, 'getStats failed');
      throw error;
    }
  }
}

export class EmailAttachmentRepository extends BaseRepository<EmailAttachment, InsertEmailAttachment> {
  constructor() {
    super('EmailAttachment');
  }

  protected getTable() {
    return emailAttachments;
  }

  protected getIdColumn() {
    return emailAttachments.id;
  }

  async getByEmail(emailId: string): Promise<EmailAttachment[]> {
    try {
      return await this.db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
    } catch (error) {
      logger.error({ err: error, emailId }, 'getByEmail failed');
      throw error;
    }
  }
}

export const emailAccountRepository = new EmailAccountRepository();
export const emailRepository = new EmailRepository();
export const emailAttachmentRepository = new EmailAttachmentRepository();
