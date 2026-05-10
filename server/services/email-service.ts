import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('EmailService');

import { storageAdapter as storage } from '../storage/adapter';
import type { EmailAccount, Email, InsertEmail } from '@shared/schema';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';

export interface EmailProviderConfig {
  code: string;
  name: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  domains: string[];
  instructions: string;
  instructionsEn: string;
}

interface EmailAccountCreateData {
  email: string;
  password?: string;
  provider: string;
  userId: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  [key: string]: unknown;
}

interface EmailAccountUpdateData {
  email?: string;
  password?: string;
  provider?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  [key: string]: unknown;
}

interface EmailQueryOptions {
  accountId?: string;
  folder?: string;
  category?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

interface EmailUpdateData {
  folder?: string;
  category?: string;
  isRead?: boolean;
  isStarred?: boolean;
  [key: string]: unknown;
}

export const EMAIL_PROVIDERS: EmailProviderConfig[] = [
  {
    code: '126',
    name: '网易126邮箱',
    imapHost: 'imap.126.com',
    imapPort: 993,
    smtpHost: 'smtp.126.com',
    smtpPort: 465,
    domains: ['126.com'],
    instructions: '请在网易邮箱设置中开启IMAP服务，并获取授权码（非登录密码）',
    instructionsEn: 'Enable IMAP in NetEase mail settings and get authorization code',
  },
  {
    code: '163',
    name: '网易163邮箱',
    imapHost: 'imap.163.com',
    imapPort: 993,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    domains: ['163.com'],
    instructions: '请在网易邮箱设置中开启IMAP服务，并获取授权码（非登录密码）',
    instructionsEn: 'Enable IMAP in NetEase mail settings and get authorization code',
  },
  {
    code: 'qq',
    name: 'QQ邮箱',
    imapHost: 'imap.qq.com',
    imapPort: 993,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    domains: ['qq.com', 'foxmail.com'],
    instructions: '请在QQ邮箱设置-账户中开启IMAP服务，并获取授权码',
    instructionsEn: 'Enable IMAP in QQ mail settings and get authorization code',
  },
  {
    code: 'gmail',
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    domains: ['gmail.com', 'googlemail.com'],
    instructions: '请在Google账户中启用两步验证并生成应用专用密码',
    instructionsEn: 'Enable 2FA in Google account and generate app-specific password',
  },
  {
    code: 'outlook',
    name: 'Outlook/Hotmail',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    domains: ['outlook.com', 'hotmail.com', 'live.com'],
    instructions: '使用Microsoft账户密码或应用密码',
    instructionsEn: 'Use Microsoft account password or app password',
  },
  {
    code: 'sina',
    name: '新浪邮箱',
    imapHost: 'imap.sina.com',
    imapPort: 993,
    smtpHost: 'smtp.sina.com',
    smtpPort: 465,
    domains: ['sina.com', 'sina.cn'],
    instructions: '请在新浪邮箱设置中开启IMAP服务',
    instructionsEn: 'Enable IMAP in Sina mail settings',
  },
  {
    code: 'sohu',
    name: '搜狐邮箱',
    imapHost: 'imap.sohu.com',
    imapPort: 993,
    smtpHost: 'smtp.sohu.com',
    smtpPort: 465,
    domains: ['sohu.com'],
    instructions: '请在搜狐邮箱设置中开启IMAP服务',
    instructionsEn: 'Enable IMAP in Sohu mail settings',
  },
  {
    code: 'aliyun',
    name: '阿里云邮箱',
    imapHost: 'imap.aliyun.com',
    imapPort: 993,
    smtpHost: 'smtp.aliyun.com',
    smtpPort: 465,
    domains: ['aliyun.com'],
    instructions: '请在阿里云邮箱设置中开启IMAP服务',
    instructionsEn: 'Enable IMAP in Aliyun mail settings',
  },
  {
    code: 'custom',
    name: '自定义IMAP服务器',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 465,
    domains: [],
    instructions: '请提供IMAP服务器地址和端口',
    instructionsEn: 'Provide IMAP server address and port',
  },
];

export function detectEmailProvider(email: string): EmailProviderConfig | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  
  for (const provider of EMAIL_PROVIDERS) {
    if (provider.domains.includes(domain)) {
      return provider;
    }
  }
  
  return EMAIL_PROVIDERS.find(p => p.code === 'custom') || null;
}

export function getProviderByCode(code: string): EmailProviderConfig | null {
  return EMAIL_PROVIDERS.find(p => p.code === code) || null;
}

export async function testEmailConnection(
  email: string,
  password: string,
  imapHost: string,
  imapPort: number
): Promise<{ success: boolean; error?: string }> {
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '连接失败' 
    };
  }
}

export interface EmailCategory {
  code: string;
  name: string;
  nameEn: string;
  icon: string;
  keywords: string[];
}

export const EMAIL_CATEGORIES: EmailCategory[] = [
  {
    code: 'invoice',
    name: '发票',
    nameEn: 'Invoice',
    icon: '🧾',
    keywords: ['发票', '增值税', 'invoice', '税号', '开票'],
  },
  {
    code: 'quotation',
    name: '报价单',
    nameEn: 'Quotation',
    icon: '📋',
    keywords: ['报价', '报价单', 'quotation', 'quote', '价格'],
  },
  {
    code: 'report',
    name: '工作汇报',
    nameEn: 'Work Report',
    icon: '📊',
    keywords: ['汇报', '报告', '周报', '月报', '工作总结', 'report'],
  },
  {
    code: 'travel',
    name: '出差相关',
    nameEn: 'Travel',
    icon: '✈️',
    keywords: ['出差', '机票', '酒店', '行程', 'trip', 'travel', '差旅'],
  },
  {
    code: 'contract',
    name: '合同文件',
    nameEn: 'Contract',
    icon: '📝',
    keywords: ['合同', '协议', 'contract', 'agreement'],
  },
  {
    code: 'notification',
    name: '通知公告',
    nameEn: 'Notification',
    icon: '🔔',
    keywords: ['通知', '公告', '提醒', 'notification', 'alert'],
  },
  {
    code: 'personal',
    name: '个人邮件',
    nameEn: 'Personal',
    icon: '👤',
    keywords: [],
  },
];

export function categorizeEmail(subject: string, bodySnippet: string): string {
  const text = `${subject} ${bodySnippet}`.toLowerCase();
  
  for (const category of EMAIL_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category.code;
      }
    }
  }
  
  return 'personal';
}

export function determineImportance(
  subject: string,
  fromEmail: string,
  hasAttachments: boolean
): 'low' | 'normal' | 'high' | 'urgent' {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes('紧急') || subjectLower.includes('urgent') || subjectLower.includes('asap')) {
    return 'urgent';
  }
  
  if (subjectLower.includes('重要') || subjectLower.includes('important') || 
      subjectLower.includes('发票') || subjectLower.includes('合同')) {
    return 'high';
  }
  
  if (subjectLower.includes('newsletter') || subjectLower.includes('订阅') ||
      subjectLower.includes('推广') || subjectLower.includes('promotion')) {
    return 'low';
  }
  
  return 'normal';
}

export interface SyncResult {
  success: boolean;
  newEmails: number;
  updatedEmails: number;
  errors: string[];
  importantEmails: Email[];
}

export class EmailService {
  async getEmailStats(userId: string): Promise<{
    totalAccounts: number;
    totalEmails: number;
    unreadCount: number;
    invoiceCount: number;
    reportCount: number;
  }> {
    const accounts = await storage.getAllEmailAccounts(userId);
    let totalEmails = 0;
    let unreadCount = 0;
    let invoiceCount = 0;
    let reportCount = 0;
    
    for (const account of accounts) {
      const emails = await storage.getEmailsByAccount(account.id);
      totalEmails += emails.length;
      unreadCount += emails.filter(e => !e.isRead).length;
      invoiceCount += emails.filter(e => e.category === 'invoice').length;
      reportCount += emails.filter(e => e.category === 'report').length;
    }
    
    return {
      totalAccounts: accounts.length,
      totalEmails,
      unreadCount,
      invoiceCount,
      reportCount,
    };
  }
  
  async syncAccount(accountId: string, limit: number = 50): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      newEmails: 0,
      updatedEmails: 0,
      errors: [],
      importantEmails: [],
    };

    try {
      const accountData = await storage.getEmailAccountWithPassword(accountId);
      if (!accountData) {
        result.errors.push('账户不存在');
        return result;
      }

      const { account, password } = accountData;
      if (!password) {
        result.errors.push('授权码未设置');
        return result;
      }

      logger.info(`[Email Sync] Starting sync for ${account.email}`);

      const client = new ImapFlow({
        host: account.imapHost || '',
        port: account.imapPort || 993,
        secure: true,
        auth: {
          user: account.email,
          pass: password,
        },
        logger: false,
      });

      await client.connect();
      logger.info(`[Email Sync] Connected to ${account.imapHost}`);

      const lock = await client.getMailboxLock('INBOX');
      try {
        const existingEmails = await storage.getEmailsByAccount(accountId);
        const existingMessageIds = new Set(existingEmails.map(e => e.messageId));

        let count = 0;
        for await (const message of client.fetch(`1:${limit}`, { 
          envelope: true, 
          source: true,
          flags: true,
          uid: true,
        })) {
          try {
            if (!message.source) continue;
            const parsed = await simpleParser(message.source) as ParsedMail;
            const messageId = parsed.messageId || `${account.email}-${message.uid}`;
            
            if (existingMessageIds.has(messageId)) {
              continue;
            }

            const fromAddress = parsed.from?.value?.[0];
            const toAddresses: string[] = [];
            if (parsed.to) {
              const toArr = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
              for (const addr of toArr) {
                if (addr.value) {
                  for (const a of addr.value) {
                    if (a.address) toAddresses.push(a.address);
                  }
                }
              }
            }
            
            const subject = parsed.subject || '(无主题)';
            const bodyText = parsed.text || '';
            const bodyHtml = typeof parsed.html === 'string' ? parsed.html : '';
            const hasAttachments = (parsed.attachments?.length || 0) > 0;
            
            const category = categorizeEmail(subject, bodyText.substring(0, 500));
            const importance = determineImportance(subject, fromAddress?.address || '', hasAttachments);
            
            const emailData: InsertEmail = {
              accountId,
              messageId,
              folder: 'INBOX',
              subject,
              fromEmail: fromAddress?.address || '',
              fromName: fromAddress?.name || fromAddress?.address || '',
              toEmails: toAddresses,
              receivedAt: parsed.date || new Date(),
              bodyText: bodyText.substring(0, 10000),
              bodyHtml: bodyHtml.substring(0, 50000),
              hasAttachments,
              isRead: message.flags?.has('\\Seen') || false,
              isStarred: message.flags?.has('\\Flagged') || false,
              category,
              importance,
            };

            const newEmail = await storage.createEmail(emailData);
            result.newEmails++;
            count++;

            if (importance === 'high' || importance === 'urgent' || category === 'invoice') {
              result.importantEmails.push(newEmail);
            }

            if (hasAttachments && parsed.attachments) {
              for (const att of parsed.attachments) {
                await storage.createEmailAttachment({
                  emailId: newEmail.id,
                  filename: att.filename || 'attachment',
                  mimeType: att.contentType || 'application/octet-stream',
                  size: att.size || 0,
                });
              }
            }

            if (category === 'invoice') {
              const invoiceData = await this.analyzeEmailForInvoice(newEmail);
              if (invoiceData.hasInvoice && invoiceData.invoiceData) {
                await storage.createInvoice({
                  userId: 'master',
                  sourceType: 'email',
                  sourceId: newEmail.id,
                  invoiceNo: invoiceData.invoiceData.invoiceNo,
                  amount: invoiceData.invoiceData.amount?.toString(),
                  sellerName: invoiceData.invoiceData.sellerName,
                  invoiceDate: invoiceData.invoiceData.invoiceDate ? new Date(invoiceData.invoiceData.invoiceDate) : null,
                  status: 'pending',
                });
              }
            }

            logger.info(`[Email Sync] Synced: ${subject.substring(0, 30)}...`);
          } catch (parseError) {
            logger.error({ err: parseError }, '[Email Sync] Parse error');
            result.errors.push(`解析邮件失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
          }
        }

        await storage.updateEmailAccount(accountId, {
          lastSyncAt: new Date(),
        });

        result.success = true;
        logger.info(`[Email Sync] Completed. New emails: ${result.newEmails}`);
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      logger.error({ err: error }, '[Email Sync] Error');
      result.errors.push(error instanceof Error ? error.message : '同步失败');
      
      await storage.updateEmailAccount(accountId, {
        status: 'error',
      });
    }

    return result;
  }

  async syncAllAccounts(userId: string): Promise<{
    totalNewEmails: number;
    accountResults: { accountId: string; email: string; result: SyncResult }[];
    allImportantEmails: Email[];
  }> {
    const accounts = await storage.getAllEmailAccounts(userId);
    const accountResults: { accountId: string; email: string; result: SyncResult }[] = [];
    let totalNewEmails = 0;
    const allImportantEmails: Email[] = [];

    for (const account of accounts) {
      if (account.status === 'disabled') continue;
      
      const result = await this.syncAccount(account.id);
      accountResults.push({
        accountId: account.id,
        email: account.email,
        result,
      });
      totalNewEmails += result.newEmails;
      allImportantEmails.push(...result.importantEmails);
    }

    return {
      totalNewEmails,
      accountResults,
      allImportantEmails,
    };
  }

  async analyzeEmailForInvoice(email: Email): Promise<{
    hasInvoice: boolean;
    invoiceData?: {
      invoiceNo?: string;
      amount?: number;
      sellerName?: string;
      invoiceDate?: string;
    };
  }> {
    const text = `${email.subject} ${email.bodyText || ''}`;
    
    const invoiceNoMatch = text.match(/发票号[码]?\s*[:：]?\s*(\d{8,20})/);
    const amountMatch = text.match(/金额\s*[:：]?\s*[¥￥]?\s*([\d,]+\.?\d*)/);
    const sellerMatch = text.match(/销售方[名称]?\s*[:：]?\s*([^,，\n]+)/);
    
    if (invoiceNoMatch || (email.category === 'invoice' && email.hasAttachments)) {
      return {
        hasInvoice: true,
        invoiceData: {
          invoiceNo: invoiceNoMatch?.[1],
          amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined,
          sellerName: sellerMatch?.[1]?.trim(),
        },
      };
    }
    
    return { hasInvoice: false };
  }

  generateEmailSummary(emails: Email[]): string {
    if (emails.length === 0) return '没有新邮件';

    const invoices = emails.filter(e => e.category === 'invoice');
    const urgent = emails.filter(e => e.importance === 'urgent');
    const high = emails.filter(e => e.importance === 'high' && e.category !== 'invoice');
    const reports = emails.filter(e => e.category === 'report');

    let summary = `爸爸，您有 ${emails.length} 封新邮件需要关注：\n\n`;

    if (urgent.length > 0) {
      summary += `🚨 紧急邮件 (${urgent.length}封):\n`;
      urgent.forEach(e => {
        summary += `  - ${e.fromName}: ${e.subject}\n`;
      });
      summary += '\n';
    }

    if (invoices.length > 0) {
      summary += `🧾 发票邮件 (${invoices.length}封):\n`;
      invoices.forEach(e => {
        summary += `  - ${e.fromName}: ${e.subject}\n`;
      });
      summary += '\n';
    }

    if (high.length > 0) {
      summary += `⭐ 重要邮件 (${high.length}封):\n`;
      high.forEach(e => {
        summary += `  - ${e.fromName}: ${e.subject}\n`;
      });
      summary += '\n';
    }

    if (reports.length > 0) {
      summary += `📊 工作汇报 (${reports.length}封):\n`;
      reports.forEach(e => {
        summary += `  - ${e.fromName}: ${e.subject}\n`;
      });
    }

    return summary;
  }

  // 账户管理
  async getAllEmailAccounts(userId?: string) {
    return await storage.getAllEmailAccounts(userId);
  }

  async getEmailAccount(id: string) {
    return await storage.getEmailAccount(id);
  }

  async getEmailAccountWithPassword(id: string) {
    return await storage.getEmailAccountWithPassword(id);
  }

  async createEmailAccount(account: EmailAccountCreateData, password?: string) {
    return await storage.createEmailAccount(account, password);
  }

  async updateEmailAccount(id: string, updates: EmailAccountUpdateData, password?: string) {
    return await storage.updateEmailAccount(id, updates, password);
  }

  async deleteEmailAccount(id: string) {
    return await storage.deleteEmailAccount(id);
  }

  // 邮件管理
  async getEmail(id: string) {
    return await storage.getEmail(id);
  }

  async getEmailsByAccount(accountId: string, folder?: string, limit?: number) {
    return await storage.getEmailsByAccount(accountId, folder, limit);
  }

  async getEmailsByCategory(accountId: string, category: string) {
    return await storage.getEmailsByCategory(accountId, category);
  }

  async getAllEmails(options?: EmailQueryOptions) {
    return await storage.getAllEmails(options);
  }

  async updateEmail(id: string, updates: EmailUpdateData) {
    return await storage.updateEmail(id, updates);
  }

  async getEmailAttachments(emailId: string) {
    return await storage.getEmailAttachments(emailId);
  }

  async getEmailAttachment(id: string) {
    return await storage.getEmailAttachment(id);
  }
}

export const emailService = new EmailService();

// 发送邮件回复
export interface SendReplyOptions {
  accountId: string;
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  inReplyTo?: string | null;
  references?: string | null;
}

export async function sendEmailReply(options: SendReplyOptions): Promise<{ messageId: string }> {
  const { storage } = await import('../storage');
  
  const account = await storage.getEmailAccount(options.accountId);
  if (!account || !account.encryptedPassword) {
    throw new Error('邮箱账户不存在或未配置');
  }
  
  // 获取SMTP配置
  const provider = getProviderByCode(account.provider);
  if (!provider) {
    throw new Error('不支持的邮箱类型');
  }
  
  // SMTP发送配置（从IMAP配置推断）
  const smtpHost = provider.imapHost.replace('imap.', 'smtp.');
  const smtpPort = 465; // 大多数邮箱使用SSL
  
  // 使用nodemailer发送
  const nodemailer = await import('nodemailer');
  
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: {
      user: account.email,
      pass: account.encryptedPassword, // 实际使用时应解密
    },
  });
  
  const mailOptions: Record<string, unknown> = {
    from: account.email,
    to: options.to,
    subject: options.subject,
    [options.isHtml ? 'html' : 'text']: options.body,
  };
  
  if (options.inReplyTo) {
    mailOptions.inReplyTo = options.inReplyTo;
  }
  if (options.references) {
    mailOptions.references = options.references;
  }
  
  const info = await transporter.sendMail(mailOptions);
  
  return { messageId: info.messageId || '' };
}
