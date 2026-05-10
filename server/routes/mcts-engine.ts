/**
 * MCTS博弈推演引擎 API 路由 - Phase 11.1
 * 
 * HTTP端点:
 * - GET /api/mcts/scenarios - 获取可用博弈场景
 * - POST /api/mcts/simulate - 运行博弈推演
 * - POST /api/mcts/dream-evolution - 梦境演化推演
 * - GET /api/mcts/history - 获取推演历史
 * - GET /api/mcts/stats - 统计信息
 * - PUT /api/mcts/config - 更新配置
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('MctsEngine');

import type { Express, Request, Response } from 'express';
import { mctsEngine } from '../services/mcts-engine';
import type { RegisterRouteFn } from './types';

export const registerMCTSRoutes: RegisterRouteFn = (app, storage, context) => {

  // 获取可用博弈场景
  app.get('/api/mcts/scenarios', async (req: Request, res: Response) => {
    try {
      const scenarios = mctsEngine.listScenarios();
      res.json({
        scenarios: scenarios.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          description: s.description,
          stakeholders: s.stakeholders.length,
          objectives: s.objectives.length,
        })),
        count: scenarios.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取场景列表失败' });
    }
  });

  // 获取场景详情
  app.get('/api/mcts/scenarios/:id', async (req: Request, res: Response) => {
    try {
      const scenario = mctsEngine.getScenario(req.params.id);
      if (!scenario) {
        return res.status(404).json({ error: '场景不存在' });
      }
      res.json(scenario);
    } catch (error) {
      res.status(500).json({ error: '获取场景详情失败' });
    }
  });

  // 运行博弈推演
  app.post('/api/mcts/simulate', async (req: Request, res: Response) => {
    try {
      const { scenarioId, context, config } = req.body;

      if (!scenarioId) {
        return res.status(400).json({ error: '缺少必要参数: scenarioId' });
      }

      const result = await mctsEngine.runSimulation(scenarioId, context || {}, config);

      res.json({
        success: true,
        result: {
          bestAction: result.bestAction ? {
            type: result.bestAction.type,
            description: result.bestAction.description,
          } : null,
          bestPathLength: result.bestPath.length,
          winProbability: result.winProbability,
          expectedValue: result.expectedValue,
          riskAssessment: result.riskAssessment,
          iterations: result.iterations,
          durationMs: result.durationMs,
          insights: result.insights,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '推演失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 梦境演化推演
  app.post('/api/mcts/dream-evolution', async (req: Request, res: Response) => {
    try {
      const { conversations, decisions, conflicts } = req.body;

      if (!conflicts || !Array.isArray(conflicts)) {
        return res.status(400).json({ error: '缺少必要参数: conflicts' });
      }

      const result = await mctsEngine.runDreamEvolution({
        conversations: conversations || [],
        decisions: decisions || [],
        conflicts,
      });

      res.json({
        success: true,
        scenariosProcessed: result.scenarios.length,
        recommendations: result.recommendations,
        strategicInsights: result.strategicInsights,
        avgWinProbability: result.scenarios.length > 0
          ? result.scenarios.reduce((sum, s) => sum + s.winProbability, 0) / result.scenarios.length
          : 0,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '梦境演化失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取推演历史
  app.get('/api/mcts/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = mctsEngine.getHistory(limit);

      res.json({
        history: history.map(h => ({
          winProbability: h.winProbability,
          riskLevel: h.riskAssessment.level,
          iterations: h.iterations,
          durationMs: h.durationMs,
          insightsCount: h.insights.length,
        })),
        count: history.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取历史失败' });
    }
  });

  // 统计信息
  app.get('/api/mcts/stats', async (req: Request, res: Response) => {
    try {
      const stats = mctsEngine.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.1',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 更新配置
  app.put('/api/mcts/config', async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      mctsEngine.updateConfig(updates);
      res.json({
        success: true,
        message: '配置已更新',
        config: mctsEngine.getStats().config,
      });
    } catch (error) {
      res.status(500).json({ error: '更新配置失败' });
    }
  });

  // 快速推演测试
  app.post('/api/mcts/quick-test', async (req: Request, res: Response) => {
    try {
      const result = await mctsEngine.runSimulation('contract_negotiation', {}, {
        maxIterations: 1000,
        timeoutMs: 30000,
      });

      res.json({
        success: true,
        winProbability: result.winProbability,
        insights: result.insights.slice(0, 3),
        durationMs: result.durationMs,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  logger.info('[MCTS] HTTP路由已注册 /api/mcts/*');
};
