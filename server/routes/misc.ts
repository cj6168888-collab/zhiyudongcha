import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Misc');

import type { Express, Request, Response } from "express";
import { WebSocket } from "ws";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { attachRole, requireMaster, requireAuth, auditAction } from "../middleware/auth";
import { z } from "zod";
import { chatWithDashScope, type ChatMessage } from "../services/dashscope";
import { avatarRecognitionService } from "../services/avatar-recognition";
import { biometricAuthService } from "../services/biometric-auth";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export function registerMiscRoutes(
  app: Express,
  storage: IStorage,
  context: RouteContext
): void {
  const { connectedUsers } = context;

  function broadcastToDevice(deviceId: string, message: Record<string, unknown>) {
    Array.from(connectedUsers.entries()).forEach(([ws, user]) => {
      if (user.deviceId === deviceId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  // ===== Health Check API (for mobile app connection test) =====
  
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "xiaozhi-avatar",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });


  // ===== Phase 2.2: Smart Reminder Scheduler (智能提醒调度器) =====
  import('./reminder-scheduler').then(module => {
    app.use('/api/reminders', attachRole, module.default);
    logger.info('[ReminderScheduler] Routes registered at /api/reminders/*');
  });

  // ===== Phase 2.3: Contract Pipeline (合同草拟管道) =====
  import('./contract-pipeline').then(module => {
    app.use('/api/contracts', attachRole, module.default);
    logger.info('[ContractPipeline] Routes registered at /api/contracts/*');
  });

  // ===== Multi-Format File Parse API =====
  
  const fileParseSchema = z.object({
    fileName: z.string(),
    base64Data: z.string(),
    mimeType: z.string().optional(),
  });

  app.post("/api/files/parse", requireMaster, async (req, res) => {
    try {
      const parsed = fileParseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败" });
      }

      const { fileName, base64Data, mimeType } = parsed.data;
      const { fileIndexer } = await import('../services/omni-archive/file-indexer');
      
      const result = await fileIndexer.parseMultiFormat(fileName, base64Data, mimeType || '');
      
      const hasError = result.metadata?.error || result.metadata?.unsupported;
      const isEmpty = !result.text && result.type !== 'archive';
      
      if (hasError) {
        return res.status(422).json({
          success: false,
          fileName,
          parsedType: result.type,
          error: result.metadata?.error || 'parse_failed',
          message: result.metadata?.message || '文件解析失败',
          metadata: result.metadata,
        });
      }
      
      if (isEmpty && result.type === 'audio') {
        return res.status(422).json({
          success: false,
          fileName,
          parsedType: result.type,
          error: 'requires_realtime_asr',
          message: result.metadata?.message || '音频文件需要通过实时语音识别处理',
          metadata: result.metadata,
        });
      }
      
      res.json({
        success: true,
        fileName,
        parsedType: result.type,
        text: result.text,
        metadata: result.metadata,
        subFiles: result.subFiles?.map(f => ({
          type: f.type,
          textLength: f.text.length,
          metadata: f.metadata,
        })),
      });
    } catch (error) {
      logger.error({ err: error }, '[FileParse] Error');
      res.status(500).json({ error: "文件解析失败" });
    }
  });

  app.post("/api/files/parse-batch", requireMaster, async (req, res) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: "files参数必须是数组" });
      }

      const { fileIndexer } = await import('../services/omni-archive/file-indexer');
      const results = [];
      
      for (const file of files) {
        try {
          const result = await fileIndexer.parseMultiFormat(
            file.fileName || file.name,
            file.base64Data || file.content,
            file.mimeType || file.type || ''
          );
          results.push({
            fileName: file.fileName || file.name,
            success: true,
            parsedType: result.type,
            text: result.text.substring(0, 5000),
            metadata: result.metadata,
          });
        } catch (e) {
          results.push({
            fileName: file.fileName || file.name,
            success: false,
            error: '解析失败',
          });
        }
      }

      res.json({
        success: true,
        totalFiles: files.length,
        parsed: results.filter(r => r.success).length,
        results,
      });
    } catch (error) {
      logger.error({ err: error }, '[FileParseBatch] Error');
      res.status(500).json({ error: "批量文件解析失败" });
    }
  });

  // ===== Entity Extraction API (智能资料收集器) =====
  
  const extractEntitiesSchema = z.object({
    text: z.string().min(1, "文本不能为空"),
    autoHarvest: z.boolean().default(false),
    minConfidence: z.number().min(0).max(1).default(0.5),
    source: z.string().optional(),
  });

  app.post("/api/entities/extract", requireMaster, async (req, res) => {
    try {
      const parsed = extractEntitiesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败", details: parsed.error.errors });
      }

      const { text, autoHarvest, minConfidence, source } = parsed.data;
      const { entityExtractor } = await import('../services/entity-extractor');
      
      if (autoHarvest) {
        const result = await entityExtractor.extractAndHarvest(text, {
          autoConfirm: false,
          source: source || 'CONVERSATION',
          minConfidence,
        });
        
        res.json({
          success: true,
          extraction: {
            persons: result.extraction.persons,
            projects: result.extraction.projects,
            companies: result.extraction.companies,
            contactInfos: result.extraction.contactInfos,
          },
          harvest: result.harvest,
        });
      } else {
        const extraction = await entityExtractor.extractFromText(text);
        
        res.json({
          success: true,
          extraction: {
            persons: extraction.persons,
            projects: extraction.projects,
            companies: extraction.companies,
            contactInfos: extraction.contactInfos,
          },
        });
      }
    } catch (error) {
      logger.error({ err: error }, '[EntityExtract] Error');
      res.status(500).json({ error: "实体提取失败" });
    }
  });

  app.post("/api/entities/harvest", requireMaster, async (req, res) => {
    try {
      const { persons: extractedPersons, autoConfirm, source } = req.body;
      
      if (!Array.isArray(extractedPersons)) {
        return res.status(400).json({ error: "persons参数必须是数组" });
      }

      const { entityExtractor } = await import('../services/entity-extractor');
      
      const result = await entityExtractor.createPersonsFromExtraction(
        { persons: extractedPersons, projects: [], companies: [], contactInfos: [], rawEntities: [] },
        { autoConfirm: autoConfirm || false, source: source || 'MANUAL_HARVEST' }
      );
      
      res.json({
        success: true,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        persons: result.persons,
      });
    } catch (error) {
      logger.error({ err: error }, '[EntityHarvest] Error');
      res.status(500).json({ error: "联系人收割失败" });
    }
  });

}
