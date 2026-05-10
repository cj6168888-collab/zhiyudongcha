import type { Express, Request, Response } from "express";
import type { IStorage } from "../storage";
import { requireMaster } from "../middleware/auth";
import { emailIntelligence } from "../services/email-intelligence";

export async function registerEmailIntelligenceRoutes(app: Express, storage: IStorage): Promise<void> {
  
  app.post("/api/email-intelligence/analyze/:emailId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;
      const email = await storage.getEmail(emailId);
      
      if (!email) {
        return res.status(404).json({ error: "邮件不存在" });
      }
      
      const analysis = await emailIntelligence.analyzeEmail(email);
      res.json(analysis);
    } catch (error) {
      console.error('[EmailIntelligence Route] Analysis failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "分析失败" });
    }
  });

  app.get("/api/email-intelligence/quick-insight/:emailId", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;
      const email = await storage.getEmail(emailId);
      
      if (!email) {
        return res.status(404).json({ error: "邮件不存在" });
      }
      
      const insight = await emailIntelligence.generateQuickInsight(email);
      res.json({ insight });
    } catch (error) {
      console.error('[EmailIntelligence Route] Quick insight failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "生成洞察失败" });
    }
  });

  app.post("/api/email-intelligence/batch-analyze", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailIds } = req.body;
      
      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        return res.status(400).json({ error: "请提供邮件ID列表" });
      }
      
      if (emailIds.length > 10) {
        return res.status(400).json({ error: "单次最多分析10封邮件" });
      }
      
      const emails = [];
      for (const id of emailIds) {
        const email = await storage.getEmail(id);
        if (email) emails.push(email);
      }
      
      const results = await emailIntelligence.batchAnalyze(emails);
      
      const analysisArray: any[] = [];
      results.forEach((analysis) => {
        analysisArray.push(analysis);
      });
      
      res.json({ analyses: analysisArray });
    } catch (error) {
      console.error('[EmailIntelligence Route] Batch analysis failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "批量分析失败" });
    }
  });

  app.post("/api/email-intelligence/classify-attachments", requireMaster, async (req: Request, res: Response) => {
    try {
      const { filenames, subject, fromEmail } = req.body;
      
      if (!Array.isArray(filenames) || filenames.length === 0) {
        return res.status(400).json({ error: "请提供附件文件名列表" });
      }
      
      const classifications = await emailIntelligence.classifyAttachments(
        filenames,
        subject || '',
        fromEmail || ''
      );
      
      res.json({ classifications });
    } catch (error) {
      console.error('[EmailIntelligence Route] Attachment classification failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "分类失败" });
    }
  });

  app.delete("/api/email-intelligence/cache/:emailId?", requireMaster, async (req: Request, res: Response) => {
    try {
      const { emailId } = req.params;
      emailIntelligence.clearCache(emailId);
      res.json({ success: true, message: emailId ? `已清除邮件 ${emailId} 的缓存` : "已清除所有缓存" });
    } catch (error) {
      res.status(500).json({ error: "清除缓存失败" });
    }
  });
}
