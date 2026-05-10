/**
 * 小智 Chrysalis API Routes - 化蝶计划API路由
 * Project Chrysalis (化蝶计划) - 自我进化协议
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Chrysalis');

import { Router, Request, Response } from 'express';
import { chrysalisOrchestrator } from '../services/chrysalis-orchestrator';
import { failureCollector } from '../services/failure-collector';
import { retrospectionEngine } from '../services/retrospection-engine';
import { logicFinetuner } from '../services/logic-finetuner';
import { visionEvolver } from '../services/vision-evolver';
import { selfCoder } from '../services/self-coder';
import { morningGift } from '../services/morning-gift';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await chrysalisOrchestrator.getStatus();
    res.json({
      success: true,
      data: status,
      message: '化蝶计划状态',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

router.post('/cycle/start', async (req: Request, res: Response) => {
  try {
    const result = await chrysalisOrchestrator.runFullCycle();
    res.json({
      success: true,
      data: result,
      message: '完整进化周期已完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启动周期失败',
    });
  }
});

router.post('/cycle/partial', async (req: Request, res: Response) => {
  try {
    const { phases } = req.body;
    const result = await chrysalisOrchestrator.runPartialCycle(phases);
    res.json({
      success: true,
      data: result,
      message: '部分进化周期已完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启动部分周期失败',
    });
  }
});

router.get('/failures/stats', async (req: Request, res: Response) => {
  try {
    const stats = await failureCollector.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败统计失败',
    });
  }
});

router.post('/failures/collect', async (req: Request, res: Response) => {
  try {
    const { type, query, reason, correction, context } = req.body;
    
    let failureId: string;
    
    switch (type) {
      case 'UNANSWERED':
        failureId = await failureCollector.collectUnanswered(query, reason, {
          module: context?.module || 'api',
          timestamp: new Date(),
          ...context,
        });
        break;
      case 'EXECUTION_ERROR':
        failureId = await failureCollector.collectExecutionError(query, reason, {
          module: context?.module || 'api',
          timestamp: new Date(),
          ...context,
        });
        break;
      case 'USER_CORRECTION':
        failureId = await failureCollector.collectUserCorrection(query, correction, {
          module: context?.module || 'api',
          timestamp: new Date(),
          ...context,
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '无效的失败类型',
        });
    }
    
    res.json({
      success: true,
      data: { failureId },
      message: '失败案例已收集',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '收集失败',
    });
  }
});

router.post('/failures/scan', async (req: Request, res: Response) => {
  try {
    const chatFailures = await failureCollector.scanChatHistoryForFailures();
    const auditFailures = await failureCollector.scanAuditLogsForFailures();
    
    res.json({
      success: true,
      data: {
        chatFailuresCollected: chatFailures,
        auditFailuresCollected: auditFailures,
        total: chatFailures + auditFailures,
      },
      message: '扫描完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '扫描失败',
    });
  }
});

router.get('/retrospection/status', async (req: Request, res: Response) => {
  try {
    const status = retrospectionEngine.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

router.post('/retrospection/start', async (req: Request, res: Response) => {
  try {
    const result = await retrospectionEngine.startRetrospection();
    res.json({
      success: true,
      data: result,
      message: '复盘会话已完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启动复盘失败',
    });
  }
});

router.get('/retrospection/knowledge', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const knowledge = await retrospectionEngine.getRecentKnowledge(limit);
    res.json({
      success: true,
      data: knowledge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取知识库失败',
    });
  }
});

router.post('/logic/analyze', async (req: Request, res: Response) => {
  try {
    const { days } = req.body;
    const result = await logicFinetuner.analyzeConversations(days || 1);
    res.json({
      success: true,
      data: result,
      message: '逻辑微调完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '分析失败',
    });
  }
});

router.post('/logic/deep-analyze', async (req: Request, res: Response) => {
  try {
    const { context } = req.body;
    const result = await logicFinetuner.deepAnalyzeWithQwen(context);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '深度分析失败',
    });
  }
});

router.get('/logic/tactics', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const tactics = await logicFinetuner.getLearnedTactics(category as string);
    res.json({
      success: true,
      data: tactics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取策略失败',
    });
  }
});

router.post('/vision/evolve', async (req: Request, res: Response) => {
  try {
    const result = await visionEvolver.evolve();
    res.json({
      success: true,
      data: result,
      message: '视觉进化完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '视觉进化失败',
    });
  }
});

router.get('/vision/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = await visionEvolver.getLearnedPatterns();
    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取模式失败',
    });
  }
});

router.post('/vision/teach', async (req: Request, res: Response) => {
  try {
    const { patternType, patternName, rules } = req.body;
    const patternId = await visionEvolver.teachPattern(patternType, patternName, rules);
    res.json({
      success: true,
      data: { patternId },
      message: '模式教学成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '教学失败',
    });
  }
});

router.get('/selfcode/status', async (req: Request, res: Response) => {
  try {
    const status = selfCoder.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

router.post('/selfcode/start', async (req: Request, res: Response) => {
  try {
    const result = await selfCoder.startSelfCodingCycle();
    res.json({
      success: true,
      data: result,
      message: '代码自迭代完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '自迭代失败',
    });
  }
});

router.get('/selfcode/patches', async (req: Request, res: Response) => {
  try {
    const deployed = await selfCoder.getDeployedPatches();
    const pending = await selfCoder.getPendingPatches();
    res.json({
      success: true,
      data: { deployed, pending },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取补丁失败',
    });
  }
});

router.post('/selfcode/rollback/:patchId', async (req: Request, res: Response) => {
  try {
    const { patchId } = req.params;
    const success = await selfCoder.rollbackPatch(patchId);
    res.json({
      success,
      message: success ? '补丁已回滚' : '回滚失败',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '回滚失败',
    });
  }
});

router.get('/morning-gift', async (req: Request, res: Response) => {
  try {
    let gift = await morningGift.getTodayGift();
    
    if (!gift) {
      gift = await morningGift.generateMorningGift();
    }
    
    res.json({
      success: true,
      data: gift,
      message: gift.greeting,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取晨间礼物失败',
    });
  }
});

router.post('/morning-gift/generate', async (req: Request, res: Response) => {
  try {
    const gift = await morningGift.generateMorningGift();
    res.json({
      success: true,
      data: gift,
      message: '晨间礼物已生成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成失败',
    });
  }
});

router.post('/morning-gift/:giftId/read', async (req: Request, res: Response) => {
  try {
    const { giftId } = req.params;
    await morningGift.markAsRead(giftId);
    res.json({
      success: true,
      message: '已标记为已读',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '标记失败',
    });
  }
});

router.get('/morning-gift/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 7;
    const gifts = await morningGift.getRecentGifts(limit);
    res.json({
      success: true,
      data: gifts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取历史失败',
    });
  }
});

export default router;
