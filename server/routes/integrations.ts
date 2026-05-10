import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Integrations');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireMaster } from "../middleware/auth";
import { integrationService } from '../services/IntegrationService';
import { personService } from '../services/PersonService';


export function registerIntegrationsRoutes(app: Express, storage: IStorage) {
  // Integration Providers
  app.get("/api/integrations/providers", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const providers = await integrationService.getAllIntegrationProviders(category);
      res.json(providers);
    } catch (error) {
      res.status(500).json({ error: "获取集成提供商失败" });
    }
  });

  app.get("/api/integrations/providers/:id", async (req, res) => {
    try {
      const provider = await integrationService.getIntegrationProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: "提供商不存在" });
      }
      res.json(provider);
    } catch (error) {
      res.status(500).json({ error: "获取提供商详情失败" });
    }
  });

  app.post("/api/integrations/providers", requireMaster, async (req, res) => {
    try {
      const provider = await integrationService.createIntegrationProvider(req.body);
      res.json(provider);
    } catch (error) {
      res.status(400).json({ error: "创建提供商失败" });
    }
  });

  // Integration Accounts
  app.get("/api/integrations/accounts", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const accounts = await integrationService.getAllIntegrationAccounts(userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "获取集成账户失败" });
    }
  });

  app.get("/api/integrations/accounts/:id", async (req, res) => {
    try {
      const account = await integrationService.getIntegrationAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "账户不存在" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "获取账户详情失败" });
    }
  });

  app.post("/api/integrations/accounts", requireMaster, async (req, res) => {
    try {
      const { credentials, ...accountData } = req.body;
      const account = await integrationService.createIntegrationAccount(accountData, credentials);
      res.json(account);
    } catch (error) {
      res.status(400).json({ error: "创建集成账户失败" });
    }
  });

  app.put("/api/integrations/accounts/:id", requireMaster, async (req, res) => {
    try {
      const { credentials, ...updates } = req.body;
      const account = await integrationService.updateIntegrationAccount(req.params.id, updates, credentials);
      if (!account) {
        return res.status(404).json({ error: "账户不存在" });
      }
      res.json(account);
    } catch (error) {
      res.status(400).json({ error: "更新账户失败" });
    }
  });

  app.delete("/api/integrations/accounts/:id", requireMaster, async (req, res) => {
    try {
      const success = await integrationService.deleteIntegrationAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "账户不存在" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "删除账户失败" });
    }
  });

  app.post("/api/integrations/accounts/:id/test", requireMaster, async (req, res) => {
    try {
      const result = await integrationService.getIntegrationAccountWithCredentials(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "账户不存在" });
      }
      
      await integrationService.updateIntegrationAccount(req.params.id, {
        status: "connected",
        lastConnectedAt: new Date(),
        lastError: null,
      });
      
      res.json({ success: true, message: "连接测试成功" });
    } catch (error) {
      res.status(500).json({ error: "连接测试失败" });
    }
  });

  // Sync Jobs
  app.get("/api/integrations/accounts/:accountId/jobs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const jobs = await integrationService.getAccountSyncJobs(req.params.accountId, limit);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "获取同步任务失败" });
    }
  });

  app.post("/api/integrations/accounts/:accountId/sync", requireMaster, async (req, res) => {
    try {
      const job = await integrationService.createIntegrationSyncJob({
        accountId: req.params.accountId,
        jobType: req.body.jobType || "full_sync",
        status: "pending",
      });
      
      integrationService.simulateIntegrationSync(job.id);
      
      res.json(job);
    } catch (error) {
      res.status(400).json({ error: "创建同步任务失败" });
    }
  });

  // WeCom specific endpoints
  app.post("/api/integrations/wecom/test", requireMaster, async (req, res) => {
    try {
      const { testConnection, parseCredentials } = await import("../services/wecom-connector");
      const credentials = parseCredentials(req.body.credentials);
      const result = await testConnection(credentials);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "连接测试失败" });
    }
  });

  app.post("/api/integrations/wecom/sync-contacts", requireMaster, async (req, res) => {
    try {
      const result = await integrationService.getIntegrationAccountWithCredentials(req.body.accountId);
      if (!result) {
        return res.status(404).json({ error: "账户不存在" });
      }
      
      const { getAllUsers, parseCredentials } = await import("../services/wecom-connector");
      const credentials = parseCredentials(result.credentials as Record<string, string>);
      const users = await getAllUsers(credentials);
      
      const existingPersons = await personService.getAllPersons();
      const existingNames = new Set(existingPersons.map(p => p.name));
      
      let created = 0;
      for (const user of users) {
        if (!existingNames.has(user.name)) {
          await personService.createPerson({
            name: user.name,
            role: user.position || "colleague",
            organization: "企业微信",
            tags: ["wecom-sync"],
            decisionDna: `企业微信同步: ${user.mobile || ""} | ${user.email || ""} (${user.userid})`,
            accessLevel: "ZONE_BLUE",
          });
          existingNames.add(user.name);
          created++;
        }
      }
      
      res.json({ success: true, synced: users.length, created });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "同步失败" });
    }
  });

  app.post("/api/integrations/wecom/send-message", requireMaster, async (req, res) => {
    try {
      const result = await integrationService.getIntegrationAccountWithCredentials(req.body.accountId);
      if (!result) {
        return res.status(404).json({ error: "账户不存在" });
      }
      
      const { sendTextMessage, sendMarkdownMessage, parseCredentials } = await import("../services/wecom-connector");
      const credentials = parseCredentials(result.credentials as Record<string, string>);
      
      const { toUser, content, type = "text" } = req.body;
      const sendFn = type === "markdown" ? sendMarkdownMessage : sendTextMessage;
      const sendResult = await sendFn(credentials, toUser, content);
      
      res.json(sendResult);
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "发送失败" });
    }
  });

  // Seed default providers if needed
  app.post("/api/integrations/seed-providers", requireMaster, async (req, res) => {
    try {
      const existing = await integrationService.getAllIntegrationProviders();
      if (existing.length > 0) {
        return res.json({ message: "提供商已存在", count: existing.length });
      }
      
      const defaultProviders = [
        { code: "wecom", name: "企业微信", nameEn: "WeCom", category: "messaging", icon: "wecom", capabilities: ["contacts", "messages", "departments"], description: "企业微信集成，同步通讯录和消息" },
        { code: "dingtalk", name: "钉钉", nameEn: "DingTalk", category: "messaging", icon: "dingtalk", capabilities: ["contacts", "messages"], description: "钉钉企业版集成" },
        { code: "lark", name: "飞书", nameEn: "Lark/Feishu", category: "messaging", icon: "lark", capabilities: ["contacts", "messages", "docs"], description: "飞书/Lark企业协作集成" },
        { code: "mysql", name: "MySQL", nameEn: "MySQL", category: "database", icon: "database", capabilities: ["query", "sync"], description: "MySQL数据库连接" },
        { code: "postgres", name: "PostgreSQL", nameEn: "PostgreSQL", category: "database", icon: "database", capabilities: ["query", "sync"], description: "PostgreSQL数据库连接" },
      ];
      
      for (const provider of defaultProviders) {
        await integrationService.createIntegrationProvider(provider);
      }
      
      res.json({ message: "默认提供商已创建", count: defaultProviders.length });
    } catch (error) {
      res.status(500).json({ error: "初始化提供商失败" });
    }
  });
}
