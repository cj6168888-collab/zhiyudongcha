import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { createServiceLogger } from '../lib/logger';
import { requireAuth, auditAction } from "../middleware/auth";
import { z } from "zod";
import { zeroHallucinationService, type ZeroHallucinationRequest } from "../services/zero-hallucination";
import { type ProfessionalMode, type UserRole } from "../config/persona";

const logger = createServiceLogger('ProfessionalRoutes');

const professionalQuerySchema = z.object({
  query: z.string().min(1, "查询内容不能为空"),
  mode: z.enum(['LEGAL', 'FINANCE']),
  context: z.string().optional(),
  attachedDocuments: z.array(z.string()).optional(),
});

export function registerProfessionalRoutes(
  app: Express,
  _storage: IStorage,
  _context: RouteContext
): void {

  app.post("/api/professional/query", requireAuth, async (req, res) => {
    try {
      const parseResult = professionalQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "请求参数无效", 
          details: parseResult.error.flatten() 
        });
      }

      const { query, mode, context, attachedDocuments } = parseResult.data;
      const userRole = (req.userRole || 'MASTER') as UserRole;
      
      logger.info(`[ZeroHallucination] Processing ${mode} query for ${userRole}`);

      const request: ZeroHallucinationRequest = {
        query,
        mode: mode as ProfessionalMode,
        userRole,
        context,
        attachedDocuments,
      };

      const result = await zeroHallucinationService.processQuery(request);

      await auditAction('PROFESSIONAL_QUERY', userRole, 'professional', mode,
        { 
          success: result.success, 
          isRefused: result.response.isRefused,
          confidenceScore: result.response.confidenceScore,
          processingTimeMs: result.processingTimeMs,
        }, 
        result.success ? 'SUCCESS' : 'FAILED', req
      );

      res.json({
        success: result.success,
        response: result.response,
        cotSteps: result.cotSteps,
        processingTimeMs: result.processingTimeMs,
      });
    } catch (error) {
      logger.error({ err: error }, '[ZeroHallucination] Query error');
      res.status(500).json({ error: "专业查询处理失败，请稍后重试" });
    }
  });

  app.post("/api/professional/confidence-check", requireAuth, async (req, res) => {
    try {
      const checkSchema = z.object({
        query: z.string().min(1),
        mode: z.enum(['LEGAL', 'FINANCE']),
      });
      
      const parseResult = checkSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "请求参数无效" });
      }

      const { query, mode } = parseResult.data;
      const result = await zeroHallucinationService.quickConfidenceCheck(
        query, 
        mode as ProfessionalMode
      );

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, '[ZeroHallucination] Confidence check error');
      res.status(500).json({ error: "置信度检查失败" });
    }
  });

  app.get("/api/professional/config", requireAuth, async (req, res) => {
    try {
      res.json({
        confidenceThreshold: 0.90,
        supportedModes: ['LEGAL', 'FINANCE'],
        chainOfThoughtSteps: ['DATA_RETRIEVAL', 'CONFIDENCE_CHECK', 'SOURCE_CITATION'],
        description: '零幻觉回路 - 确保法务/财务人格绝对诚实',
      });
    } catch (error) {
      res.status(500).json({ error: "获取配置失败" });
    }
  });

  logger.info('[Professional] Routes registered at /api/professional/*');
}
