import type { Express, Request, Response } from "express";
import type { IStorage } from "../storage";
import { requireMaster } from "../middleware/auth";
import { taskExtractor } from "../services/task-extractor";

export async function registerTaskExtractorRoutes(app: Express, storage: IStorage): Promise<void> {

  app.post("/api/task-extractor/from-email/:emailId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;
      const email = await storage.getEmail(emailId);
      
      if (!email) {
        return res.status(404).json({ error: "邮件不存在" });
      }
      
      const result = await taskExtractor.extractFromEmail(email);
      res.json(result);
    } catch (error) {
      console.error('[TaskExtractor Route] Email extraction failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "提取任务失败" });
    }
  });

  app.post("/api/task-extractor/from-text", requireMaster, async (req: Request, res: Response) => {
    try {
      const { text, sourceType, sourceId, sender } = req.body;
      
      if (!text || !sourceType || !sourceId) {
        return res.status(400).json({ error: "请提供text, sourceType和sourceId" });
      }
      
      if (!['chat', 'document', 'voice'].includes(sourceType)) {
        return res.status(400).json({ error: "sourceType必须是chat/document/voice之一" });
      }
      
      const result = await taskExtractor.extractFromText(text, sourceType, sourceId, sender);
      res.json(result);
    } catch (error) {
      console.error('[TaskExtractor Route] Text extraction failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "提取任务失败" });
    }
  });

  app.post("/api/task-extractor/batch-from-emails", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailIds } = req.body;
      
      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        return res.status(400).json({ error: "请提供邮件ID列表" });
      }
      
      if (emailIds.length > 20) {
        return res.status(400).json({ error: "单次最多处理20封邮件" });
      }
      
      const emails = [];
      for (const id of emailIds) {
        const email = await storage.getEmail(id);
        if (email) emails.push(email);
      }
      
      const results = await taskExtractor.batchExtractFromEmails(emails);
      const summary = taskExtractor.generateTaskSummary(results);
      
      res.json({ results, summary });
    } catch (error) {
      console.error('[TaskExtractor Route] Batch extraction failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "批量提取失败" });
    }
  });

  app.post("/api/task-extractor/create-calendar-events", requireMaster, async (req: Request, res: Response) => {
    try {
      const { tasks } = req.body;
      
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: "请提供任务列表" });
      }
      
      const parsedTasks = tasks.map(t => ({
        ...t,
        suggestedDeadline: t.suggestedDeadline ? new Date(t.suggestedDeadline) : null,
        extractedAt: t.extractedAt ? new Date(t.extractedAt) : new Date(),
      }));
      
      const result = await taskExtractor.extractAndCreateCalendarEvents(parsedTasks);
      res.json(result);
    } catch (error) {
      console.error('[TaskExtractor Route] Create calendar events failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "创建日历事件失败" });
    }
  });
}
