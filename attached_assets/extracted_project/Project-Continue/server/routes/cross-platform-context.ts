import type { Express, Request, Response } from "express";
import { requireMaster } from "../middleware/auth";
import { crossPlatformContext } from "../services/cross-platform-context";

export async function registerCrossPlatformContextRoutes(app: Express): Promise<void> {

  app.post("/api/synergy/message", requireMaster, async (req: Request, res: Response) => {
    try {
      const { platform, platformMessageId, contactId, contactName, content, direction, timestamp, messageType, rawContent } = req.body;
      
      if (!platform || !contactId || !contactName || !content) {
        return res.status(400).json({ error: "请提供platform, contactId, contactName和content" });
      }
      
      const message = crossPlatformContext.normalizeMessage(
        platform,
        platformMessageId || `msg_${Date.now()}`,
        contactId,
        contactName,
        content,
        direction || 'incoming',
        timestamp ? new Date(timestamp) : new Date(),
        messageType || 'text',
        rawContent
      );
      
      res.json({ success: true, message });
    } catch (error) {
      console.error('[CrossPlatformContext Route] Add message failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "添加消息失败" });
    }
  });

  app.get("/api/synergy/contacts", requireMaster, async (req: Request, res: Response) => {
    try {
      const contacts = crossPlatformContext.getAllContacts();
      res.json({ contacts });
    } catch (error) {
      res.status(500).json({ error: "获取联系人列表失败" });
    }
  });

  app.get("/api/synergy/contact/:contactId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const context = crossPlatformContext.getContactContext(contactId);
      
      if (!context) {
        return res.status(404).json({ error: "联系人不存在" });
      }
      
      res.json(context);
    } catch (error) {
      res.status(500).json({ error: "获取联系人上下文失败" });
    }
  });

  app.get("/api/synergy/contact/:contactId/messages", requireMaster, async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = crossPlatformContext.getContactMessages(contactId, limit);
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ error: "获取消息失败" });
    }
  });

  app.post("/api/synergy/contact/:contactId/analyze", requireMaster, async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      
      const analysis = await crossPlatformContext.analyzeContactContext(contactId);
      
      if (!analysis) {
        return res.status(404).json({ error: "无法分析该联系人上下文，可能没有消息记录" });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error('[CrossPlatformContext Route] Analyze failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "分析失败" });
    }
  });

  app.post("/api/synergy/reminders", requireMaster, async (req: Request, res: Response) => {
    try {
      const { contactIds } = req.body;
      
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "请提供contactIds列表" });
      }
      
      const analyses = [];
      for (const contactId of contactIds) {
        const analysis = await crossPlatformContext.analyzeContactContext(contactId);
        if (analysis) analyses.push(analysis);
      }
      
      const reminders = crossPlatformContext.generateCrossAppReminder(analyses);
      res.json({ reminders });
    } catch (error) {
      console.error('[CrossPlatformContext Route] Generate reminders failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "生成提醒失败" });
    }
  });

  app.get("/api/synergy/search", requireMaster, async (req: Request, res: Response) => {
    try {
      const { q, platform } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: "请提供搜索关键词q" });
      }
      
      const messages = crossPlatformContext.searchMessages(
        q as string,
        platform as any
      );
      
      res.json({ messages, count: messages.length });
    } catch (error) {
      res.status(500).json({ error: "搜索失败" });
    }
  });

  app.delete("/api/synergy/context/:contactId?", requireMaster, async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      crossPlatformContext.clearContext(contactId);
      res.json({ success: true, message: contactId ? `已清除${contactId}的上下文` : "已清除所有上下文" });
    } catch (error) {
      res.status(500).json({ error: "清除上下文失败" });
    }
  });
}
