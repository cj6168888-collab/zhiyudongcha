import type { Express, Request, Response } from "express";
import type { IStorage } from "../storage";
import { requireMaster } from "../middleware/auth";

export async function registerEmailRoutes(app: Express, storage: IStorage): Promise<void> {
  const { 
    EMAIL_PROVIDERS, 
    detectEmailProvider, 
    getProviderByCode, 
    emailService, 
    EMAIL_CATEGORIES, 
    sendEmailReply 
  } = await import("../services/email-service");

  app.get("/api/email/providers", async (req: Request, res: Response) => {
    res.json(EMAIL_PROVIDERS.map(p => ({
      code: p.code,
      name: p.name,
      domains: p.domains,
      instructions: p.instructions,
      instructionsEn: p.instructionsEn,
    })));
  });

  app.get("/api/email/categories", async (req: Request, res: Response) => {
    res.json(EMAIL_CATEGORIES);
  });

  app.post("/api/email/detect-provider", async (req: Request, res: Response) => {
    const { email } = req.body;
    const provider = detectEmailProvider(email);
    if (provider) {
      res.json({
        code: provider.code,
        name: provider.name,
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        instructions: provider.instructions,
      });
    } else {
      res.json(null);
    }
  });

  app.get("/api/email/accounts", async (req: Request, res: Response) => {
    try {
      const userId = "master";
      const accounts = await storage.getAllEmailAccounts(userId);
      res.json(accounts.map(a => ({
        ...a,
        encryptedPassword: undefined,
        passwordIv: undefined,
      })));
    } catch (error) {
      res.status(500).json({ error: "获取邮箱账户失败" });
    }
  });

  app.post("/api/email/accounts", requireMaster, async (req: Request, res: Response) => {
    try {
      const { email, displayName, provider, password, imapHost, imapPort, smtpHost, smtpPort } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "邮箱地址和密码/授权码必填" });
      }
      
      const detectedProvider = detectEmailProvider(email);
      const finalProvider = provider || detectedProvider?.code || 'custom';
      const providerConfig = getProviderByCode(finalProvider);
      
      const account = await storage.createEmailAccount({
        userId: "master",
        email,
        displayName: displayName || email.split('@')[0],
        provider: finalProvider,
        imapHost: imapHost || providerConfig?.imapHost || '',
        imapPort: imapPort || providerConfig?.imapPort || 993,
        smtpHost: smtpHost || providerConfig?.smtpHost || '',
        smtpPort: smtpPort || providerConfig?.smtpPort || 465,
        status: 'active',
      }, password);
      
      res.json({ 
        success: true, 
        account: { ...account, encryptedPassword: undefined, passwordIv: undefined } 
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "添加邮箱失败" });
    }
  });

  app.put("/api/email/accounts/:id", requireMaster, async (req: Request, res: Response) => {
    try {
      const { password, ...updates } = req.body;
      const account = await storage.updateEmailAccount(req.params.id, updates, password);
      if (!account) {
        return res.status(404).json({ error: "账户不存在" });
      }
      res.json({ success: true, account: { ...account, encryptedPassword: undefined, passwordIv: undefined } });
    } catch (error) {
      res.status(500).json({ error: "更新邮箱失败" });
    }
  });

  app.delete("/api/email/accounts/:id", requireMaster, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteEmailAccount(req.params.id);
      res.json({ success: deleted });
    } catch (error) {
      res.status(500).json({ error: "删除邮箱失败" });
    }
  });

  app.post("/api/email/accounts/:id/sync", requireMaster, async (req: Request, res: Response) => {
    try {
      const { limit = 50 } = req.body;
      const result = await emailService.syncAccount(req.params.id, limit);
      
      if (result.importantEmails.length > 0) {
        const summary = emailService.generateEmailSummary(result.importantEmails);
        res.json({ ...result, summary });
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error('[Email Sync] Route error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "同步失败" });
    }
  });

  app.post("/api/email/sync-all", requireMaster, async (req: Request, res: Response) => {
    try {
      const userId = "master";
      const result = await emailService.syncAllAccounts(userId);
      
      if (result.allImportantEmails.length > 0) {
        const summary = emailService.generateEmailSummary(result.allImportantEmails);
        res.json({ ...result, summary });
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error('[Email Sync All] Route error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "同步失败" });
    }
  });

  app.get("/api/email/accounts/:id/emails", async (req: Request, res: Response) => {
    try {
      const { folder, category, limit } = req.query;
      let emails;
      
      if (category) {
        emails = await storage.getEmailsByCategory(req.params.id, category as string);
      } else {
        emails = await storage.getEmailsByAccount(
          req.params.id, 
          folder as string, 
          limit ? parseInt(limit as string) : undefined
        );
      }
      
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: "获取邮件失败" });
    }
  });

  app.get("/api/email/messages", async (req: Request, res: Response) => {
    try {
      const { category, importance, unread, limit, offset } = req.query;
      const emails = await storage.getAllEmails({
        category: category as string,
        importance: importance as string,
        isRead: unread === 'true' ? false : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: "获取邮件失败" });
    }
  });

  app.get("/api/email/messages/:id", async (req: Request, res: Response) => {
    try {
      const email = await storage.getEmail(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "邮件不存在" });
      }
      const attachments = await storage.getEmailAttachments(req.params.id);
      res.json({ ...email, attachments });
    } catch (error) {
      res.status(500).json({ error: "获取邮件失败" });
    }
  });

  app.get("/api/email/stats", async (req: Request, res: Response) => {
    try {
      const stats = await emailService.getEmailStats("master");
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "获取统计失败" });
    }
  });

  app.post("/api/email/:id/read", async (req: Request, res: Response) => {
    try {
      const email = await storage.updateEmail(req.params.id, { isRead: true });
      res.json({ success: true, email });
    } catch (error) {
      res.status(500).json({ error: "标记失败" });
    }
  });

  app.post("/api/email/:id/category", async (req: Request, res: Response) => {
    try {
      const { category } = req.body;
      const email = await storage.updateEmail(req.params.id, { category });
      res.json({ success: true, email });
    } catch (error) {
      res.status(500).json({ error: "更新分类失败" });
    }
  });

  app.get("/api/email/attachments/:id/download", async (req: Request, res: Response) => {
    try {
      const attachment = await storage.getEmailAttachment(req.params.id);
      if (!attachment) {
        return res.status(404).json({ error: "附件不存在" });
      }
      
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      
      if (attachment.storagePath) {
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.resolve(attachment.storagePath);
        
        if (fs.existsSync(filePath)) {
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
        } else {
          res.status(404).json({ error: "附件文件不存在" });
        }
      } else {
        res.status(404).json({ error: "附件内容不可用" });
      }
    } catch (error) {
      console.error("Download attachment error:", error);
      res.status(500).json({ error: "下载附件失败" });
    }
  });

  app.post("/api/email/:id/reply", requireMaster, async (req: Request, res: Response) => {
    try {
      const { body, isHtml } = req.body;
      if (!body) {
        return res.status(400).json({ error: "回复内容不能为空" });
      }
      
      const email = await storage.getEmail(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "邮件不存在" });
      }
      
      const account = await storage.getEmailAccount(email.accountId);
      if (!account) {
        return res.status(404).json({ error: "邮箱账户不存在" });
      }
      
      const result = await sendEmailReply({
        accountId: account.id,
        to: email.fromEmail || '',
        subject: `Re: ${email.subject || ''}`,
        body,
        isHtml: isHtml || false,
        inReplyTo: email.messageId,
        references: email.messageId,
      });
      
      res.json({ success: true, messageId: result.messageId });
    } catch (error) {
      console.error("Reply email error:", error);
      res.status(500).json({ error: "发送回复失败" });
    }
  });
}
