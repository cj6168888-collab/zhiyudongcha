import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireAuth, auditAction } from '../middleware/auth';
import { z } from 'zod';
import { runExpertAnalysis, runMultiExpertAnalysis, synthesizeExpertOpinions, type ExpertType } from '../services/expert-ai';
import { zeroHallucinationService, type ZeroHallucinationRequest } from '../services/zero-hallucination';
import { type ProfessionalMode, type UserRole } from '../config/persona';

const logger = createServiceLogger('ExpertRoutes');

const expertAnalyzeSchema = z.object({
  expertType: z.enum(['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY']),
  query: z.string().min(1, '查询内容不能为空'),
  context: z.string().optional(),
});

const multiExpertSchema = z.object({
  query: z.string().min(1, '查询内容不能为空'),
  experts: z.array(z.enum(['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'])).optional(),
  context: z.string().optional(),
});

const professionalQuerySchema = z.object({
  query: z.string().min(1, '查询内容不能为空'),
  mode: z.enum(['LEGAL', 'FINANCE']),
  context: z.string().optional(),
  attachedDocuments: z.array(z.string()).optional(),
});

export function registerExpertRoutes(app: Express, _context: RouteContext): void {
  // Enhanced types for request augmentation
  type ReqWithUserRole = Request & { userRole?: string; user?: { id?: string; role?: string } }
  app.get('/api/expert/types', (_req, res) => {
    res.json({
      types: ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'],
      descriptions: {
        LEGAL: '法律顾问 - 合规风险分析',
        FINANCE: '财务分析师 - 投资与财务规划',
        STRATEGY: '策略大师 - 博弈与竞争策略',
        PSYCHOLOGY: '心理专家 - 行为分析与沟通',
        PLANNING: '规划专家 - 项目分解与执行',
        SECRETARY: '私人秘书 - 日程与任务管理',
      },
    });
  });

  app.post('/api/expert/analyze', requireAuth, async (req, res) => {
    try {
      const parseResult = expertAnalyzeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: '请求参数无效',
          details: parseResult.error.flatten(),
        });
      }

      const { expertType, query, context } = parseResult.data;
      logger.info({ expertType }, 'Single expert analysis');

      const analysis = await runExpertAnalysis(expertType as ExpertType, query, context);

      await auditAction('EXPERT_ANALYZE', ((req as unknown) as ReqWithUserRole).userRole || 'MASTER', 'expert', expertType,
        { success: true, expertType, queryLength: query.length }, 'SUCCESS', req
      );

      res.json(analysis);
    } catch (error) {
      logger.error({ err: error }, 'Analysis error');
      res.status(500).json({ error: '专家分析失败，请稍后重试' });
    }
  });

  app.post('/api/expert/multi-analyze', requireAuth, async (req, res) => {
    try {
      const parseResult = multiExpertSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: '请求参数无效',
          details: parseResult.error.flatten(),
        });
      }

      const { query, experts, context } = parseResult.data;
      const selectedExperts = (experts || ['LEGAL', 'FINANCE', 'STRATEGY']) as ExpertType[];

      logger.info({ experts: selectedExperts }, 'Multi-expert analysis');

      const analyses = await runMultiExpertAnalysis(query, selectedExperts, context);
      const synthesis = await synthesizeExpertOpinions(analyses);

      await auditAction('EXPERT_MULTI_ANALYZE', ((req as unknown) as ReqWithUserRole).userRole || 'MASTER', 'expert', 'multi',
        { success: true, experts: selectedExperts, queryLength: query.length }, 'SUCCESS', req
      );

      res.json({
        analyses,
        synthesis,
      });
    } catch (error) {
      logger.error({ err: error }, 'Multi-analysis error');
      res.status(500).json({ error: '多专家分析失败，请稍后重试' });
    }
  });

  app.post('/api/professional/query', requireAuth, async (req, res) => {
    try {
      const parseResult = professionalQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: '请求参数无效',
          details: parseResult.error.flatten(),
        });
      }

      const { query, mode, context, attachedDocuments } = parseResult.data;
      const userRole = (req.userRole || 'MASTER') as UserRole;

      logger.info({ mode, userRole }, 'Processing professional query');

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
      logger.error({ err: error }, 'Professional query error');
      res.status(500).json({ error: '专业查询处理失败，请稍后重试' });
    }
  });

  app.post('/api/professional/confidence-check', requireAuth, async (req, res) => {
    try {
      const checkSchema = z.object({
        query: z.string().min(1),
        mode: z.enum(['LEGAL', 'FINANCE']),
      });

      const parseResult = checkSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: '请求参数无效' });
      }

      const { query, mode } = parseResult.data;
      const result = await zeroHallucinationService.quickConfidenceCheck(
        query,
        mode as ProfessionalMode
      );

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Confidence check error');
      res.status(500).json({ error: '置信度检查失败' });
    }
  });

  app.get('/api/professional/config', requireAuth, async (_req, res) => {
    try {
      res.json({
        modes: ['LEGAL', 'FINANCE'],
        confidenceThreshold: 0.8,
        maxQueryLength: 5000,
        features: {
          chainOfThought: true,
          knowledgeBaseRetrieval: true,
          sourceAttribution: true,
          confidenceScoring: true,
        },
        knowledgeBaseStats: {
          legalEntries: 67,
          financeEntries: 16,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Get config error');
      res.status(500).json({ error: '获取配置失败' });
    }
  });

  logger.info('Expert routes registered');
}
