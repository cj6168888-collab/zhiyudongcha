import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';
import type { Email, InsertEmail, EmailAttachment, InsertEmailAttachment } from '@shared/schema';

const logger = createServiceLogger('EmailService');

export class EmailService {
  /**
   * 获取邮件
   */
  async getEmail(id: string): Promise<Email | undefined> {
    return await storage.getEmail(id);
  }

  /**
   * 创建邮件
   */
  async createEmail(email: InsertEmail): Promise<Email> {
    const created = await storage.createEmail(email);
    logger.info({ emailId: created.id, subject: created.subject }, '邮件创建成功');
    return created;
  }

  /**
   * 获取邮件附件
   */
  async getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
    return await storage.getEmailAttachments(emailId);
  }

  /**
   * 获取账户的邮件
   */
  async getEmailsByAccount(accountId: string, folder?: string, limit?: number): Promise<Email[]> {
    return await storage.getEmailsByAccount(accountId, folder, limit);
  }

  /**
   * 获取邮件的分类统计
   */
  async getEmailStats(): Promise<unknown> {
    return await storage.getEmailStats();
  }

  /**
   * 更新邮件
   */
  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined> {
    const updated = await storage.updateEmail(id, updates);
    if (updated) {
      logger.debug({ emailId: id }, '邮件更新成功');
    }
    return updated;
  }

  /**
   * 删除邮件
   */
  async deleteEmail(id: string): Promise<boolean> {
    const success = await storage.deleteEmail(id);
    logger.debug({ emailId: id }, success ? '邮件删除成功' : '邮件删除失败');
    return success;
  }

  /**
   * 获取所有邮件（带过滤器）
   */
  async getAllEmails(options?: {
    accountId?: string;
    category?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<Email[]> {
    return await storage.getAllEmails(options);
  }
}

export const emailService = new EmailService();