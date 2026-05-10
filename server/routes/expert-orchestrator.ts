/**
 * 多专家协同编排 API 路由
 * Phase 4.2 - 六脑合一蜂群效应
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ExpertOrchestrator');

import { Router, Request, Response } from 'express';
import { expertOrchestrator } from '../services/expert-orchestrator';
import { runExpertAnalysis, type ExpertType } from '../services/expert-ai';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const router = Router();

router.post('/classify', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供问题 (query)' 
      });
    }
    
    const classification = expertOrchestrator.classifyQuestion(query);
    
    res.json({
      success: true,
      data: classification,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/swarm', async (req: Request, res: Response) => {
  try {
    const { query, context, forceExperts, maxExperts, includeOptional } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供问题 (query)' 
      });
    }
    
    const session = await expertOrchestrator.orchestrateSwarm(query, context, {
      forceExperts,
      maxExperts,
      includeOptional,
    });
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        classification: session.classification,
        arbitration: session.arbitration,
        expertCount: session.analyses.length,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/swarm/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = expertOrchestrator.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: '会话不存在' 
      });
    }
    
    res.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/single', async (req: Request, res: Response) => {
  try {
    const { query, expertType, context, useKnowledgeBase } = req.body;
    
    if (!query || !expertType) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供问题 (query) 和专家类型 (expertType)' 
      });
    }
    
    const validExperts: ExpertType[] = ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'];
    if (!validExperts.includes(expertType)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的专家类型，可选: ${validExperts.join(', ')}` 
      });
    }
    
    const analysis = await runExpertAnalysis(expertType, query, context, { 
      useKnowledgeBase: useKnowledgeBase !== false 
    });
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = expertOrchestrator.getExpertStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const sessions = expertOrchestrator.getSessionHistory(limit);
    
    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        query: s.query.slice(0, 100) + (s.query.length > 100 ? '...' : ''),
        classification: s.classification,
        expertCount: s.analyses.length,
        overallRisk: s.arbitration.overallRisk,
        processingTimeMs: s.arbitration.processingTimeMs,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/decisions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const decisions = await expertOrchestrator.getRecentDecisions(limit);
    
    res.json({
      success: true,
      data: decisions,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/experts', async (_req: Request, res: Response) => {
  try {
    const experts = [
      { type: 'LEGAL', name: '法务专家', description: '合同、劳动法、知识产权、诉讼策略' },
      { type: 'FINANCE', name: '财务专家', description: '税务筹划、财务分析、投资评估' },
      { type: 'STRATEGY', name: '战略专家', description: '竞争分析、博弈论、市场策略' },
      { type: 'PSYCHOLOGY', name: '心理专家', description: '情绪分析、沟通技巧、团队动态' },
      { type: 'PLANNING', name: '规划专家', description: '项目管理、任务分解、时间安排' },
      { type: 'SECRETARY', name: '秘书助理', description: '日程管理、信息整理、协调沟通' },
    ];
    
    res.json({
      success: true,
      data: experts,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/arbitrate', async (req: Request, res: Response) => {
  try {
    const { sessionId, resolution, overrideData } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供会话ID (sessionId)' 
      });
    }
    
    const session = expertOrchestrator.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: '会话不存在' 
      });
    }
    
    const updatedArbitration = {
      ...session.arbitration,
      conflictResolution: resolution || session.arbitration.conflictResolution,
      manualOverride: overrideData ? true : false,
      finalAnswer: overrideData?.finalAnswer || session.arbitration.finalAnswer,
    };
    
    res.json({
      success: true,
      data: updatedArbitration,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
